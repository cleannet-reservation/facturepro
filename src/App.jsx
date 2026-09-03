import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Subscribe from './pages/Subscribe'
import AdminDashboard from './pages/AdminDashboard'
import Dashboard from './pages/Dashboard'
import Tresorerie from './pages/Tresorerie'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import Catalogue from './pages/Catalogue'
import Devis from './pages/Devis'
import DevisForm from './pages/DevisForm'
import DevisDetail from './pages/DevisDetail'
import Factures from './pages/Factures'
import FactureForm from './pages/FactureForm'
import FactureDetail from './pages/FactureDetail'
import FacturesRecurrentes from './pages/FacturesRecurrentes'
import Achats from './pages/Achats'
import NotesDeFrais from './pages/NotesDeFrais'
import Settings from './pages/Settings'
import PublicQuote from './pages/PublicQuote'
import ResetPassword from './pages/ResetPassword'
import { MentionsLegales, Confidentialite, CGV } from './pages/Legal'

function Gate({ children }) {
  const { session, business, loading, hasActiveAccess } = useAuth()

  if (loading) return <div className="loading-screen">Chargement…</div>
  if (!session) return <Login />
  if (!business) return <Onboarding />
  if (!hasActiveAccess()) return <Subscribe />
  return children
}

function AdminGate({ children }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return <div className="loading-screen">Chargement…</div>
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/consultation/devis/:token" element={<PublicQuote />} />
          <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />
          <Route path="/mentions-legales" element={<MentionsLegales />} />
          <Route path="/confidentialite" element={<Confidentialite />} />
          <Route path="/cgv" element={<CGV />} />

          <Route
            path="/*"
            element={
              <Gate>
                <Routes>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="tresorerie" element={<Tresorerie />} />
                    <Route path="clients" element={<Clients />} />
                    <Route path="clients/:id" element={<ClientDetail />} />
                    <Route path="catalogue" element={<Catalogue />} />
                    <Route path="devis" element={<Devis />} />
                    <Route path="devis/nouveau" element={<DevisForm />} />
                    <Route path="devis/:id/modifier" element={<DevisForm />} />
                    <Route path="devis/:id" element={<DevisDetail />} />
                    <Route path="factures" element={<Factures />} />
                    <Route path="factures/nouvelle" element={<FactureForm />} />
                    <Route path="factures/:id/modifier" element={<FactureForm />} />
                    <Route path="factures/:id" element={<FactureDetail />} />
                    <Route path="factures-recurrentes" element={<FacturesRecurrentes />} />
                    <Route path="achats" element={<Achats />} />
                    <Route path="notes-de-frais" element={<NotesDeFrais />} />
                    <Route path="parametres" element={<Settings />} />
                    <Route path="admin" element={<AdminGate><AdminDashboard /></AdminGate>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </Gate>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
