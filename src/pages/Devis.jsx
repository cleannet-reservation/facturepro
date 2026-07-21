import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatEUR, formatDate, QUOTE_STATUS_OPTIONS } from '../lib/calc'
import StatusSelect from '../components/StatusSelect'

export default function Devis() {
  const { business } = useAuth()
  const [quotes, setQuotes] = useState([])

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

  return (
    <div>
      <header className="page-header">
        <h1>Devis</h1>
        <Link to="/devis/nouveau" className="btn-primary">+ Nouveau devis</Link>
      </header>

      <section className="panel">
        {quotes.length === 0 ? (
          <p className="empty-state">Aucun devis pour l'instant.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>N°</th><th>Client</th><th>Date</th><th>Total TTC</th><th>Statut</th></tr></thead>
            <tbody>
              {quotes.map((q) => (
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
