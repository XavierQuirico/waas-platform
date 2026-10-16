'use client';

import { useState } from 'react';

const WEBHOOK_EVENTS = [
  { value: 'BILLING.SUBSCRIPTION.ACTIVATED', label: 'Suscripción activada' },
  { value: 'PAYMENT.CAPTURE.COMPLETED', label: 'Pago capturado' },
  { value: 'BILLING.SUBSCRIPTION.PAYMENT.FAILED', label: 'Pago fallido' },
  { value: 'BILLING.SUBSCRIPTION.CANCELLED', label: 'Suscripción cancelada' },
] as const;

export function SimulatePaypalWebhook() {
  const [eventType, setEventType] = useState<string>(WEBHOOK_EVENTS[0].value);
  const [subscriptionId, setSubscriptionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  async function handleSimulate() {
    setLoading(true);
    setError('');
    setResult('');
    try {
      const res = await fetch('/api/trpc/dev.simulatePaypalWebhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            eventType,
            subscriptionId: subscriptionId || undefined,
          },
        }),
      });
      const data = await res.json();
      if (data.result?.data) {
        const { status } = data.result.data.json;
        setResult(`✓ Webhook simulado — HTTP ${status}`);
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
      <h2 className="text-sm font-semibold text-gray-800">Simular webhook de PayPal</h2>
      <p className="text-xs text-gray-500">
        Envía un payload mock al handler real de webhooks. El handler debe estar configurado
        para aceptar <code>X-Dev-Bypass: true</code> en desarrollo.
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500">Tipo de evento</label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-200 px-2 py-1.5 text-sm"
          >
            {WEBHOOK_EVENTS.map((e) => (
              <option key={e.value} value={e.value}>{e.label} ({e.value})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500">
            Subscription ID (opcional — se genera uno fake si vacío)
          </label>
          <input
            value={subscriptionId}
            onChange={(e) => setSubscriptionId(e.target.value)}
            placeholder="I-XXXXXXXXXXXXXXXX"
            className="mt-1 block w-full rounded border border-gray-200 px-2 py-1.5 font-['Inter_Tight'] text-sm"
          />
        </div>

        <button
          type="button"
          onClick={handleSimulate}
          disabled={loading}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          {loading ? 'Enviando...' : 'Simular webhook →'}
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
