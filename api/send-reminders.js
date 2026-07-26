// Fonction serverless Vercel — /api/send-reminders
// Exécutée automatiquement une fois par jour par Vercel Cron (voir vercel.json).
// Parcourt TOUTES les factures en retard, et envoie une relance par email
// (pas plus d'une tous les 7 jours par facture, pour ne pas spammer le client).
//
// Variables d'environnement requises : SUPABASE_SERVICE_ROLE_KEY, BREVO_API_KEY
//
// Protection : Vercel Cron envoie l'en-tête "authorization: Bearer <CRON_SECRET>"
// automatiquement si la variable CRON_SECRET est définie sur le projet.

import { createClient } from '@supabase/supabase-js'

const REMINDER_INTERVAL_DAYS = 7

export default async function handler(req, res) {
  // Vérifie que l'appel vient bien de Vercel Cron (ou d'un test manuel avec le bon secret)
  if (process.env.CRON_SECRET) {
    const auth = req.headers['authorization']
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Non autorisé' })
    }
  }

  const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const today = new Date().toISOString().slice(0, 10)
  const results = { flagged: 0, remindersSent: 0, errors: [] }

  try {
    // 1. Marquer en retard toutes les factures dont l'échéance est dépassée
    const { data: toFlag } = await supabaseAdmin
      .from('invoices')
      .select('id')
      .lt('due_date', today)
      .in('status', ['sent', 'partially_paid'])

    if (toFlag && toFlag.length > 0) {
      await supabaseAdmin.from('invoices').update({ status: 'overdue' }).in('id', toFlag.map((i) => i.id))
      results.flagged = toFlag.length
    }

    // 2. Relancer les factures en retard, en respectant l'intervalle minimum
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - REMINDER_INTERVAL_DAYS)

    const { data: overdueInvoices } = await supabaseAdmin
      .from('invoices')
      .select('*, clients(name, email), businesses(name, email, tax_regime)')
      .eq('status', 'overdue')

    const dueForReminder = (overdueInvoices || []).filter(
      (inv) => !inv.last_reminder_sent_at || new Date(inv.last_reminder_sent_at) < cutoff
    )

    for (const inv of dueForReminder) {
      const client = inv.clients
      const business = inv.businesses
      if (!client?.email) continue

      const remaining = Number(inv.total_ttc) - Number(inv.deposit_paid || 0)
      const paymentLine = inv.stripe_payment_link_url
        ? `<p><a href="${inv.stripe_payment_link_url}" style="display:inline-block; background:#2F6F5E; color:#fff; padding:10px 18px; border-radius:6px; text-decoration:none;">Payer en ligne</a></p>`
        : ''

      const html = `
        <div style="font-family: Arial, sans-serif; color: #1B2A4A; max-width: 560px;">
          <h2 style="color: #C1502E;">Rappel — Facture ${inv.number} impayée</h2>
          <p>Bonjour ${client.name},</p>
          <p>Sauf erreur de notre part, la facture ${inv.number} d'un montant de
          <strong>${remaining.toFixed(2)} €</strong> reste à ce jour impayée
          ${inv.due_date ? `(échéance dépassée depuis le ${new Date(inv.due_date).toLocaleDateString('fr-FR')})` : ''}.
          Merci de bien vouloir procéder au règlement dans les meilleurs délais.</p>
          ${paymentLine}
          <p>Cordialement,<br/>${business.name}</p>
        </div>
      `

      try {
        const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': process.env.BREVO_API_KEY },
          body: JSON.stringify({
            sender: { name: business.name, email: business.email || 'no-reply@facturepro.app' },
            to: [{ email: client.email, name: client.name }],
            subject: `Rappel — Facture ${inv.number} impayée`,
            htmlContent: html,
          }),
        })
        if (!emailRes.ok) {
          const errData = await emailRes.json()
          throw new Error(errData.message || 'Erreur Brevo')
        }

        await supabaseAdmin
          .from('invoices')
          .update({ last_reminder_sent_at: new Date().toISOString(), reminder_count: (inv.reminder_count || 0) + 1 })
          .eq('id', inv.id)

        results.remindersSent++
      } catch (err) {
        results.errors.push({ invoiceId: inv.id, error: err.message })
      }
    }

    return res.status(200).json(results)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
