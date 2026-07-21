// Fonction serverless Vercel — /api/accept-quote
// Permet à un client (sans compte) d'accepter un devis via son lien public.
//
// Variable d'environnement requise sur Vercel : SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const { token, acceptedByName } = req.body
  if (!token || !acceptedByName) {
    return res.status(400).json({ error: 'Champs manquants' })
  }

  const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  try {
    const { data: quote, error: findError } = await supabaseAdmin
      .from('quotes')
      .select('id, status')
      .eq('public_token', token)
      .single()
    if (findError || !quote) return res.status(404).json({ error: 'Devis introuvable' })

    if (quote.status === 'accepted') {
      return res.status(200).json({ success: true, alreadyAccepted: true })
    }

    const { error: updateError } = await supabaseAdmin
      .from('quotes')
      .update({ status: 'accepted', accepted_at: new Date().toISOString(), accepted_by_name: acceptedByName })
      .eq('id', quote.id)
    if (updateError) throw updateError

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
