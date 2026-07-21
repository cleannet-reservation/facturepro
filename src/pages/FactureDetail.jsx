import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatEUR, formatDate, computeCreditImpot, INVOICE_TYPE_LABELS } from '../lib/calc'
import { downloadDocumentPDF } from '../lib/pdfGenerator'
import StatusStamp from '../components/StatusStamp'

export default function FactureDetail() {
  const { id } = useParams()
  const { business } = useAuth()
  const [invoice, setInvoice] = useState(null)
  const [client, setClient] = useState(null)
  const [items, setItems] = useState([])
  const [depositAmount, setDepositAmount] = useState('')
  const [deductedInvoice, setDeductedInvoice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    const { data: inv } = await supabase.from('invoices').select('*, clients(*)').eq('id', id).single()
    if (!inv) return
    setInvoice(inv)
    setClient(inv.clients)
    setDepositAmount(inv.deposit_requested > 0 ? inv.deposit_requested : Math.round(inv.total_ttc * 0.3 * 100) / 100)
    const { data: its } = await supabase.from('invoice_items').select('*').eq('invoice_id', id).order('position')
    setItems(its || [])

    if (inv.invoice_type === 'solde' && inv.quote_id) {
      const { data: acomptes } = await supabase
        .from('invoices')
        .select('number, total_ttc')
        .eq('quote_id', inv.quote_id)
        .eq('invoice_type', 'acompte')
      if (acomptes && acomptes.length > 0) {
        setDeductedInvoice({
          number: acomptes.map((a) => a.number).join(', '),
          total_ttc: acomptes.reduce((sum, a) => sum + Number(a.total_ttc), 0),
        })
      }
    }
  }

  async function handleDownloadPDF() {
    const pdfTypeLabel = {
      acompte: "FACTURE D'ACOMPTE",
      solde: 'FACTURE DE SOLDE',
      standalone: 'FACTURE',
    }[invoice.invoice_type] || 'FACTURE'

    await downloadDocumentPDF({
      type: pdfTypeLabel,
      number: invoice.number,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      business,
      client,
      items,
      subtotal_ht: invoice.subtotal_ht,
      tva_amount: invoice.tva_amount,
      total_ttc: invoice.total_ttc,
      deposit_requested: invoice.invoice_type === 'standalone' ? invoice.deposit_requested : 0,
      deducted_invoice: deductedInvoice,
      tax_credit_eligible: invoice.tax_credit_eligible,
      notes: invoice.notes,
    })
  }

  async function generatePaymentLink() {
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/create-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(depositAmount),
          description: `Acompte — Facture ${invoice.number}`,
          invoiceNumber: invoice.number,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la création du lien de paiement')

      await supabase
        .from('invoices')
        .update({ deposit_requested: Number(depositAmount), stripe_payment_link_url: data.url })
        .eq('id', id)

      setInvoice((inv) => ({ ...inv, deposit_requested: Number(depositAmount), stripe_payment_link_url: data.url }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function markDepositPaid() {
    setBusy(true)
    await supabase
      .from('invoices')
      .update({ deposit_paid: invoice.deposit_requested, status: 'partially_paid' })
      .eq('id', id)
    await supabase.from('payments').insert({ invoice_id: id, amount: invoice.deposit_requested, type: 'deposit' })
    setInvoice((inv) => ({ ...inv, deposit_paid: inv.deposit_requested, status: 'partially_paid' }))
    setBusy(false)
  }

  async function markFullyPaid() {
    setBusy(true)
    await supabase.from('invoices').update({ status: 'paid' }).eq('id', id)
    setInvoice((inv) => ({ ...inv, status: 'paid' }))
    setBusy(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(invoice.stripe_payment_link_url)
  }

  if (!invoice || !client) return <p>Chargement…</p>

  const remaining = invoice.total_ttc - (invoice.deposit_paid || 0)

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>{INVOICE_TYPE_LABELS[invoice.invoice_type] || 'Facture'} {invoice.number}</h1>
          {deductedInvoice && (
            <div className="muted">Déduit de la facture d'acompte {deductedInvoice.number} ({formatEUR(deductedInvoice.total_ttc)})</div>
          )}
        </div>
        <StatusStamp status={invoice.status} />
      </header>

      <section className="panel doc-summary">
        <div>
          <strong>{client.name}</strong>
          <div className="muted">{client.address} {client.postal_code} {client.city}</div>
        </div>
        <div className="doc-meta">
          <div>Émise le {formatDate(invoice.issue_date)}</div>
          {invoice.due_date && <div>Échéance {formatDate(invoice.due_date)}</div>}
        </div>
      </section>

      <section className="panel">
        <table className="data-table">
          <thead><tr><th>Description</th><th>Qté</th><th>PU</th><th>Total</th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>{it.description}</td>
                <td>{it.quantity}</td>
                <td>{formatEUR(it.unit_price)}</td>
                <td>{formatEUR(it.quantity * it.unit_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="totals-box">
          <div className="total-ttc"><span>Total TTC</span><span>{formatEUR(invoice.total_ttc)}</span></div>
          {invoice.deposit_paid > 0 && (
            <div><span>Reste à payer</span><span>{formatEUR(remaining)}</span></div>
          )}
        </div>

        {invoice.tax_credit_eligible && (
          <div className="form-info" style={{ marginTop: 14 }}>
            Éligible au crédit d'impôt Services à la Personne (50%) — crédit estimé {formatEUR(computeCreditImpot(invoice.total_ttc))}, reste à charge réel {formatEUR(invoice.total_ttc - computeCreditImpot(invoice.total_ttc))}.
          </div>
        )}
      </section>

      <section className="panel">
        <h2 className="section-title">Acompte en ligne</h2>
        {invoice.status === 'paid' ? (
          <p className="empty-state">Facture entièrement réglée.</p>
        ) : (
          <>
            <div className="form-grid">
              <label>
                Montant de l'acompte (€)
                <input type="number" min="0" step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
              </label>
              <div className="deposit-actions">
                <button className="btn-secondary" disabled={busy} onClick={generatePaymentLink}>
                  {invoice.stripe_payment_link_url ? 'Régénérer le lien' : 'Générer le lien de paiement'}
                </button>
              </div>
            </div>

            {invoice.stripe_payment_link_url && (
              <div className="payment-link-box">
                <input readOnly value={invoice.stripe_payment_link_url} />
                <button className="btn-secondary" onClick={copyLink}>Copier</button>
              </div>
            )}

            {error && <div className="form-error">{error}</div>}

            <div className="action-row">
              {invoice.deposit_requested > 0 && invoice.deposit_paid === 0 && (
                <button className="btn-secondary" disabled={busy} onClick={markDepositPaid}>Marquer l'acompte comme reçu</button>
              )}
              <button className="btn-primary" disabled={busy} onClick={markFullyPaid}>Marquer la facture comme soldée</button>
            </div>
          </>
        )}
      </section>

      <section className="panel action-row">
        <button className="btn-secondary" onClick={handleDownloadPDF}>Télécharger le PDF</button>
      </section>
    </div>
  )
}
