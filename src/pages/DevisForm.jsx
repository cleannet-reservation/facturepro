import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { computeTotals, formatEUR } from '../lib/calc'

function emptyItem() {
  return { description: '', quantity: 1, unit_price: 0, tva_rate: 20 }
}

export default function DevisForm() {
  const { business } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams() // présent seulement en mode édition (/devis/:id/modifier)
  const isEditMode = !!id

  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState('')
  const [services, setServices] = useState([])
  const [validityDate, setValidityDate] = useState(defaultValidity())
  const [taxCreditEligible, setTaxCreditEligible] = useState(false)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([emptyItem()])
  const [discountType, setDiscountType] = useState('none')
  const [discountValue, setDiscountValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingQuote, setLoadingQuote] = useState(isEditMode)
  const [quoteNumber, setQuoteNumber] = useState('')

  function defaultValidity() {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  }

  useEffect(() => {
    if (business) {
      loadClients()
      loadServices()
      if (isEditMode) loadExistingQuote()
    }
  }, [business, id])

  async function loadExistingQuote() {
    const { data: quote } = await supabase.from('quotes').select('*').eq('id', id).single()
    if (!quote) return
    setQuoteNumber(quote.number)
    setClientId(quote.client_id)
    setValidityDate(quote.validity_date || defaultValidity())
    setTaxCreditEligible(!!quote.tax_credit_eligible)
    setDiscountType(quote.discount_type || 'none')
    setDiscountValue(quote.discount_value > 0 ? quote.discount_value : '')
    setNotes(quote.notes || '')

    const { data: its } = await supabase.from('quote_items').select('*').eq('quote_id', id).order('position')
    if (its && its.length > 0) {
      setItems(its.map((it) => ({ description: it.description, quantity: it.quantity, unit_price: it.unit_price, tva_rate: it.tva_rate })))
    }
    setLoadingQuote(false)
  }

  async function loadServices() {
    const { data } = await supabase.from('services').select('*').eq('business_id', business.id).order('name')
    setServices(data || [])
  }

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*').eq('business_id', business.id).order('name')
    setClients(data || [])
    if (!isEditMode && data && data.length > 0) setClientId(data[0].id)
  }

  function updateItem(index, field, value) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)))
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()])
  }

  function addFromCatalogue(serviceId) {
    const service = services.find((s) => s.id === serviceId)
    if (!service) return
    setItems((prev) => [...prev, { description: service.name, quantity: 1, unit_price: service.unit_price, tva_rate: service.tva_rate }])
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const totals = computeTotals(items, business?.tax_regime, { type: discountType, value: discountValue })

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
      if (isEditMode) {
        const { error: updateError } = await supabase
          .from('quotes')
          .update({
            client_id: clientId,
            validity_date: validityDate,
            notes,
            tax_credit_eligible: taxCreditEligible,
            ...totals,
          })
          .eq('id', id)
        if (updateError) throw updateError

        // Repart d'une liste de lignes propre : on supprime les anciennes, on insère les nouvelles
        await supabase.from('quote_items').delete().eq('quote_id', id)
        const itemsPayload = items.map((it, i) => ({
          quote_id: id,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          tva_rate: business.tax_regime === 'assujetti' ? it.tva_rate : 0,
          position: i,
        }))
        const { error: itemsError } = await supabase.from('quote_items').insert(itemsPayload)
        if (itemsError) throw itemsError

        navigate(`/devis/${id}`)
      } else {
        const number = `D-${String(business.quote_next_number).padStart(4, '0')}`

        const { data: quote, error: quoteError } = await supabase
          .from('quotes')
          .insert({
            business_id: business.id,
            client_id: clientId,
            number,
            validity_date: validityDate,
            notes,
            tax_credit_eligible: taxCreditEligible,
            ...totals,
          })
          .select()
          .single()
        if (quoteError) throw quoteError

        const itemsPayload = items.map((it, i) => ({
          quote_id: quote.id,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          tva_rate: business.tax_regime === 'assujetti' ? it.tva_rate : 0,
          position: i,
        }))
        const { error: itemsError } = await supabase.from('quote_items').insert(itemsPayload)
        if (itemsError) throw itemsError

        await supabase.from('businesses').update({ quote_next_number: business.quote_next_number + 1 }).eq('id', business.id)

        navigate(`/devis/${quote.id}`)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loadingQuote) return <p>Chargement…</p>

  return (
    <div>
      <header className="page-header">
        <h1>{isEditMode ? `Modifier le devis ${quoteNumber}` : 'Nouveau devis'}</h1>
      </header>

      <form onSubmit={handleSubmit} className="panel">
        <div className="form-grid">
          <label>
            Client
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              {clients.length === 0 && <option value="">Aucun client — crée-en un d'abord</option>}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.client_type === 'professionnel' ? c.company_name : c.name}</option>
              ))}
            </select>
          </label>
          <label>
            Valable jusqu'au
            <input type="date" value={validityDate} onChange={(e) => setValidityDate(e.target.value)} />
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
                <td><textarea rows={1} className="description-input" value={it.description} onChange={(e) => updateItem(i, 'description', e.target.value)} placeholder="Nettoyage canapé 3 places" /></td>
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
        <div className="action-row">
          <button type="button" className="link-btn" onClick={addItem}>+ Ajouter une ligne</button>
          {services.length > 0 && (
            <select
              className="catalogue-select"
              value=""
              onChange={(e) => { if (e.target.value) addFromCatalogue(e.target.value); e.target.value = '' }}
            >
              <option value="">+ Depuis le catalogue…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {formatEUR(s.unit_price)}</option>
              ))}
            </select>
          )}
        </div>

        <div className="form-grid" style={{ marginTop: 12, alignItems: 'flex-end' }}>
          <label>Réduction
            <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
              <option value="none">Aucune</option>
              <option value="percent">Pourcentage (%)</option>
              <option value="amount">Montant fixe (€)</option>
            </select>
          </label>
          {discountType !== 'none' && (
            <label>{discountType === 'percent' ? 'Valeur (%)' : 'Valeur (€)'}
              <input type="number" min="0" step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="0" />
            </label>
          )}
        </div>

        <div className="totals-box">
          <div><span>Sous-total</span><span>{formatEUR(items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0))}</span></div>
          {totals.discount_amount > 0 && (
            <div><span>Réduction</span><span>- {formatEUR(totals.discount_amount)}</span></div>
          )}
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
          {busy ? 'Enregistrement…' : isEditMode ? 'Enregistrer les modifications' : 'Créer le devis'}
        </button>
      </form>
    </div>
  )
}
