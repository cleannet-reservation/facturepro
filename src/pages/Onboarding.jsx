import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Onboarding() {
  const { session, refreshBusiness } = useAuth()
  const [form, setForm] = useState({
    name: '',
    siret: '',
    address: '',
    postal_code: '',
    city: '',
    email: session?.user?.email || '',
    phone: '',
    tax_regime: 'franchise',
    tva_number: '',
    sap_eligible: false,
    sap_agrement_number: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { error } = await supabase.from('businesses').insert({
        owner_id: session.user.id,
        ...form,
      })
      if (error) throw error
      await refreshBusiness()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card wide">
        <div className="brand-mark">FacturePro</div>
        <h1>Configure ton entreprise</h1>
        <p className="auth-sub">Ces informations apparaîtront sur tous tes devis et factures.</p>

        <form onSubmit={handleSubmit} className="auth-form grid-2">
          <label>
            Nom de l'entreprise
            <input required value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="CleanNet Multi-Service 06" />
          </label>
          <label>
            SIRET
            <input value={form.siret} onChange={(e) => update('siret', e.target.value)} placeholder="123 456 789 00012" />
          </label>
          <label className="span-2">
            Adresse
            <input value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="12 rue Exemple" />
          </label>
          <label>
            Code postal
            <input value={form.postal_code} onChange={(e) => update('postal_code', e.target.value)} placeholder="06600" />
          </label>
          <label>
            Ville
            <input value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Antibes" />
          </label>
          <label>
            Email de contact
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
          </label>
          <label>
            Téléphone
            <input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="06 12 34 56 78" />
          </label>

          <fieldset className="span-2 tax-regime">
            <legend>Régime de TVA</legend>
            <label className="radio-row">
              <input type="radio" name="tax_regime" checked={form.tax_regime === 'franchise'} onChange={() => update('tax_regime', 'franchise')} />
              Auto-entrepreneur — TVA non applicable (art. 293 B du CGI)
            </label>
            <label className="radio-row">
              <input type="radio" name="tax_regime" checked={form.tax_regime === 'assujetti'} onChange={() => update('tax_regime', 'assujetti')} />
              Assujetti à la TVA — je facture HT / TVA / TTC
            </label>
          </fieldset>

          {form.tax_regime === 'assujetti' && (
            <label className="span-2">
              Numéro de TVA intracommunautaire
              <input value={form.tva_number} onChange={(e) => update('tva_number', e.target.value)} placeholder="FR12345678900" />
            </label>
          )}

          <fieldset className="span-2 tax-regime">
            <legend>Crédit d'impôt Services à la Personne</legend>
            <label className="radio-row">
              <input type="checkbox" checked={form.sap_eligible} onChange={(e) => update('sap_eligible', e.target.checked)} />
              J'ai un agrément Services à la Personne — mes clients particuliers peuvent bénéficier de 50% de crédit d'impôt
            </label>
            {form.sap_eligible && (
              <label style={{ marginTop: 10 }}>
                Numéro d'agrément SAP
                <input value={form.sap_agrement_number} onChange={(e) => update('sap_agrement_number', e.target.value)} placeholder="SAP123456789" />
              </label>
            )}
          </fieldset>

          {error && <div className="form-error span-2">{error}</div>}

          <button type="submit" className="btn-primary span-2" disabled={busy}>
            {busy ? 'Création…' : 'Créer mon espace'}
          </button>
        </form>
      </div>
    </div>
  )
}
