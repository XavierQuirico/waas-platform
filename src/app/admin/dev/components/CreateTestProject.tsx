'use client';

import { useState } from 'react';

const PLANS = ['BASIC', 'PRO', 'BUSINESS', 'LEGACY'] as const;
const STATUSES = [
  'DRAFT', 'REQUIRES_REVIEW', 'PROPOSAL_SENT', 'PROPOSAL_EXPIRED',
  'PAYMENT_RECEIVED', 'AWAITING_ASSETS', 'ASSETS_SUBMITTED',
  'ASSETS_UNDER_REVIEW', 'ASSETS_INCOMPLETE', 'PRODUCTION_STARTED',
  'STAGING_REVIEW', 'REVISIONS', 'REVISIONS_DONE', 'LIVE',
  'SUSPENDED', 'CANCELLED',
] as const;

interface Props {
  onCreated: (projectId: string) => void;
}

export function CreateTestProject({ onCreated }: Props) {
  const [clientName, setClientName] = useState('Test Cliente');
  const [email, setEmail] = useState(`test-${Date.now()}@waas.test`);
  const [businessName, setBusinessName] = useState('Negocio de Prueba');
  const [plan, setPlan] = useState<typeof PLANS[number]>('BASIC');
  const [status, setStatus] = useState<typeof STATUSES[number]>('AWAITING_ASSETS');
  const [stagingUrl, setStagingUrl] = useState('');
  const [productionUrl, setProductionUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ projectId: string } | null>(null);
  const [error, setError] = useState('');

  async function handleCreate() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/trpc/dev.createTestData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            clientName, email, businessName, plan, status,
            stagingUrl: stagingUrl || undefined,
            productionUrl: productionUrl || undefined,
          },
        }),
      });
      const data = await res.json();
      const projectId = data.result?.data?.json?.projectId;
      if (projectId) {
        setResult({ projectId });
        onCreated(projectId);
        // Reset email to avoid duplicate
        setEmail(`test-${Date.now()}@waas.test`);
      } else {
        setError(JSON.stringify(data));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-800">Crear cliente + proyecto de prueba</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500">Nombre del cliente</label>
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-200 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-200 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Nombre del negocio</label>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-200 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Plan</label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as (typeof PLANS)[number])}
            className="mt-1 block w-full rounded border border-gray-200 px-2 py-1.5 text-sm"
          >
            {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500">Estado inicial</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
            className="mt-1 block w-full rounded border border-gray-200 px-2 py-1.5 text-sm"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {(status === 'STAGING_REVIEW' || status === 'REVISIONS') && (
          <div>
            <label className="block text-xs text-gray-500">Staging URL (opcional)</label>
            <input
              type="url"
              value={stagingUrl}
              onChange={(e) => setStagingUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 block w-full rounded border border-gray-200 px-2 py-1.5 text-sm"
            />
          </div>
        )}
        {status === 'LIVE' && (
          <div>
            <label className="block text-xs text-gray-500">Production URL (opcional)</label>
            <input
              type="url"
              value={productionUrl}
              onChange={(e) => setProductionUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 block w-full rounded border border-gray-200 px-2 py-1.5 text-sm"
            />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleCreate}
        disabled={loading}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
      >
        {loading ? 'Creando...' : 'Crear proyecto de prueba'}
      </button>

      {result && (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm">
          <p className="font-medium text-green-800">✓ Proyecto creado</p>
          <p className="mt-1 font-['Inter_Tight'] text-xs text-green-700">{result.projectId}</p>
          <a
            href={`/admin/proyectos/${result.projectId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs text-blue-600 underline"
          >
            Ver en /admin/proyectos →
          </a>
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
