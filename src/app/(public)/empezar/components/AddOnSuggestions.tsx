'use client';

// Add-ons sugeridos en la propuesta (Step 4)
// Muestra add-ons recomendados según el checklist — NO cambian el plan base

import type { AddOnSuggestion } from '@/lib/intake/types';

interface AddOnSuggestionsProps {
  addOns: AddOnSuggestion[];
}

export function AddOnSuggestions({ addOns }: AddOnSuggestionsProps) {
  if (addOns.length === 0) return null;

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        Add-ons recomendados
      </p>
      <div className="mt-2 space-y-2">
        {addOns.map((addon) => (
          <div
            key={addon.key}
            className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-white p-3"
          >
            <div>
              <p className="text-sm font-medium text-gray-700">{addon.label}</p>
              <p className="text-xs text-gray-400">{addon.reason}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-gray-900">
              +${addon.priceUsd}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Los add-ons son opcionales. Xavier los discutirá contigo en la propuesta final.
      </p>
    </div>
  );
}
