import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff, FiPhone } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import './Auth.css';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  // If already logged in, redirect
  if (user) {
    navigate('/dashboard');
  }

  const toTitleCase = (str) => str.replace(/\b\w/g, c => c.toUpperCase());

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: toTitleCase(name.trim()),
            phone: phone,
            role: 'student', // Default role for new signups
          }
        }
      });
      if (error) throw error;
      await showAlert('Account created! Please check your email inbox to confirm your account before logging in.', 'Welcome!', 'success');
      navigate('/login');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card animate-scale">
        <div className="auth-header">
          <h2>Create your account</h2>
          <p>Start learning new skills today</p>
        </div>


        {error && <div className="auth-error" style={{ color: 'var(--danger)', marginBottom: '16px', fontSize: '0.875rem', textAlign: 'center' }}>{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Full Name</label>
            <div className="input-icon">
              <FiUser />
              <input type="text" placeholder="Enter full name" value={name} onChange={e => setName(e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label>Phone Number</label>
            <div className="input-icon">
              <FiPhone />
              <input type="tel" placeholder="Enter phone number" value={phone} onChange={e => setPhone(e.target.value)} required />
            </div>
          </div>
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
              <input type={showPw ? 'text' : 'password'} placeholder="Create a strong password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
              <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>{showPw ? <FiEyeOff /> : <FiEye />}</button>
            </div>
          </div>
          <label className="auth-terms"><input type="checkbox" required /> <span>I agree to the <Link to="/terms-of-service">Terms of Service</Link> and <Link to="/privacy-policy">Privacy Policy</Link></span></label>
          <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
      </div>
    </div>
  );
}
