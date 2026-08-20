import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { APP_NAME } from '../lib/theme'

export default function Subscribe() {
  const { business, signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const trialExpired = business?.subscription_status === 'trial' && business?.trial_ends_at && new Date(business.trial_ends_at) < new Date()
  const isPastDue = business?.subscription_status === 'past_due'
  const isCanceled = business?.subscription_status === 'canceled'
  const isBlocked = business?.access_enabled === false

  async function handleSubscribe() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/create-subscription-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id, returnOrigin: window.location.origin }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.href = data.url
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  let title = "Active ton abonnement"
  let message = `Ton essai gratuit de ${APP_NAME} est terminé. Active ton abonnement pour continuer à créer des devis et factures.`
  if (isPastDue) {
    title = 'Paiement en attente'
    message = "Le dernier prélèvement de ton abonnement n'a pas pu être effectué. Mets à jour ton moyen de paiement pour retrouver l'accès."
  } else if (isCanceled) {
    title = 'Abonnement résilié'
    message = 'Ton abonnement a été résilié. Réabonne-toi pour retrouver l\'accès à tes devis et factures.'
  } else if (isBlocked) {
    title = 'Accès suspendu'
    message = "L'accès à ton compte a été temporairement suspendu. Contacte-nous si tu penses qu'il s'agit d'une erreur."
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand-mark">{APP_NAME}</div>
        <h1>{title}</h1>
        <p className="auth-sub">{message}</p>

        {!isBlocked && (
          <>
            <div className="panel" style={{ background: 'var(--bg-elevated-2)', marginBottom: 20 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--cyan)' }}>9,90 € <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 400 }}>/ mois</span></div>
              <p className="muted" style={{ marginTop: 8 }}>Devis, factures, acomptes en ligne, relances automatiques, et tout le reste — sans engagement.</p>
            </div>

            {error && <div className="form-error" style={{ marginBottom: 16 }}>{error}</div>}

            <button className="btn-primary" style={{ width: '100%' }} disabled={busy} onClick={handleSubscribe}>
              {busy ? 'Redirection…' : 'Activer mon abonnement'}
            </button>
          </>
        )}

        <button className="link-btn" onClick={signOut}>Se déconnecter</button>
      </div>
    </div>
  )
}
