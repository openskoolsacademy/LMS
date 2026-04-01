import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiBookOpen, FiBarChart2, FiAward, FiUser, FiLogOut, FiChevronDown, FiEdit, FiBookmark } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import './ProfileDropdown.css';

export default function ProfileDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const { profile, role, signOut } = useAuth();

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = () => {
    setOpen(false);
    signOut();
  };

  const menuItems = [
    { to: '/dashboard?tab=courses', icon: <FiBookOpen />, label: 'My Courses', desc: 'Continue learning' },
    { to: '/dashboard?tab=progress', icon: <FiBarChart2 />, label: 'Progress', desc: 'Track your goals' },
    { to: '/dashboard?tab=certificates', icon: <FiAward />, label: 'Certificates', desc: 'View achievements' },
    { to: '/saved-jobs', icon: <FiBookmark />, label: 'Saved Jobs', desc: 'Bookmarked roles' },
    { to: '/dashboard?tab=profile', icon: <FiUser />, label: 'Profile', desc: 'Account settings' },
  ];

  const adminItems = [];
  if (role === 'instructor' || role === 'admin' || role === 'author') {
    adminItems.push({ to: '/blog/write', icon: <FiEdit />, label: 'Write Blog', desc: 'Share your knowledge' });
    adminItems.push({ to: '/instructor', icon: <FiBarChart2 />, label: 'Instructor Panel', desc: 'Manage your courses' });
  }
  if (role === 'admin') {
    adminItems.push({ to: '/admin', icon: <FiUser />, label: 'Admin Control', desc: 'Platform settings' });
  }

  return (
    <div className="profile-dropdown" ref={ref}>
      <button className="profile-dropdown__trigger" onClick={() => setOpen(!open)}>
        <div className="profile-dropdown__avatar">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={profile?.name} />
          ) : (
            <FiUser />
          )}
          <span className="profile-dropdown__status" />
        </div>
        <FiChevronDown className={`profile-dropdown__chevron ${open ? 'rotated' : ''}`} />
      </button>

      {open && (
        <div className="profile-dropdown__menu animate-scale">
          {/* User info header */}
          <div className="profile-dropdown__header">
            <div className="profile-dropdown__header-avatar">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile?.name} />
              ) : (
                <FiUser size={20} />
              )}
            </div>
            <div className="profile-dropdown__header-info">
              <h4>{profile?.name || 'User'}</h4>
              <span className="profile-dropdown__role">{role || 'student'}</span>
            </div>
          </div>

          <div className="profile-dropdown__divider" />

          {/* Menu Items */}
            <div className="profile-dropdown__items">
            {adminItems.length > 0 && (
              <>
                {adminItems.map((item) => (
                  <Link key={item.label} to={item.to} className="profile-dropdown__item admin" onClick={() => setOpen(false)}>
                    <span className="profile-dropdown__item-icon">{item.icon}</span>
                    <div className="profile-dropdown__item-text">
                      <span className="profile-dropdown__item-label">{item.label}</span>
                      <span className="profile-dropdown__item-desc">{item.desc}</span>
                    </div>
                  </Link>
                ))}
                <div className="profile-dropdown__divider" />
              </>
            )}
            {menuItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="profile-dropdown__item"
                onClick={() => setOpen(false)}
              >
                <span className="profile-dropdown__item-icon">{item.icon}</span>
                <div className="profile-dropdown__item-text">
                  <span className="profile-dropdown__item-label">{item.label}</span>
                  <span className="profile-dropdown__item-desc">{item.desc}</span>
                </div>
              </Link>
            ))}
          </div>

          <div className="profile-dropdown__divider" />

          {/* Logout */}
          <button className="profile-dropdown__logout" onClick={handleSignOut}>
            <FiLogOut />
            <span>Log Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
