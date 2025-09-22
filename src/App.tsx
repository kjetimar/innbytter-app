import { Outlet, Link, useLocation } from 'react-router-dom'
export default function App() {
  const loc = useLocation();
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">Innbytter</Link>
        <nav className="nav">{loc.pathname}</nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
