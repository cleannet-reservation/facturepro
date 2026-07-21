import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatEUR, formatDate } from '../lib/calc'
import { downloadDocumentPDF } from '../lib/pdfGenerator'
import StatusStamp from '../components/StatusStamp'

export default function DevisDetail() {
  const { id } = useParams()
  const { business } = useAuth()
  const navigate = useNavigate()
  const [quote, setQuote] = useState(null)
  const [client, setClient] = useState(null)
  const [items, setItems] = useState([])
  const [relatedInvoices, setRelatedInvoices] = useState([])
  const [depositPercent, setDepositPercent] = useState(30)
  const [showDepositForm, setShowDepositForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailStatus, setEmailStatus] = useState('')

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    const { data: q } = await supabase.from('quotes').select('*, clients(*)').eq('id', id).single()
    if (!q) return
    setQuote(q)
    setClient(q.clients)
    const { data: its } = await supabase.from('quote_items').select('*').eq('quote_id', id).order('position')
    setItems(its || [])
    const { data: invs } = await supabase.from('invoices').select('*').eq('quote_id', id).order('created_at')
    setRelatedInvoices(invs || [])
  }

  const alreadyInvoicedAcompte = relatedInvoices
    .filter((inv) => inv.invoice_type === 'acompte')
    .reduce((sum, inv) => sum + Number(inv.total_ttc), 0)

  const hasSolde = relatedInvoices.some((inv) => inv.invoice_type === 'solde')
  const hasStandalone = relatedInvoices.some((inv) => inv.invoice_type === 'standalone')

  async function updateStatus(status) {
    setBusy(true)
    const patch = { status }
    if (status === 'accepted') {
      patch.accepted_at = new Date().toISOString()
      patch.accepted_by_name = client?.name
    }
    const { error } = await supabase.from('quotes').update(patch).eq('id', id)
    if (!error) setQuote((q) => ({ ...q, ...patch }))
    setBusy(false)
  }

  async function handleSendEmail() {
    if (!client.email) {
      setEmailStatus("Ce client n'a pas d'adresse email enregistrée.")
      return
    }
    setSendingEmail(true)
    setEmailStatus('')
    try {
      const publicUrl = `${window.location.origin}/consultation/devis/${quote.public_token}`
      const html = `
        <div style="font-family: Arial, sans-serif; color: #1B2A4A; max-width: 560px;">
          <h2 style="color: #21503F;">Devis ${quote.number} — ${business.name}</h2>
          <p>Bonjour ${client.name},</p>
          <p>Voici votre devis d'un montant de <strong>${formatEUR(quote.total_ttc)}</strong>, valable
          ${quote.validity_date ? `jusqu'au ${formatDate(quote.validity_date)}` : '30 jours'}.</p>
          <p><a href="${publicUrl}" style="display:inline-block; background:#2F6F5E; color:#fff; padding:10px 18px; border-radius:6px; text-decoration:none;">Consulter et accepter le devis</a></p>
          <p style="color:#6E6355; font-size:13px;">Ou copiez ce lien dans votre navigateur : ${publicUrl}</p>
          <p>Cordialement,<br/>${business.name}</p>
        </div>
      `
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: client.email,
          toName: client.name,
          subject: `Devis ${quote.number} — ${business.name}`,
          htmlContent: html,
          senderName: business.name,
          senderEmail: business.email,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi")

      if (quote.status === 'draft') await updateStatus('sent')
      setEmailStatus('Email envoyé avec succès.')
    } catch (err) {
      setEmailStatus(`Erreur : ${err.message}`)
    } finally {
      setSendingEmail(false)
    }
  }

  async function handleDownloadPDF() {
    await downloadDocumentPDF({
      type: 'DEVIS',
      number: quote.number,
      issue_date: quote.issue_date,
      validity_date: quote.validity_date,
      business,
      client,
      items,
      subtotal_ht: quote.subtotal_ht,
      tva_amount: quote.tva_amount,
      total_ttc: quote.total_ttc,
      tax_credit_eligible: quote.tax_credit_eligible,
      notes: quote.notes,
    })
  }

  // Crée une facture d'acompte, une facture de solde, ou une facture complète standalone.
  // type: 'acompte' | 'solde' | 'standalone'
  async function createInvoice(type, depositAmount) {
    setBusy(true)
    try {
      const number = `F-${String(business.invoice_next_number).padStart(4, '0')}`
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 30)

      let invoiceTotals
      let invoiceItems
      let notes = quote.notes

      if (type === 'acompte') {
        const ratio = depositAmount / quote.total_ttc
        invoiceTotals = {
          subtotal_ht: Math.round(quote.subtotal_ht * ratio * 100) / 100,
          tva_amount: Math.round(quote.tva_amount * ratio * 100) / 100,
          total_ttc: depositAmount,
        }
        invoiceItems = [{
          description: `Acompte sur devis ${quote.number} (${depositPercent}%)`,
          quantity: 1,
          unit_price: depositAmount,
          tva_rate: 0,
          position: 0,
        }]
      } else if (type === 'solde') {
        const remaining = Math.round((quote.total_ttc - alreadyInvoicedAcompte) * 100) / 100
        const ratio = remaining / quote.total_ttc
        invoiceTotals = {
          subtotal_ht: Math.round(quote.subtotal_ht * ratio * 100) / 100,
          tva_amount: Math.round(quote.tva_amount * ratio * 100) / 100,
          total_ttc: remaining,
        }
        invoiceItems = [{
          description: `Solde sur devis ${quote.number}`,
          quantity: 1,
          unit_price: remaining,
          tva_rate: 0,
          position: 0,
        }]
      } else {
        invoiceTotals = {
          subtotal_ht: quote.subtotal_ht,
          tva_amount: quote.tva_amount,
          total_ttc: quote.total_ttc,
        }
        invoiceItems = items.map((it, i) => ({
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          tva_rate: it.tva_rate,
          position: i,
        }))
      }

      const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .insert({
          business_id: business.id,
          client_id: client.id,
          quote_id: quote.id,
          number,
          invoice_type: type,
          due_date: dueDate.toISOString().slice(0, 10),
          notes,
          tax_credit_eligible: quote.tax_credit_eligible,
          ...invoiceTotals,
        })
        .select()
        .single()
      if (invError) throw invError

      const itemsPayload = invoiceItems.map((it) => ({ ...it, invoice_id: invoice.id }))
      await supabase.from('invoice_items').insert(itemsPayload)
      await supabase.from('businesses').update({ invoice_next_number: business.invoice_next_number + 1 }).eq('id', business.id)

      navigate(`/factures/${invoice.id}`)
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  function handleCreateDepositInvoice() {
    const depositAmount = Math.round(quote.total_ttc * (depositPercent / 100) * 100) / 100
    createInvoice('acompte', depositAmount)
  }

  if (!quote || !client) return <p>Chargement…</p>

  return (
    <div>
      <header className="page-header">
        <h1>Devis {quote.number}</h1>
        <StatusStamp status={quote.status} />
      </header>

      <section className="panel doc-summary">
        <div>
          <strong>{client.name}</strong>
          <div className="muted">{client.address} {client.postal_code} {client.city}</div>
        </div>
        <div className="doc-meta">
          <div>Émis le {formatDate(quote.issue_date)}</div>
          {quote.validity_date && <div>Valable jusqu'au {formatDate(quote.validity_date)}</div>}
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
          <div className="total-ttc"><span>Total TTC</span><span>{formatEUR(quote.total_ttc)}</span></div>
        </div>
      </section>

      <section className="panel action-row">
        <button className="btn-secondary" onClick={handleDownloadPDF}>Télécharger le PDF</button>
        <button className="btn-secondary" disabled={sendingEmail} onClick={handleSendEmail}>
          {sendingEmail ? 'Envoi…' : 'Envoyer par email'}
        </button>

        {quote.status === 'draft' && (
          <button className="btn-secondary" disabled={busy} onClick={() => updateStatus('sent')}>Marquer comme envoyé</button>
        )}
        {(quote.status === 'sent' || quote.status === 'draft') && (
          <button className="btn-secondary" disabled={busy} onClick={() => updateStatus('accepted')}>Marquer comme accepté</button>
        )}
      </section>

      {emailStatus && (
        <section className="panel">
          <p className={emailStatus.startsWith('Erreur') ? 'form-error' : 'form-info'} style={{ margin: 0 }}>{emailStatus}</p>
        </section>
      )}

      {quote.status === 'accepted' && (
        <section className="panel">
          <h2 className="section-title">Facturation</h2>

          {relatedInvoices.length > 0 && (
            <table className="data-table" style={{ marginBottom: 16 }}>
              <thead><tr><th>N°</th><th>Type</th><th>Montant</th></tr></thead>
              <tbody>
                {relatedInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td><Link to={`/factures/${inv.id}`}>{inv.number}</Link></td>
                    <td>{inv.invoice_type === 'acompte' ? "Facture d'acompte" : inv.invoice_type === 'solde' ? 'Facture de solde' : 'Facture'}</td>
                    <td>{formatEUR(inv.total_ttc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="action-row">
            {!hasStandalone && !hasSolde && (
              <button className="btn-secondary" disabled={busy} onClick={() => setShowDepositForm((s) => !s)}>
                {showDepositForm ? 'Annuler' : "Créer une facture d'acompte"}
              </button>
            )}

            {alreadyInvoicedAcompte > 0 && !hasSolde && (
              <button className="btn-primary" disabled={busy} onClick={() => createInvoice('solde')}>
                Créer la facture de solde ({formatEUR(quote.total_ttc - alreadyInvoicedAcompte)})
              </button>
            )}

            {alreadyInvoicedAcompte === 0 && !hasStandalone && (
              <button className="btn-primary" disabled={busy} onClick={() => createInvoice('standalone')}>
                Créer la facture complète
              </button>
            )}
          </div>

          {showDepositForm && (
            <div className="form-grid" style={{ marginTop: 16, alignItems: 'flex-end' }}>
              <label>
                Pourcentage d'acompte
                <input type="number" min="1" max="99" value={depositPercent} onChange={(e) => setDepositPercent(Number(e.target.value))} />
              </label>
              <div>
                <div className="muted" style={{ marginBottom: 8 }}>
                  Montant : {formatEUR(quote.total_ttc * (depositPercent / 100))}
                </div>
                <button className="btn-primary" disabled={busy} onClick={handleCreateDepositInvoice}>
                  Générer la facture d'acompte
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
