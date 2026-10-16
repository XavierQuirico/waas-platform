'use client';

import { useState, useEffect } from 'react';

interface Project {
  id: string;
  plan: string;
  status: string;
  businessName: string;
  email: string;
}

export function CleanDevData() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      const res = await fetch('/api/trpc/dev.listAllProjects');
      const data = await res.json();
      setProjects(data.result?.data?.json ?? []);
    } catch {
      // silent
    }
  }

  async function handleClean() {
    if (confirmText !== 'ELIMINAR') return;
    if (!selectedProjectId) return;

    setLoading(true);
    setError('');
    setResult('');
    try {
      const res = await fetch('/api/trpc/dev.cleanDevData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { projectId: selectedProjectId } }),
      });
      const data = await res.json();
      if (data.result?.data?.json?.deleted) {
        setResult(`✓ Proyecto ${selectedProjectId} eliminado junto con todos sus eventos y assets.`);
        setSelectedProjectId('');
        setConfirmText('');
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

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-800">Limpiar datos de prueba</h2>
      <p className="text-xs text-amber-700 rounded border border-amber-200 bg-amber-50 p-2">
        ⚠️ Esta acción elimina permanentemente el proyecto, sus assets y eventos del audit log.
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500">Seleccionar proyecto a eliminar</label>
          <select
            value={selectedProjectId}
            onChange={(e) => { setSelectedProjectId(e.target.value); setConfirmText(''); }}
            className="mt-1 block w-full rounded border border-gray-200 px-2 py-1.5 text-sm"
          >
            <option value="">— Seleccionar —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.businessName} ({p.email}) — {p.status}
              </option>
            ))}
          </select>
        </div>

        {selectedProjectId && (
          <div>
            <label className="block text-xs text-gray-500">
              Escribe <strong>ELIMINAR</strong> para confirmar
            </label>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="ELIMINAR"
              className="mt-1 block w-full rounded border border-red-200 px-2 py-1.5 text-sm"
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleClean}
          disabled={loading || confirmText !== 'ELIMINAR' || !selectedProjectId}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          {loading ? 'Eliminando...' : 'Eliminar proyecto y datos →'}
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
