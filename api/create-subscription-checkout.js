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

  if (!process.env.STRIPE_PRICE_ID) {
    return res.status(500).json({ error: "STRIPE_PRICE_ID n'est pas configuré sur le serveur" })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  try {
    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single()
    if (!business) return res.status(404).json({ error: 'Entreprise introuvable' })

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      customer: business.stripe_customer_id || undefined,
      customer_email: business.stripe_customer_id ? undefined : business.email || undefined,
      client_reference_id: businessId,
      subscription_data: { metadata: { businessId } },
      metadata: { businessId },
      success_url: `${returnOrigin}/?abonnement=succes`,
      cancel_url: `${returnOrigin}/abonnement?annule=1`,
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
