import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatEUR, formatDate } from '../lib/calc'

const CATEGORIES = ['Déplacement', 'Repas', 'Péage / Parking', 'Matériel', 'Autre']

export default function NotesDeFrais() {
  const { business } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm())

  function emptyForm() {
    return {
      description: '',
      amount: '',
      expense_date: new Date().toISOString().slice(0, 10),
      category: CATEGORIES[0],
      reimbursable: false,
      notes: '',
    }
  }

  useEffect(() => {
    if (business) load()
  }, [business])

  async function load() {
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('business_id', business.id)
      .order('expense_date', { ascending: false })
    setExpenses(data || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('expenses').insert({
      business_id: business.id,
      ...form,
      amount: Number(form.amount),
    })
    if (error) {
      setError(error.message)
      return
    }
    setForm(emptyForm())
    setShowForm(false)
    load()
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  return (
    <div>
      <header className="page-header">
        <h1>Notes de frais</h1>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Annuler' : '+ Nouvelle note de frais'}
        </button>
      </header>

      {showForm && (
        <form onSubmit={handleSubmit} className="panel form-grid">
          <label className="span-2">Description
            <input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex : Repas client Antibes" />
          </label>
          <label>Montant (€)
            <input type="number" min="0" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </label>
          <label>Date
            <input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
          </label>
          <label>Catégorie
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="radio-row">
            <input type="checkbox" checked={form.reimbursable} onChange={(e) => setForm({ ...form, reimbursable: e.target.checked })} />
            À me rembourser
          </label>
          {error && <div className="form-error span-2">{error}</div>}
          <button type="submit" className="btn-primary span-2">Enregistrer la note de frais</button>
        </form>
      )}

      <section className="panel">
        {expenses.length === 0 ? (
          <p className="empty-state">Aucune note de frais enregistrée.</p>
        ) : (
          <>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Description</th><th>Catégorie</th><th>Montant</th><th>À rembourser</th></tr></thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td>{formatDate(e.expense_date)}</td>
                    <td>{e.description}</td>
                    <td>{e.category}</td>
                    <td>{formatEUR(e.amount)}</td>
                    <td>{e.reimbursable ? 'Oui' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="totals-box"><div className="total-ttc"><span>Total</span><span>{formatEUR(total)}</span></div></div>
          </>
        )}
      </section>
    </div>
  )
}
