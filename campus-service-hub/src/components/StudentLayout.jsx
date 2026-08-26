import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Coffee, Store, WashingMachine, Wallet, LogOut, Sun, Moon } from 'lucide-react';

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const isDayScholar = user.user_type === 'day_scholar';

  const tabs = [
    { name: 'Canteen Menu', path: '/student/canteen', icon: Coffee },
    ...(!isDayScholar ? [
      { name: 'Hostel Store', path: '/student/store', icon: Store },
      { name: 'Laundry Desk', path: '/student/laundry', icon: WashingMachine },
      { name: 'Student Wallet', path: '/student/wallet', icon: Wallet },
    ] : []),
  ];

  // Dark/Light Mode state management
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Dynamically assign theme container class depending on page URL
  const getThemeClass = () => {
    if (location.pathname.includes('/student/canteen')) return 'theme-canteen';
    if (location.pathname.includes('/student/store')) return 'theme-store';
    if (location.pathname.includes('/student/laundry')) return 'theme-laundry';
    if (location.pathname.includes('/student/wallet')) return 'theme-wallet';
    return 'theme-canteen';
  };

  const currentTheme = getThemeClass();

  return (
    <div className={`min-h-screen pb-20 md:pb-0 md:pl-64 flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-300 ${currentTheme}`}>
      
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col p-6 z-35 shadow-sm transition-colors duration-300">
        
        {/* Anna University Emblem Header */}
        <div className="flex flex-col items-center gap-2 mb-8 pb-5 border-b border-slate-100 dark:border-slate-800">
          <img 
            src="https://upload.wikimedia.org/wikipedia/en/thumb/4/49/Anna_University_logo.svg/200px-Anna_University_logo.svg.png"
            alt="Anna University Logo"
            className="w-16 h-16 object-contain dark:brightness-95"
            onError={(e) => {
              e.target.style.display = 'none';
              document.getElementById('au-logo-fallback').style.display = 'flex';
            }}
          />
          <div 
            id="au-logo-fallback" 
            className="hidden w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full items-center justify-center font-bold text-slate-700 dark:text-slate-300 text-center text-[10px] border border-slate-350 dark:border-slate-700"
          >
            AU Logo
          </div>
          <div className="text-center mt-1">
            <h2 className="text-xs font-black text-slate-800 dark:text-slate-200 tracking-wider uppercase m-0 leading-none">CAMPUS</h2>
            <span className="text-[10px] text-brand font-black tracking-widest uppercase transition-colors duration-300">
              SERVICE HUB
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname.startsWith(tab.path);
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                  isActive
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {tab.name}
              </Link>
            );
          })}
        </nav>

        {/* Controls: Light/Dark Mode switch */}
        <div className="py-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
          <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Theme Mode</span>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-350 text-slate-550 dark:text-slate-305 transition-all cursor-pointer"
            aria-label="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>
        </div>

        {/* User Card */}
        <div className="border-t border-slate-150 dark:border-slate-800 pt-4 flex flex-col gap-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-black text-xs border border-slate-205 dark:border-slate-700">
              {user.name[0]}
            </div>
            <div className="truncate text-left">
              <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate uppercase">{user.name}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{user.roll_no}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-2 rounded-lg text-xs font-black text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all duration-300 cursor-pointer uppercase tracking-wider"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Top Header for Mobile */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-2">
          <img 
            src="https://upload.wikimedia.org/wikipedia/en/thumb/4/49/Anna_University_logo.svg/200px-Anna_University_logo.svg.png"
            alt="Anna University Logo"
            className="w-8 h-8 object-contain"
          />
          <div className="text-left">
            <h2 className="text-xs font-black text-slate-805 dark:text-slate-200 tracking-tight m-0 leading-none">CAMPUS</h2>
            <span className="text-[8px] text-brand font-black uppercase tracking-wider transition-colors duration-300">SERVICE HUB</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={logout}
            className="p-2 text-slate-450 hover:text-red-600 transition-all duration-300 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        <Outlet />
      </main>

      {/* Bottom Tab Bar for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-around py-2 px-4 z-30 shadow-lg transition-colors duration-300">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname.startsWith(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center gap-1 py-1 px-3 transition-all duration-300 ${
                isActive ? 'text-brand scale-105 font-bold' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9px] font-bold uppercase tracking-wider">{tab.name.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
