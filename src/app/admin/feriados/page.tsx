'use client';

import { useState, useEffect, useCallback } from 'react';

interface Holiday {
  id: string;
  date: string;
  name: string;
  year: number;
}

async function trpcQuery<T>(path: string): Promise<T> {
  const res = await fetch(`/api/trpc/${path}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? 'Error desconocido');
  return data.result?.data?.json as T;
}

async function trpcMutation<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/trpc/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json: body }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? 'Error desconocido');
  return data.result?.data?.json as T;
}

export default function FeriadosPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const loadHolidays = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await trpcQuery<Holiday[]>('admin.listHolidays');
      setHolidays(result ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHolidays();
  }, [loadHolidays]);

  async function handleAdd() {
    if (!date || !name.trim()) {
      setAddError('La fecha y el nombre son obligatorios.');
      return;
    }
    setAdding(true);
    setAddError('');
    try {
      await trpcMutation('admin.addHoliday', { date, name: name.trim() });
      setDate('');
      setName('');
      await loadHolidays();
    } catch (e) {
      setAddError(String(e));
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await trpcMutation('admin.deleteHoliday', { id });
      await loadHolidays();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Feriados RD</h1>
        <p className="text-sm text-gray-500">
          Gestiona los días feriados de República Dominicana para el cálculo de SLA.
        </p>
      </div>

      {/* Add form */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-4 text-sm font-semibold text-gray-800">Añadir feriado</h2>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block rounded border border-gray-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500">Nombre del feriado</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Día de la Independencia"
              className="mt-1 block w-full rounded border border-gray-200 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding}
            className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {adding ? 'Añadiendo...' : 'Añadir'}
          </button>
        </div>
        {addError && (
          <p className="mt-2 text-xs text-red-600">{addError}</p>
        )}
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : holidays.length === 0 ? (
        <p className="text-sm text-gray-500">No hay feriados registrados.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Año</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {holidays.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{h.date}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{h.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{h.year}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(h.id)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
