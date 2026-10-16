'use client';

import type { CatalogDecision } from '@/lib/catalog/types';

interface PartialConfirmStepProps {
  decision: CatalogDecision;
  originalQuantity: number;
  onConfirm: (acceptedQuantity: number) => void;
  onCancel: () => void;
}

export function PartialConfirmStep({
  decision,
  originalQuantity,
  onConfirm,
  onCancel,
}: PartialConfirmStepProps) {
  const { includedQuantity, paidQuantity, quoteQuantity, unavailableQuantity } = decision;
  const hasPayablePart = paidQuantity > 0 || quoteQuantity > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
        <p
          className="text-sm font-medium text-amber-400"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Disponibilidad parcial
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-amber-400/70">
          Tu plan cubre{' '}
          <span className="font-medium text-amber-300">{includedQuantity}</span> de{' '}
          <span className="font-medium">{originalQuantity}</span>{' '}
          {originalQuantity === 1 ? 'unidad' : 'unidades'}.
          {paidQuantity > 0 && (
            <> Las otras <span className="font-medium">{paidQuantity}</span> tienen costo adicional.</>
          )}
          {quoteQuantity > 0 && (
            <> Las otras <span className="font-medium">{quoteQuantity}</span> requieren cotización.</>
          )}
          {unavailableQuantity > 0 && !hasPayablePart && (
            <> Las otras <span className="font-medium">{unavailableQuantity}</span> no están disponibles en tu plan actual.</>
          )}
        </p>
      </div>

      <div className="space-y-2">
        {hasPayablePart && (
          <button
            onClick={() => onConfirm(originalQuantity)}
            className="w-full rounded-md bg-[#d5ff02] px-4 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Confirmar solicitud completa
            {paidQuantity > 0 && <span className="ml-1 opacity-70">({includedQuantity} incluido + {paidQuantity} con costo)</span>}
            {quoteQuantity > 0 && !paidQuantity && <span className="ml-1 opacity-70">({includedQuantity} incluido + {quoteQuantity} a cotizar)</span>}
          </button>
        )}

        {includedQuantity > 0 && (unavailableQuantity > 0 || !hasPayablePart) && (
          <button
            onClick={() => onConfirm(includedQuantity)}
            className="w-full rounded-md border border-white/20 px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/5"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Solicitar solo {includedQuantity} (incluido en tu plan)
          </button>
        )}

        <button
          onClick={onCancel}
          className="w-full rounded-md px-4 py-2 text-sm text-white/30 transition-colors hover:text-white/50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
