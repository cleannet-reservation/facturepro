import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatEUR, formatDate } from '../lib/calc'

const CATEGORIES = ['Fournitures', 'Matériel', 'Carburant', 'Sous-traitance', 'Assurance', 'Autre']

export default function Achats() {
  const { business } = useAuth()
  const [purchases, setPurchases] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm())

  function emptyForm() {
    return {
      supplier_name: '',
      description: '',
      amount: '',
      purchase_date: new Date().toISOString().slice(0, 10),
      category: CATEGORIES[0],
      notes: '',
    }
  }

  useEffect(() => {
    if (business) load()
  }, [business])

  async function load() {
    const { data } = await supabase
      .from('purchases')
      .select('*')
      .eq('business_id', business.id)
      .order('purchase_date', { ascending: false })
    setPurchases(data || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('purchases').insert({
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

  const total = purchases.reduce((sum, p) => sum + Number(p.amount), 0)

  return (
    <div>
      <header className="page-header">
        <h1>Factures d'achat</h1>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Annuler' : '+ Nouvel achat'}
        </button>
      </header>

      {showForm && (
        <form onSubmit={handleSubmit} className="panel form-grid">
          <label>Fournisseur
            <input required value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} placeholder="Ex : Leroy Merlin" />
          </label>
          <label>Montant TTC (€)
            <input type="number" min="0" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </label>
          <label>Date
            <input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
          </label>
          <label>Catégorie
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="span-2">Description
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex : Produits nettoyants + éponges" />
          </label>
          {error && <div className="form-error span-2">{error}</div>}
          <button type="submit" className="btn-primary span-2">Enregistrer l'achat</button>
        </form>
      )}

      <section className="panel">
        {purchases.length === 0 ? (
          <p className="empty-state">Aucune facture d'achat enregistrée.</p>
        ) : (
          <>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Fournisseur</th><th>Description</th><th>Catégorie</th><th>Montant</th></tr></thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.purchase_date)}</td>
                    <td>{p.supplier_name}</td>
                    <td>{p.description}</td>
                    <td>{p.category}</td>
                    <td>{formatEUR(p.amount)}</td>
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
