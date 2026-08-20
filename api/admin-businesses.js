// Fonction serverless Vercel — /api/admin-businesses
// Renvoie la liste de toutes les entreprises avec leur statut d'abonnement.
// Réservé aux comptes présents dans la table platform_admins.
//
// Le token de session Supabase du demandeur est envoyé dans l'en-tête
// Authorization, on vérifie son identité puis son statut admin avant de
// renvoyer quoi que ce soit.

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
      .select('id, name, email, subscription_status, trial_ends_at, access_enabled, stripe_customer_id, created_at')
      .order('created_at', { ascending: false })
    if (bizError) throw bizError

    return res.status(200).json({ businesses })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
