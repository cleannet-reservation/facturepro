// Fonction serverless Vercel — /api/create-payment-link
// Crée un lien de paiement Stripe pour un acompte (ou solde) de facture.
//
// Si l'entreprise a renseigné sa propre clé Stripe secrète (Paramètres →
// Paiements en ligne), le lien est créé sur SON compte Stripe : l'argent du
// client va directement chez elle.
// Sinon (aucune clé personnelle renseignée), on utilise la clé Stripe de la
// plateforme (STRIPE_SECRET_KEY) — c'est le comportement par défaut pour toi.
//
// Variables d'environnement requises : STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const { amount, description, invoiceNumber, invoiceId } = req.body

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Montant invalide' })
  }

  try {
    // Cherche si la facture appartient à une entreprise avec sa propre clé Stripe
    let stripeSecretKey = process.env.STRIPE_SECRET_KEY
    let usingOwnKey = false

    if (invoiceId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      const { data: invoice } = await supabaseAdmin
        .from('invoices')
        .select('business_id, businesses(stripe_secret_key)')
        .eq('id', invoiceId)
        .single()

      if (invoice?.businesses?.stripe_secret_key) {
        stripeSecretKey = invoice.businesses.stripe_secret_key
        usingOwnKey = true
      }
    }

    const stripe = new Stripe(stripeSecretKey)

    const price = await stripe.prices.create({
      currency: 'eur',
      unit_amount: Math.round(amount * 100), // Stripe attend des centimes
      product_data: {
        name: description || `Facture ${invoiceNumber}`,
      },
    })

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { invoiceNumber: invoiceNumber || '', invoiceId: invoiceId || '' },
      payment_intent_data: {
        metadata: { invoiceNumber: invoiceNumber || '', invoiceId: invoiceId || '' },
      },
    })

    return res.status(200).json({ url: paymentLink.url, id: paymentLink.id, usingOwnKey })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
