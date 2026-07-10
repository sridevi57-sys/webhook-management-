import React, { useEffect, useState } from 'react';
import { api } from '../context/AuthContext.js';
import { 
  Key, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Copy, 
  CheckCircle2, 
  Eye, 
  EyeOff,
  AlertCircle
} from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  key?: string; // Only visible on creation
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

export const ApiKeys: React.FC = () => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyName, setKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<ApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const fetchKeys = async () => {
    try {
      const res = await api.get('/keys');
      setKeys(res.data);
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName) return;
    setCreating(true);
    setNewKey(null);
    try {
      const res = await api.post('/keys', { name: keyName });
      setNewKey(res.data.apiKey);
      setKeyName('');
      setShowKey(true);
      fetchKeys();
    } catch (err) {
      console.error('Failed to generate key:', err);
      alert('Error generating API Key');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!window.confirm('Are you sure you want to revoke this API key? This cannot be undone.')) return;
    try {
      await api.delete(`/keys/${id}`);
      fetchKeys();
    } catch (err) {
      console.error('Failed to delete key:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div class="space-y-8 select-none">
      <div>
        <h1 class="font-display font-bold text-3xl tracking-tight text-white flex items-center gap-3">
          Ingestion API Keys
        </h1>
        <p class="text-sm text-slate-400">Manage key credentials used to publish events into the webhook engine</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Generate Form */}
        <div class="lg:col-span-1 space-y-6">
          <div class="glass-panel p-6 rounded-2xl border border-slate-900 space-y-4">
            <h3 class="font-display font-semibold text-sm text-white">Generate Ingestion Key</h3>
            
            <form onSubmit={handleCreateKey} class="space-y-4">
              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-slate-400">Key Name / Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., E-Commerce Service Ingestion"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  class="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl text-sm outline-none text-slate-100 placeholder:text-slate-600 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                class="w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-brand-500/10"
              >
                {creating ? <RefreshCw class="w-3.5 h-3.5 animate-spin" /> : <Plus class="w-3.5 h-3.5" />}
                Generate Ingestion Key
              </button>
            </form>
          </div>

          {/* New Key Result Card */}
          {newKey && (
            <div class="glass-panel p-6 rounded-2xl border border-emerald-500/10 bg-emerald-500/5 space-y-4">
              <div class="flex items-start gap-3">
                <AlertCircle class="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 class="font-semibold text-xs text-emerald-200">Copy API Key</h4>
                  <p class="text-[10px] text-emerald-400/80 leading-relaxed mt-0.5">
                    Save this key now. For security reasons, you will not be able to view it again.
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-900">
                <input
                  type={showKey ? 'text' : 'password'}
                  readOnly
                  value={newKey.key}
                  class="bg-transparent border-none text-xs font-mono text-slate-300 outline-none flex-1"
                />
                <button 
                  onClick={() => setShowKey(!showKey)}
                  class="text-slate-500 hover:text-slate-300"
                >
                  {showKey ? <EyeOff class="w-4 h-4" /> : <Eye class="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => copyToClipboard(newKey.key || '')}
                  class="text-slate-500 hover:text-slate-300"
                >
                  <Copy class="w-4 h-4" />
                </button>
              </div>
              {copied && <span class="block text-[10px] text-emerald-400 font-semibold">Key copied!</span>}
            </div>
          )}
        </div>

        {/* List API Keys */}
        <div class="lg:col-span-2">
          <div class="glass-panel rounded-2xl border border-slate-900 overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-900 bg-slate-950/20">
              <h3 class="font-display font-semibold text-sm text-white">Active Keys</h3>
            </div>

            {loading ? (
              <div class="p-10 flex items-center justify-center">
                <RefreshCw class="w-6 h-6 text-brand-400 animate-spin" />
              </div>
            ) : keys.length === 0 ? (
              <div class="p-10 text-center space-y-2">
                <p class="text-xs text-slate-500 italic">No API keys registered yet.</p>
              </div>
            ) : (
              <div class="divide-y divide-slate-900">
                {keys.map((key) => (
                  <div key={key.id} class="flex items-center justify-between p-5 hover:bg-slate-900/10">
                    <div class="space-y-1 pr-4">
                      <div class="flex items-center gap-2.5">
                        <span class="font-semibold text-sm text-slate-200">{key.name}</span>
                        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                          Active
                        </span>
                      </div>
                      <span class="block text-[10px] text-slate-500 font-mono">
                        Created: {new Date(key.createdAt).toLocaleDateString()} • Last Used:{' '}
                        {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteKey(key.id)}
                      class="p-2 bg-slate-900 hover:bg-red-500/10 text-slate-500 hover:text-red-400 border border-slate-800 hover:border-red-500/20 rounded-xl transition-all cursor-pointer"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
