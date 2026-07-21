import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatEUR, formatDate, INVOICE_TYPE_LABELS, INVOICE_STATUS_OPTIONS } from '../lib/calc'
import StatusSelect from '../components/StatusSelect'

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

  async function updateStatus(invoiceId, newStatus) {
    setInvoices((invs) => invs.map((i) => (i.id === invoiceId ? { ...i, status: newStatus } : i)))
    await supabase.from('invoices').update({ status: newStatus }).eq('id', invoiceId)
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
