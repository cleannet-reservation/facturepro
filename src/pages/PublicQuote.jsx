import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { formatEUR, formatDate, computeCreditImpot } from '../lib/calc'

export default function PublicQuote() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [acceptName, setAcceptName] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    load()
  }, [token])

  async function load() {
    try {
      const res = await fetch(`/api/quote-public?token=${token}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Devis introuvable')
      setData(json)
      if (json.quote.status === 'accepted') setAccepted(true)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAccept(e) {
    e.preventDefault()
    setAccepting(true)
    try {
      const res = await fetch('/api/accept-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, acceptedByName: acceptName }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setAccepted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setAccepting(false)
    }
  }

  if (error) {
    return (
      <div className="auth-page">
        <div className="auth-card"><p className="form-error">{error}</p></div>
      </div>
    )
  }

  if (!data) {
    return <div className="loading-screen">Chargement du devis…</div>
  }

  const { quote, items } = data
  const business = quote.businesses
  const client = quote.clients
  const hasTva = business.tax_regime === 'assujetti'

  return (
    <div className="auth-page" style={{ alignItems: 'flex-start', paddingTop: 48 }}>
      <div className="auth-card wide">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          {business.logo_url && <img src={business.logo_url} alt={business.name} style={{ width: 40, height: 40, objectFit: 'contain' }} />}
          <div className="brand-mark" style={{ margin: 0 }}>{business.name}</div>
        </div>
        <h1>Devis {quote.number}</h1>
        <p className="auth-sub">
          {client.name} — émis le {formatDate(quote.issue_date)}
          {quote.validity_date && ` — valable jusqu'au ${formatDate(quote.validity_date)}`}
        </p>

        <table className="data-table" style={{ marginBottom: 16 }}>
          <thead><tr><th>Description</th><th>Qté</th><th>PU</th><th>Total</th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>{it.description}</td>
                <td>{it.quantity}</td>
                <td>{formatEUR(it.unit_price)}</td>
                <td>{formatEUR(it.quantity * it.unit_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals-box">
          {hasTva && (
            <>
              <div><span>Total HT</span><span>{formatEUR(quote.subtotal_ht)}</span></div>
              <div><span>TVA</span><span>{formatEUR(quote.tva_amount)}</span></div>
            </>
          )}
          <div className="total-ttc"><span>Total TTC</span><span>{formatEUR(quote.total_ttc)}</span></div>
        </div>

        {quote.tax_credit_eligible && (
          <div className="form-info" style={{ marginTop: 14 }}>
            Éligible au crédit d'impôt Services à la Personne (50%) — reste à charge réel estimé {formatEUR(quote.total_ttc - computeCreditImpot(quote.total_ttc))}.
          </div>
        )}

        {quote.notes && <p className="muted" style={{ marginTop: 16 }}>{quote.notes}</p>}

        <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          {accepted ? (
            <div className="form-info">
              Devis accepté{quote.accepted_by_name ? ` par ${quote.accepted_by_name}` : ''}. L'entreprise a été notifiée et reviendra vers vous pour la suite.
            </div>
          ) : (
            <form onSubmit={handleAccept} className="auth-form">
              <label>
                Votre nom complet, pour valider l'acceptation de ce devis
                <input required value={acceptName} onChange={(e) => setAcceptName(e.target.value)} placeholder="Prénom Nom" />
              </label>
              <button type="submit" className="btn-primary" disabled={accepting}>
                {accepting ? 'Validation…' : 'Accepter ce devis'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
