import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LogIn, UserPlus, ShieldAlert, Utensils, Building, KeyRound, Mail, User } from 'lucide-react';

export default function Login() {
  const { login, signup, loading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [userType, setUserType] = useState('hosteller');
  const [hostelBlock, setHostelBlock] = useState('Block-A');
  const [roomNo, setRoomNo] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isLogin) {
      const res = await login(email, password);
      if (!res.success) {
        setError(res.error || 'Login failed. Please check your credentials.');
      }
    } else {
      if (!name || !rollNo || (userType === 'hosteller' && (!hostelBlock || !roomNo))) {
        setError('All fields are required to join the hub.');
        return;
      }
      const res = await signup(email, password, {
        name,
        roll_no: rollNo,
        user_type: userType,
        hostel_block: hostelBlock,
        room_no: roomNo,
      });
      if (!res.success) {
        setError(res.error || 'Failed to create student card.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-neutral-100">
      <div className="w-full max-w-lg bg-white border border-neutral-200 rounded-2xl shadow-lg relative overflow-hidden">
        
        {/* KFC Stripes top banner */}
        <div className="kfc-stripes w-full shrink-0"></div>

        <div className="p-8">
          <div className="flex flex-col items-center mb-8 pb-6 border-b border-neutral-100">
            <div className="w-16 h-16 bg-[#e4002b] rounded-full flex items-center justify-center mb-4 text-white shadow-md">
              <Utensils className="w-7 h-7" />
            </div>
            <h1 className="text-3xl font-black text-neutral-800 tracking-tighter m-0 uppercase leading-none">CAMPUS SERVICE HUB</h1>
            <p className="text-neutral-500 text-xs mt-2 uppercase tracking-widest font-black text-[#e4002b]">Fast & Secure Ordering Portal</p>
          </div>

          {/* Tab selection with bold underlines */}
          <div className="flex mb-6 border-b border-neutral-200">
            <button
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 pb-3 text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                isLogin ? 'text-[#e4002b] border-b-4 border-[#e4002b]' : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <LogIn className="w-4 h-4" /> Sign In
              </span>
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 pb-3 text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                !isLogin ? 'text-[#e4002b] border-b-4 border-[#e4002b]' : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <UserPlus className="w-4 h-4" /> Register
              </span>
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-[#e4002b] text-red-800 rounded flex items-start gap-3 text-left text-xs font-bold">
              <ShieldAlert className="w-5 h-5 text-[#e4002b] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wider text-[#e4002b]">System Notice</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {!isLogin && (
              <>
                {/* Full Name */}
                <div>
                  <label className="block text-[10px] font-black text-neutral-500 mb-1 uppercase tracking-wider">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Sushil Kumar"
                      className="w-full pl-9 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-red-550 transition-colors text-xs"
                    />
                  </div>
                </div>

                {/* Roll Number */}
                <div>
                  <label className="block text-[10px] font-black text-neutral-500 mb-1 uppercase tracking-wider">Roll Number</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      required
                      value={rollNo}
                      onChange={(e) => setRollNo(e.target.value)}
                      placeholder="e.g. CS26001"
                      className="w-full pl-9 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-red-550 transition-colors text-xs"
                    />
                  </div>
                </div>

                {/* Residency */}
                <div>
                  <label className="block text-[10px] font-black text-neutral-500 mb-1 uppercase tracking-wider">Residency Option</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setUserType('hosteller')}
                      className={`py-2 px-3 rounded-lg border text-xs font-black transition-all ${
                        userType === 'hosteller'
                          ? 'border-[#e4002b] bg-[#e4002b]/5 text-[#e4002b]'
                          : 'border-neutral-250 bg-neutral-50 text-neutral-400 hover:border-neutral-350'
                      }`}
                    >
                      Hosteller
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserType('day_scholar')}
                      className={`py-2 px-3 rounded-lg border text-xs font-black transition-all ${
                        userType === 'day_scholar'
                          ? 'border-[#e4002b] bg-[#e4002b]/5 text-[#e4002b]'
                          : 'border-neutral-250 bg-neutral-50 text-neutral-400 hover:border-neutral-350'
                      }`}
                    >
                      Day Scholar
                    </button>
                  </div>
                </div>

                {/* Hosteller Fields */}
                {userType === 'hosteller' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-neutral-500 mb-1 uppercase tracking-wider">Hostel Block</label>
                      <select
                        value={hostelBlock}
                        onChange={(e) => setHostelBlock(e.target.value)}
                        className="w-full px-2 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-800 focus:outline-none focus:border-red-550 text-xs"
                      >
                        <option value="Block-A">Block A</option>
                        <option value="Block-B">Block B</option>
                        <option value="Block-C">Block C</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-neutral-500 mb-1 uppercase tracking-wider">Room No</label>
                      <input
                        type="text"
                        required
                        value={roomNo}
                        onChange={(e) => setRoomNo(e.target.value)}
                        placeholder="e.g. 304"
                        className="w-full px-2.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-red-550 text-xs"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Email */}
            <div>
              <label className="block text-[10px] font-black text-neutral-500 mb-1 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@hub.edu"
                  className="w-full pl-9 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-red-550 transition-colors text-xs"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] font-black text-neutral-500 mb-1 uppercase tracking-wider">Password</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-red-550 transition-colors text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#e4002b] hover:bg-red-750 disabled:opacity-50 text-white rounded-lg font-black uppercase tracking-widest transition-all duration-300 cursor-pointer shadow flex items-center justify-center gap-2 mt-6 text-xs"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : isLogin ? (
                <>
                  <LogIn className="w-4 h-4" /> Enter Canteen Hub
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" /> Create Profile card
                </>
              )}
            </button>
          </form>

          {isLogin && (
            <div className="mt-8 border-t border-neutral-100 pt-6 text-center text-neutral-500">
              <p className="font-black text-[10px] uppercase tracking-wider text-neutral-450 mb-3 text-left">Quick Demo Combos</p>
              <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
                <button 
                  onClick={() => { setEmail('student_hostel@hub.edu'); setPassword('demo123'); }}
                  className="p-2.5 bg-neutral-50 border border-neutral-200 hover:border-[#e4002b]/40 rounded-lg text-neutral-800 text-[10px] font-black text-left flex flex-col justify-between"
                >
                  <span className="text-[#e4002b] font-black text-[8px] uppercase tracking-wider">COMBO 1</span>
                  <span>Hosteller Acc.</span>
                </button>
                <button 
                  onClick={() => { setEmail('student_day@hub.edu'); setPassword('demo123'); }}
                  className="p-2.5 bg-neutral-50 border border-neutral-200 hover:border-[#e4002b]/40 rounded-lg text-neutral-800 text-[10px] font-black text-left flex flex-col justify-between"
                >
                  <span className="text-[#e4002b] font-black text-[8px] uppercase tracking-wider">COMBO 2</span>
                  <span>Day Scholar Acc.</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
