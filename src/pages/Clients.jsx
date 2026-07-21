import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Clients() {
  const { business } = useAuth()
  const [clients, setClients] = useState([])
  const [form, setForm] = useState(emptyForm())
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  function emptyForm() {
    return { name: '', address: '', postal_code: '', city: '', email: '', phone: '' }
  }

  useEffect(() => {
    if (business) load()
  }, [business])

  async function load() {
    const { data } = await supabase.from('clients').select('*').eq('business_id', business.id).order('name')
    setClients(data || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('clients').insert({ business_id: business.id, ...form })
    if (error) {
      setError(error.message)
      return
    }
    setForm(emptyForm())
    setShowForm(false)
    load()
  }

  return (
    <div>
      <header className="page-header">
        <h1>Clients</h1>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Annuler' : '+ Nouveau client'}
        </button>
      </header>

      {showForm && (
        <form onSubmit={handleSubmit} className="panel form-grid">
          <label>Nom / raison sociale
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>Téléphone
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label>Adresse
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </label>
          <label>Code postal
            <input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
          </label>
          <label>Ville
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </label>
          {error && <div className="form-error span-2">{error}</div>}
          <button type="submit" className="btn-primary span-2">Enregistrer le client</button>
        </form>
      )}

      <section className="panel">
        {clients.length === 0 ? (
          <p className="empty-state">Aucun client enregistré. Ajoute ton premier client pour créer un devis.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>Nom</th><th>Email</th><th>Téléphone</th><th>Ville</th></tr></thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.email}</td>
                  <td>{c.phone}</td>
                  <td>{c.city}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
