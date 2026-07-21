import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatEUR, formatDate, INVOICE_TYPE_LABELS } from '../lib/calc'
import StatusStamp from '../components/StatusStamp'

export default function Factures() {
  const { business } = useAuth()
  const [invoices, setInvoices] = useState([])

  useEffect(() => {
    if (business) load()
  }, [business])

  async function load() {
    const { data } = await supabase
      .from('invoices')
      .select('*, clients(name)')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
    setInvoices(data || [])
  }

  return (
    <div>
      <header className="page-header">
        <h1>Factures</h1>
        <Link to="/factures/nouvelle" className="btn-primary">+ Nouvelle facture</Link>
      </header>

      <section className="panel">
        {invoices.length === 0 ? (
          <p className="empty-state">Aucune facture pour l'instant. Crée-en une directement, ou convertis un devis accepté.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>N°</th><th>Type</th><th>Client</th><th>Date</th><th>Total TTC</th><th>Statut</th></tr></thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td><Link to={`/factures/${inv.id}`}>{inv.number}</Link></td>
                  <td>{INVOICE_TYPE_LABELS[inv.invoice_type] || 'Facture'}</td>
                  <td>{inv.clients?.name}</td>
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
