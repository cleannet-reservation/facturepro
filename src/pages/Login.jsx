import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setInfo('Compte créé. Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.')
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
        })
        if (error) throw error
        setInfo('Email envoyé (si ce compte existe). Vérifie ta boîte mail, y compris les spams, et clique sur le lien reçu.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const titles = { signin: 'Connexion', signup: 'Créer un compte', forgot: 'Mot de passe oublié' }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand-mark">FacturePro</div>
        <h1>{titles[mode]}</h1>
        <p className="auth-sub">
          {mode === 'forgot' ? 'On t\'envoie un lien pour en choisir un nouveau.' : 'Devis, factures et acomptes en ligne — sans friction.'}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@entreprise.fr" />
          </label>

          {mode !== 'forgot' && (
            <label>
              Mot de passe
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </label>
          )}

          {error && <div className="form-error">{error}</div>}
          {info && <div className="form-info">{info}</div>}

          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Un instant…' : mode === 'signin' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Envoyer le lien'}
          </button>
        </form>

        {mode === 'signin' && (
          <>
            <button className="link-btn" onClick={() => { setMode('signup'); setError(''); setInfo('') }}>
              Pas encore de compte ? En créer un
            </button>
            <button className="link-btn" onClick={() => { setMode('forgot'); setError(''); setInfo('') }}>
              Mot de passe oublié ?
            </button>
          </>
        )}
        {mode !== 'signin' && (
          <button className="link-btn" onClick={() => { setMode('signin'); setError(''); setInfo('') }}>
            Retour à la connexion
          </button>
        )}
      </div>
    </div>
  )
}
