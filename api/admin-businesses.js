import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const authHeader = req.headers['authorization'] || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non authentifié' })

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

    const { data: businesses, error: bizError } = await supabaseAdmin
      .from('businesses')
      .select('id, owner_id, name, email, subscription_status, trial_ends_at, access_enabled, stripe_customer_id, created_at')
      .order('created_at', { ascending: false })
    if (bizError) throw bizError

    const { data: allAdmins } = await supabaseAdmin.from('platform_admins').select('user_id')
    const adminIds = new Set((allAdmins || []).map((a) => a.user_id))

    const enriched = businesses.map((b) => ({ ...b, isAdminOwner: adminIds.has(b.owner_id) }))

    return res.status(200).json({ businesses: enriched })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
