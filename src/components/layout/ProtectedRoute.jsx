import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="section container text-center">Loading...</div>;
  }

  if (!user) {
    // Redirect them to the /login page, but save the current location they were trying to go to
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // User is logged in but doesn't have the right role
    // Redirect to their respective dashboard
    if (role === 'admin') return <Navigate to="/admin" replace />;
    if (role === 'instructor') return <Navigate to="/instructor" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
