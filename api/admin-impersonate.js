// Fonction serverless Vercel — /api/admin-impersonate
// Génère un lien de connexion magique vers le compte d'une entreprise, pour
// que l'admin puisse consulter/aider sans connaître son mot de passe.
// Réservé aux super admins.
//
// ⚠️ Ouvre ce lien dans une fenêtre de navigation privée / un autre
// navigateur : l'ouvrir dans le même onglet remplacerait TA session admin
// par celle du client (les sessions Supabase sont stockées par navigateur,
// pas par onglet).

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const authHeader = req.headers['authorization'] || ''
  const token = authHeader.replace('Bearer ', '')
  const { businessId } = req.body
  if (!token) return res.status(401).json({ error: 'Non authentifié' })
  if (!businessId) return res.status(400).json({ error: 'businessId manquant' })

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

    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('owner_id')
      .eq('id', businessId)
      .single()
    if (!business?.owner_id) return res.status(404).json({ error: 'Entreprise introuvable' })

    const { data: ownerData, error: ownerError } = await supabaseAdmin.auth.admin.getUserById(business.owner_id)
    if (ownerError || !ownerData?.user?.email) return res.status(404).json({ error: "Impossible de retrouver le compte de connexion de cette entreprise" })

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: ownerData.user.email,
    })
    if (linkError) throw linkError

    return res.status(200).json({ url: linkData.properties.action_link })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
