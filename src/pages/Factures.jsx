import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatEUR, formatDate, INVOICE_TYPE_LABELS, INVOICE_STATUS_OPTIONS, STATUS_LABELS } from '../lib/calc'
import { flagOverdueInvoices } from '../lib/invoiceHelpers'
import { downloadCSV } from '../lib/csvExport'
import StatusSelect from '../components/StatusSelect'

export default function Factures() {
  const { business } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    if (business) load()
  }, [business])

  async function load() {
    const { data } = await supabase
      .from('invoices')
      .select('*, clients(name)')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
    const updated = await flagOverdueInvoices(data || [])
    setInvoices(updated)
  }

  async function updateStatus(invoiceId, newStatus) {
    setInvoices((invs) => invs.map((i) => (i.id === invoiceId ? { ...i, status: newStatus } : i)))
    await supabase.from('invoices').update({ status: newStatus }).eq('id', invoiceId)
  }

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false
      if (dateFrom && inv.issue_date < dateFrom) return false
      if (dateTo && inv.issue_date > dateTo) return false
      if (search) {
        const needle = search.toLowerCase()
        const haystack = `${inv.number} ${inv.clients?.name || ''}`.toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    })
  }, [invoices, search, statusFilter, dateFrom, dateTo])

  const hasActiveFilters = search || statusFilter !== 'all' || dateFrom || dateTo

  function clearFilters() {
    setSearch('')
    setStatusFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  function handleExportCSV() {
    const headers = ['Numéro', 'Type', 'Client', 'Date émission', 'Échéance', 'Total HT', 'TVA', 'Total TTC', 'Montant réglé', 'Reste à payer', 'Statut']
    const rows = filtered.map((inv) => {
      const paid = inv.status === 'paid' ? Number(inv.total_ttc) : Number(inv.deposit_paid || 0)
      return [
        inv.number,
        INVOICE_TYPE_LABELS[inv.invoice_type] || 'Facture',
        inv.clients?.name || '',
        formatDate(inv.issue_date),
        inv.due_date ? formatDate(inv.due_date) : '',
        inv.subtotal_ht,
        inv.tva_amount,
        inv.total_ttc,
        paid,
        Number(inv.total_ttc) - paid,
        STATUS_LABELS[inv.status] || inv.status,
      ]
    })
    downloadCSV(`factures-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  }

  return (
    <div>
      <header className="page-header">
        <h1>Factures</h1>
        <div className="action-row">
          <button className="btn-secondary" onClick={handleExportCSV} disabled={filtered.length === 0}>Exporter en CSV</button>
          <Link to="/factures/nouvelle" className="btn-primary">+ Nouvelle facture</Link>
        </div>
      </header>

      <section className="panel">
        <div className="form-grid" style={{ marginBottom: 16 }}>
          <label>
            Recherche (N° ou client)
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="F-0012 ou nom du client" />
          </label>
          <label>
            Statut
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Tous les statuts</option>
              {INVOICE_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </label>
          <label>
            Du
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label>
            Au
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
        </div>
        {hasActiveFilters && (
          <button className="link-btn" style={{ marginTop: 0, marginBottom: 12 }} onClick={clearFilters}>Réinitialiser les filtres</button>
        )}

        {filtered.length === 0 ? (
          <p className="empty-state">
            {invoices.length === 0 ? "Aucune facture pour l'instant. Crée-en une directement, ou convertis un devis accepté." : 'Aucune facture ne correspond à ces filtres.'}
          </p>
        ) : (
          <table className="data-table">
            <thead><tr><th>N°</th><th>Type</th><th>Client</th><th>Date</th><th>Total TTC</th><th>Statut</th></tr></thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id}>
                  <td><Link to={`/factures/${inv.id}`}>{inv.number}</Link></td>
                  <td>{INVOICE_TYPE_LABELS[inv.invoice_type] || 'Facture'}</td>
                  <td>{inv.clients?.name}</td>
                  <td>{formatDate(inv.issue_date)}</td>
                  <td>{formatEUR(inv.total_ttc)}</td>
                  <td><StatusSelect status={inv.status} options={INVOICE_STATUS_OPTIONS} onChange={(s) => updateStatus(inv.id, s)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
