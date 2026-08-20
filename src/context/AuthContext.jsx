import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { applyBrandColor } from '../lib/theme'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [business, setBusiness] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setBusiness(null)
      setIsAdmin(false)
      return
    }
    loadBusiness()
    checkAdmin()
  }, [session])

  async function loadBusiness() {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', session.user.id)
      .maybeSingle()
    if (!error) {
      setBusiness(data)
      if (data?.brand_color) applyBrandColor(data.brand_color)
    }
  }

  async function checkAdmin() {
    const { data } = await supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
    setIsAdmin(!!data)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  // Un abonnement est considéré actif si le statut Stripe est "active",
  // ou si l'entreprise est encore dans sa période d'essai gratuite.
  // Un admin a toujours accès. Le coupe-circuit manuel (access_enabled)
  // prime sur tout le reste.
  function hasActiveAccess() {
    if (!business) return false
    if (isAdmin) return true
    if (business.access_enabled === false) return false
    if (business.subscription_status === 'active') return true
    if (business.subscription_status === 'trial' && business.trial_ends_at) {
      return new Date(business.trial_ends_at) > new Date()
    }
    return false
  }

  return (
    <AuthContext.Provider value={{ session, business, isAdmin, loading, refreshBusiness: loadBusiness, signOut, hasActiveAccess }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
