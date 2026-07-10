import React, { useEffect, useState } from 'react';
import { api } from '../context/AuthContext.js';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Webhook, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Sliders,
  ChevronRight,
  Activity,
  Globe
} from 'lucide-react';

interface Endpoint {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
  isVerified: boolean;
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  rateLimitPerSecond: number;
  createdAt: string;
}

export const Dashboard: React.FC = () => {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [refreshing, setRefreshing] = useState(false);

  // New endpoint form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [rateLimit, setRateLimit] = useState(10);
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const fetchEndpoints = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      const searchParam = search ? `&search=${search}` : '';
      const res = await api.get(`/endpoints?page=1&limit=50${statusParam}${searchParam}`);
      setEndpoints(res.data.endpoints);
    } catch (err) {
      console.error('Failed to fetch endpoints:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEndpoints();
  }, [statusFilter]);

  // Debounced search trigger
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchEndpoints(true);
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [search]);

  const handleAddEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);
    try {
      await api.post('/endpoints', {
        name,
        url,
        description: description || undefined,
        rateLimitPerSecond: rateLimit
      });
      setShowAddModal(false);
      setName('');
      setUrl('');
      setDescription('');
      setRateLimit(10);
      fetchEndpoints();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to register endpoint');
    } finally {
      setFormSubmitting(false);
    }
  };

  const getCircuitBadge = (state: string) => {
    switch (state) {
      case 'CLOSED':
        return (
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
            <CheckCircle2 class="w-3.5 h-3.5" />
            Circuit Closed
          </span>
        );
      case 'OPEN':
        return (
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/15 animate-pulse">
            <XCircle class="w-3.5 h-3.5" />
            Circuit Open
          </span>
        );
      case 'HALF_OPEN':
        return (
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/15">
            <AlertTriangle class="w-3.5 h-3.5" />
            Half Open
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div class="space-y-8 select-none">
      {/* Top Welcome Title */}
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="font-display font-bold text-3xl tracking-tight text-white flex items-center gap-3">
            Developer Console
          </h1>
          <p class="text-sm text-slate-400">Register, verify, and inspect your webhook targets in real time</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            onClick={() => { setRefreshing(true); fetchEndpoints(true); }}
            class="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
          >
            <RefreshCw class={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            class="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 rounded-xl text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus class="w-4 h-4" />
            Add Webhook
          </button>
        </div>
      </div>

      {/* Overview Metrics Grid */}
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div class="glass-panel p-6 rounded-2xl border border-slate-900 flex items-center justify-between">
          <div>
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Endpoints</span>
            <span class="block font-display font-bold text-3xl text-white mt-1">{endpoints.length}</span>
          </div>
          <div class="bg-brand-500/10 p-3 rounded-xl border border-brand-500/15 text-brand-400">
            <Webhook class="w-6 h-6" />
          </div>
        </div>

        <div class="glass-panel p-6 rounded-2xl border border-slate-900 flex items-center justify-between">
          <div>
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Healthy Circuits</span>
            <span class="block font-display font-bold text-3xl text-emerald-400 mt-1">
              {endpoints.filter(e => e.circuitState === 'CLOSED').length}
            </span>
          </div>
          <div class="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/15 text-emerald-400">
            <CheckCircle2 class="w-6 h-6" />
          </div>
        </div>

        <div class="glass-panel p-6 rounded-2xl border border-slate-900 flex items-center justify-between">
          <div>
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Failing Circuits</span>
            <span class="block font-display font-bold text-3xl text-rose-400 mt-1">
              {endpoints.filter(e => e.circuitState === 'OPEN').length}
            </span>
          </div>
          <div class="bg-rose-500/10 p-3 rounded-xl border border-rose-500/15 text-rose-400">
            <XCircle class="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main List Area */}
      <div class="glass-panel rounded-2xl border border-slate-900 overflow-hidden">
        {/* Filters and search headers */}
        <div class="px-6 py-5 border-b border-slate-900 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div class="relative w-full md:w-80">
            <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
              <Search class="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search endpoints..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              class="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-sm transition-all text-slate-100 placeholder:text-slate-600 outline-none"
            />
          </div>

          <div class="flex items-center gap-2 self-stretch md:self-auto">
            <span class="text-xs font-semibold text-slate-400 mr-1 select-none">Status:</span>
            {['all', 'active', 'inactive'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status as any)}
                class={`px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider cursor-pointer transition-all ${
                  statusFilter === status
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Content list */}
        {loading ? (
          <div class="p-16 flex items-center justify-center">
            <RefreshCw class="w-8 h-8 text-brand-400 animate-spin" />
          </div>
        ) : endpoints.length === 0 ? (
          <div class="p-16 text-center space-y-4">
            <div class="inline-flex bg-slate-900 p-4 rounded-full border border-slate-800 text-slate-500">
              <Webhook class="w-8 h-8" />
            </div>
            <div>
              <p class="text-slate-300 font-semibold">No webhook endpoints found</p>
              <p class="text-xs text-slate-500 mt-1">Add your first webhook target to begin receiving events</p>
            </div>
          </div>
        ) : (
          <div class="divide-y divide-slate-900">
            {endpoints.map((ep) => (
              <Link
                key={ep.id}
                to={`/endpoints/${ep.id}`}
                class="flex flex-col sm:flex-row sm:items-center justify-between p-6 hover:bg-slate-900/20 transition-all group"
              >
                <div class="space-y-1.5 pr-4 min-w-0">
                  <div class="flex items-center gap-3">
                    <span class="font-semibold text-slate-200 group-hover:text-brand-300 transition-colors font-display text-base truncate">
                      {ep.name}
                    </span>
                    <span class={`inline-block w-2 h-2 rounded-full ${ep.isActive ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
                    <span class="text-[10px] uppercase font-mono text-slate-500 tracking-wider">
                      {ep.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <div class="flex items-center gap-2 text-slate-400 text-xs font-mono truncate">
                    <Globe class="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                    <span class="truncate">{ep.url}</span>
                  </div>
                </div>

                <div class="flex items-center gap-4 mt-4 sm:mt-0">
                  <div class="flex flex-col items-end gap-1.5">
                    {getCircuitBadge(ep.circuitState)}
                    <span class="text-[10px] text-slate-500 flex items-center gap-1 font-semibold">
                      {ep.isVerified ? (
                        <span class="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 class="w-3 h-3" /> Verified
                        </span>
                      ) : (
                        <span class="text-amber-400 flex items-center gap-1 animate-pulse">
                          <AlertTriangle class="w-3 h-3" /> Unverified
                        </span>
                      )}
                      • {ep.rateLimitPerSecond} req/s limit
                    </span>
                  </div>
                  <ChevronRight class="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Modal - Add Webhook Endpoint */}
      {showAddModal && (
        <div class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="glass-panel w-full max-w-lg rounded-3xl border border-slate-900 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div class="px-6 py-5 border-b border-slate-900 flex justify-between items-center bg-slate-950/50">
              <h2 class="font-display font-bold text-lg text-white">Add Webhook Endpoint</h2>
              <button 
                onClick={() => setShowAddModal(false)}
                class="text-slate-400 hover:text-slate-200 font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddEndpoint} class="p-6 space-y-4">
              {formError && (
                <div class="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
                  {formError}
                </div>
              )}

              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-slate-300">Name</label>
                <input
                  type="text"
                  required
                  placeholder="Payment Server Receiver"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  class="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-sm transition-all text-slate-100 placeholder:text-slate-600 outline-none"
                />
              </div>

              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-slate-300">Endpoint URL (SSRF Safe • Requires HTTPS)</label>
                <input
                  type="url"
                  required
                  placeholder="https://api.yourdomain.com/webhooks"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  class="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-sm transition-all text-slate-100 placeholder:text-slate-600 outline-none"
                />
              </div>

              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-slate-300">Description (Optional)</label>
                <textarea
                  placeholder="Triggered for transaction operations..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  class="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-sm transition-all text-slate-100 placeholder:text-slate-600 h-20 outline-none resize-none"
                />
              </div>

              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-slate-300">Rate Limit (concurrent requests/sec)</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={rateLimit}
                  onChange={(e) => setRateLimit(parseInt(e.target.value, 10))}
                  class="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-sm transition-all text-slate-100 outline-none"
                />
              </div>

              <div class="pt-4 border-t border-slate-900 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  class="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 rounded-xl text-sm font-semibold text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  class="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-500/50 rounded-xl text-sm font-semibold text-white shadow-lg cursor-pointer"
                >
                  {formSubmitting ? 'Registering...' : 'Register Endpoint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
