import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useNavigate, Link } from 'react-router-dom';
import { Activity, Mail, Lock, User, Loader2 } from 'lucide-react';

export const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(email, password, name || undefined);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please check inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
      {/* Decorative Blur Orbs */}
      <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -z-10"></div>
      <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -z-10"></div>

      <div class="w-full max-w-md space-y-8">
        {/* Header */}
        <div class="text-center space-y-3">
          <div class="inline-flex bg-brand-500/10 p-3.5 rounded-2xl border border-brand-500/20 text-brand-400 mb-2">
            <Activity class="w-8 h-8" />
          </div>
          <h1 class="font-display font-bold text-3xl tracking-tight text-white">Create account</h1>
          <p class="text-sm text-slate-400">Get started with SDE-grade webhook delivery</p>
        </div>

        {/* Card */}
        <div class="glass-panel p-8 rounded-3xl border border-slate-900 shadow-xl glow-brand">
          <form onSubmit={handleSubmit} class="space-y-5">
            {error && (
              <div class="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
                {error}
              </div>
            )}

            <div class="space-y-2">
              <label class="block text-xs font-semibold text-slate-300">Full Name (Optional)</label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <User class="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  class="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-sm transition-all text-slate-100 placeholder:text-slate-600 outline-none"
                />
              </div>
            </div>

            <div class="space-y-2">
              <label class="block text-xs font-semibold text-slate-300">Email Address</label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <Mail class="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  class="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-sm transition-all text-slate-100 placeholder:text-slate-600 outline-none"
                />
              </div>
            </div>

            <div class="space-y-2">
              <label class="block text-xs font-semibold text-slate-300">Password</label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <Lock class="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  class="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-sm transition-all text-slate-100 placeholder:text-slate-600 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              class="w-full py-3 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 disabled:bg-brand-500/50 rounded-xl text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 class="w-4 h-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>

        <p class="text-center text-xs text-slate-500">
          Already have an account?{' '}
          <Link to="/login" class="text-brand-400 hover:text-brand-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
