'use client';

import { useState } from 'react';

const COMMON_EVENTS = [
  { name: 'waas/payment.received', defaultData: (id: string) => ({ projectId: id }) },
  { name: 'waas/payment.failed', defaultData: (id: string) => ({ projectId: id }) },
  { name: 'waas/subscription.cancelled', defaultData: (id: string) => ({ projectId: id, subscriptionId: 'I-dev000000000' }) },
  { name: 'waas/assets.submitted', defaultData: (id: string) => ({ projectId: id }) },
  { name: 'waas/assets.incomplete', defaultData: (id: string) => ({ projectId: id }) },
  { name: 'waas/production.started', defaultData: (id: string) => ({ projectId: id }) },
  { name: 'waas/staging.deployed', defaultData: (id: string) => ({ projectId: id, stagingUrl: 'https://test.vercel.app' }) },
  { name: 'waas/project.live', defaultData: (id: string) => ({ projectId: id }) },
  { name: 'waas/revisions.submitted', defaultData: (id: string) => ({ projectId: id }) },
  { name: 'waas/proposal.sent', defaultData: (id: string) => ({ projectId: id }) },
  { name: 'waas/site.down', defaultData: (id: string) => ({ projectId: id, incidentId: 'dev-incident-id', monitorURL: 'https://ejemplo.com' }) },
  { name: 'waas/incident.resolved', defaultData: (id: string) => ({ projectId: id, incidentId: 'dev-incident-id', autoResolved: false }) },
  { name: 'waas/incident.reported', defaultData: (id: string) => ({ projectId: id, incidentId: 'dev-incident-id' }) },
];

interface Props {
  defaultProjectId?: string;
}

export function TriggerInngestEvent({ defaultProjectId }: Props) {
  const [selectedEvent, setSelectedEvent] = useState(COMMON_EVENTS[0].name);
  const [projectId, setProjectId] = useState(defaultProjectId ?? '');
  const [customData, setCustomData] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const eventDef = COMMON_EVENTS.find((e) => e.name === selectedEvent);

  function getDataJson() {
    if (customData.trim()) {
      try {
        return JSON.parse(customData);
      } catch {
        return null;
      }
    }
    return eventDef?.defaultData(projectId) ?? { projectId };
  }

  async function handleTrigger() {
    const data = getDataJson();
    if (!data) {
      setError('JSON inválido en el campo de datos.');
      return;
    }
    setLoading(true);
    setError('');
    setResult('');
    try {
      const res = await fetch('/api/trpc/dev.triggerInngestEvent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: { eventName: selectedEvent, data },
        }),
      });
      const resData = await res.json();
      if (resData.result?.data?.json?.sent) {
        setResult(`✓ Evento disparado: ${selectedEvent}`);
      } else {
        setError(JSON.stringify(resData));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-800">Trigger manual de eventos Inngest</h2>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500">Evento</label>
          <select
            value={selectedEvent}
            onChange={(e) => { setSelectedEvent(e.target.value); setCustomData(''); }}
            className="mt-1 block w-full rounded border border-gray-200 px-2 py-1.5 text-sm"
          >
            {COMMON_EVENTS.map((e) => (
              <option key={e.name} value={e.name}>{e.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500">Project ID</label>
          <input
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="uuid del proyecto"
            className="mt-1 block w-full rounded border border-gray-200 px-2 py-1.5 font-['Inter_Tight'] text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500">
            Data (JSON personalizado — deja vacío para usar el default)
          </label>
          <textarea
            value={customData || JSON.stringify(eventDef?.defaultData(projectId || 'PROJECT_ID'), null, 2)}
            onChange={(e) => setCustomData(e.target.value)}
            rows={4}
            className="mt-1 block w-full rounded border border-gray-200 px-2 py-1.5 font-['Inter_Tight'] text-xs"
          />
        </div>

        <button
          type="button"
          onClick={handleTrigger}
          disabled={loading}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          {loading ? 'Disparando...' : 'Trigger evento →'}
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
