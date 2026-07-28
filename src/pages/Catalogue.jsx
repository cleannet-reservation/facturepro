import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatEUR } from '../lib/calc'

export default function Catalogue() {
  const { business } = useAuth()
  const [services, setServices] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm())

  function emptyForm() {
    return { name: '', unit_price: '', tva_rate: 20 }
  }

  useEffect(() => {
    if (business) load()
  }, [business])

  async function load() {
    const { data } = await supabase.from('services').select('*').eq('business_id', business.id).order('name')
    setServices(data || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('services').insert({
      business_id: business.id,
      name: form.name,
      unit_price: Number(form.unit_price),
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

  async function handleDelete(id) {
    if (!confirm('Supprimer cette prestation du catalogue ?')) return
    await supabase.from('services').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <header className="page-header">
        <h1>Catalogue de prestations</h1>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Annuler' : '+ Nouvelle prestation'}
        </button>
      </header>

      <p className="muted" style={{ marginBottom: 16 }}>
        Enregistre ici tes prestations les plus courantes — tu pourras les ajouter en un clic dans tes devis et factures, sans retaper la description et le prix à chaque fois.
      </p>

      {showForm && (
        <form onSubmit={handleSubmit} className="panel form-grid">
          <label className="span-2">Nom de la prestation
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nettoyage canapé 3 places" />
          </label>
          <label>Prix unitaire (€)
            <input type="number" min="0" step="0.01" required value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
          </label>
          {business?.tax_regime === 'assujetti' && (
            <label>TVA (%)
              <input type="number" min="0" step="0.1" value={form.tva_rate} onChange={(e) => setForm({ ...form, tva_rate: e.target.value })} />
            </label>
          )}
          {error && <div className="form-error span-2">{error}</div>}
          <button type="submit" className="btn-primary span-2">Ajouter au catalogue</button>
        </form>
      )}

      <section className="panel">
        {services.length === 0 ? (
          <p className="empty-state">Aucune prestation enregistrée pour l'instant.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>Nom</th><th>Prix unitaire</th>{business?.tax_regime === 'assujetti' && <th>TVA</th>}<th></th></tr></thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{formatEUR(s.unit_price)}</td>
                  {business?.tax_regime === 'assujetti' && <td>{s.tva_rate}%</td>}
                  <td><button className="icon-btn" onClick={() => handleDelete(s.id)} aria-label="Supprimer">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
