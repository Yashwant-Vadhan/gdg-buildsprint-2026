import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Card from '../components/Card';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../lib/supabaseClient';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await signIn(email, password);
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-4">Campus Service Hub</h1>

        {!isSupabaseConfigured && (
          <div className="mb-4 rounded-lg bg-amber-100 text-warning text-sm p-3">
            Supabase not configured — copy .env.example to .env and fill in your project keys.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">
              Roll number / Email
            </label>
            <input
              id="email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full min-h-[44px] px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full min-h-[44px] px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {error && <p className="text-danger text-sm">{error}</p>}

          <Button type="submit" loading={submitting} className="w-full">
            Log in
          </Button>
        </form>

        <p className="text-sm text-gray-500 mt-4 text-center">
          New student?{' '}
          <Link to="/register" className="text-primary underline">Register</Link>
        </p>
      </Card>
    </div>
  );
}
