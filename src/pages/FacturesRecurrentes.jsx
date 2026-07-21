import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatEUR, formatDate, round2 } from '../lib/calc'

const FREQ_LABELS = { weekly: 'Chaque semaine', monthly: 'Chaque mois', yearly: 'Chaque année' }

export default function FacturesRecurrentes() {
  const { business } = useAuth()
  const navigate = useNavigate()
  const [recurring, setRecurring] = useState([])
  const [clients, setClients] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(emptyForm())

  function emptyForm() {
    return {
      client_id: '',
      description: '',
      amount: '',
      tva_rate: 20,
      frequency: 'monthly',
      next_run_date: new Date().toISOString().slice(0, 10),
    }
  }

  useEffect(() => {
    if (business) load()
  }, [business])

  async function load() {
    const { data: recs } = await supabase
      .from('recurring_invoices')
      .select('*, clients(name)')
      .eq('business_id', business.id)
      .order('next_run_date')
    setRecurring(recs || [])
    const { data: cls } = await supabase.from('clients').select('*').eq('business_id', business.id).order('name')
    setClients(cls || [])
    if (cls && cls.length > 0) setForm((f) => ({ ...f, client_id: f.client_id || cls[0].id }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.client_id) {
      setError('Sélectionne un client.')
      return
    }
    const { error } = await supabase.from('recurring_invoices').insert({
      business_id: business.id,
      ...form,
      amount: Number(form.amount),
      tva_rate: business.tax_regime === 'assujetti' ? Number(form.tva_rate) : 0,
    })
    if (error) {
      setError(error.message)
      return
    }
    setForm(emptyForm())
    setShowForm(false)
    load()
  }

  function nextDate(current, frequency) {
    const d = new Date(current)
    if (frequency === 'weekly') d.setDate(d.getDate() + 7)
    else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1)
    else d.setFullYear(d.getFullYear() + 1)
    return d.toISOString().slice(0, 10)
  }

  // Génère une facture standalone à partir du modèle, et avance sa prochaine échéance
  async function generateNow(rec) {
    setBusy(true)
    try {
      const number = `F-${String(business.invoice_next_number).padStart(4, '0')}`
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 30)

      const hasTva = business.tax_regime === 'assujetti'
      const subtotalHT = hasTva ? round2(rec.amount / (1 + rec.tva_rate / 100)) : rec.amount
      const tvaAmount = hasTva ? round2(rec.amount - subtotalHT) : 0

      const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .insert({
          business_id: business.id,
          client_id: rec.client_id,
          number,
          invoice_type: 'standalone',
          due_date: dueDate.toISOString().slice(0, 10),
          subtotal_ht: subtotalHT,
          tva_amount: tvaAmount,
          total_ttc: rec.amount,
          notes: `Facture récurrente — ${rec.description}`,
        })
        .select()
        .single()
      if (invError) throw invError

      await supabase.from('invoice_items').insert({
        invoice_id: invoice.id,
        description: rec.description,
        quantity: 1,
        unit_price: rec.amount,
        tva_rate: rec.tva_rate,
        position: 0,
      })

      await supabase.from('businesses').update({ invoice_next_number: business.invoice_next_number + 1 }).eq('id', business.id)
      await supabase
        .from('recurring_invoices')
        .update({ next_run_date: nextDate(rec.next_run_date, rec.frequency), last_generated_at: new Date().toISOString() })
        .eq('id', rec.id)

      navigate(`/factures/${invoice.id}`)
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(rec) {
    await supabase.from('recurring_invoices').update({ active: !rec.active }).eq('id', rec.id)
    load()
  }

  return (
    <div>
      <header className="page-header">
        <h1>Factures récurrentes</h1>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Annuler' : '+ Nouvelle facture récurrente'}
        </button>
      </header>

      <p className="muted" style={{ marginBottom: 16 }}>
        Ces modèles ne s'envoient pas automatiquement — clique sur "Générer maintenant" quand tu veux émettre la facture du mois. On pourra automatiser complètement l'envoi plus tard si tu veux.
      </p>

      {showForm && (
        <form onSubmit={handleSubmit} className="panel form-grid">
          <label>Client
            <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} required>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Fréquence
            <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
              <option value="weekly">Chaque semaine</option>
              <option value="monthly">Chaque mois</option>
              <option value="yearly">Chaque année</option>
            </select>
          </label>
          <label className="span-2">Description de la prestation
            <input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex : Forfait entretien mensuel bureaux" />
          </label>
          <label>Montant TTC (€)
            <input type="number" min="0" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </label>
          {business?.tax_regime === 'assujetti' && (
            <label>TVA (%)
              <input type="number" min="0" step="0.1" value={form.tva_rate} onChange={(e) => setForm({ ...form, tva_rate: e.target.value })} />
            </label>
          )}
          <label>Première échéance
            <input type="date" value={form.next_run_date} onChange={(e) => setForm({ ...form, next_run_date: e.target.value })} />
          </label>
          {error && <div className="form-error span-2">{error}</div>}
          <button type="submit" className="btn-primary span-2">Créer le modèle</button>
        </form>
      )}

      <section className="panel">
        {recurring.length === 0 ? (
          <p className="empty-state">Aucune facture récurrente configurée.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>Client</th><th>Description</th><th>Montant</th><th>Fréquence</th><th>Prochaine échéance</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {recurring.map((rec) => (
                <tr key={rec.id}>
                  <td>{rec.clients?.name}</td>
                  <td>{rec.description}</td>
                  <td>{formatEUR(rec.amount)}</td>
                  <td>{FREQ_LABELS[rec.frequency]}</td>
                  <td>{formatDate(rec.next_run_date)}</td>
                  <td>
                    <button className="link-btn" style={{ margin: 0 }} onClick={() => toggleActive(rec)}>
                      {rec.active ? 'Actif' : 'En pause'}
                    </button>
                  </td>
                  <td>
                    <button className="btn-secondary" disabled={busy} onClick={() => generateNow(rec)}>Générer maintenant</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
