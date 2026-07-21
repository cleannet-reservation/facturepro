import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Settings() {
  const { business, session, refreshBusiness } = useAuth()
  const [form, setForm] = useState({ ...business })
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(business?.logo_url || null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaved(false)
    setBusy(true)
    try {
      let logoUrl = form.logo_url

      if (logoFile) {
        const ext = logoFile.name.split('.').pop()
        const path = `${session.user.id}/logo.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(path, logoFile, { upsert: true })
        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(path)
        logoUrl = `${publicUrlData.publicUrl}?t=${Date.now()}` // cache-bust
      }

      const { error: updateError } = await supabase
        .from('businesses')
        .update({
          name: form.name,
          siret: form.siret,
          address: form.address,
          postal_code: form.postal_code,
          city: form.city,
          email: form.email,
          phone: form.phone,
          tax_regime: form.tax_regime,
          tva_number: form.tva_number,
          iban: form.iban,
          payment_terms: form.payment_terms,
          sap_eligible: form.sap_eligible,
          sap_agrement_number: form.sap_agrement_number,
          logo_url: logoUrl,
        })
        .eq('id', business.id)
      if (updateError) throw updateError

      await refreshBusiness()
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <header className="page-header">
        <h1>Paramètres de l'entreprise</h1>
      </header>

      <form onSubmit={handleSubmit} className="panel form-grid">
        <div className="span-2" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {logoPreview ? (
            <img src={logoPreview} alt="Logo" style={{ width: 64, height: 64, objectFit: 'contain', background: '#fff', borderRadius: 8, padding: 4 }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: 8, border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              Pas de logo
            </div>
          )}
          <label style={{ flex: 1 }}>
            Logo (apparaît sur tes devis et factures)
            <input type="file" accept="image/png, image/jpeg" onChange={handleLogoChange} />
          </label>
        </div>

        <label>Nom de l'entreprise
          <input required value={form.name || ''} onChange={(e) => update('name', e.target.value)} />
        </label>
        <label>SIRET
          <input value={form.siret || ''} onChange={(e) => update('siret', e.target.value)} />
        </label>
        <label className="span-2">Adresse
          <input value={form.address || ''} onChange={(e) => update('address', e.target.value)} />
        </label>
        <label>Code postal
          <input value={form.postal_code || ''} onChange={(e) => update('postal_code', e.target.value)} />
        </label>
        <label>Ville
          <input value={form.city || ''} onChange={(e) => update('city', e.target.value)} />
        </label>
        <label>Email de contact
          <input type="email" value={form.email || ''} onChange={(e) => update('email', e.target.value)} />
        </label>
        <label>Téléphone
          <input value={form.phone || ''} onChange={(e) => update('phone', e.target.value)} />
        </label>
        <label>IBAN
          <input value={form.iban || ''} onChange={(e) => update('iban', e.target.value)} />
        </label>
        <label>Conditions de paiement
          <input value={form.payment_terms || ''} onChange={(e) => update('payment_terms', e.target.value)} placeholder="30 jours" />
        </label>

        <fieldset className="span-2 tax-regime">
          <legend>Régime de TVA</legend>
          <label className="radio-row">
            <input type="radio" name="tax_regime" checked={form.tax_regime === 'franchise'} onChange={() => update('tax_regime', 'franchise')} />
            Auto-entrepreneur — TVA non applicable
          </label>
          <label className="radio-row">
            <input type="radio" name="tax_regime" checked={form.tax_regime === 'assujetti'} onChange={() => update('tax_regime', 'assujetti')} />
            Assujetti à la TVA
          </label>
        </fieldset>

        {form.tax_regime === 'assujetti' && (
          <label className="span-2">Numéro de TVA intracommunautaire
            <input value={form.tva_number || ''} onChange={(e) => update('tva_number', e.target.value)} />
          </label>
        )}

        <fieldset className="span-2 tax-regime">
          <legend>Crédit d'impôt Services à la Personne</legend>
          <label className="radio-row">
            <input type="checkbox" checked={!!form.sap_eligible} onChange={(e) => update('sap_eligible', e.target.checked)} />
            J'ai un agrément Services à la Personne
          </label>
          {form.sap_eligible && (
            <label style={{ marginTop: 10 }}>Numéro d'agrément SAP
              <input value={form.sap_agrement_number || ''} onChange={(e) => update('sap_agrement_number', e.target.value)} />
            </label>
          )}
        </fieldset>

        {error && <div className="form-error span-2">{error}</div>}
        {saved && <div className="form-info span-2">Modifications enregistrées.</div>}

        <button type="submit" className="btn-primary span-2" disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </div>
  )
}
