import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatEUR, formatDate } from '../lib/calc'
import { flagOverdueInvoices } from '../lib/invoiceHelpers'
import StatusStamp from '../components/StatusStamp'

export default function Tresorerie() {
  const { business } = useAuth()
  const [unpaidInvoices, setUnpaidInvoices] = useState([])
  const [chartData, setChartData] = useState([])
  const [recurringTotal, setRecurringTotal] = useState(0)

  useEffect(() => {
    if (business) load()
  }, [business])

  async function load() {
    const { data: invoicesRaw } = await supabase
      .from('invoices')
      .select('*, clients(name)')
      .eq('business_id', business.id)
      .neq('status', 'paid')
      .order('due_date', { ascending: true, nullsFirst: false })

    const invoices = await flagOverdueInvoices(invoicesRaw || [])
    setUnpaidInvoices(invoices)
    setChartData(buildForecast(invoices))

    const { data: recurring } = await supabase
      .from('recurring_invoices')
      .select('amount')
      .eq('business_id', business.id)
      .eq('active', true)
    setRecurringTotal((recurring || []).reduce((sum, r) => sum + Number(r.amount), 0))
  }

  // Regroupe le montant restant dû par mois d'échéance (retard + 6 mois à venir)
  function buildForecast(invoices) {
    const now = new Date()
    const months = [{ key: 'retard', label: 'En retard', total: 0, isOverdue: true }]
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('fr-FR', { month: 'short' }), total: 0 })
    }

    invoices.forEach((inv) => {
      const remaining = Number(inv.total_ttc) - Number(inv.deposit_paid || 0)
      if (remaining <= 0) return

      if (inv.status === 'overdue' || !inv.due_date) {
        months[0].total += remaining
        return
      }
      const d = new Date(inv.due_date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const month = months.find((m) => m.key === key)
      if (month) month.total += remaining
      else if (d < now) months[0].total += remaining
      // Au-delà de 6 mois : non affiché sur le graphique, mais reste dans le tableau détaillé
    })

    return months
  }

  const totalAttendu = unpaidInvoices.reduce((sum, inv) => sum + (Number(inv.total_ttc) - Number(inv.deposit_paid || 0)), 0)
  const totalEnRetard = unpaidInvoices
    .filter((inv) => inv.status === 'overdue')
    .reduce((sum, inv) => sum + (Number(inv.total_ttc) - Number(inv.deposit_paid || 0)), 0)

  return (
    <div>
      <header className="page-header">
        <h1>Trésorerie prévisionnelle</h1>
      </header>

      <div className="stat-grid">
        <div className="stat-card highlight">
          <span className="stat-label">Total à encaisser</span>
          <span className="stat-value">{formatEUR(totalAttendu)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Dont en retard</span>
          <span className="stat-value">{formatEUR(totalEnRetard)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Factures en attente</span>
          <span className="stat-value">{unpaidInvoices.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Récurrent mensuel actif</span>
          <span className="stat-value">{formatEUR(recurringTotal)}</span>
        </div>
      </div>

      <section className="panel">
        <h2>Argent à venir — par échéance</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Basé sur les factures non payées et leur date d'échéance. Ne tient pas compte des devis pas encore facturés.
        </p>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1E293B" vertical={false} />
              <XAxis dataKey="label" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}€`} width={50} />
              <Tooltip formatter={(v) => formatEUR(v)} contentStyle={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, borderRadius: 6, background: '#111A2E', borderColor: '#1E293B', color: '#fff' }} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.isOverdue ? '#F87171' : '#22D3EE'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <h2>Factures en attente de paiement</h2>
        {unpaidInvoices.length === 0 ? (
          <p className="empty-state">Aucune facture en attente — tout est encaissé 🎉</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>N°</th><th>Client</th><th>Échéance</th><th>Reste à payer</th><th>Statut</th></tr></thead>
            <tbody>
              {unpaidInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td><Link to={`/factures/${inv.id}`}>{inv.number}</Link></td>
                  <td>{inv.clients?.name}</td>
                  <td>{inv.due_date ? formatDate(inv.due_date) : '—'}</td>
                  <td>{formatEUR(Number(inv.total_ttc) - Number(inv.deposit_paid || 0))}</td>
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
