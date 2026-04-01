import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import './Auth.css';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // If we land here but there's no hash/token in URL, we might want to warn the user
    // However, Supabase handles the session creation automatically before this point if the link is valid.
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        // Technically, the user must have an active recovery session right now.
        // If not, their link might be invalid or expired.
        // We'll let them try, but it might fail.
        console.warn('ResetPassword: No active recovery session spotted. Link might be invalid.');
      }
    };
    checkSession();
  }, []);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }
    
    try {
      // Supabase's updateUser automatically uses the recovery token generated from the email link
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: password
      });
      
      if (updateError) throw updateError;

      // Success!
      alert('Password updated successfully! You can now log in.');
      navigate('/login');
    } catch (err) {
      console.error('Password update error:', err);
      setError(err.message || 'Failed to update password. Your reset link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card animate-scale">
        <div className="auth-header">
          <h2>Create New Password</h2>
          <p>Please enter your new strong password below.</p>
        </div>

        {error && <div className="auth-error" style={{ color: 'var(--danger)', marginBottom: '16px', fontSize: '0.875rem', textAlign: 'center' }}>{error}</div>}

        <form onSubmit={handleUpdatePassword} className="auth-form">
          <div className="form-group">
            <label>New Password</label>
            <div className="input-icon">
              <FiLock />
              <input 
                type={showPw ? 'text' : 'password'} 
                placeholder="Enter new password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
              <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>
                {showPw ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>
          
          <div className="form-group">
            <label>Confirm New Password</label>
            <div className="input-icon">
              <FiLock />
              <input 
                type={showPw ? 'text' : 'password'} 
                placeholder="Confirm new password" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                required 
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading || !password || !confirmPassword}>
            {loading ? 'Updating Password...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
