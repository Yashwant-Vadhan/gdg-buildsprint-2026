import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Card from '../components/Card';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../lib/supabaseClient';

const EMPTY_FORM = {
  name: '',
  rollNo: '',
  email: '',
  password: '',
  userType: 'day_scholar',
};

export default function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationNeeded, setConfirmationNeeded] = useState(false);

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signUpError, needsEmailConfirmation } = await signUp(form);
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (needsEmailConfirmation) {
      setConfirmationNeeded(true);
      return;
    }
    navigate('/');
  };

  if (confirmationNeeded) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold mb-2">Check your email</h1>
          <p className="text-sm text-gray-600">
            We sent a confirmation link to {form.email}. Confirm it, then log in.
          </p>
          <Link to="/login" className="inline-block mt-4 text-primary underline text-sm">
            Back to login
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-4">Student Registration</h1>

        {!isSupabaseConfigured && (
          <div className="mb-4 rounded-lg bg-amber-100 text-warning text-sm p-3">
            Supabase not configured — copy .env.example to .env and fill in your project keys.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={update('name')}
              className="w-full min-h-[44px] px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="rollNo">Roll number</label>
            <input
              id="rollNo"
              type="text"
              value={form.rollNo}
              onChange={update('rollNo')}
              className="w-full min-h-[44px] px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={update('email')}
              className="w-full min-h-[44px] px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={update('password')}
              minLength={6}
              className="w-full min-h-[44px] px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <span className="block text-sm font-medium mb-1">I am a</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="userType"
                  value="day_scholar"
                  checked={form.userType === 'day_scholar'}
                  onChange={update('userType')}
                />
                Day Scholar
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="userType"
                  value="hosteller"
                  checked={form.userType === 'hosteller'}
                  onChange={update('userType')}
                />
                Hosteller
              </label>
            </div>
          </div>

          {error && <p className="text-danger text-sm">{error}</p>}

          <Button type="submit" loading={submitting} className="w-full">
            Register
          </Button>
        </form>

        <p className="text-sm text-gray-500 mt-4 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-primary underline">Log in</Link>
        </p>
      </Card>
    </div>
  );
}
