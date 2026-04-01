import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiMenu, FiX, FiUser, FiLogOut } from 'react-icons/fi';
import ProfileDropdown from '../ui/ProfileDropdown';
import { useAuth } from '../../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user, profile, role, signOut } = useAuth();
  
  const toggleMobile = () => {
    const newState = !mobileOpen;
    setMobileOpen(newState);
    if (newState) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }
  };

  const closeMobile = () => {
    setMobileOpen(false);
    document.body.classList.remove('no-scroll');
  };

  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <button className={`navbar__hamburger ${mobileOpen ? 'is-active' : ''}`} onClick={toggleMobile} aria-label="Menu">
          {mobileOpen ? <FiX /> : <FiMenu />}
        </button>

        <Link to="/" className="navbar__logo" onClick={closeMobile}>
          <img src="/logo.svg" alt="Open Skools Academy Logo" className="brand-logo" />
        </Link>

        <nav className={`navbar__nav ${mobileOpen ? 'open' : ''}`}>
          <Link to="/" className={`nav-link ${isActive('/')}`} onClick={closeMobile}>Home</Link>
          <Link to="/about" className={`nav-link ${isActive('/about')}`} onClick={closeMobile}>About</Link>
          <Link to="/courses" className={`nav-link ${isActive('/courses')}`} onClick={closeMobile}>Courses</Link>
          <Link to="/careers" className={`nav-link ${isActive('/careers')}`} onClick={closeMobile}>Careers</Link>
          <Link to="/contact" className={`nav-link ${isActive('/contact')}`} onClick={closeMobile}>Contact</Link>
          <Link to="/blog" className={`nav-link ${isActive('/blog')}`} onClick={closeMobile}>Blog</Link>
          <div className="nav-mobile-actions">
            {!user ? (
              <>
                <Link to="/login" className="btn btn-outline btn-sm" onClick={closeMobile}>Log In</Link>
                <Link to="/signup" className="btn btn-primary btn-sm" onClick={closeMobile}>Sign Up</Link>
              </>
            ) : (
              <button 
                className="btn btn-outline btn-sm" 
                onClick={() => { signOut(); closeMobile(); }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FiLogOut /> Log Out
              </button>
            )}
          </div>
        </nav>

        <div className="navbar__actions">
          {!user ? (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm nav-login">Log In</Link>
              <Link to="/signup" className="btn btn-primary btn-sm nav-signup">Sign Up</Link>
            </>
          ) : (
            <div className="nav-profile">
              <ProfileDropdown />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
