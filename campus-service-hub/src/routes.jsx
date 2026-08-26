import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import StudentLayout from './components/StudentLayout';
import Login from './pages/Login';

// Placeholder/lazy screens for other roles to ensure no routing crashes
import Canteen from './pages/student/Canteen';
import CanteenCheckout from './pages/student/CanteenCheckout';
import CanteenStatus from './pages/student/CanteenStatus';
import Store from './pages/student/Store';
import Laundry from './pages/student/Laundry';
import Wallet from './pages/student/Wallet';

// Authentication Guard
const AuthGuard = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <span className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// Role Guard for Students
const StudentGuard = ({ children, requireHosteller = false }) => {
  const { user } = useAuth();

  if (user.role !== 'student') {
    return <Navigate to="/admin-portal" replace />;
  }

  if (requireHosteller && user.user_type !== 'hosteller') {
    return <Navigate to="/student/canteen" replace />;
  }

  return children;
};

// Simple Fallback Admin Dashboard for other roles (to support demo accounts switching)
const AdminPortalFallback = () => {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-panel p-8 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Portal Access</h2>
        <p className="text-slate-400 text-sm mb-6">
          You logged in as <span className="text-blue-400 font-semibold">{user?.name}</span> with role <span className="text-purple-400 font-semibold uppercase">{user?.role}</span>.
        </p>
        <div className="p-4 bg-yellow-950/20 border border-yellow-500/30 text-yellow-300 rounded-xl text-xs text-left mb-6">
          ⚠️ Admin portals are managed by Madheshwaran (Phase 5/6).
        </div>
        <button
          onClick={logout}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-all"
        >
          Sign Out & Return
        </button>
      </div>
    </div>
  );
};

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* Student Routes */}
      <Route
        path="/student"
        element={
          <AuthGuard>
            <StudentGuard>
              <StudentLayout />
            </StudentGuard>
          </AuthGuard>
        }
      >
        <Route index element={<Navigate to="canteen" replace />} />
        <Route path="canteen" element={<Canteen />} />
        <Route path="canteen/checkout" element={<CanteenCheckout />} />
        <Route path="canteen/status/:id" element={<CanteenStatus />} />
        
        {/* Hosteller Only Guarded Routes */}
        <Route path="store" element={<StudentGuard requireHosteller><Store /></StudentGuard>} />
        <Route path="laundry" element={<StudentGuard requireHosteller><Laundry /></StudentGuard>} />
        <Route path="wallet" element={<StudentGuard requireHosteller><Wallet /></StudentGuard>} />
      </Route>

      {/* Admin Portal Redirect / Fallback */}
      <Route path="/admin-portal" element={<AuthGuard><AdminPortalFallback /></AuthGuard>} />

      {/* Default Catch-all */}
      <Route path="*" element={<Navigate to="/student/canteen" replace />} />
    </Routes>
  );
}
