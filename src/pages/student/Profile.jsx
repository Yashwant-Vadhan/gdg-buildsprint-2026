import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { User, Mail, Shield, Building, Home, LogOut } from 'lucide-react';

export default function Profile() {
  const { profile, userType, signOut } = useAuth();

  if (!profile) return null;

  return (
    <div className="max-w-md mx-auto space-y-6 text-left pb-10">
      <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase m-0">Student Profile</h1>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-md relative overflow-hidden">
        
        {/* Top Banner accent */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-brand"></div>

        {/* Avatar header */}
        <div className="flex flex-col items-center pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="w-20 h-20 rounded-full bg-brand-light text-brand flex items-center justify-center text-3xl font-black border-2 border-brand shadow-md">
            {profile.name?.[0] ?? '?'}
          </div>
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-150 uppercase tracking-tight mt-3">{profile.name}</h2>
          <span className="text-[10px] text-brand font-black uppercase tracking-widest bg-brand-light px-2.5 py-0.5 rounded mt-1.5">
            {userType?.replace('_', ' ')}
          </span>
        </div>

        {/* Profile details list */}
        <div className="space-y-4 pt-6 text-xs">
          
          {/* Roll Number */}
          <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-brand shrink-0" /> Roll Number
            </span>
            <span className="text-slate-800 dark:text-slate-100 font-black">{profile.roll_no}</span>
          </div>

          {/* Email */}
          <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-brand shrink-0" /> Email Address
            </span>
            <span className="text-slate-800 dark:text-slate-100 font-bold">{profile.email}</span>
          </div>

          {/* User Type */}
          <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-4 h-4 text-brand shrink-0" /> Residency
            </span>
            <span className="text-slate-800 dark:text-slate-100 font-black uppercase">{userType?.replace('_', ' ')}</span>
          </div>

          {/* Hosteller block info */}
          {userType === 'hosteller' && (
            <>
              <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800">
                <span className="text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-brand shrink-0" /> Hostel Block
                </span>
                <span className="text-slate-800 dark:text-slate-100 font-black">{profile.hostel_block || 'N/A'}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800">
                <span className="text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Home className="w-4 h-4 text-brand shrink-0" /> Room Number
                </span>
                <span className="text-slate-800 dark:text-slate-100 font-black">{profile.room_no || 'N/A'}</span>
              </div>
            </>
          )}

        </div>

        <button
          onClick={signOut}
          className="w-full mt-8 py-3 bg-red-600 hover:bg-red-750 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out Account
        </button>

      </div>
    </div>
  );
}
