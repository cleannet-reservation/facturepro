// Fonction serverless Vercel — /api/quote-public?token=...
// Permet à un client (sans compte) de consulter un devis via son lien public.
// Utilise la clé service_role côté serveur uniquement pour lire les données
// malgré le Row Level Security (qui bloque normalement l'accès anonyme).
//
// Variable d'environnement requise sur Vercel : SUPABASE_SERVICE_ROLE_KEY
// (clé secrète Supabase — Project Settings → API → Secret keys)

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const { token } = req.query
  if (!token) return res.status(400).json({ error: 'Token manquant' })

  const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  try {
    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .select('*, clients(name, address, postal_code, city), businesses(name, address, postal_code, city, siret, tva_number, email, phone, logo_url, tax_regime)')
      .eq('public_token', token)
      .single()
    if (quoteError || !quote) return res.status(404).json({ error: 'Devis introuvable' })

    const { data: items } = await supabaseAdmin
      .from('quote_items')
      .select('*')
      .eq('quote_id', quote.id)
      .order('position')

    return res.status(200).json({ quote, items })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
