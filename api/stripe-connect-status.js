// Fonction serverless Vercel — /api/stripe-connect-status?businessId=...
// Vérifie auprès de Stripe si le compte connecté d'une entreprise est prêt
// à recevoir des paiements, et synchronise ce statut dans Supabase.

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const { businessId } = req.query
  if (!businessId) return res.status(400).json({ error: 'businessId manquant' })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  try {
    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('stripe_connect_account_id')
      .eq('id', businessId)
      .single()

    if (!business?.stripe_connect_account_id) {
      return res.status(200).json({ connected: false, chargesEnabled: false })
    }

    const account = await stripe.accounts.retrieve(business.stripe_connect_account_id)

    await supabaseAdmin
      .from('businesses')
      .update({ stripe_connect_charges_enabled: account.charges_enabled })
      .eq('id', businessId)

    return res.status(200).json({
      connected: true,
      chargesEnabled: account.charges_enabled,
      detailsSubmitted: account.details_submitted,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
