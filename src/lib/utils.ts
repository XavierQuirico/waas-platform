/**
 * Combina clases CSS — filtra falsy values y une con espacio.
 * Drop-in simple sin dependencias externas.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
