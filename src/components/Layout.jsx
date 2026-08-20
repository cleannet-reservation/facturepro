import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { business, isAdmin, signOut } = useAuth()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">{business?.app_name || 'FacturePro'}</div>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>Tableau de bord</NavLink>
          <NavLink to="/tresorerie" className={({ isActive }) => (isActive ? 'active' : '')}>Trésorerie</NavLink>
          <NavLink to="/clients" className={({ isActive }) => (isActive ? 'active' : '')}>Clients</NavLink>
          <NavLink to="/catalogue" className={({ isActive }) => (isActive ? 'active' : '')}>Catalogue</NavLink>
          <NavLink to="/devis" className={({ isActive }) => (isActive ? 'active' : '')}>Devis</NavLink>
          <NavLink to="/factures" className={({ isActive }) => (isActive ? 'active' : '')}>Factures</NavLink>
          <NavLink to="/factures-recurrentes" className={({ isActive }) => (isActive ? 'active' : '')}>Factures récurrentes</NavLink>
          <NavLink to="/achats" className={({ isActive }) => (isActive ? 'active' : '')}>Factures d'achat</NavLink>
          <NavLink to="/notes-de-frais" className={({ isActive }) => (isActive ? 'active' : '')}>Notes de frais</NavLink>
          <NavLink to="/parametres" className={({ isActive }) => (isActive ? 'active' : '')}>Paramètres</NavLink>
          {isAdmin && <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>Super admin</NavLink>}
        </nav>
        <div className="sidebar-footer">
          <div className="biz-name">{business?.name}</div>
          <button className="link-btn" onClick={signOut}>Se déconnecter</button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
