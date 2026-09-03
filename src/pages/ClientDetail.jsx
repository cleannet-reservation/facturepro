import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatEUR, formatDate, INVOICE_TYPE_LABELS, computeCreditImpot } from '../lib/calc'
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
      const payload = {
        client_type: form.client_type,
        name: form.name,
        company_name: form.client_type === 'professionnel' ? form.company_name : null,
        tva_number: form.client_type === 'professionnel' ? form.tva_number : null,
        siren_siret: form.client_type === 'professionnel' ? form.siren_siret : null,
        naf_code: form.client_type === 'professionnel' ? form.naf_code : null,
        language: form.language,
        email: form.email,
        phone: form.phone,
        address: form.address,
        address_complement: form.address_complement,
        postal_code: form.postal_code,
        city: form.city,
        website: form.client_type === 'professionnel' ? form.website : null,
        notes: form.notes,
      }
      const { error: updateError } = await supabase
        .from('clients')
        .update(payload)
        .eq('id', id)
      if (updateError) throw updateError
      setClient({ ...client, ...payload })
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
        <h1>{client.client_type === 'professionnel' ? client.company_name : client.name}</h1>
        <button className="btn-secondary" onClick={() => setEditing((e) => !e)}>
          {editing ? 'Annuler' : 'Modifier la fiche'}
        </button>
      </header>

      {editing ? (
        <form onSubmit={handleSave} className="panel form-grid">
          <fieldset className="span-2 tax-regime">
            <legend>Type de client</legend>
            <label className="radio-row">
              <input type="radio" name="client_type" checked={form.client_type === 'particulier'} onChange={() => setForm({ ...form, client_type: 'particulier' })} />
              Particulier
            </label>
            <label className="radio-row">
              <input type="radio" name="client_type" checked={form.client_type === 'professionnel'} onChange={() => setForm({ ...form, client_type: 'professionnel' })} />
              Professionnel
            </label>
          </fieldset>

          {form.client_type === 'professionnel' && (
            <>
              <label className="span-2">Nom de la société *
                <input required value={form.company_name || ''} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
              </label>
              <label>Numéro de TVA
                <input value={form.tva_number || ''} onChange={(e) => setForm({ ...form, tva_number: e.target.value })} placeholder="FR12345678900" />
              </label>
              <label>SIREN/SIRET
                <input value={form.siren_siret || ''} onChange={(e) => setForm({ ...form, siren_siret: e.target.value })} />
              </label>
              <label>Code NAF, NACE, NOGA…
                <input value={form.naf_code || ''} onChange={(e) => setForm({ ...form, naf_code: e.target.value })} />
              </label>
              <label>Langue
                <select value={form.language || 'fr'} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                  <option value="fr">Français</option>
                  <option value="en">Anglais</option>
                </select>
              </label>
            </>
          )}

          <label className="span-2">{form.client_type === 'professionnel' ? "Nom du contact (usage interne, n'apparaît pas sur les documents)" : 'Nom et prénom'}
            <input required value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>Email
            <input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>Téléphone
            <input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label className="span-2">Adresse
            <input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </label>
          <label className="span-2">Complément d'adresse
            <input value={form.address_complement || ''} onChange={(e) => setForm({ ...form, address_complement: e.target.value })} />
          </label>
          <label>Code postal
            <input value={form.postal_code || ''} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
          </label>
          <label>Ville
            <input value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </label>
          {form.client_type === 'professionnel' && (
            <label className="span-2">Site internet
              <input value={form.website || ''} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" />
            </label>
          )}
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
            {client.client_type === 'professionnel' && <div className="muted">Contact : {client.name}</div>}
            {client.client_type === 'professionnel' && client.tva_number && <div className="muted">TVA : {client.tva_number}</div>}
            {client.client_type === 'professionnel' && client.siren_siret && <div className="muted">SIREN/SIRET : {client.siren_siret}</div>}
            <div className="muted">{client.email}</div>
            <div className="muted">{client.phone}</div>
            <div className="muted">{client.address} {client.address_complement} {client.postal_code} {client.city}</div>
            {client.website && <div className="muted">{client.website}</div>}
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
