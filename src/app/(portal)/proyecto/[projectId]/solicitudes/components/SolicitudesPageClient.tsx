'use client';

import { useState } from 'react';
import type { ClientTicket, PortalCapabilityCard, PortalCatalogCategory } from '@/lib/catalog/portal-types';
import { CapabilityCard } from './CapabilityCard';
import { RequestFormDialog } from './RequestFormDialog';
import { TicketList } from './TicketList';

interface SolicitudesPageClientProps {
  categories: PortalCatalogCategory[];
  tickets: ClientTicket[];
  projectId: string;
}

export function SolicitudesPageClient({
  categories,
  tickets,
  projectId,
}: SolicitudesPageClientProps) {
  const [selectedCard, setSelectedCard] = useState<PortalCapabilityCard | null>(null);

  function handleSuccess() {
    setSelectedCard(null);
    // Server action already calls revalidatePath — next navigation reflects updated state
  }

  if (categories.length === 0 && tickets.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-white/30">
          No hay capacidades disponibles en el portal en este momento.
        </p>
      </div>
    );
  }

  return (
    <div>
      <TicketList tickets={tickets} />

      {categories.length > 0 && (
        <div className="space-y-8">
          {categories.map((category) => (
            <section key={category.id}>
              <div className="mb-3 flex items-center gap-2">
                {category.icon && (
                  <span className="text-base" aria-hidden="true">
                    {category.icon}
                  </span>
                )}
                <h2 className="text-xs font-medium text-white/40 uppercase tracking-[0.08em]">
                  {category.publicName}
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {category.items.map((card) => (
                  <CapabilityCard key={card.id} card={card} onRequest={setSelectedCard} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {selectedCard && (
        <RequestFormDialog
          card={selectedCard}
          projectId={projectId}
          onClose={() => setSelectedCard(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
