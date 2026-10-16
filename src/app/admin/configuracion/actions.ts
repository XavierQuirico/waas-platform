'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { addonCatalog } from '@/db/schema';

type AddonCategory = 'design' | 'content' | 'integration' | 'revision' | 'custom';

interface SaveAddonInput {
  id?: string;
  code: string;
  name: string;
  description?: string;
  priceCents: number;
  category: AddonCategory;
  active: boolean;
}

async function assertAdmin() {
  const { userId } = await auth();
  return Boolean(userId && userId === process.env.ADMIN_CLERK_USER_ID);
}

export async function listAddonCatalogAction() {
  if (!(await assertAdmin())) return { error: 'No autorizado' };

  try {
    const rows = await db.select().from(addonCatalog).orderBy(addonCatalog.category, addonCatalog.code);
    return { addons: rows };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Error al cargar add-ons' };
  }
}

export async function syncDocumentedAddonCatalogAction() {
  if (!(await assertAdmin())) return { error: 'No autorizado' };
  return { error: 'El catálogo se gestiona desde Capacidades & Add-ons (catalog-actions). Esta acción está deshabilitada.' };
}

export async function saveAddonCatalogAction(input: SaveAddonInput) {
  if (!(await assertAdmin())) return { error: 'No autorizado' };

  try {
    const values = {
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      description: input.description?.trim() || null,
      priceCents: input.priceCents,
      category: input.category,
      active: input.active,
      updatedAt: new Date(),
    };

    const [addon] = input.id
      ? await db.update(addonCatalog).set(values).where(eq(addonCatalog.id, input.id)).returning()
      : await db.insert(addonCatalog).values(values).returning();

    revalidatePath('/admin/configuracion');
    revalidatePath('/admin/tickets');
    revalidatePath('/admin/calculadora');
    return { addon };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Error al guardar add-on' };
  }
}

export async function toggleAddonCatalogAction(id: string, active: boolean) {
  if (!(await assertAdmin())) return { error: 'No autorizado' };

  try {
    const [addon] = await db
      .update(addonCatalog)
      .set({ active, updatedAt: new Date() })
      .where(eq(addonCatalog.id, id))
      .returning();

    revalidatePath('/admin/configuracion');
    revalidatePath('/admin/tickets');
    revalidatePath('/admin/calculadora');
    return { addon };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Error al actualizar add-on' };
  }
}

export async function deleteAddonCatalogAction(id: string) {
  if (!(await assertAdmin())) return { error: 'No autorizado' };

  try {
    await db.delete(addonCatalog).where(eq(addonCatalog.id, id));
    revalidatePath('/admin/configuracion');
    revalidatePath('/admin/tickets');
    revalidatePath('/admin/calculadora');
    return { ok: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Error al eliminar add-on' };
  }
}
