'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';

export function CreateTestClient() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [business, setBusiness] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ id: string } | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/dev/create-test-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, business }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido');
      setResult(data);
      setName('');
      setEmail('');
      setBusiness('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2 mb-4">
        <UserPlus size={16} strokeWidth={1.5} className="text-amber-400" />
        <h3 className="text-sm font-semibold text-white font-['Roobert']">CreateTestClient</h3>
        <span className="text-xs text-white/30 font-['Roobert']">Crea un cliente fake sin proyecto</span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre completo"
          required
          className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none font-['Roobert']"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none font-['Roobert']"
        />
        <input
          type="text"
          value={business}
          onChange={(e) => setBusiness(e.target.value)}
          placeholder="Nombre del negocio"
          required
          className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none font-['Roobert']"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/30 disabled:opacity-50 transition-colors font-['Roobert']"
        >
          {loading ? 'Creando...' : 'Crear cliente de prueba'}
        </button>
      </form>
      {result && (
        <p className="mt-3 text-xs text-green-400 font-['Inter_Tight']">
          ✓ Cliente creado — ID: {result.id}
        </p>
      )}
      {error && (
        <p className="mt-3 text-xs text-red-400 font-['Inter_Tight']">{error}</p>
      )}
    </div>
  );
}
