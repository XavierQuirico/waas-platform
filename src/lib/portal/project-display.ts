// Human-safe display names for client-facing project labels.
//
// Pure helpers — no DB, no React. The portal must NEVER show internal
// identifiers to the client (no projectId, no UUID fragments, no "Proyecto #hash").
//
// Resolution order for multi-project clients:
//   1. productionUrl  → legible hostname
//   2. domainTarget   → legible hostname
//   3. stagingUrl     → legible hostname
//   4. fallback       → "Sitio N" (1-based by index)
// Single project always shows "Sitio principal".

export type PortalProjectDisplayInput = {
  index: number;
  total: number;
  productionUrl?: string | null;
  stagingUrl?: string | null;
  domainTarget?: string | null;
};

// A fully-formed UUID (e.g. an internal projectId that leaked into a URL field).
const FULL_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// A bare hex blob with no dot — e.g. "d382a4", a sliced UUID fragment. A real
// hostname always carries a dot (example.com), so this never rejects real domains.
const HEX_FRAGMENT_RE = /^[0-9a-f]{6,32}$/;

/** True when a normalized host is actually an internal id (UUID or hex fragment), not a domain. */
function looksLikeInternalId(host: string): boolean {
  if (FULL_UUID_RE.test(host)) return true;
  if (!host.includes('.') && HEX_FRAGMENT_RE.test(host)) return true;
  return false;
}

/**
 * Normalizes a URL or bare domain into a readable hostname for the client:
 * strips protocol, credentials, "www.", port, path/query/hash and trailing dots.
 * Never throws. Returns null when the input yields no usable host.
 */
export function getPortalProjectHostLabel(urlOrDomain: string | null | undefined): string | null {
  if (urlOrDomain == null) return null;
  let raw = String(urlOrDomain).trim();
  if (!raw) return null;

  // Strip scheme (http://, https://, ftp://, …) — requires the "://" form.
  raw = raw.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
  // Strip user:pass@ credentials.
  raw = raw.replace(/^[^@/]*@/, '');
  // Cut everything from the first path/query/fragment separator.
  raw = raw.split(/[/?#]/)[0] ?? '';
  // Strip "www." prefix.
  raw = raw.replace(/^www\./i, '');
  // Strip explicit port.
  raw = raw.replace(/:\d+$/, '');
  // Strip trailing dots/whitespace.
  raw = raw.trim().replace(/\.+$/, '').trim();

  if (!raw) return null;
  const host = raw.toLowerCase();
  // Blindaje: jamás exponer un projectId/UUID o un fragmento hex como label.
  if (looksLikeInternalId(host)) return null;
  return host;
}

/**
 * Produces the human label for a project card / selector entry.
 * Guaranteed to never return an empty string, a UUID, a UUID fragment,
 * or a "Proyecto #..." style label, and never throws on malformed input.
 */
export function getPortalProjectDisplayName(input: PortalProjectDisplayInput): string {
  const { total } = input;
  if (!Number.isFinite(total) || total <= 1) return 'Sitio principal';

  const host =
    getPortalProjectHostLabel(input.productionUrl) ??
    getPortalProjectHostLabel(input.domainTarget) ??
    getPortalProjectHostLabel(input.stagingUrl);

  if (host) return host;

  const idx = Number.isFinite(input.index) && input.index >= 0 ? Math.floor(input.index) : 0;
  return `Sitio ${idx + 1}`;
}
