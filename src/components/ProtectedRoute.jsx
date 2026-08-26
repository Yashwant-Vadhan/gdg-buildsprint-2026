import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute({ allowedRoles, children }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
