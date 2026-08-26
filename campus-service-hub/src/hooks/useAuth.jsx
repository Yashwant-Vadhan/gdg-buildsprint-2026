import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isMockMode } from '../lib/supabaseClient';

const AuthContext = createContext(null);

// Preset mock users for convenience during hackathon demo/testing
const MOCK_USERS = {
  'student_day@hub.edu': {
    id: 'mock-day-scholar-id',
    email: 'student_day@hub.edu',
    name: 'Sushil Kumar (Day Scholar)',
    roll_no: 'CS26001',
    user_type: 'day_scholar',
    role: 'student',
  },
  'student_hostel@hub.edu': {
    id: 'mock-hosteller-id',
    email: 'student_hostel@hub.edu',
    name: 'Sushil Kumar (Hosteller)',
    roll_no: 'CS26002',
    user_type: 'hosteller',
    role: 'student',
    hostel_block: 'Block-A',
    room_no: 'A-304',
  },
  'canteen@hub.edu': {
    id: 'mock-canteen-admin-id',
    email: 'canteen@hub.edu',
    name: 'Canteen Manager',
    roll_no: 'ADM001',
    user_type: 'day_scholar',
    role: 'canteen_admin',
  },
  'committee@hub.edu': {
    id: 'mock-committee-id',
    email: 'committee@hub.edu',
    name: 'Hostel Committee Lead',
    roll_no: 'COM001',
    user_type: 'hosteller',
    role: 'hostel_committee',
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for mocked session first
    const storedUser = localStorage.getItem('hub_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setLoading(false);
      return;
    }

    if (isMockMode) {
      setLoading(false);
      return;
    }

    // Real Supabase Auth subscription
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchUserProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchUserProfile(session.user);
      } else {
        setUser(null);
        localStorage.removeItem('hub_user');
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (authUser) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) throw error;
      const fullUser = { ...authUser, ...data };
      setUser(fullUser);
      localStorage.setItem('hub_user', JSON.stringify(fullUser));
    } catch (err) {
      console.error('Error fetching user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    setLoading(true);
    if (isMockMode) {
      // Simulate login with preset users or default student
      const matched = MOCK_USERS[email];
      if (matched) {
        setUser(matched);
        localStorage.setItem('hub_user', JSON.stringify(matched));
        setLoading(false);
        return { success: true, user: matched };
      } else {
        // Fallback generic student
        const guestUser = {
          id: 'guest-id-' + Date.now(),
          email,
          name: email.split('@')[0],
          roll_no: 'CS' + Math.floor(10000 + Math.random() * 90000),
          user_type: 'hosteller',
          role: 'student',
          hostel_block: 'Block-B',
          room_no: 'B-101',
        };
        setUser(guestUser);
        localStorage.setItem('hub_user', JSON.stringify(guestUser));
        setLoading(false);
        return { success: true, user: guestUser };
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return { success: false, error: error.message };
    }
    await fetchUserProfile(data.user);
    return { success: true };
  };

  const signup = async (email, password, { name, roll_no, user_type, hostel_block, room_no }) => {
    setLoading(true);
    if (isMockMode) {
      const newUser = {
        id: 'new-user-' + Date.now(),
        email,
        name,
        roll_no,
        user_type,
        role: 'student',
        hostel_block: user_type === 'hosteller' ? hostel_block : null,
        room_no: user_type === 'hosteller' ? room_no : null,
      };
      setUser(newUser);
      localStorage.setItem('hub_user', JSON.stringify(newUser));
      
      // Seed initial wallet balance in mock mode storage
      if (user_type === 'hosteller') {
        localStorage.setItem(`wallet_balance_${newUser.id}`, '0.00');
      }
      
      setLoading(false);
      return { success: true, user: newUser };
    }

    // 1. Supabase Auth Signup
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setLoading(false);
      return { success: false, error: error.message };
    }

    // 2. Insert into users table
    const profile = {
      id: data.user.id,
      name,
      roll_no,
      email,
      user_type,
      role: 'student',
      hostel_block: user_type === 'hosteller' ? hostel_block : null,
      room_no: user_type === 'hosteller' ? room_no : null,
    };

    const { error: profileError } = await supabase.from('users').insert(profile);
    if (profileError) {
      setLoading(false);
      return { success: false, error: profileError.message };
    }

    // 3. If Hosteller, auto-create wallet (handled by database trigger or frontend manual insert if trigger is not set)
    if (user_type === 'hosteller') {
      const { error: walletError } = await supabase.from('wallets').insert({
        user_id: data.user.id,
        balance: 0.00
      });
      if (walletError) {
        console.error('Wallet creation error:', walletError.message);
      }
    }

    setUser({ ...data.user, ...profile });
    setLoading(false);
    return { success: true };
  };

  const logout = async () => {
    if (!isMockMode) {
      await supabase.auth.signOut();
    }
    setUser(null);
    localStorage.removeItem('hub_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, isMockMode }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
