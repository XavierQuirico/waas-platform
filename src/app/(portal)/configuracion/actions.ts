'use server';

import { db } from '@/db';
import { clients } from '@/db/schema';
import { requirePortalClient } from '@/lib/portal/context';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  isConfigSectionId,
  validateConfigSection,
  type ConfigSectionId,
} from '@/lib/portal/configuration-view-model';

export type UpdateConfigState =
  | { ok: true; section: ConfigSectionId }
  | { ok: false; section: ConfigSectionId | null; field: string | null; error: string }
  | null;

/**
 * Actualiza UNA sección editable de la configuración del cliente.
 *
 * Seguridad:
 *   - La sección llega en `__section` y se valida contra la allowlist; una
 *     sección desconocida se rechaza sin tocar la base de datos.
 *   - Sólo se persisten los campos permitidos de esa sección. Cualquier otra
 *     clave del FormData (incluido un `clientId` inyectado) se ignora.
 *   - El cliente objetivo se deriva SIEMPRE de la sesión (requirePortalClient),
 *     nunca del navegador.
 */
export async function updateClientConfig(
  _prev: UpdateConfigState,
  formData: FormData,
): Promise<UpdateConfigState> {
  const section = formData.get('__section');

  if (!isConfigSectionId(section)) {
    return { ok: false, section: null, field: null, error: 'Sección no válida.' };
  }

  const raw: Record<string, unknown> = {
    fullName: formData.get('fullName'),
    businessName: formData.get('businessName'),
    whatsapp: formData.get('whatsapp'),
    location: formData.get('location'),
    currentUrl: formData.get('currentUrl'),
  };

  const parsed = validateConfigSection(section, raw);
  if ('error' in parsed) {
    return { ok: false, section, field: parsed.field, error: parsed.error };
  }

  // Ownership derivado de la sesión — nunca confiamos en el cliente.
  const ctx = await requirePortalClient();

  try {
    await db
      .update(clients)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(clients.id, ctx.client.id));
  } catch {
    return {
      ok: false,
      section,
      field: null,
      error: 'No pudimos guardar los cambios. Inténtalo de nuevo.',
    };
  }

  revalidatePath('/configuracion');
  return { ok: true, section };
}
