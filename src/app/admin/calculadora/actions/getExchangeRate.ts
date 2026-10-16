'use server';

import { isAdmin } from '@/lib/admin/auth';

/**
 * Server action: obtiene la tasa de cambio USD→DOP desde open.er-api.com
 * Se ejecuta en el servidor para evitar CORS desde el cliente.
 */
export async function getExchangeRate(): Promise<{
  rate: number;
  updatedAt: string;
} | null> {
  if (!(await isAdmin())) return null;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 3600 }, // cachear 1h en Next.js
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      rates: Record<string, number>;
      time_last_update_utc?: string;
    };
    const rate = data.rates?.DOP;
    if (!rate || typeof rate !== 'number') return null;
    return {
      rate,
      updatedAt: data.time_last_update_utc ?? new Date().toUTCString(),
    };
  } catch {
    return null;
  }
}
