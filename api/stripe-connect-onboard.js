// Fonction serverless Vercel — /api/stripe-connect-onboard
// Crée (si besoin) un compte Stripe Connect Express pour l'entreprise, puis
// renvoie un lien d'onboarding hébergé par Stripe où l'utilisateur renseigne
// ses infos bancaires. Une fois terminé, l'argent des paiements clients
// arrive directement sur CE compte, pas sur celui de la plateforme.
//
// Variables d'environnement requises : STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY
//
// ⚠️ Note sécurité pour plus tard : si tu ouvres FacturePro à d'autres
// entreprises payantes, il faudra vérifier ici que la personne qui appelle
// cette fonction est bien authentifiée et propriétaire de businessId (via un
// token Supabase envoyé dans les headers), pas juste faire confiance à
// l'ID envoyé par le frontend. Pour l'instant (toi seul utilisateur), ce
// n'est pas un risque, mais à corriger avant toute ouverture publique.

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const { businessId, returnOrigin } = req.body
  if (!businessId || !returnOrigin) {
    return res.status(400).json({ error: 'Champs manquants' })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  try {
    const { data: business, error: fetchError } = await supabaseAdmin
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single()
    if (fetchError || !business) return res.status(404).json({ error: 'Entreprise introuvable' })

    let accountId = business.stripe_connect_account_id

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'FR',
        email: business.email || undefined,
        business_type: 'individual',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      })
      accountId = account.id
      await supabaseAdmin.from('businesses').update({ stripe_connect_account_id: accountId }).eq('id', businessId)
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${returnOrigin}/parametres?stripe=refresh`,
      return_url: `${returnOrigin}/parametres?stripe=return`,
      type: 'account_onboarding',
    })

    return res.status(200).json({ url: accountLink.url })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
