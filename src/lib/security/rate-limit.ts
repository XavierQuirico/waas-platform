// ============================================================
// Limitador de peticiones por clave (ventana deslizante, en memoria)
//
// Protege los endpoints públicos más costosos (wizard e interpretación con IA)
// contra ráfagas y abuso básico. El estado vive en la memoria de cada instancia
// de la función, así que en un despliegue con muchas instancias el límite es
// aproximado. Para una garantía global, usar además el rate limiting del borde
// (p. ej. Vercel Firewall) o un almacén compartido.
// ============================================================

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string, now?: number): RateLimitResult;
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  maxKeys?: number;
}): RateLimiter {
  const { windowMs, max, maxKeys = 5000 } = options;
  const hits = new Map<string, number[]>();

  function prune(now: number) {
    for (const [key, timestamps] of hits) {
      const recent = timestamps.filter((t) => now - t < windowMs);
      if (recent.length === 0) hits.delete(key);
      else hits.set(key, recent);
    }
  }

  return {
    check(key, now = Date.now()) {
      if (hits.size >= maxKeys) prune(now);

      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

      if (recent.length >= max) {
        hits.set(key, recent);
        const retryAfterMs = windowMs - (now - recent[0]);
        return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
      }

      recent.push(now);
      hits.set(key, recent);
      return { allowed: true, remaining: max - recent.length, retryAfterSeconds: 0 };
    },
  };
}

type HeaderReader = { get(name: string): string | null };

/** Identifica al cliente por la primera IP de x-forwarded-for (la añade el proxy). */
export function clientIpFromHeaders(headers: HeaderReader): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || headers.get('x-real-ip')?.trim() || 'unknown';
  return ip.slice(0, 45);
}
