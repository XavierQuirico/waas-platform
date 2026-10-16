'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';

interface TicketPayPalCheckoutProps {
  ticketNumber: string;
  quoteRevision: number;
  quotedPriceCents: number;
}

type CheckoutStep = 'idle' | 'creating' | 'capturing' | 'success' | 'error';

function PayPalCheckoutInner({
  ticketNumber,
  quoteRevision,
  quotedPriceCents,
}: TicketPayPalCheckoutProps) {
  const router = useRouter();
  const [step, setStep] = useState<CheckoutStep>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCreateOrder = async (): Promise<string> => {
    setStep('creating');
    setErrorMessage(null);

    const res = await fetch(`/api/portal/tickets/${ticketNumber}/paypal/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedQuoteRevision: quoteRevision }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      const msg = body.error ?? 'No pudimos crear la orden de pago.';
      setStep('error');
      setErrorMessage(msg);
      throw new Error(msg);
    }

    const data = (await res.json()) as { orderId?: string; error?: string };
    if (!data.orderId) {
      const msg = data.error ?? 'No se recibió el ID de orden.';
      setStep('error');
      setErrorMessage(msg);
      throw new Error(msg);
    }

    return data.orderId;
  };

  const handleApprove = async (data: { orderID: string }) => {
    setStep('capturing');
    setErrorMessage(null);

    const res = await fetch(`/api/portal/tickets/${ticketNumber}/paypal/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: data.orderID,
        expectedQuoteRevision: quoteRevision,
      }),
    });

    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };

    if (res.ok && body.ok) {
      setStep('success');
      router.refresh();
      return;
    }

    const msg =
      body.message ??
      body.error ??
      'No pudimos confirmar tu pago. Tu aceptación sigue activa, inténtalo de nuevo.';
    setStep('error');
    setErrorMessage(msg);
  };

  const handleError = () => {
    setStep('error');
    setErrorMessage('Ocurrió un error con PayPal. Tu aceptación sigue activa, inténtalo de nuevo.');
  };

  const handleCancel = () => {
    if (step === 'creating' || step === 'capturing') return;
    setStep('idle');
    setErrorMessage(null);
  };

  if (step === 'success') {
    return (
      <div className="flex items-center gap-2 text-emerald-400 text-sm font-inter-tight">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 flex-shrink-0">
          <path d="M4 10.5l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Pago procesado. Actualizando…
      </div>
    );
  }

  const amountUSD = (quotedPriceCents / 100).toFixed(2);

  return (
    <div className="space-y-3">
      {errorMessage && (
        <div className="rounded-xl bg-red-400/10 border border-red-400/20 px-4 py-3">
          <p className="text-xs text-red-300 font-inter-tight">{errorMessage}</p>
          <button
            type="button"
            onClick={() => { setStep('idle'); setErrorMessage(null); }}
            className="mt-1.5 text-xs text-red-300/60 hover:text-red-300/90 font-inter-tight transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {(step === 'creating' || step === 'capturing') && (
        <p className="text-xs text-white/35 font-inter-tight animate-pulse">
          {step === 'creating' ? 'Preparando orden…' : 'Confirmando pago…'}
        </p>
      )}

      <PayPalButtons
        style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 40 }}
        disabled={step === 'creating' || step === 'capturing'}
        createOrder={handleCreateOrder}
        onApprove={handleApprove}
        onError={handleError}
        onCancel={handleCancel}
      />

      <p className="text-xs text-white/25 font-inter-tight text-center">
        Importe: <span className="text-white/40 tabular-nums">${amountUSD} USD</span>
      </p>
    </div>
  );
}

export function TicketPayPalCheckout(props: TicketPayPalCheckoutProps) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  if (!clientId) {
    return (
      <p className="text-xs text-red-400 font-inter-tight">
        PayPal no está configurado. Contacta soporte.
      </p>
    );
  }

  return (
    <PayPalScriptProvider
      options={{
        clientId,
        currency: 'USD',
        intent: 'capture',
        components: 'buttons',
      }}
    >
      <PayPalCheckoutInner {...props} />
    </PayPalScriptProvider>
  );
}
