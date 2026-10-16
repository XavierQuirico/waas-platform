'use client';

import { useState } from 'react';
import { Timer } from 'lucide-react';

export function ResetSLATimer() {
  const [projectId, setProjectId] = useState('');
  const [hours, setHours] = useState('5');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');

    try {
      const res = await fetch('/api/dev/reset-sla-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, remainingHours: Number(hours) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido');
      setSuccess(`SLA reiniciado. Deadline: ${data.newDeadline}`);
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
        <Timer size={16} strokeWidth={1.5} className="text-amber-400" />
        <h3 className="text-sm font-semibold text-white font-['Roobert']">ResetSLATimer</h3>
        <span className="text-xs text-white/30 font-['Roobert']">Simula horas restantes de SLA</span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="Project UUID"
          required
          className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none font-['Inter_Tight']"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            min="0"
            max="200"
            className="w-24 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none font-['Inter_Tight']"
          />
          <span className="text-sm text-white/50 font-['Roobert']">horas restantes</span>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/30 disabled:opacity-50 transition-colors font-['Roobert']"
        >
          {loading ? 'Aplicando...' : 'Reiniciar SLA'}
        </button>
      </form>
      {success && <p className="mt-3 text-xs text-green-400 font-['Inter_Tight']">✓ {success}</p>}
      {error && <p className="mt-3 text-xs text-red-400 font-['Inter_Tight']">{error}</p>}
    </div>
  );
}
