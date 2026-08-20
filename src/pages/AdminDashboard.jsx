import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatDate } from '../lib/calc'

const STATUS_META = {
  active: { label: 'Actif', class: 'stamp-paid' },
  trial: { label: 'Essai', class: 'stamp-partially_paid' },
  past_due: { label: 'Impayé', class: 'stamp-refused' },
  canceled: { label: 'Résilié', class: 'stamp-draft' },
}

export default function AdminDashboard() {
  const [businesses, setBusinesses] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [impersonateLink, setImpersonateLink] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function authHeader() {
    const { data } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${data.session?.access_token}` }
  }

  async function load() {
    setError('')
    try {
      const res = await fetch('/api/admin-businesses', { headers: await authHeader() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setBusinesses(data.businesses)
    } catch (err) {
      setError(err.message)
    }
  }

  async function toggleAccess(id, currentlyEnabled) {
    setBusyId(id)
    try {
      const res = await fetch('/api/admin-toggle-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ businessId: id, enabled: !currentlyEnabled }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setBusinesses((list) => list.map((b) => (b.id === id ? { ...b, access_enabled: !currentlyEnabled } : b)))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function impersonate(id) {
    setBusyId(id)
    setImpersonateLink(null)
    setError('')
    try {
      const res = await fetch('/api/admin-impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ businessId: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setImpersonateLink(data.url)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  if (error && !businesses) {
    return (
      <div>
        <header className="page-header"><h1>Super admin</h1></header>
        <div className="form-error">{error}</div>
      </div>
    )
  }

  if (!businesses) return <p>Chargement…</p>

  const activeCount = businesses.filter((b) => b.subscription_status === 'active').length
  const pastDueCount = businesses.filter((b) => b.subscription_status === 'past_due').length
  const trialCount = businesses.filter((b) => b.subscription_status === 'trial').length
  const mrr = activeCount * 9.9

  return (
    <div>
      <header className="page-header">
        <h1>Super admin</h1>
      </header>

      <div className="stat-grid">
        <div className="stat-card highlight">
          <span className="stat-label">MRR estimé</span>
          <span className="stat-value">{mrr.toFixed(2)} €</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Abonnés actifs</span>
          <span className="stat-value">{activeCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Impayés</span>
          <span className="stat-value">{pastDueCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Essais en cours</span>
          <span className="stat-value">{trialCount}</span>
        </div>
      </div>

      {impersonateLink && (
        <section className="panel">
          <p className="form-info" style={{ marginBottom: 10 }}>
            Lien de connexion généré — ouvre-le dans une <strong>fenêtre de navigation privée</strong> (pas cet onglet) pour ne pas remplacer ta propre session admin.
          </p>
          <div className="payment-link-box">
            <input readOnly value={impersonateLink} />
            <button className="btn-secondary" onClick={() => navigator.clipboard.writeText(impersonateLink)}>Copier</button>
          </div>
        </section>
      )}

      {error && <div className="form-error" style={{ marginBottom: 16 }}>{error}</div>}

      <section className="panel">
        <table className="data-table">
          <thead>
            <tr><th>Entreprise</th><th>Statut</th><th>Fin d'essai</th><th>Accès</th><th></th></tr>
          </thead>
          <tbody>
            {businesses.map((b) => {
              const meta = STATUS_META[b.subscription_status] || STATUS_META.trial
              return (
                <tr key={b.id}>
                  <td>{b.name}<div className="muted">{b.email}</div></td>
                  <td><span className={`stamp ${meta.class}`}>{meta.label}</span></td>
                  <td>{b.trial_ends_at ? formatDate(b.trial_ends_at) : '—'}</td>
                  <td>
                    <button className="btn-secondary" disabled={busyId === b.id} onClick={() => toggleAccess(b.id, b.access_enabled)}>
                      {b.access_enabled ? 'Actif' : 'Bloqué'}
                    </button>
                  </td>
                  <td>
                    <button className="btn-secondary" disabled={busyId === b.id} onClick={() => impersonate(b.id)}>
                      Se connecter
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
