import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import StudentLayout from './components/StudentLayout';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';

// Placeholder/lazy screens for other roles to ensure no routing crashes
import Canteen from './pages/student/Canteen';
import CanteenCheckout from './pages/student/CanteenCheckout';
import CanteenStatus from './pages/student/CanteenStatus';
import PaymentReturn from './pages/student/PaymentReturn';
import Store from './pages/student/Store';
import Laundry from './pages/student/Laundry';
import Wallet from './pages/student/Wallet';

// Admin / Committee screens (Madheshwaran)
import CanteenAdmin from './pages/admin/CanteenAdmin';
import StoreAdmin from './pages/admin/StoreAdmin';
import LaundryAdmin from './pages/admin/LaundryAdmin';
import PaymentsView from './pages/admin/PaymentsView';
import ReceiptsQueue from './pages/committee/ReceiptsQueue';
import WalletLog from './pages/committee/WalletLog';

const ADMIN_HOME_BY_ROLE = {
  canteen_admin: '/admin/canteen',
  store_admin: '/admin/store',
  laundry_admin: '/admin/laundry',
  hostel_committee: '/committee/receipts',
};

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
    return <Navigate to={ADMIN_HOME_BY_ROLE[user.role] ?? '/login'} replace />;
  }

  if (requireHosteller && user.user_type !== 'hosteller') {
    return <Navigate to="/student/canteen" replace />;
  }

  return children;
};

// Role Guard for Admin / Committee staff — mirrors StudentGuard for the other four roles
const StaffGuard = ({ children, allowedRoles }) => {
  const { user } = useAuth();

  if (user.role === 'student') {
    return <Navigate to="/student/canteen" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={ADMIN_HOME_BY_ROLE[user.role] ?? '/login'} replace />;
  }

  return children;
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
        <Route path="canteen/payment-return" element={<PaymentReturn />} />
        <Route path="canteen/status/:id" element={<CanteenStatus />} />

        {/* Hosteller Only Guarded Routes */}
        <Route path="store" element={<StudentGuard requireHosteller><Store /></StudentGuard>} />
        <Route path="laundry" element={<StudentGuard requireHosteller><Laundry /></StudentGuard>} />
        <Route path="wallet" element={<StudentGuard requireHosteller><Wallet /></StudentGuard>} />
      </Route>

      {/* Admin Routes — Canteen / Store / Laundry admins share Payments */}
      <Route
        path="/admin"
        element={
          <AuthGuard>
            <StaffGuard allowedRoles={['canteen_admin', 'store_admin', 'laundry_admin']}>
              <AdminLayout />
            </StaffGuard>
          </AuthGuard>
        }
      >
        <Route path="canteen" element={<CanteenAdmin />} />
        <Route path="store" element={<StoreAdmin />} />
        <Route path="laundry" element={<LaundryAdmin />} />
        <Route path="payments" element={<PaymentsView />} />
      </Route>

      {/* Committee Routes */}
      <Route
        path="/committee"
        element={
          <AuthGuard>
            <StaffGuard allowedRoles={['hostel_committee']}>
              <AdminLayout />
            </StaffGuard>
          </AuthGuard>
        }
      >
        <Route index element={<Navigate to="receipts" replace />} />
        <Route path="receipts" element={<ReceiptsQueue />} />
        <Route path="wallet-log" element={<WalletLog />} />
      </Route>

      {/* Default Catch-all */}
      <Route path="*" element={<Navigate to="/student/canteen" replace />} />
    </Routes>
  );
}
