import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../context/AuthContext.js';
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Eye, 
  EyeOff, 
  Copy, 
  Trash2,
  RefreshCw,
  Send,
  Play,
  Settings,
  Shield,
  Layers,
  ChevronRight,
  Database,
  ExternalLink
} from 'lucide-react';

interface Subscription {
  id: string;
  eventType: string;
}

interface Endpoint {
  id: string;
  name: string;
  description?: string;
  url: string;
  secret: string;
  isActive: boolean;
  isVerified: boolean;
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  rateLimitPerSecond: number;
  subscriptions: Subscription[];
}

interface DeliveryLog {
  id: string;
  eventId: string;
  status: 'PENDING' | 'QUEUED' | 'PROCESSING' | 'DELIVERED' | 'RETRYING' | 'FAILED' | 'DEAD_LETTER' | 'CANCELLED';
  attempt: number;
  statusCode?: number;
  latencyMs?: number;
  errorDetails?: string;
  requestHeaders?: any;
  requestPayload?: any;
  responseHeaders?: any;
  responseBody?: string;
  createdAt: string;
  event: {
    eventType: string;
  };
}

export const EndpointDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [endpoint, setEndpoint] = useState<Endpoint | null>(null);
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  // Subscriptions form state
  const [newEvent, setNewEvent] = useState('');
  const [subAdding, setSubAdding] = useState(false);

  // Trigger test mock state
  const [testPayload, setTestPayload] = useState('{\n  "event": "user.signup",\n  "data": {\n    "user_id": "usr_94a28f",\n    "email": "dev@webhook.engine"\n  }\n}');
  const [testEventType, setTestEventType] = useState('user.signup.v1');
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState('');

  // Selected Log Drawer
  const [selectedLog, setSelectedLog] = useState<DeliveryLog | null>(null);
  const [replaying, setReplaying] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Fetch Endpoint details
  const fetchEndpoint = async () => {
    try {
      const res = await api.get(`/endpoints/${id}`);
      setEndpoint(res.data);
    } catch (err) {
      console.error('Failed to fetch endpoint details:', err);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Delivery Logs
  const fetchLogs = async (silent = false) => {
    if (!silent) setLogsLoading(true);
    try {
      const statusParam = statusFilter ? `&status=${statusFilter}` : '';
      const res = await api.get(`/endpoints/${id}/logs?page=${page}&limit=10${statusParam}`);
      setLogs(res.data.logs);
      setTotalPages(res.data.meta.totalPages);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchEndpoint();
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchLogs();
    }
  }, [id, page, statusFilter]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleActive = async () => {
    if (!endpoint) return;
    try {
      const nextState = !endpoint.isActive;
      const res = await api.patch(`/endpoints/${id}`, { isActive: nextState });
      setEndpoint({ ...endpoint, isActive: res.data.endpoint.isActive });
    } catch (err) {
      console.error('Failed to toggle endpoint status:', err);
    }
  };

  const handleDeleteEndpoint = async () => {
    if (!window.confirm('Are you sure you want to delete this endpoint and all its subscriptions?')) return;
    try {
      await api.delete(`/endpoints/${id}`);
      navigate('/');
    } catch (err) {
      console.error('Failed to delete endpoint:', err);
    }
  };

  const handleAddSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent) return;
    setSubAdding(true);
    try {
      await api.post(`/endpoints/${id}/subscriptions`, { eventType: newEvent });
      setNewEvent('');
      fetchEndpoint();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to subscribe to event');
    } finally {
      setSubAdding(false);
    }
  };

  const handleDeleteSubscription = async (subId: string) => {
    try {
      await api.delete(`/endpoints/${id}/subscriptions/${subId}`);
      fetchEndpoint();
    } catch (err) {
      console.error('Failed to unsubscribe:', err);
    }
  };

  const handleVerifyChallenge = async () => {
    setVerifying(true);
    try {
      const res = await api.post(`/endpoints/${id}/verify`);
      alert(res.data.message || 'Challenge verification succeeded!');
      fetchEndpoint();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Verification failed. Target receiver did not return matching challenge code.');
    } finally {
      setVerifying(false);
    }
  };

  const handleTriggerTest = async () => {
    setTriggering(true);
    setTriggerMsg('');
    try {
      let parsed;
      try {
        parsed = JSON.parse(testPayload);
      } catch {
        alert('Invalid JSON formatting in payload editor');
        setTriggering(false);
        return;
      }

      const res = await api.post('/events', {
        eventType: testEventType,
        payload: parsed
      });
      setTriggerMsg(`Mock event queued (Job ID: ${res.data.deliveries?.[0]?.jobId || 'dispatch'})`);
      setTimeout(() => {
        fetchLogs(true);
      }, 1000);
    } catch (err: any) {
      setTriggerMsg('Failed: ' + (err.response?.data?.error || 'Unknown error'));
    } finally {
      setTriggering(false);
    }
  };

  const handleReplayEvent = async (logId: string, eventId: string) => {
    setReplaying(logId);
    try {
      const res = await api.post(`/events/${eventId}/replay`);
      alert(`Event replay submitted successfully (Job: ${res.data.jobId || 'requeued'})`);
      setTimeout(() => {
        fetchLogs(true);
      }, 1000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to replay event');
    } finally {
      setReplaying(null);
    }
  };

  const getLogStatusBadge = (status: string) => {
    const base = "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider font-mono inline-block";
    switch (status) {
      case 'DELIVERED':
        return `${base} bg-emerald-500/10 text-emerald-400 border border-emerald-500/20`;
      case 'FAILED':
        return `${base} bg-rose-500/10 text-rose-400 border border-rose-500/20`;
      case 'RETRYING':
        return `${base} bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse`;
      case 'DEAD_LETTER':
        return `${base} bg-slate-800 text-slate-400 border border-slate-700`;
      case 'CANCELLED':
        return `${base} bg-slate-900 text-slate-500 border border-slate-800`;
      default:
        return `${base} bg-brand-500/10 text-brand-400 border border-brand-500/20`;
    }
  };

  if (loading) {
    return (
      <div class="h-96 flex items-center justify-center">
        <RefreshCw class="w-8 h-8 text-brand-400 animate-spin" />
      </div>
    );
  }

  if (!endpoint) return null;

  return (
    <div class="space-y-8 select-none">
      {/* Back button */}
      <Link 
        to="/" 
        class="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft class="w-4 h-4" />
        Back to Dashboard
      </Link>

      {/* Top Heading Panel */}
      <div class="flex flex-col lg:flex-row justify-between items-start gap-6">
        <div class="space-y-2 max-w-2xl min-w-0">
          <div class="flex items-center gap-3 flex-wrap">
            <h1 class="font-display font-bold text-3xl tracking-tight text-white truncate">{endpoint.name}</h1>
            {endpoint.circuitState === 'CLOSED' ? (
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                Circuit Closed
              </span>
            ) : endpoint.circuitState === 'OPEN' ? (
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/15 animate-pulse">
                Circuit Open
              </span>
            ) : (
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/15">
                Circuit Half-Open
              </span>
            )}
            <span class={`inline-block w-2.5 h-2.5 rounded-full ${endpoint.isActive ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50' : 'bg-slate-600'}`}></span>
          </div>
          <p class="text-slate-400 text-xs font-mono break-all">{endpoint.url}</p>
          {endpoint.description && <p class="text-sm text-slate-300">{endpoint.description}</p>}
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button
            onClick={handleToggleActive}
            class={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
              endpoint.isActive 
                ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700' 
                : 'bg-brand-500 border-transparent text-white hover:bg-brand-600'
            }`}
          >
            {endpoint.isActive ? 'Pause Webhook' : 'Resume Webhook'}
          </button>
          <button
            onClick={handleDeleteEndpoint}
            class="p-2.5 bg-slate-900 border border-slate-800 hover:border-red-500/20 text-slate-400 hover:text-red-400 rounded-xl transition-all cursor-pointer"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Relational Columns */}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Keys and Subscriptions (1 Column wide) */}
        <div class="space-y-8 lg:col-span-1">
          
          {/* Webhook Sign Secret Card */}
          <div class="glass-panel p-6 rounded-2xl border border-slate-900 space-y-4">
            <h3 class="font-display font-semibold text-sm text-white flex items-center gap-2">
              <Shield class="w-4.5 h-4.5 text-brand-400" />
              Signing Secret
            </h3>
            <p class="text-xs text-slate-400">Used to sign payloads with HMAC-SHA256.</p>
            <div class="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-900">
              <input
                type={showSecret ? 'text' : 'password'}
                readOnly
                value={endpoint.secret}
                class="bg-transparent border-none text-xs font-mono text-slate-300 outline-none flex-1"
              />
              <button 
                onClick={() => setShowSecret(!showSecret)}
                class="text-slate-500 hover:text-slate-300"
              >
                {showSecret ? <EyeOff class="w-4 h-4" /> : <Eye class="w-4 h-4" />}
              </button>
              <button 
                onClick={() => copyToClipboard(endpoint.secret)}
                class="text-slate-500 hover:text-slate-300"
              >
                <Copy class="w-4 h-4" />
              </button>
            </div>
            {copied && <span class="block text-[10px] text-emerald-400 font-semibold">Secret copied!</span>}
          </div>

          {/* Webhook Verification challenge card */}
          {!endpoint.isVerified && (
            <div class="glass-panel p-6 rounded-2xl border border-amber-500/10 bg-amber-500/5 space-y-4">
              <div class="flex items-start gap-3">
                <AlertTriangle class="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                <div class="space-y-1">
                  <h4 class="font-semibold text-xs text-amber-200">Endpoint Unverified</h4>
                  <p class="text-[11px] text-amber-400/80 leading-relaxed">
                    You must verify ownership of your target receiver URL before deliveries will start.
                  </p>
                </div>
              </div>
              <button
                onClick={handleVerifyChallenge}
                disabled={verifying}
                class="w-full py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 rounded-xl text-xs font-semibold text-slate-950 shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {verifying ? (
                  <>
                    <RefreshCw class="w-3.5 h-3.5 animate-spin" />
                    Sending Challenge...
                  </>
                ) : (
                  <>
                    <Shield class="w-3.5 h-3.5" />
                    Verify Endpoint URL
                  </>
                )}
              </button>
            </div>
          )}

          {/* Subscriptions Card */}
          <div class="glass-panel p-6 rounded-2xl border border-slate-900 space-y-4">
            <h3 class="font-display font-semibold text-sm text-white flex items-center gap-2">
              <Layers class="w-4.5 h-4.5 text-brand-400" />
              Event Subscriptions
            </h3>
            
            <form onSubmit={handleAddSubscription} class="flex gap-2">
              <input
                type="text"
                required
                placeholder="order.created.v1"
                value={newEvent}
                onChange={(e) => setNewEvent(e.target.value)}
                class="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg text-xs outline-none text-slate-200 placeholder:text-slate-600"
              />
              <button
                type="submit"
                disabled={subAdding}
                class="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
              >
                Add
              </button>
            </form>

            <div class="space-y-1.5 max-h-56 overflow-y-auto">
              {endpoint.subscriptions.length === 0 ? (
                <p class="text-xs text-slate-500 italic p-2">Not subscribed to any events yet.</p>
              ) : (
                endpoint.subscriptions.map((sub) => (
                  <div key={sub.id} class="flex items-center justify-between bg-slate-950 px-3 py-2 rounded-xl border border-slate-900 text-xs">
                    <span class="font-mono text-slate-300">{sub.eventType}</span>
                    <button
                      onClick={() => handleDeleteSubscription(sub.id)}
                      class="text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Delivery Logs and Tests (2 Columns wide) */}
        <div class="space-y-8 lg:col-span-2">
          
          {/* Trigger Mock test endpoint section */}
          {endpoint.isVerified && (
            <div class="glass-panel p-6 rounded-2xl border border-slate-900 space-y-4">
              <h3 class="font-display font-semibold text-sm text-white flex items-center gap-2">
                <Send class="w-4.5 h-4.5 text-brand-400" />
                Trigger Test Event
              </h3>
              
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="md:col-span-1 space-y-3">
                  <div class="space-y-1">
                    <label class="block text-[10px] font-semibold text-slate-400">Event Type Version</label>
                    <input
                      type="text"
                      value={testEventType}
                      onChange={(e) => setTestEventType(e.target.value)}
                      class="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg text-xs outline-none text-slate-200"
                    />
                  </div>
                  <button
                    onClick={handleTriggerTest}
                    disabled={triggering}
                    class="w-full py-2 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-500/50 rounded-lg text-xs font-semibold text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-brand-500/10"
                  >
                    {triggering ? (
                      <>
                        <RefreshCw class="w-3.5 h-3.5 animate-spin" />
                        Queuing Event...
                      </>
                    ) : (
                      <>
                        <Play class="w-3.5 h-3.5" />
                        Fire Test Event
                      </>
                    )}
                  </button>
                  {triggerMsg && <p class="text-[10px] text-brand-300 font-mono leading-relaxed">{triggerMsg}</p>}
                </div>

                <div class="md:col-span-2">
                  <label class="block text-[10px] font-semibold text-slate-400 mb-1">Payload JSON Editor</label>
                  <textarea
                    value={testPayload}
                    onChange={(e) => setTestPayload(e.target.value)}
                    class="w-full h-28 p-3 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-lg text-xs font-mono outline-none text-slate-300 resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Delivery Logs history */}
          <div class="glass-panel rounded-2xl border border-slate-900 overflow-hidden">
            {/* Headers and filters */}
            <div class="px-6 py-4 border-b border-slate-900 flex justify-between items-center bg-slate-950/20">
              <h3 class="font-display font-semibold text-sm text-white flex items-center gap-2">
                <Database class="w-4.5 h-4.5 text-brand-400" />
                Delivery Logs
              </h3>
              
              <div class="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  class="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 outline-none cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="FAILED">Failed</option>
                  <option value="RETRYING">Retrying</option>
                  <option value="DEAD_LETTER">Dead Letter</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
                <button
                  onClick={() => fetchLogs(true)}
                  class="p-1.5 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 border border-slate-800 transition-all cursor-pointer"
                >
                  <RefreshCw class={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* List logs */}
            {logsLoading ? (
              <div class="p-10 flex items-center justify-center">
                <RefreshCw class="w-6 h-6 text-brand-400 animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <div class="p-10 text-center space-y-2">
                <p class="text-xs text-slate-500 italic">No delivery attempts recorded.</p>
              </div>
            ) : (
              <div class="divide-y divide-slate-900">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    class="flex items-center justify-between p-4 hover:bg-slate-900/10 cursor-pointer group"
                  >
                    <div class="flex items-center gap-4 min-w-0">
                      {/* Log status code indicator */}
                      <span class={`inline-block w-8 text-center text-xs font-mono font-bold ${
                        log.statusCode && log.statusCode >= 200 && log.statusCode < 300 
                          ? 'text-emerald-400' 
                          : log.statusCode 
                          ? 'text-rose-400' 
                          : 'text-slate-500'
                      }`}>
                        {log.statusCode || '---'}
                      </span>
                      
                      <div class="min-w-0">
                        <span class="block text-xs font-mono text-slate-200 truncate">{log.event.eventType}</span>
                        <span class="block text-[10px] text-slate-500 font-mono">
                          Attempt {log.attempt} • {new Date(log.createdAt).toLocaleTimeString()} • {log.latencyMs ? `${log.latencyMs}ms` : '---'}
                        </span>
                      </div>
                    </div>

                    <div class="flex items-center gap-3">
                      {getLogStatusBadge(log.status)}
                      <ChevronRight class="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div class="px-6 py-4 border-t border-slate-900 flex justify-between items-center bg-slate-950/10">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  class="px-3 py-1.5 bg-slate-900 border border-slate-800 disabled:opacity-40 rounded-lg text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Prev
                </button>
                <span class="text-xs text-slate-500">Page {page} of {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  class="px-3 py-1.5 bg-slate-900 border border-slate-800 disabled:opacity-40 rounded-lg text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slide-over Drawer Log Details */}
      {selectedLog && (
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex justify-end">
          <div class="w-full max-w-2xl bg-slate-950 border-l border-slate-900 h-full flex flex-col justify-between overflow-hidden shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div class="px-6 py-5 border-b border-slate-900 flex justify-between items-center bg-slate-950/80">
              <div>
                <h3 class="font-display font-bold text-lg text-white">Log Details</h3>
                <span class="text-[10px] text-slate-500 font-mono">{selectedLog.id}</span>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                class="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close Drawer
              </button>
            </div>

            {/* Scrollable details */}
            <div class="flex-1 p-6 overflow-y-auto space-y-6">
              {/* Event Type & Status Info */}
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-900 space-y-1">
                  <span class="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Event Name</span>
                  <span class="block font-mono text-xs text-slate-200">{selectedLog.event.eventType}</span>
                </div>
                <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-900 space-y-1">
                  <span class="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Delivery Status</span>
                  <span class="block mt-0.5">{getLogStatusBadge(selectedLog.status)}</span>
                </div>
              </div>

              {/* Code blocks */}
              <div class="space-y-4">
                <div>
                  <span class="block text-xs font-semibold text-slate-400 mb-1">Payload JSON</span>
                  <pre class="p-4 bg-slate-900 border border-slate-800/80 rounded-xl text-xs font-mono text-brand-300 overflow-x-auto max-h-48 leading-relaxed">
                    {JSON.stringify(selectedLog.requestPayload, null, 2)}
                  </pre>
                </div>

                <div>
                  <span class="block text-xs font-semibold text-slate-400 mb-1">Request Headers</span>
                  <pre class="p-4 bg-slate-900 border border-slate-800/80 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto max-h-48 leading-relaxed">
                    {JSON.stringify(selectedLog.requestHeaders, null, 2)}
                  </pre>
                </div>

                {selectedLog.responseHeaders && (
                  <div>
                    <span class="block text-xs font-semibold text-slate-400 mb-1">Response Headers</span>
                    <pre class="p-4 bg-slate-900 border border-slate-800/80 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto max-h-48 leading-relaxed">
                      {JSON.stringify(selectedLog.responseHeaders, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.responseBody && (
                  <div>
                    <span class="block text-xs font-semibold text-slate-400 mb-1">Response Body</span>
                    <pre class="p-4 bg-slate-900 border border-slate-800/80 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto max-h-48 leading-relaxed">
                      {selectedLog.responseBody}
                    </pre>
                  </div>
                )}

                {selectedLog.errorDetails && (
                  <div class="p-4 bg-rose-500/5 border border-rose-500/10 text-rose-400 rounded-xl space-y-1">
                    <span class="block text-[10px] font-bold text-rose-500 uppercase tracking-wide">Error Log Trace</span>
                    <p class="text-xs font-mono">{selectedLog.errorDetails}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div class="px-6 py-4 border-t border-slate-900 bg-slate-950/80 flex gap-3 justify-end">
              <button
                onClick={() => handleReplayEvent(selectedLog.id, selectedLog.eventId)}
                disabled={replaying === selectedLog.id}
                class="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md shadow-brand-500/10"
              >
                {replaying === selectedLog.id ? (
                  <>
                    <RefreshCw class="w-3.5 h-3.5 animate-spin" />
                    Replaying...
                  </>
                ) : (
                  <>
                    <Play class="w-3.5 h-3.5" />
                    Replay Event
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
