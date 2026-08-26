import { Routes, Route, Navigate, Link } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import CanteenAdmin from './pages/admin/CanteenAdmin';
import StoreAdmin from './pages/admin/StoreAdmin';
import LaundryAdmin from './pages/admin/LaundryAdmin';
import PaymentsView from './pages/admin/PaymentsView';
import ReceiptsQueue from './pages/committee/ReceiptsQueue';
import WalletLog from './pages/committee/WalletLog';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './hooks/useAuth';

const NAV_BY_ROLE = {
  canteen_admin: [{ to: '/admin/canteen', label: 'Queue / Menu' }, { to: '/admin/payments', label: 'Payments' }],
  store_admin: [{ to: '/admin/store', label: 'Queue / Menu' }, { to: '/admin/payments', label: 'Payments' }],
  laundry_admin: [{ to: '/admin/laundry', label: 'Queue' }, { to: '/admin/payments', label: 'Payments' }],
  hostel_committee: [{ to: '/committee/receipts', label: 'Receipts' }, { to: '/committee/wallet-log', label: 'Wallet Log' }],
};

const HOME_BY_ROLE = {
  student: '/student',
  canteen_admin: '/admin/canteen',
  store_admin: '/admin/store',
  laundry_admin: '/admin/laundry',
  hostel_committee: '/committee/receipts',
};

// Placeholder until the real student-facing pages (canteen/store/laundry/wallet
// ordering) are built — not this role's scope, just here so registering as a
// student doesn't dead-end at a confusing redirect.
function StudentPlaceholder() {
  const { profile, signOut } = useAuth();
  return (
    <div className="p-6 max-w-sm mx-auto text-center space-y-3">
      <h1 className="text-xl font-semibold">Welcome, {profile?.name}</h1>
      <p className="text-gray-500">Student ordering pages are still being built.</p>
      <button onClick={signOut} className="text-sm text-primary underline">Log out</button>
    </div>
  );
}

function TopNav() {
  const { role, signOut } = useAuth();
  const links = NAV_BY_ROLE[role] ?? [];

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
      <div className="flex gap-4">
        {links.map((link) => (
          <Link key={link.to} to={link.to} className="text-sm font-medium text-gray-700 hover:text-primary">
            {link.label}
          </Link>
        ))}
      </div>
      <button onClick={signOut} className="text-sm text-gray-500 hover:text-danger">
        Log out
      </button>
    </nav>
  );
}

function Home() {
  const { role, loading } = useAuth();
  if (loading) return <div className="p-6 text-center text-gray-500">Loading…</div>;
  return <Navigate to={HOME_BY_ROLE[role] ?? '/login'} replace />;
}

// Dev-only, unauthenticated preview of admin/committee screens — lets you see the UI
// before a real Supabase project + admin accounts exist. Stripped from prod builds
// by import.meta.env.DEV (Vite removes the whole branch at build time).
const DEV_PREVIEW_PAGES = [
  { to: '/dev/admin/canteen', label: 'Admin — Canteen' },
  { to: '/dev/admin/store', label: 'Admin — Store' },
  { to: '/dev/admin/laundry', label: 'Admin — Laundry' },
  { to: '/dev/admin/payments', label: 'Admin — Payments' },
  { to: '/dev/committee/receipts', label: 'Committee — Receipts' },
  { to: '/dev/committee/wallet-log', label: 'Committee — Wallet Log' },
];

function DevPreviewIndex() {
  return (
    <div className="p-6 max-w-md mx-auto space-y-2">
      <h1 className="text-xl font-semibold mb-4">Dev Preview (no login required)</h1>
      {DEV_PREVIEW_PAGES.map((page) => (
        <Link
          key={page.to}
          to={page.to}
          className="block bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-primary"
        >
          {page.label}
        </Link>
      ))}
      <p className="text-sm text-gray-500 pt-2">
        Data reads/writes will show errors until a real Supabase project is configured in .env.
      </p>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      {user && <TopNav />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/student"
          element={<ProtectedRoute allowedRoles={['student']}><StudentPlaceholder /></ProtectedRoute>}
        />
        <Route path="/" element={<Home />} />

        <Route
          path="/admin/canteen"
          element={<ProtectedRoute allowedRoles={['canteen_admin']}><CanteenAdmin /></ProtectedRoute>}
        />
        <Route
          path="/admin/store"
          element={<ProtectedRoute allowedRoles={['store_admin']}><StoreAdmin /></ProtectedRoute>}
        />
        <Route
          path="/admin/laundry"
          element={<ProtectedRoute allowedRoles={['laundry_admin']}><LaundryAdmin /></ProtectedRoute>}
        />
        <Route
          path="/admin/payments"
          element={
            <ProtectedRoute allowedRoles={['canteen_admin', 'store_admin', 'laundry_admin']}>
              <PaymentsView />
            </ProtectedRoute>
          }
        />

        <Route
          path="/committee/receipts"
          element={<ProtectedRoute allowedRoles={['hostel_committee']}><ReceiptsQueue /></ProtectedRoute>}
        />
        <Route
          path="/committee/wallet-log"
          element={<ProtectedRoute allowedRoles={['hostel_committee']}><WalletLog /></ProtectedRoute>}
        />

        {import.meta.env.DEV && (
          <>
            <Route path="/dev" element={<DevPreviewIndex />} />
            <Route path="/dev/admin/canteen" element={<CanteenAdmin />} />
            <Route path="/dev/admin/store" element={<StoreAdmin />} />
            <Route path="/dev/admin/laundry" element={<LaundryAdmin />} />
            <Route path="/dev/admin/payments" element={<PaymentsView />} />
            <Route path="/dev/committee/receipts" element={<ReceiptsQueue />} />
            <Route path="/dev/committee/wallet-log" element={<WalletLog />} />
          </>
        )}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
