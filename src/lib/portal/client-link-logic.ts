// ============================================================
// Client Link Logic — Pure helpers (no DB, no Clerk)
// Used by portal context and submitV2 to resolve clerkUserId conflicts.
// ============================================================

/**
 * Decision returned by resolveClientLink.
 * - 'use_as_is'       → use the client record as-is, no update needed
 * - 'update_clerk_id' → safe to update client.clerkUserId to the real userId
 * - 'conflict'        → email belongs to a different real Clerk account; abort
 */
export type ClientLinkDecision = 'use_as_is' | 'update_clerk_id' | 'conflict';

/**
 * Given an existing client's clerkUserId and an incoming real userId,
 * returns what action to take.
 *
 * Rules:
 * - If existing is pending_ or empty string → safe to link real userId ('update_clerk_id').
 * - If existing equals incoming → already linked ('use_as_is').
 * - If existing is a real userId different from incoming → conflict ('conflict').
 * - If no incoming userId (anonymous submit) + existing pending → 'use_as_is'.
 * - If no incoming userId (anonymous submit) + existing real → 'conflict' (blocks email hijacking).
 */
export function resolveClientLink(
  existingClerkId: string | null | undefined,
  incomingClerkId: string | null | undefined
): ClientLinkDecision {
  const existing = existingClerkId ?? '';
  const incoming = incomingClerkId ?? '';

  const existingIsPending = existing === '' || existing.startsWith('pending_');
  const incomingIsReal = incoming !== '' && !incoming.startsWith('pending_');

  if (existingIsPending) {
    return incomingIsReal ? 'update_clerk_id' : 'use_as_is';
  }

  // existing has a real clerkUserId
  if (existing === incoming) return 'use_as_is';
  if (incomingIsReal && existing !== incoming) return 'conflict';
  // anonymous submit (incoming null/empty/pending) against a real existing account → conflict
  return 'conflict';
}

/**
 * Un cliente pendiente solo se enlaza a una cuenta real si el email de contacto
 * del formulario coincide con el email verificado de quien está autenticado.
 * Evita que alguien tome el control de la solicitud de otra persona escribiendo
 * su email en el wizard estando autenticado con otra cuenta.
 */
export function canLinkPendingClient(opts: {
  decision: ClientLinkDecision;
  verifiedEmail: string | null | undefined;
  contactEmail: string;
}): boolean {
  if (opts.decision !== 'update_clerk_id') return true;
  if (!opts.verifiedEmail) return false;
  return opts.verifiedEmail.trim().toLowerCase() === opts.contactEmail.trim().toLowerCase();
}

// ─── Portal state classification ──────────────────────────

/**
 * Determines what the /portal page should render based on context.
 * Priority: conflict > active > pending > empty
 */
export type PortalState = 'conflict' | 'dashboard' | 'pending' | 'empty';

export function classifyPortalState(opts: {
  accountConflict: boolean;
  hasActiveProject: boolean;
  hasPendingRequest: boolean;
}): PortalState {
  if (opts.accountConflict) return 'conflict';
  if (opts.hasActiveProject) return 'dashboard';
  if (opts.hasPendingRequest) return 'pending';
  return 'empty';
}

// ─── Status sets ──────────────────────────────────────────

export const PENDING_PROJECT_STATUSES = ['DRAFT', 'REQUIRES_REVIEW'] as const;

export const ACTIVE_PROJECT_STATUSES = [
  'PROPOSAL_SENT',
  'PAYMENT_RECEIVED',
  'AWAITING_ASSETS',
  'ASSETS_SUBMITTED',
  'ASSETS_UNDER_REVIEW',
  'ASSETS_INCOMPLETE',
  'PRODUCTION_STARTED',
  'STAGING_REVIEW',
  'REVISIONS',
  'REVISIONS_DONE',
  'LIVE',
  'SUSPENDED',
] as const;
