import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const authHeader = req.headers['authorization'] || ''
  const token = authHeader.replace('Bearer ', '')
  const { businessId, enabled } = req.body
  if (!token) return res.status(401).json({ error: 'Non authentifié' })
  if (!businessId || typeof enabled !== 'boolean') return res.status(400).json({ error: 'Champs manquants' })

  const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !userData?.user) return res.status(401).json({ error: 'Session invalide' })

    const { data: adminRow } = await supabaseAdmin
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle()
    if (!adminRow) return res.status(403).json({ error: "Accès réservé aux super admins" })

    const { error: updateError } = await supabaseAdmin
      .from('businesses')
      .update({ access_enabled: enabled })
      .eq('id', businessId)
    if (updateError) throw updateError

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
