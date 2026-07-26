// Fonction serverless Vercel — /api/create-payment-link
// Crée un lien de paiement Stripe pour un acompte (ou solde) de facture.
//
// Si l'entreprise a connecté son propre compte Stripe (Stripe Connect), le
// lien est créé sur CE compte : l'argent du client va directement chez
// l'entreprise, pas sur le compte de la plateforme.
// Sinon (compte non encore connecté), on utilise la clé Stripe de la
// plateforme comme avant (compatibilité pendant la transition).
//
// Une commission plateforme optionnelle peut être prélevée automatiquement
// sur chaque paiement via PLATFORM_FEE_PERCENT (ex. "2" pour 2%). Laisse
// cette variable vide/à 0 si tu ne veux pas de commission.
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

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  try {
    // Cherche si la facture appartient à une entreprise avec un compte Stripe connecté
    let connectedAccountId = null
    if (invoiceId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      const { data: invoice } = await supabaseAdmin
        .from('invoices')
        .select('business_id, businesses(stripe_connect_account_id, stripe_connect_charges_enabled)')
        .eq('id', invoiceId)
        .single()

      if (invoice?.businesses?.stripe_connect_account_id && invoice.businesses.stripe_connect_charges_enabled) {
        connectedAccountId = invoice.businesses.stripe_connect_account_id
      }
    }

    const stripeOptions = connectedAccountId ? { stripeAccount: connectedAccountId } : undefined

    const price = await stripe.prices.create(
      {
        currency: 'eur',
        unit_amount: Math.round(amount * 100), // Stripe attend des centimes
        product_data: {
          name: description || `Facture ${invoiceNumber}`,
        },
      },
      stripeOptions
    )

    const paymentIntentData = {
      metadata: { invoiceNumber: invoiceNumber || '', invoiceId: invoiceId || '' },
    }

    // Commission plateforme optionnelle (uniquement sur les comptes connectés)
    const feePercent = Number(process.env.PLATFORM_FEE_PERCENT || 0)
    if (connectedAccountId && feePercent > 0) {
      paymentIntentData.application_fee_amount = Math.round(amount * 100 * (feePercent / 100))
    }

    const paymentLink = await stripe.paymentLinks.create(
      {
        line_items: [{ price: price.id, quantity: 1 }],
        metadata: { invoiceNumber: invoiceNumber || '', invoiceId: invoiceId || '' },
        payment_intent_data: paymentIntentData,
      },
      stripeOptions
    )

    return res.status(200).json({ url: paymentLink.url, id: paymentLink.id, connected: !!connectedAccountId })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
