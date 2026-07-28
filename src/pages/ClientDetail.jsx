import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatEUR, formatDate, INVOICE_TYPE_LABELS } from '../lib/calc'
import { flagOverdueInvoices } from '../lib/invoiceHelpers'
import { downloadAttestationPDF } from '../lib/pdfGenerator'
import StatusStamp from '../components/StatusStamp'

export default function ClientDetail() {
  const { id } = useParams()
  const { business } = useAuth()
  const [client, setClient] = useState(null)
  const [form, setForm] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [invoices, setInvoices] = useState([])
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [attestationYear, setAttestationYear] = useState(new Date().getFullYear())
  const [generatingAttestation, setGeneratingAttestation] = useState(false)
  const [attestationError, setAttestationError] = useState('')

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    const { data: c } = await supabase.from('clients').select('*').eq('id', id).single()
    if (!c) return
    setClient(c)
    setForm(c)

    const { data: q } = await supabase
      .from('quotes')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
    setQuotes(q || [])

    const { data: inv } = await supabase
      .from('invoices')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
    const updatedInvoices = await flagOverdueInvoices(inv || [])
    setInvoices(updatedInvoices)
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          name: form.name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          postal_code: form.postal_code,
          city: form.city,
          notes: form.notes,
        })
        .eq('id', id)
      if (updateError) throw updateError
      setClient(form)
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!client || !form) return <p>Chargement…</p>

  async function handleGenerateAttestation() {
    setAttestationError('')
    setGeneratingAttestation(true)
    try {
      const eligibleInvoices = invoices.filter((inv) => {
        if (!inv.tax_credit_eligible) return false
        const invYear = new Date(inv.issue_date).getFullYear()
        return invYear === Number(attestationYear)
      })

      if (eligibleInvoices.length === 0) {
        throw new Error(`Aucune facture éligible au crédit d'impôt pour ${client.name} en ${attestationYear}.`)
      }

      const invoiceRows = eligibleInvoices.map((inv) => ({
        number: inv.number,
        issue_date: inv.issue_date,
        amount: inv.status === 'paid' ? Number(inv.total_ttc) : Number(inv.deposit_paid || 0),
      }))
      const totalPaid = invoiceRows.reduce((sum, r) => sum + r.amount, 0)

      if (totalPaid <= 0) {
        throw new Error("Aucun montant réglé pour ces factures sur cette année pour l'instant.")
      }

      await downloadAttestationPDF({
        business,
        client,
        year: attestationYear,
        totalPaid,
        invoices: invoiceRows,
      })
    } catch (err) {
      setAttestationError(err.message)
    } finally {
      setGeneratingAttestation(false)
    }
  }

  const totalFacture = invoices.reduce((sum, inv) => sum + Number(inv.total_ttc), 0)
  const totalPaye = invoices.reduce((sum, inv) => {
    if (inv.status === 'paid') return sum + Number(inv.total_ttc)
    return sum + Number(inv.deposit_paid || 0)
  }, 0)
  const resteAPayer = totalFacture - totalPaye
  const devisAcceptes = quotes.filter((q) => q.status === 'accepted').length

  return (
    <div>
      <header className="page-header">
        <h1>{client.name}</h1>
        <button className="btn-secondary" onClick={() => setEditing((e) => !e)}>
          {editing ? 'Annuler' : 'Modifier la fiche'}
        </button>
      </header>

      {editing ? (
        <form onSubmit={handleSave} className="panel form-grid">
          <label>Nom / raison sociale
            <input required value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>Email
            <input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>Téléphone
            <input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label>Adresse
            <input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </label>
          <label>Code postal
            <input value={form.postal_code || ''} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
          </label>
          <label>Ville
            <input value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </label>
          <label className="span-2">Notes
            <textarea rows={3} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          {error && <div className="form-error span-2">{error}</div>}
          <button type="submit" className="btn-primary span-2" disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      ) : (
        <section className="panel doc-summary">
          <div>
            <div className="muted">{client.email}</div>
            <div className="muted">{client.phone}</div>
            <div className="muted">{client.address} {client.postal_code} {client.city}</div>
            {client.notes && <div className="muted" style={{ marginTop: 8 }}>{client.notes}</div>}
          </div>
        </section>
      )}

      {business?.sap_eligible && (
        <section className="panel">
          <h2 className="section-title" style={{ marginTop: 0 }}>Attestation fiscale annuelle (crédit d'impôt SAP)</h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            Génère le document à envoyer à ce client pour sa déclaration de revenus, reprenant le total réglé sur l'année pour les prestations éligibles.
          </p>
          <div className="form-grid" style={{ alignItems: 'flex-end' }}>
            <label>
              Année
              <input type="number" value={attestationYear} onChange={(e) => setAttestationYear(e.target.value)} />
            </label>
            <div>
              <button className="btn-primary" disabled={generatingAttestation} onClick={handleGenerateAttestation}>
                {generatingAttestation ? 'Génération…' : "Générer l'attestation"}
              </button>
            </div>
          </div>
          {attestationError && <div className="form-error" style={{ marginTop: 12 }}>{attestationError}</div>}
        </section>
      )}

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Devis acceptés</span>
          <span className="stat-value">{devisAcceptes} / {quotes.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total facturé</span>
          <span className="stat-value">{formatEUR(totalFacture)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total payé</span>
          <span className="stat-value">{formatEUR(totalPaye)}</span>
        </div>
        <div className={`stat-card ${resteAPayer > 0 ? 'highlight' : ''}`}>
          <span className="stat-label">Reste à payer</span>
          <span className="stat-value">{formatEUR(resteAPayer)}</span>
        </div>
      </div>

      <section className="panel">
        <h2>Devis</h2>
        {quotes.length === 0 ? (
          <p className="empty-state">Aucun devis pour ce client.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>N°</th><th>Date</th><th>Total TTC</th><th>Statut</th></tr></thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id}>
                  <td><Link to={`/devis/${q.id}`}>{q.number}</Link></td>
                  <td>{formatDate(q.issue_date)}</td>
                  <td>{formatEUR(q.total_ttc)}</td>
                  <td><StatusStamp status={q.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>Factures</h2>
        {invoices.length === 0 ? (
          <p className="empty-state">Aucune facture pour ce client.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>N°</th><th>Type</th><th>Date</th><th>Total TTC</th><th>Statut</th></tr></thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td><Link to={`/factures/${inv.id}`}>{inv.number}</Link></td>
                  <td>{INVOICE_TYPE_LABELS[inv.invoice_type] || 'Facture'}</td>
                  <td>{formatDate(inv.issue_date)}</td>
                  <td>{formatEUR(inv.total_ttc)}</td>
                  <td><StatusStamp status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
