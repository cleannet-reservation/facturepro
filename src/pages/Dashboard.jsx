import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatEUR } from '../lib/calc'

export default function Dashboard() {
  const { business } = useAuth()
  const [stats, setStats] = useState({ quotesCount: 0, invoicesCount: 0, unpaidTotal: 0, acceptedQuotes: 0 })
  const [recentQuotes, setRecentQuotes] = useState([])
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
      .select('*')
      .eq('business_id', business.id)

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
                  <td>{q.issue_date}</td>
                  <td>{formatEUR(q.total_ttc)}</td>
                  <td>{q.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
