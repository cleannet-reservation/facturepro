import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatEUR, formatDate, QUOTE_STATUS_OPTIONS, INVOICE_STATUS_OPTIONS } from '../lib/calc'
import StatusSelect from '../components/StatusSelect'

export default function Dashboard() {
  const { business } = useAuth()
  const [stats, setStats] = useState({ quotesCount: 0, invoicesCount: 0, unpaidTotal: 0, acceptedQuotes: 0 })
  const [recentQuotes, setRecentQuotes] = useState([])
  const [recentInvoices, setRecentInvoices] = useState([])
  const [chartData, setChartData] = useState([])

  useEffect(() => {
    if (business) loadStats()
  }, [business])

  async function loadStats() {
    const { data: quotes } = await supabase
      .from('quotes')
      .select('*')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })

    const { data: invoices } = await supabase
      .from('invoices')
      .select('*, clients(name)')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })

    const unpaidTotal = (invoices || [])
      .filter((i) => i.status !== 'paid')
      .reduce((sum, i) => sum + Number(i.total_ttc) - Number(i.deposit_paid || 0), 0)

    setStats({
      quotesCount: quotes?.length || 0,
      invoicesCount: invoices?.length || 0,
      unpaidTotal,
      acceptedQuotes: (quotes || []).filter((q) => q.status === 'accepted').length,
    })
    setRecentQuotes((quotes || []).slice(0, 5))
    setRecentInvoices((invoices || []).slice(0, 5))
    setChartData(buildMonthlyRevenue(invoices || []))
  }

  // Regroupe le CA (factures payées) des 6 derniers mois
  function buildMonthlyRevenue(invoices) {
    const months = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('fr-FR', { month: 'short' }), total: 0 })
    }
    invoices
      .filter((inv) => inv.status === 'paid')
      .forEach((inv) => {
        const d = new Date(inv.issue_date)
        const key = `${d.getFullYear()}-${d.getMonth()}`
        const month = months.find((m) => m.key === key)
        if (month) month.total += Number(inv.total_ttc)
      })
    return months
  }

  async function updateQuoteStatus(quoteId, newStatus) {
    setRecentQuotes((qs) => qs.map((q) => (q.id === quoteId ? { ...q, status: newStatus } : q)))
    await supabase.from('quotes').update({ status: newStatus }).eq('id', quoteId)
  }

  async function updateInvoiceStatus(invoiceId, newStatus) {
    setRecentInvoices((invs) => invs.map((i) => (i.id === invoiceId ? { ...i, status: newStatus } : i)))
    await supabase.from('invoices').update({ status: newStatus }).eq('id', invoiceId)
  }

  return (
    <div>
      <header className="page-header">
        <h1>Tableau de bord</h1>
        <Link to="/devis/nouveau" className="btn-primary">+ Nouveau devis</Link>
      </header>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Devis créés</span>
          <span className="stat-value">{stats.quotesCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Devis acceptés</span>
          <span className="stat-value">{stats.acceptedQuotes}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Factures émises</span>
          <span className="stat-value">{stats.invoicesCount}</span>
        </div>
        <div className="stat-card highlight">
          <span className="stat-label">Reste à encaisser</span>
          <span className="stat-value">{formatEUR(stats.unpaidTotal)}</span>
        </div>
      </div>

      <section className="panel">
        <h2>Chiffre d'affaires — 6 derniers mois</h2>
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1E293B" vertical={false} />
              <XAxis dataKey="label" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}€`} width={50} />
              <Tooltip formatter={(v) => formatEUR(v)} contentStyle={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, borderRadius: 6, background: '#111A2E', borderColor: '#1E293B', color: '#fff' }} />
              <Line type="monotone" dataKey="total" stroke="#22D3EE" strokeWidth={2.5} dot={{ fill: '#22D3EE', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <h2>Derniers devis</h2>
        {recentQuotes.length === 0 ? (
          <p className="empty-state">Aucun devis pour l'instant. Crée ton premier devis pour commencer.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>N°</th><th>Date</th><th>Total TTC</th><th>Statut</th></tr>
            </thead>
            <tbody>
              {recentQuotes.map((q) => (
                <tr key={q.id}>
                  <td><Link to={`/devis/${q.id}`}>{q.number}</Link></td>
                  <td>{formatDate(q.issue_date)}</td>
                  <td>{formatEUR(q.total_ttc)}</td>
                  <td><StatusSelect status={q.status} options={QUOTE_STATUS_OPTIONS} onChange={(s) => updateQuoteStatus(q.id, s)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>Dernières factures</h2>
        {recentInvoices.length === 0 ? (
          <p className="empty-state">Aucune facture pour l'instant.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>N°</th><th>Client</th><th>Total TTC</th><th>Reste à payer</th><th>Statut</th></tr>
            </thead>
            <tbody>
              {recentInvoices.map((inv) => {
                const remaining = Number(inv.total_ttc) - Number(inv.deposit_paid || 0)
                return (
                  <tr key={inv.id}>
                    <td><Link to={`/factures/${inv.id}`}>{inv.number}</Link></td>
                    <td>{inv.clients?.name}</td>
                    <td>{formatEUR(inv.total_ttc)}</td>
                    <td>{inv.status === 'paid' ? '—' : formatEUR(remaining)}</td>
                    <td><StatusSelect status={inv.status} options={INVOICE_STATUS_OPTIONS} onChange={(s) => updateInvoiceStatus(inv.id, s)} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
