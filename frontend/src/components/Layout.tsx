import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  Activity, 
  Terminal, 
  Key, 
  LogOut, 
  Webhook, 
  User, 
  Menu, 
  X,
  Lock
} from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navigation = [
    { name: 'Endpoints', href: '/', icon: Webhook },
    { name: 'API Keys', href: '/keys', icon: Key },
    { name: 'System Logs', href: '/audit', icon: Terminal },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div class="min-h-screen bg-slate-950 flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside class="hidden md:flex flex-col w-64 glass-panel border-r border-slate-900 px-4 py-6 justify-between shrink-0">
        <div>
          {/* Logo */}
          <div class="flex items-center gap-3 px-2 mb-8 select-none">
            <div class="bg-brand-500/10 p-2 rounded-xl border border-brand-500/20 text-brand-400">
              <Activity class="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span class="font-display font-bold text-lg tracking-tight text-white">WebhookEngine</span>
              <span class="block text-[10px] text-slate-400 font-mono">v1.0.0 • SDE Console</span>
            </div>
          </div>

          {/* Nav items */}
          <nav class="space-y-1.5">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  class={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive 
                      ? 'bg-brand-500/15 border border-brand-500/25 text-brand-300' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border border-transparent'
                  }`}
                >
                  <Icon class={`w-4.5 h-4.5 ${isActive ? 'text-brand-400' : 'text-slate-400'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Footer Profile & Logout */}
        <div class="pt-6 border-t border-slate-900 space-y-4">
          <div class="flex items-center gap-3 px-2">
            <div class="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 border border-slate-700">
              <User class="w-4 h-4" />
            </div>
            <div class="overflow-hidden">
              <span class="block text-xs font-semibold text-slate-200 truncate">{user?.name || 'Developer'}</span>
              <span class="block text-[10px] text-slate-500 truncate">{user?.email}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/5 border border-transparent hover:border-red-500/10 transition-all cursor-pointer"
          >
            <LogOut class="w-4.5 h-4.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Top Navbar */}
      <header class="md:hidden flex items-center justify-between px-6 py-4 glass-panel border-b border-slate-900 z-50">
        <div class="flex items-center gap-2">
          <Activity class="w-5 h-5 text-brand-400" />
          <span class="font-display font-bold text-md text-white">WebhookEngine</span>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          class="text-slate-400 hover:text-slate-200 cursor-pointer"
        >
          {mobileMenuOpen ? <X class="w-6 h-6" /> : <Menu class="w-6 h-6" />}
        </button>
      </header>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div class="md:hidden fixed inset-0 top-16 bg-slate-950/95 backdrop-blur-lg z-40 flex flex-col p-6 justify-between">
          <nav class="space-y-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  class={`flex items-center gap-4 px-4 py-3.5 rounded-xl text-base font-semibold transition-all ${
                    isActive 
                      ? 'bg-brand-500/15 border border-brand-500/25 text-brand-300' 
                      : 'text-slate-400 border border-transparent'
                  }`}
                >
                  <Icon class="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          
          <div class="pt-6 border-t border-slate-900 space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
                <User class="w-5 h-5" />
              </div>
              <div>
                <span class="block text-sm font-semibold text-slate-200">{user?.name || 'Developer'}</span>
                <span class="block text-xs text-slate-500">{user?.email}</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              class="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-medium bg-red-500/10 border border-red-500/20 text-red-400 cursor-pointer"
            >
              <LogOut class="w-4.5 h-4.5" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Page Area */}
      <main class="flex-1 flex flex-col min-w-0 bg-slate-950/60 overflow-y-auto">
        <div class="flex-1 p-6 md:p-10 max-w-7xl w-full mx-auto space-y-8">
          {children}
        </div>
      </main>
    </div>
  );
};
