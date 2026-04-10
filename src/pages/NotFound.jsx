import { Link } from 'react-router-dom';
import { FiHome, FiArrowLeft } from 'react-icons/fi';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '40px 20px'
    }}>
      <h1 style={{
        fontSize: 'clamp(4rem, 10vw, 8rem)',
        fontWeight: 800,
        background: 'linear-gradient(135deg, #008ad1, #00c6ff)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        margin: 0,
        lineHeight: 1
      }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', color: 'var(--gray-800)', margin: '12px 0 8px' }}>
        Page Not Found
      </h2>
      <p style={{ color: 'var(--gray-500)', maxWidth: '440px', marginBottom: '28px' }}>
        The page you're looking for doesn't exist or has been moved. Let's get you back on track.
      </p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link to="/" className="btn btn-primary"><FiHome style={{ marginRight: 6 }} /> Home</Link>
        <button onClick={() => window.history.back()} className="btn btn-outline"><FiArrowLeft style={{ marginRight: 6 }} /> Go Back</button>
      </div>
    </div>
  );
}
