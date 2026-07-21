import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
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
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setInfo('Compte créé. Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand-mark">FacturePro</div>
        <h1>{mode === 'signin' ? 'Connexion' : 'Créer un compte'}</h1>
        <p className="auth-sub">Devis, factures et acomptes en ligne — sans friction.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@entreprise.fr" />
          </label>
          <label>
            Mot de passe
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </label>

          {error && <div className="form-error">{error}</div>}
          {info && <div className="form-info">{info}</div>}

          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Un instant…' : mode === 'signin' ? 'Se connecter' : "Créer mon compte"}
          </button>
        </form>

        <button className="link-btn" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? "Pas encore de compte ? En créer un" : 'Déjà un compte ? Se connecter'}
        </button>
      </div>
    </div>
  )
}
