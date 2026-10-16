'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { projects, quotes } from '@/db/schema';
import { eq } from 'drizzle-orm';

type Plan = 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY';

interface CreateProjectInput {
  clientId: string;
  plan: Plan;
  monthlyPriceCents: number;
  setupFeeCents: number;
  domainTarget?: string;
  internalNotes?: string;
  portfolioFlag: boolean;
  quoteId?: string;
}

export async function createProjectAction(
  input: CreateProjectInput,
): Promise<{ projectId: string } | { error: string }> {
  const { userId } = await auth();
  if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
    return { error: 'No autorizado' };
  }

  try {
    let catalogSnapshot = null;
    if (input.quoteId) {
      const [quote] = await db
        .select({ catalogSnapshot: quotes.catalogSnapshot })
        .from(quotes)
        .where(eq(quotes.id, input.quoteId));
      if (quote && quote.catalogSnapshot) {
        catalogSnapshot = quote.catalogSnapshot;
      }
    }

    const [project] = await db
      .insert(projects)
      .values({
        clientId: input.clientId,
        plan: input.plan,
        monthlyPriceCents: input.monthlyPriceCents,
        setupFeeCents: input.setupFeeCents,
        domainTarget: input.domainTarget ?? null,
        internalNotes: input.internalNotes ?? null,
        portfolioFlag: input.portfolioFlag,
        status: 'DRAFT',
        catalogSnapshot,
      })
      .returning({ id: projects.id });

    revalidatePath('/admin/proyectos');
    return { projectId: project.id };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Error al crear proyecto' };
  }
}
