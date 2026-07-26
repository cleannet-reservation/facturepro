import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatEUR, formatDate, QUOTE_STATUS_OPTIONS, STATUS_LABELS } from '../lib/calc'
import StatusSelect from '../components/StatusSelect'

export default function Devis() {
  const { business } = useAuth()
  const [quotes, setQuotes] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    if (business) load()
  }, [business])

  async function load() {
    const { data } = await supabase
      .from('quotes')
      .select('*, clients(name)')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
    setQuotes(data || [])
  }

  async function updateStatus(quoteId, newStatus) {
    setQuotes((qs) => qs.map((q) => (q.id === quoteId ? { ...q, status: newStatus } : q)))
    await supabase.from('quotes').update({ status: newStatus }).eq('id', quoteId)
  }

  const filtered = useMemo(() => {
    return quotes.filter((q) => {
      if (statusFilter !== 'all' && q.status !== statusFilter) return false
      if (dateFrom && q.issue_date < dateFrom) return false
      if (dateTo && q.issue_date > dateTo) return false
      if (search) {
        const needle = search.toLowerCase()
        const haystack = `${q.number} ${q.clients?.name || ''}`.toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    })
  }, [quotes, search, statusFilter, dateFrom, dateTo])

  const hasActiveFilters = search || statusFilter !== 'all' || dateFrom || dateTo

  function clearFilters() {
    setSearch('')
    setStatusFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div>
      <header className="page-header">
        <h1>Devis</h1>
        <Link to="/devis/nouveau" className="btn-primary">+ Nouveau devis</Link>
      </header>

      <section className="panel">
        <div className="form-grid" style={{ marginBottom: 16 }}>
          <label>
            Recherche (N° ou client)
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="D-0012 ou nom du client" />
          </label>
          <label>
            Statut
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Tous les statuts</option>
              {QUOTE_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
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
            {quotes.length === 0 ? "Aucun devis pour l'instant." : 'Aucun devis ne correspond à ces filtres.'}
          </p>
        ) : (
          <table className="data-table">
            <thead><tr><th>N°</th><th>Client</th><th>Date</th><th>Total TTC</th><th>Statut</th></tr></thead>
            <tbody>
              {filtered.map((q) => (
                <tr key={q.id}>
                  <td><Link to={`/devis/${q.id}`}>{q.number}</Link></td>
                  <td>{q.clients?.name}</td>
                  <td>{formatDate(q.issue_date)}</td>
                  <td>{formatEUR(q.total_ttc)}</td>
                  <td><StatusSelect status={q.status} options={QUOTE_STATUS_OPTIONS} onChange={(s) => updateStatus(q.id, s)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
