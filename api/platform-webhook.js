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
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_PLATFORM_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Signature webhook plateforme invalide :', err.message)
    return res.status(400).json({ error: `Signature invalide : ${err.message}` })
  }

  const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const businessId = session.metadata?.businessId || session.client_reference_id
      if (businessId) {
        await supabaseAdmin
          .from('businesses')
          .update({
            subscription_status: 'active',
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
          })
          .eq('id', businessId)
      }
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object
      const subscriptionId = invoice.subscription
      if (subscriptionId) {
        await supabaseAdmin
          .from('businesses')
          .update({ subscription_status: 'active' })
          .eq('stripe_subscription_id', subscriptionId)
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object
      const subscriptionId = invoice.subscription
      if (subscriptionId) {
        await supabaseAdmin
          .from('businesses')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_subscription_id', subscriptionId)
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object
      await supabaseAdmin
        .from('businesses')
        .update({ subscription_status: 'canceled' })
        .eq('stripe_subscription_id', subscription.id)
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
