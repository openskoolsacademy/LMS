import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMail, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import './Auth.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Note: We use the active window's origin to create a dynamic redirect relative to deployment.
      const redirectUrl = `${window.location.origin}/reset-password`;
      
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      
      if (authError) throw authError;

      setIsSuccess(true);
    } catch (err) {
      console.error('Password reset request error:', err);
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card animate-scale">
        <Link to="/login" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--gray-500)' }}>
          <FiArrowLeft /> Back to Login
        </Link>
        
        {isSuccess ? (
          <div className="auth-header" style={{ marginTop: 20 }}>
            <FiCheckCircle size={48} color="var(--success)" style={{ marginBottom: 16 }} />
            <h2>Check your email</h2>
            <p>We've sent a password reset link to <strong>{email}</strong>.</p>
            <p style={{ marginTop: 8, fontSize: '0.875rem' }}>You can close this tab and continue from the link inside the email.</p>
          </div>
        ) : (
          <>
            <div className="auth-header">
              <h2>Reset Password</h2>
              <p>Enter your email and we'll send you a link to reset your password.</p>
            </div>

            {error && <div className="auth-error" style={{ color: 'var(--danger)', marginBottom: '16px', fontSize: '0.875rem', textAlign: 'center' }}>{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label>Email Address</label>
                <div className="input-icon">
                  <FiMail />
                  <input 
                    type="email" 
                    placeholder="name@example.com" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    required 
                  />
                </div>
              </div>
              
              <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading || !email}>
                {loading ? 'Sending Link...' : 'Send Reset Link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
