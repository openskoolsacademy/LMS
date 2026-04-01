import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { FiMenu, FiX } from 'react-icons/fi';
import './DashboardLayout.css';

export default function DashboardLayout({ links, title }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="dashboard-layout">
      {/* Mobile Sidebar Toggle Header */}
      <div className="dash-mobile-header">
        <button 
          className="dash-mobile-toggle" 
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle Sidebar"
        >
          {mobileOpen ? <FiX /> : <FiMenu />}
        </button>
        <span className="dash-mobile-title">{title}</span>
      </div>

      <aside className={`dash-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="dash-sidebar-header">
          <h3 className="dash-sidebar__title">{title}</h3>
          <button className="dash-sidebar-close" onClick={() => setMobileOpen(false)}>
            <FiX />
          </button>
        </div>
        <nav className="dash-sidebar__nav">
          {links.map(link => (
            <NavLink
              key={link.path}
              to={link.path}
              end={link.end}
              className={({ isActive }) => `dash-nav-link ${isActive ? 'active' : ''}`}
            >
              {link.icon}
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      
      {/* Overlay for mobile */}
      {mobileOpen && <div className="dash-sidebar-overlay" onClick={() => setMobileOpen(false)} />}

      <div className="dash-main">
        <Outlet />
      </div>
    </div>
  );
}
