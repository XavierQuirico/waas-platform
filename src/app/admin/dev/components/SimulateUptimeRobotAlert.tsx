'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export function SimulateUptimeRobotAlert() {
  const [projectId, setProjectId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ incidentId: string } | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError('');

    try {
      const res = await fetch('/api/dev/simulate-uptimerobot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido');
      setResult(data);
      setProjectId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={16} strokeWidth={1.5} className="text-amber-400" />
        <h3 className="text-sm font-semibold text-white font-['Roobert']">SimulateUptimeRobotAlert</h3>
        <span className="text-xs text-white/30 font-['Roobert']">Crea incidencia P1 automática</span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="Project UUID (debe estar en LIVE)"
          required
          className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none font-['Inter_Tight']"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors font-['Roobert']"
        >
          {loading ? 'Simulando...' : 'Simular alerta UptimeRobot'}
        </button>
      </form>
      {result && (
        <p className="mt-3 text-xs text-green-400 font-['Inter_Tight']">
          ✓ Incidencia P1 creada — ID: {result.incidentId}
        </p>
      )}
      {error && <p className="mt-3 text-xs text-red-400 font-['Inter_Tight']">{error}</p>}
    </div>
  );
}
