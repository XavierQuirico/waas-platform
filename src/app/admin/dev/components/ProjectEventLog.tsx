'use client';

import { useState, useEffect } from 'react';

interface ProjectEvent {
  id: string;
  projectId: string;
  eventType: string;
  actorType: string;
  fromStatus: string | null;
  toStatus: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface Props {
  defaultProjectId?: string;
}

export function ProjectEventLog({ defaultProjectId }: Props) {
  const [filterProjectId, setFilterProjectId] = useState(defaultProjectId ?? '');
  const [events, setEvents] = useState<ProjectEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (defaultProjectId) setFilterProjectId(defaultProjectId);
  }, [defaultProjectId]);

  useEffect(() => {
    fetchEvents();
  }, [filterProjectId]);

  async function fetchEvents() {
    setLoading(true);
    try {
      const input = filterProjectId
        ? encodeURIComponent(JSON.stringify({ json: { projectId: filterProjectId } }))
        : encodeURIComponent(JSON.stringify({ json: {} }));
      const res = await fetch(`/api/trpc/dev.getRecentEvents?input=${input}`);
      const data = await res.json();
      setEvents(data.result?.data?.json ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">Event log (últimos 50)</h2>
        <button
          type="button"
          onClick={fetchEvents}
          className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      <div>
        <label className="block text-xs text-gray-500">Filtrar por project ID (opcional)</label>
        <input
          value={filterProjectId}
          onChange={(e) => setFilterProjectId(e.target.value)}
          placeholder="uuid del proyecto"
          className="mt-1 block w-full rounded border border-gray-200 px-2 py-1.5 font-['Inter_Tight'] text-sm"
        />
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Cargando eventos...</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-gray-400">No hay eventos.</p>
      ) : (
        <div className="max-h-96 overflow-y-auto rounded border border-gray-200">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-left text-gray-500">Hora</th>
                <th className="px-3 py-2 text-left text-gray-500">Evento</th>
                <th className="px-3 py-2 text-left text-gray-500">Estado</th>
                <th className="px-3 py-2 text-left text-gray-500">Actor</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-['Inter_Tight'] text-gray-400">
                    {new Date(ev.createdAt).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-700">{ev.eventType}</td>
                  <td className="px-3 py-2 text-gray-500">
                    {ev.fromStatus && ev.toStatus
                      ? `${ev.fromStatus} → ${ev.toStatus}`
                      : ev.toStatus ?? ev.fromStatus ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-gray-400">{ev.actorType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
