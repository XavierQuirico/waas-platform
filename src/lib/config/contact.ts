// ============================================================
// Datos de contacto del negocio — fuente única
//
// Los valores salen de variables de entorno públicas; los valores por defecto
// son ficticios para que ningún dato personal viva en el código.
// ============================================================

const DEFAULT_WHATSAPP = '18095550100';

/** Solo dígitos, con código de país (formato que espera wa.me). */
export const CONTACT_WHATSAPP_NUMBER = (
  process.env.NEXT_PUBLIC_CONTACT_WHATSAPP ?? DEFAULT_WHATSAPP
).replace(/\D/g, '');

export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'hola@quiricostudios.com';

/** Enlace de WhatsApp, con un mensaje prellenado opcional. */
export function whatsappUrl(message?: string): string {
  const base = `https://wa.me/${CONTACT_WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Número legible. Formatea números norteamericanos (+1) como "+1 (809) 555-0100". */
export function formatWhatsAppDisplay(): string {
  const n = CONTACT_WHATSAPP_NUMBER;
  if (n.length === 11 && n.startsWith('1')) {
    return `+1 (${n.slice(1, 4)}) ${n.slice(4, 7)}-${n.slice(7)}`;
  }
  return `+${n}`;
}
