import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();
    if (error) {
      console.error('[useAuth] failed to load user profile', error);
      setProfile(null);
    } else {
      setProfile(data);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const authUser = data.session?.user ?? null;
      setUser(authUser);
      await loadProfile(authUser);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const authUser = session?.user ?? null;
      setUser(authUser);
      await loadProfile(authUser);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signUp = useCallback(async ({ name, rollNo, email, password, userType }) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error };

    const authUser = data.user;
    if (!authUser) {
      return { error: new Error('Sign up did not return a user') };
    }

    const { error: profileError } = await supabase.from('users').insert({
      id: authUser.id,
      name,
      roll_no: rollNo,
      email,
      user_type: userType,
      role: 'student',
    });
    if (profileError) return { error: profileError };

    if (userType === 'hosteller') {
      const { error: walletError } = await supabase
        .from('wallets')
        .insert({ user_id: authUser.id, balance: 0 });
      if (walletError) return { error: walletError };
    }

    // If email confirmation is required, data.session is null here and the
    // caller should tell the student to confirm before logging in.
    return { error: null, needsEmailConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    user,
    role: profile?.role ?? null,
    userType: profile?.user_type ?? null,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
  };
}
