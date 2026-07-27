// Fonction serverless Vercel — /api/stripe-key-test
// Vérifie qu'une clé Stripe secrète est valide, sans jamais la stocker ici
// (l'enregistrement se fait séparément, côté Supabase, depuis le frontend).

import Stripe from 'stripe'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const { secretKey } = req.body
  if (!secretKey) return res.status(400).json({ error: 'Clé manquante' })

  if (!secretKey.startsWith('sk_')) {
    return res.status(400).json({ error: "Cette clé ne ressemble pas à une clé secrète Stripe valide (elle doit commencer par 'sk_')" })
  }

  try {
    const stripe = new Stripe(secretKey)
    const account = await stripe.accounts.retrieve()
    return res.status(200).json({ valid: true, accountName: account.business_profile?.name || account.email || account.id })
  } catch (err) {
    return res.status(400).json({ valid: false, error: 'Clé invalide ou refusée par Stripe : ' + err.message })
  }
}
