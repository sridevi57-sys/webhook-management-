import React, { useEffect, useState } from 'react';
import { api } from '../context/AuthContext.js';
import { RefreshCw, Terminal, Eye } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  resourceId?: string;
  resourceType?: string;
  ipAddress?: string;
  createdAt: string;
  details?: any;
}

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/audit?page=${page}&limit=15`);
      setLogs(res.data.logs);
      setTotalPages(res.data.meta.totalPages);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page]);

  return (
    <div class="space-y-8 select-none">
      <div class="flex justify-between items-center">
        <div>
          <h1 class="font-display font-bold text-3xl tracking-tight text-white flex items-center gap-3">
            System Audit Logs
          </h1>
          <p class="text-sm text-slate-400">Compliance records tracking webhook mutations, key changes, and state transitions</p>
        </div>
        <button
          onClick={fetchLogs}
          class="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
        >
          <RefreshCw class={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div class="glass-panel rounded-2xl border border-slate-900 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-900 bg-slate-950/20 flex items-center gap-2 text-slate-400 text-sm font-semibold">
          <Terminal class="w-4 h-4 text-brand-400" />
          Audit Trail
        </div>

        {loading ? (
          <div class="p-16 flex items-center justify-center">
            <RefreshCw class="w-8 h-8 text-brand-400 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div class="p-16 text-center text-xs text-slate-500 italic">No audit records found.</div>
        ) : (
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="border-b border-slate-900 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th class="p-4">Action</th>
                  <th class="p-4">Resource Type</th>
                  <th class="p-4">IP Address</th>
                  <th class="p-4">Timestamp</th>
                  <th class="p-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-900 text-slate-300">
                {logs.map((log) => (
                  <tr key={log.id} class="hover:bg-slate-900/10">
                    <td class="p-4 font-mono font-bold text-slate-200">{log.action}</td>
                    <td class="p-4">
                      {log.resourceType ? (
                        <span class="px-2 py-0.5 rounded bg-slate-850 border border-slate-800 text-[10px] font-mono text-slate-400">
                          {log.resourceType}
                        </span>
                      ) : (
                        '---'
                      )}
                    </td>
                    <td class="p-4 font-mono text-slate-400">{log.ipAddress || 'unknown'}</td>
                    <td class="p-4 text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                    <td class="p-4 text-right">
                      {log.details ? (
                        <button
                          onClick={() => setSelectedLog(log)}
                          class="p-1 text-brand-400 hover:text-brand-300 cursor-pointer"
                        >
                          <Eye class="w-4 h-4 inline" />
                        </button>
                      ) : (
                        '---'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
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

      {/* Details Modal */}
      {selectedLog && (
        <div class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="glass-panel w-full max-w-lg rounded-3xl border border-slate-900 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div class="px-6 py-4 border-b border-slate-900 flex justify-between items-center bg-slate-950/50">
              <h3 class="font-display font-bold text-white">Log Details: {selectedLog.action}</h3>
              <button 
                onClick={() => setSelectedLog(null)}
                class="text-slate-400 hover:text-slate-200 font-semibold cursor-pointer text-xs"
              >
                Close
              </button>
            </div>
            <div class="p-6">
              <pre class="p-4 bg-slate-950 border border-slate-900 rounded-xl text-xs font-mono text-brand-300 overflow-x-auto max-h-64 leading-relaxed">
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
