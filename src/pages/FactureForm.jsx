import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { computeTotals, formatEUR } from '../lib/calc'

function emptyItem() {
  return { description: '', quantity: 1, unit_price: 0, tva_rate: 20 }
}

export default function FactureForm() {
  const { business } = useAuth()
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState('')
  const [dueDate, setDueDate] = useState(defaultDueDate())
  const [taxCreditEligible, setTaxCreditEligible] = useState(false)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([emptyItem()])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function defaultDueDate() {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  }

  useEffect(() => {
    if (business) loadClients()
  }, [business])

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*').eq('business_id', business.id).order('name')
    setClients(data || [])
    if (data && data.length > 0) setClientId(data[0].id)
  }

  function updateItem(index, field, value) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)))
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()])
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const totals = computeTotals(items, business?.tax_regime)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!clientId) {
      setError('Sélectionne un client.')
      return
    }
    if (items.length === 0 || items.some((it) => !it.description)) {
      setError('Chaque ligne doit avoir une description.')
      return
    }
    setBusy(true)
    try {
      const number = `F-${String(business.invoice_next_number).padStart(4, '0')}`

      const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .insert({
          business_id: business.id,
          client_id: clientId,
          number,
          invoice_type: 'standalone',
          due_date: dueDate,
          notes,
          tax_credit_eligible: taxCreditEligible,
          ...totals,
        })
        .select()
        .single()
      if (invError) throw invError

      const itemsPayload = items.map((it, i) => ({
        invoice_id: invoice.id,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        tva_rate: business.tax_regime === 'assujetti' ? it.tva_rate : 0,
        position: i,
      }))
      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsPayload)
      if (itemsError) throw itemsError

      await supabase.from('businesses').update({ invoice_next_number: business.invoice_next_number + 1 }).eq('id', business.id)

      navigate(`/factures/${invoice.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <header className="page-header">
        <h1>Nouvelle facture</h1>
      </header>

      <form onSubmit={handleSubmit} className="panel">
        <div className="form-grid">
          <label>
            Client
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              {clients.length === 0 && <option value="">Aucun client — crée-en un d'abord</option>}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label>
            Échéance de paiement
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>

        <h2 className="section-title">Prestations</h2>
        <table className="items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qté</th>
              <th>Prix unitaire (€)</th>
              {business?.tax_regime === 'assujetti' && <th>TVA (%)</th>}
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td><input value={it.description} onChange={(e) => updateItem(i, 'description', e.target.value)} placeholder="Nettoyage canapé 3 places" /></td>
                <td><input type="number" min="0" step="0.5" value={it.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} className="qty-input" /></td>
                <td><input type="number" min="0" step="0.01" value={it.unit_price} onChange={(e) => updateItem(i, 'unit_price', e.target.value)} className="price-input" /></td>
                {business?.tax_regime === 'assujetti' && (
                  <td><input type="number" min="0" step="0.1" value={it.tva_rate} onChange={(e) => updateItem(i, 'tva_rate', e.target.value)} className="tva-input" /></td>
                )}
                <td className="line-total">{formatEUR((it.quantity || 0) * (it.unit_price || 0))}</td>
                <td><button type="button" className="icon-btn" onClick={() => removeItem(i)} aria-label="Supprimer la ligne">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="link-btn" onClick={addItem}>+ Ajouter une ligne</button>

        <div className="totals-box">
          {business?.tax_regime === 'assujetti' && (
            <>
              <div><span>Total HT</span><span>{formatEUR(totals.subtotal_ht)}</span></div>
              <div><span>TVA</span><span>{formatEUR(totals.tva_amount)}</span></div>
            </>
          )}
          <div className="total-ttc"><span>Total TTC</span><span>{formatEUR(totals.total_ttc)}</span></div>
        </div>

        {business?.sap_eligible && (
          <label className="radio-row span-2" style={{ marginTop: 4 }}>
            <input type="checkbox" checked={taxCreditEligible} onChange={(e) => setTaxCreditEligible(e.target.checked)} />
            Ce client est un particulier éligible au crédit d'impôt Services à la Personne (50%)
          </label>
        )}

        <label className="span-2">
          Notes / conditions particulières
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </label>

        {error && <div className="form-error">{error}</div>}

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Création…' : 'Créer la facture'}
        </button>
      </form>
    </div>
  )
}
