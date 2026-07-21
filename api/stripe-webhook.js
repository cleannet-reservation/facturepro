// Fonction serverless Vercel — /api/stripe-webhook
// Reçoit les événements Stripe (paiement d'acompte/facture confirmé) et met
// à jour automatiquement la facture correspondante dans Supabase, sans
// intervention manuelle.
//
// Variables d'environnement requises sur Vercel :
//   STRIPE_SECRET_KEY       (déjà utilisée pour créer les liens de paiement)
//   STRIPE_WEBHOOK_SECRET   (fournie par Stripe à la création du webhook, voir README)
//   SUPABASE_SERVICE_ROLE_KEY (clé secrète Supabase, jamais exposée au frontend)
//
// IMPORTANT : cette fonction a besoin du corps brut (non parsé) de la requête
// pour vérifier la signature Stripe — d'où bodyParser: false ci-dessous.

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const config = {
  api: { bodyParser: false },
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const rawBody = await readRawBody(req)
  const signature = req.headers['stripe-signature']

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Signature Stripe invalide :', err.message)
    return res.status(400).json({ error: `Webhook signature invalide : ${err.message}` })
  }

  const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const invoiceId = session.metadata?.invoiceId

      if (invoiceId) {
        const amountPaid = (session.amount_total || 0) / 100

        const { data: invoice } = await supabaseAdmin
          .from('invoices')
          .select('*')
          .eq('id', invoiceId)
          .single()

        if (invoice) {
          const alreadyPaid = Number(invoice.deposit_paid || 0) + amountPaid
          const isFullyPaid = alreadyPaid >= Number(invoice.total_ttc) - 0.01

          await supabaseAdmin
            .from('invoices')
            .update({
              deposit_paid: alreadyPaid,
              status: isFullyPaid ? 'paid' : 'partially_paid',
            })
            .eq('id', invoiceId)

          await supabaseAdmin.from('payments').insert({
            invoice_id: invoiceId,
            amount: amountPaid,
            type: isFullyPaid ? 'balance' : 'deposit',
            stripe_payment_intent_id: session.payment_intent || null,
          })
        }
      }
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
