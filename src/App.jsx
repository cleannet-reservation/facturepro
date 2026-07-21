import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
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

function Gate({ children }) {
  const { session, business, loading } = useAuth()

  if (loading) return <div className="loading-screen">Chargement…</div>
  if (!session) return <Login />
  if (!business) return <Onboarding />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Route publique : consultation d'un devis par le client, sans compte */}
          <Route path="/consultation/devis/:token" element={<PublicQuote />} />

          {/* Tout le reste de l'app nécessite une connexion */}
          <Route
            path="/*"
            element={
              <Gate>
                <Routes>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="clients" element={<Clients />} />
                    <Route path="devis" element={<Devis />} />
                    <Route path="devis/nouveau" element={<DevisForm />} />
                    <Route path="devis/:id" element={<DevisDetail />} />
                    <Route path="factures" element={<Factures />} />
                    <Route path="factures/nouvelle" element={<FactureForm />} />
                    <Route path="factures/:id" element={<FactureDetail />} />
                    <Route path="factures-recurrentes" element={<FacturesRecurrentes />} />
                    <Route path="achats" element={<Achats />} />
                    <Route path="notes-de-frais" element={<NotesDeFrais />} />
                    <Route path="parametres" element={<Settings />} />
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
