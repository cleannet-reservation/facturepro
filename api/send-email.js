// Fonction serverless Vercel — /api/send-email
// Envoie un email transactionnel via l'API Brevo.
//
// Variable d'environnement requise sur Vercel : BREVO_API_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const { to, toName, subject, htmlContent, senderName, senderEmail, attachment } = req.body

  if (!to || !subject || !htmlContent) {
    return res.status(400).json({ error: 'Champs manquants (to, subject, htmlContent)' })
  }

  if (!process.env.BREVO_API_KEY) {
    return res.status(500).json({ error: "BREVO_API_KEY n'est pas configurée sur le serveur" })
  }

  try {
    const payload = {
      sender: { name: senderName || 'FacturePro', email: senderEmail || 'no-reply@facturepro.app' },
      to: [{ email: to, name: toName || undefined }],
      subject,
      htmlContent,
    }

    // Pièce jointe PDF optionnelle : { name: 'facture.pdf', content: '<base64 sans préfixe>' }
    if (attachment && attachment.content && attachment.name) {
      payload.attachment = [{ name: attachment.name, content: attachment.content }]
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.message || "Erreur lors de l'envoi de l'email")

    return res.status(200).json({ success: true, messageId: data.messageId })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
