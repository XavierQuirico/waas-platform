import { createHash, timingSafeEqual } from 'crypto';

/**
 * Compara dos secretos en tiempo constante. Se hace hash de ambos para que la
 * comparación no dependa de la longitud ni filtre información por temporización.
 */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}
