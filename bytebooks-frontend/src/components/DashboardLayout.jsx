import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import '../styles/dashboard.css';

/*
 * DashboardLayout — Main layout: sidebar + header + scrollable content.
 *
 * Differences from the v1/no-auth version:
 *   - Uses React Router's <NavLink> for nav (automatic "active" styling
 *     via the callback className).
 *   - Renders nested routes through <Outlet /> rather than `children`.
 *   - Conditionally renders login/register links or a welcome message
 *     + logout button based on `useAuth().user`.
 *   - The "Add Book" entry appears only when authenticated, matching the
 *     protected /books/new route.
 */

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/books', label: 'Books', icon: '📚' },
  { to: '/authors', label: 'Authors', icon: '✍️' },
];

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/books': 'Books',
  '/authors': 'Authors',
  '/books/new': 'Add Book',
};

function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || 'ByteBooks';

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">📖</span>
          ByteBooks Admin
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          {user && (
            <NavLink
              to="/books/new"
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
            >
              <span className="nav-icon">➕</span>
              Add Book
            </NavLink>
          )}
        </nav>
      </aside>

      {/* Header */}
      <header className="header">
        <h1 className="header-title">{title}</h1>
        <div className="header-user">
          {user ? (
            <>
              <span>Welcome, {user.username}</span>
              <div className="header-avatar">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <button className="header-logout" onClick={logout} type="button">
                Logout
              </button>
            </>
          ) : (
            <div className="header-auth-links">
              <NavLink to="/login" className="header-link">Login</NavLink>
              <NavLink to="/register" className="header-link header-link-primary">
                Register
              </NavLink>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default DashboardLayout;
