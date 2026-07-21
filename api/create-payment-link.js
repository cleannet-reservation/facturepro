// Fonction serverless Vercel — /api/create-payment-link
// Crée un lien de paiement Stripe pour un acompte (ou solde) de facture.
// Utilise ta clé Stripe secrète perso (compte classique, pas Stripe Connect,
// puisque c'est toi l'unique utilisateur pour l'instant).
//
// Variable d'environnement requise sur Vercel : STRIPE_SECRET_KEY

import Stripe from 'stripe'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const { amount, description, invoiceNumber, invoiceId } = req.body

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Montant invalide' })
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

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

    return res.status(200).json({ url: paymentLink.url, id: paymentLink.id })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
