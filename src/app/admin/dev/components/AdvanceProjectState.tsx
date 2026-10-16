'use client';

import { useState, useEffect } from 'react';

const STATUSES = [
  'DRAFT', 'REQUIRES_REVIEW', 'PROPOSAL_SENT', 'PROPOSAL_EXPIRED',
  'PAYMENT_RECEIVED', 'AWAITING_ASSETS', 'ASSETS_SUBMITTED',
  'ASSETS_UNDER_REVIEW', 'ASSETS_INCOMPLETE', 'PRODUCTION_STARTED',
  'STAGING_REVIEW', 'REVISIONS', 'REVISIONS_DONE', 'LIVE', 'SUSPENDED', 'CANCELLED',
] as const;

interface Project {
  id: string;
  plan: string;
  status: string;
  businessName: string;
  email: string;
}

interface Props {
  defaultProjectId?: string;
}

export function AdvanceProjectState({ defaultProjectId }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId ?? '');
  const [newStatus, setNewStatus] = useState<typeof STATUSES[number]>('STAGING_REVIEW');
  const [stagingUrl, setStagingUrl] = useState('');
  const [productionUrl, setProductionUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (defaultProjectId) setSelectedProjectId(defaultProjectId);
  }, [defaultProjectId]);

  async function fetchProjects() {
    try {
      const res = await fetch('/api/trpc/dev.listAllProjects', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setProjects(data.result?.data?.json ?? []);
    } catch {
      // silent
    }
  }

  async function handleAdvance() {
    if (!selectedProjectId) return;
    setLoading(true);
    setError('');
    setResult('');
    try {
      const res = await fetch('/api/trpc/dev.advanceProjectState', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            projectId: selectedProjectId,
            newStatus,
            stagingUrl: stagingUrl || undefined,
            productionUrl: productionUrl || undefined,
          },
        }),
      });
      const data = await res.json();
      if (data.result?.data) {
        setResult(`✓ Estado cambiado a ${newStatus}`);
        fetchProjects();
      } else {
        setError(JSON.stringify(data));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-800">
        Avanzar estado del proyecto (sin validar state machine)
      </h2>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500">Seleccionar proyecto</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-200 px-2 py-1.5 text-sm"
          >
            <option value="">— Seleccionar —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.businessName} ({p.plan}) — {p.status}
              </option>
            ))}
          </select>
        </div>

        {selectedProject && (
          <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Estado actual: <strong>{selectedProject.status}</strong> | Plan: {selectedProject.plan}
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-500">Nuevo estado</label>
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as (typeof STATUSES)[number])}
            className="mt-1 block w-full rounded border border-gray-200 px-2 py-1.5 text-sm"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {(newStatus === 'STAGING_REVIEW' || newStatus === 'REVISIONS') && (
          <div>
            <label className="block text-xs text-gray-500">Staging URL (opcional)</label>
            <input
              type="url"
              value={stagingUrl}
              onChange={(e) => setStagingUrl(e.target.value)}
              placeholder="https://cliente.vercel.app"
              className="mt-1 block w-full rounded border border-gray-200 px-2 py-1.5 text-sm"
            />
          </div>
        )}

        {newStatus === 'LIVE' && (
          <div>
            <label className="block text-xs text-gray-500">Production URL (opcional)</label>
            <input
              type="url"
              value={productionUrl}
              onChange={(e) => setProductionUrl(e.target.value)}
              placeholder="https://cliente.com"
              className="mt-1 block w-full rounded border border-gray-200 px-2 py-1.5 text-sm"
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleAdvance}
          disabled={!selectedProjectId || loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          {loading ? 'Cambiando...' : `Cambiar a ${newStatus}`}
        </button>
      </div>

      {result && (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {result}
        </div>
      )}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
