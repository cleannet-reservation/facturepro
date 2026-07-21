import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatEUR, formatDate, computeCreditImpot, INVOICE_TYPE_LABELS } from '../lib/calc'
import { downloadDocumentPDF, getDocumentPDFBase64 } from '../lib/pdfGenerator'
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
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailStatus, setEmailStatus] = useState('')

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

  function buildPdfDoc() {
    const pdfTypeLabel = {
      acompte: "FACTURE D'ACOMPTE",
      solde: 'FACTURE DE SOLDE',
      standalone: 'FACTURE',
    }[invoice.invoice_type] || 'FACTURE'

    return {
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
    }
  }

  async function handleDownloadPDF() {
    await downloadDocumentPDF(buildPdfDoc())
  }

  async function handleSendEmail() {
    if (!client.email) {
      setEmailStatus("Ce client n'a pas d'adresse email enregistrée.")
      return
    }
    setSendingEmail(true)
    setEmailStatus('')
    try {
      const docData = buildPdfDoc()
      const { base64, filename } = await getDocumentPDFBase64(docData)

      const docLabel = INVOICE_TYPE_LABELS[invoice.invoice_type] || 'Facture'
      const paymentLine = invoice.stripe_payment_link_url
        ? `<p><a href="${invoice.stripe_payment_link_url}" style="display:inline-block; background:#2F6F5E; color:#fff; padding:10px 18px; border-radius:6px; text-decoration:none;">Payer en ligne</a></p>`
        : ''

      const html = `
        <div style="font-family: Arial, sans-serif; color: #1B2A4A; max-width: 560px;">
          <h2 style="color: #21503F;">${docLabel} ${invoice.number} — ${business.name}</h2>
          <p>Bonjour ${client.name},</p>
          <p>Veuillez trouver ci-joint votre ${docLabel.toLowerCase()} d'un montant de <strong>${formatEUR(invoice.total_ttc)}</strong>
          ${invoice.due_date ? `, à régler avant le ${formatDate(invoice.due_date)}` : ''}.</p>
          ${paymentLine}
          <p>Cordialement,<br/>${business.name}</p>
        </div>
      `

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: client.email,
          toName: client.name,
          subject: `${docLabel} ${invoice.number} — ${business.name}`,
          htmlContent: html,
          senderName: business.name,
          senderEmail: business.email,
          attachment: { name: filename, content: base64 },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi")

      if (invoice.status === 'draft') {
        await supabase.from('invoices').update({ status: 'sent' }).eq('id', id)
        setInvoice((inv) => ({ ...inv, status: 'sent' }))
      }
      setEmailStatus('Email envoyé avec succès.')
    } catch (err) {
      setEmailStatus(`Erreur : ${err.message}`)
    } finally {
      setSendingEmail(false)
    }
  }

  async function generatePaymentLink(amount) {
    setError('')
    if (!amount || amount <= 0) {
      setError('Montant invalide.')
      return
    }
    setBusy(true)
    try {
      const isFullPayment = amount >= invoice.total_ttc - (invoice.deposit_paid || 0) - 0.01
      const res = await fetch('/api/create-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          description: `${isFullPayment ? 'Paiement' : 'Acompte'} — Facture ${invoice.number}`,
          invoiceNumber: invoice.number,
          invoiceId: invoice.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la création du lien de paiement')

      await supabase
        .from('invoices')
        .update({ deposit_requested: amount, stripe_payment_link_url: data.url })
        .eq('id', id)

      setInvoice((inv) => ({ ...inv, deposit_requested: amount, stripe_payment_link_url: data.url }))
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
        <h2 className="section-title">Paiement de la facture en ligne</h2>
        {invoice.status === 'paid' ? (
          <p className="empty-state">Facture entièrement réglée.</p>
        ) : (
          <>
            <p className="muted" style={{ marginBottom: 12 }}>
              Génère un lien pour que le client règle la totalité restante ({formatEUR(invoice.total_ttc - (invoice.deposit_paid || 0))}) en une fois.
            </p>
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() => generatePaymentLink(invoice.total_ttc - (invoice.deposit_paid || 0))}
            >
              Générer le lien de paiement complet
            </button>

            {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}
          </>
        )}
      </section>

      {invoice.status !== 'paid' && (
        <section className="panel">
          <h2 className="section-title">Demander un acompte</h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            Génère un lien pour que le client règle uniquement un acompte, le reste étant à facturer plus tard.
          </p>
          <div className="action-row">
            <button className="btn-secondary" disabled={busy} onClick={() => generatePaymentLink(Math.round(invoice.total_ttc * 0.3 * 100) / 100)}>
              Acompte 30% ({formatEUR(invoice.total_ttc * 0.3)})
            </button>
            <button className="btn-secondary" disabled={busy} onClick={() => generatePaymentLink(Math.round(invoice.total_ttc * 0.5 * 100) / 100)}>
              Acompte 50% ({formatEUR(invoice.total_ttc * 0.5)})
            </button>
          </div>

          <div className="form-grid" style={{ marginTop: 16 }}>
            <label>
              Ou un montant personnalisé (€)
              <input type="number" min="0" step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
            </label>
            <div className="deposit-actions">
              <button className="btn-secondary" disabled={busy} onClick={() => generatePaymentLink(Number(depositAmount))}>
                Générer ce montant
              </button>
            </div>
          </div>
        </section>
      )}

      {invoice.stripe_payment_link_url && (
        <section className="panel">
          <h2 className="section-title">Lien actif à envoyer au client</h2>
          <div className="payment-link-box">
            <input readOnly value={invoice.stripe_payment_link_url} />
            <button className="btn-secondary" onClick={copyLink}>Copier</button>
          </div>
          <p className="muted">
            Montant demandé : {formatEUR(invoice.deposit_requested)}. Générer un nouveau lien (ci-dessus) remplace celui-ci.
          </p>

          {invoice.status !== 'paid' && (
            <div className="action-row">
              {invoice.deposit_requested > 0 && invoice.deposit_paid === 0 && (
                <button className="btn-secondary" disabled={busy} onClick={markDepositPaid}>Marquer ce montant comme reçu</button>
              )}
              <button className="btn-primary" disabled={busy} onClick={markFullyPaid}>Marquer la facture comme soldée</button>
            </div>
          )}
        </section>
      )}

      <section className="panel action-row">
        <button className="btn-secondary" onClick={handleDownloadPDF}>Télécharger le PDF</button>
        <button className="btn-secondary" disabled={sendingEmail} onClick={handleSendEmail}>
          {sendingEmail ? 'Envoi…' : 'Envoyer par email'}
        </button>
      </section>

      {emailStatus && (
        <section className="panel">
          <p className={emailStatus.startsWith('Erreur') ? 'form-error' : 'form-info'} style={{ margin: 0 }}>{emailStatus}</p>
        </section>
      )}
    </div>
  )
}
