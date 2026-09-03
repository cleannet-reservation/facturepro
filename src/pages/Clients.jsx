import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Clients() {
  const { business } = useAuth()
  const [clients, setClients] = useState([])
  const [form, setForm] = useState(emptyForm())
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  function emptyForm() {
    return {
      client_type: 'particulier',
      name: '',
      company_name: '',
      tva_number: '',
      siren_siret: '',
      naf_code: '',
      language: 'fr',
      address: '',
      address_complement: '',
      postal_code: '',
      city: '',
      website: '',
      email: '',
      phone: '',
    }
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
    const payload = { business_id: business.id, ...form }
    if (payload.client_type === 'particulier') {
      payload.company_name = null
      payload.tva_number = null
      payload.siren_siret = null
      payload.naf_code = null
    }
    const { error } = await supabase.from('clients').insert(payload)
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
          <fieldset className="span-2 tax-regime">
            <legend>Type de client</legend>
            <label className="radio-row">
              <input type="radio" name="client_type" checked={form.client_type === 'particulier'} onChange={() => setForm({ ...form, client_type: 'particulier' })} />
              Particulier
            </label>
            <label className="radio-row">
              <input type="radio" name="client_type" checked={form.client_type === 'professionnel'} onChange={() => setForm({ ...form, client_type: 'professionnel' })} />
              Professionnel
            </label>
          </fieldset>

          {form.client_type === 'professionnel' && (
            <>
              <label className="span-2">Nom de la société * <span className="muted" style={{ fontWeight: 400 }}>(nom affiché sur les devis/factures)</span>
                <input required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Ex : Cabinet Dentaire Azur" />
              </label>
              <label>Numéro de TVA
                <input value={form.tva_number} onChange={(e) => setForm({ ...form, tva_number: e.target.value })} placeholder="FR12345678900" />
              </label>
              <label>SIREN/SIRET
                <input value={form.siren_siret} onChange={(e) => setForm({ ...form, siren_siret: e.target.value })} placeholder="123 456 789 00012" />
              </label>
              <label>Code NAF, NACE, NOGA…
                <input value={form.naf_code} onChange={(e) => setForm({ ...form, naf_code: e.target.value })} placeholder="8121Z" />
              </label>
              <label>Langue
                <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                  <option value="fr">Français</option>
                  <option value="en">Anglais</option>
                </select>
              </label>
            </>
          )}

          <label className="span-2">{form.client_type === 'professionnel' ? "Nom du contact (usage interne, n'apparaît pas sur les documents)" : 'Nom et prénom'}
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={form.client_type === 'professionnel' ? 'Ex : Dr Martin (contact)' : 'Prénom Nom'} />
          </label>

          <h2 className="section-title span-2" style={{ marginTop: 0 }}>Coordonnées</h2>

          <label className="span-2">Adresse
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </label>
          <label className="span-2">Complément d'adresse
            <input value={form.address_complement} onChange={(e) => setForm({ ...form, address_complement: e.target.value })} placeholder="Bâtiment, étage, appartement…" />
          </label>
          <label>Code postal
            <input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
          </label>
          <label>Ville
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </label>
          {form.client_type === 'professionnel' && (
            <label className="span-2">Site internet
              <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" />
            </label>
          )}
          <label>Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>Numéro de téléphone
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
            <thead><tr><th>Nom</th><th>Type</th><th>Email</th><th>Téléphone</th><th>Ville</th></tr></thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td><Link to={`/clients/${c.id}`}>{c.client_type === 'professionnel' ? c.company_name : c.name}</Link></td>
                  <td>{c.client_type === 'professionnel' ? 'Professionnel' : 'Particulier'}</td>
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
