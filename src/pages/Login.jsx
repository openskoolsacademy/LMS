import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();

  // If already logged in, redirect securely as a side-effect
  useEffect(() => {
    if (user) {
      console.log('Login: User detected, navigating to dashboard...');
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [user, navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    console.log('Login: Attempting sign-in for:', email);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      
      if (authError) {
        console.error('Login: Auth error:', authError.message);
        throw authError;
      }

      console.log('Login: Success! Token received for user:', data.user?.id);
      // AuthContext will update, triggering the useEffect above
    } catch (err) {
      setError(err.message);
      setLoading(false); // Reset loading on error
    }
    // Note: We don't setLoading(false) in finally if successful, 
    // because the component will unmount on redirect.
  };

  return (
    <div className="auth-page">
      <div className="auth-card animate-scale">
        <div className="auth-header">
          <h2>Welcome back</h2>
          <p>Log in to continue learning</p>
        </div>


        {error && <div className="auth-error" style={{ color: 'var(--danger)', marginBottom: '16px', fontSize: '0.875rem', textAlign: 'center' }}>{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Email</label>
            <div className="input-icon">
              <FiMail />
              <input type="email" placeholder="Enter email address" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label>Password</label>
            <div className="input-icon">
              <FiLock />
              <input type={showPw ? 'text' : 'password'} placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>{showPw ? <FiEyeOff /> : <FiEye />}</button>
            </div>
          </div>
          <div className="auth-options">
            <label className="auth-remember"><input type="checkbox" /> Remember me</label>
            <Link to="/forgot-password" className="auth-forgot">Forgot password?</Link>
          </div>
          <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <p className="auth-switch">Don&apos;t have an account? <Link to="/signup">Sign up</Link></p>
      </div>
    </div>
  );
}
