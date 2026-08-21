import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { applyBrandColor } from '../lib/theme'

export default function Settings() {
  const { business, session, refreshBusiness } = useAuth()
  const [form, setForm] = useState({ ...business })
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(business?.logo_url || null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const [stripeKeyInput, setStripeKeyInput] = useState('')
  const [webhookSecretInput, setWebhookSecretInput] = useState('')
  const [stripeTesting, setStripeTesting] = useState(false)
  const [stripeTestResult, setStripeTestResult] = useState(null)
  const [stripeSaving, setStripeSaving] = useState(false)
  const [stripeSaved, setStripeSaved] = useState(false)
  const [webhookSaving, setWebhookSaving] = useState(false)
  const [webhookSaved, setWebhookSaved] = useState(false)
  const [webhookError, setWebhookError] = useState('')

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
        logoUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`
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
          app_name: form.app_name,
          brand_color: form.brand_color,
        })
        .eq('id', business.id)
      if (updateError) throw updateError

      if (form.brand_color) applyBrandColor(form.brand_color)
      await refreshBusiness()
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleTestStripeKey() {
    setStripeTesting(true)
    setStripeTestResult(null)
    try {
      const res = await fetch('/api/stripe-key-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretKey: stripeKeyInput }),
      })
      const data = await res.json()
      if (!res.ok || !data.valid) throw new Error(data.error || 'Clé invalide')
      setStripeTestResult({ ok: true, message: `Clé valide — compte Stripe : ${data.accountName}` })
    } catch (err) {
      setStripeTestResult({ ok: false, message: err.message })
    } finally {
      setStripeTesting(false)
    }
  }

  async function handleSaveStripeKey() {
    setStripeSaving(true)
    setStripeSaved(false)
    try {
      const { error: updateError } = await supabase
        .from('businesses')
        .update({ stripe_secret_key: stripeKeyInput })
        .eq('id', business.id)
      if (updateError) throw updateError

      await refreshBusiness()
      setStripeSaved(true)
      setStripeKeyInput('')
    } catch (err) {
      setStripeTestResult({ ok: false, message: err.message })
    } finally {
      setStripeSaving(false)
    }
  }

  async function handleSaveWebhookSecret() {
    setWebhookSaving(true)
    setWebhookSaved(false)
    setWebhookError('')
    try {
      const { error: updateError } = await supabase
        .from('businesses')
        .update({ stripe_webhook_secret: webhookSecretInput })
        .eq('id', business.id)
      if (updateError) throw updateError

      await refreshBusiness()
      setWebhookSaved(true)
      setWebhookSecretInput('')
    } catch (err) {
      setWebhookError(err.message)
    } finally {
      setWebhookSaving(false)
    }
  }

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/stripe-webhook?business=${business?.id}` : ''

  return (
    <div>
      <header className="page-header">
        <h1>Paramètres de l'entreprise</h1>
      </header>

      <section className="panel">
        <h2 className="section-title" style={{ marginTop: 0 }}>Paiements en ligne (Stripe)</h2>

        {business?.stripe_secret_key ? (
          <div className="form-info">Une clé Stripe est enregistrée pour cette entreprise — les paiements de tes clients vont directement sur ce compte.</div>
        ) : (
          <p className="muted" style={{ marginBottom: 12 }}>
            Colle ici ta clé Stripe secrète pour que les paiements de tes clients arrivent directement sur ton propre compte Stripe.
          </p>
        )}

        <div className="form-grid" style={{ marginTop: 12 }}>
          <label className="span-2">
            Clé secrète Stripe (commence par sk_live_ ou sk_test_)
            <input
              type="password"
              value={stripeKeyInput}
              onChange={(e) => setStripeKeyInput(e.target.value)}
              placeholder="sk_live_..."
            />
          </label>
        </div>

        <div className="action-row" style={{ marginTop: 12 }}>
          <button type="button" className="btn-secondary" disabled={!stripeKeyInput || stripeTesting} onClick={handleTestStripeKey}>
            {stripeTesting ? 'Test…' : 'Tester la clé'}
          </button>
          <button type="button" className="btn-primary" disabled={!stripeKeyInput || stripeSaving} onClick={handleSaveStripeKey}>
            {stripeSaving ? 'Enregistrement…' : 'Enregistrer cette clé'}
          </button>
        </div>

        {stripeTestResult && (
          <div className={stripeTestResult.ok ? 'form-info' : 'form-error'} style={{ marginTop: 12 }}>
            {stripeTestResult.message}
          </div>
        )}
        {stripeSaved && <div className="form-info" style={{ marginTop: 12 }}>Clé Stripe enregistrée.</div>}

        <h2 className="section-title">Confirmation automatique des paiements (optionnel)</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Pour que tes factures passent en "payée" automatiquement (sans avoir à cliquer toi-même), crée un webhook
          sur ton compte Stripe avec cette URL, événement <code>checkout.session.completed</code> :
        </p>
        <div className="payment-link-box">
          <input readOnly value={webhookUrl} />
          <button type="button" className="btn-secondary" onClick={() => navigator.clipboard.writeText(webhookUrl)}>Copier</button>
        </div>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <label className="span-2">
            Clé secrète du webhook (whsec_...)
            <input
              type="password"
              value={webhookSecretInput}
              onChange={(e) => setWebhookSecretInput(e.target.value)}
              placeholder="whsec_..."
            />
          </label>
        </div>
        <button type="button" className="btn-secondary" style={{ marginTop: 12 }} disabled={!webhookSecretInput || webhookSaving} onClick={handleSaveWebhookSecret}>
          {webhookSaving ? 'Enregistrement…' : 'Enregistrer ce secret webhook'}
        </button>
        {webhookSaved && <div className="form-info" style={{ marginTop: 12 }}>Webhook secret enregistré — la confirmation automatique des paiements est active.</div>}
        {webhookError && <div className="form-error" style={{ marginTop: 12 }}>{webhookError}</div>}
        <p className="muted" style={{ marginTop: 12 }}>
          Sans ce webhook configuré, tout fonctionne quand même — tu devras juste cliquer manuellement sur "Marquer comme reçu/soldée" après avoir vérifié le paiement sur ton dashboard Stripe.
        </p>
      </section>

      <section className="panel">
        <h2 className="section-title" style={{ marginTop: 0 }}>Marque blanche</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Personnalise le nom affiché et la couleur d'accent de l'application — utile si tu déploies cette app pour un autre client sous son propre nom.
        </p>
        <div className="form-grid">
          <label>Nom affiché de l'application
            <input value={form.app_name || ''} onChange={(e) => update('app_name', e.target.value)} placeholder="FacturePro" />
          </label>
          <label>Couleur d'accent
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="color"
                value={form.brand_color || '#22D3EE'}
                onChange={(e) => update('brand_color', e.target.value)}
                style={{ width: 48, height: 40, padding: 2, cursor: 'pointer' }}
              />
              <input
                value={form.brand_color || '#22D3EE'}
                onChange={(e) => update('brand_color', e.target.value)}
                placeholder="#22D3EE"
                style={{ flex: 1 }}
              />
            </div>
          </label>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          Le nom ci-dessus ne s'affiche qu'une fois connecté. Pour les écrans de connexion (avant identification), règle aussi la variable d'environnement <code>VITE_APP_NAME</code> sur Vercel avec la même valeur.
        </p>
      </section>

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
