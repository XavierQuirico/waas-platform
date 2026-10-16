import type { CatalogDecisionCode, CatalogNextAction, CatalogRequestKind } from './types';
import type { ClientTicketStatus } from '@/lib/tickets/billing';

export type PortalCapabilityCard = {
  id: string;
  code: string;
  publicName: string;
  publicDescription: string;
  categoryId: string;
  categoryName: string;
  icon: string | null;
  decision: CatalogDecisionCode;
  nextAction: CatalogNextAction;
  reasonCode: string;
  priceCents: number | null;
  listPriceCents: number;
  includedRemaining: number | null;
  includedQuantity: number | null;
  paidQuantity: number | null;
  quoteQuantity: number | null;
  unavailableQuantity: number | null;
  allowedRequestKinds: CatalogRequestKind[];
};

export type SubmitCatalogRequestInput = {
  projectId: string;
  catalogItemId: string;
  requestKind: CatalogRequestKind;
  quantity: number;
  title: string;
  description: string;
  acceptedPartial?: boolean;
  acceptedQuantity?: number;
  originalQuantity?: number;
};

export type PortalCatalogCategory = {
  id: string;
  name: string;
  publicName: string;
  icon: string | null;
  items: PortalCapabilityCard[];
};

export type ClientTicket = {
  id: string;
  ticketNumber: string;
  title: string;
  addonPublicName: string | null;
  createdAt: Date;
  clientStatus: ClientTicketStatus;
  priceAmount: number;
  quoteStatus: string;
};
