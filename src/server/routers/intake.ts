// ============================================================
// tRPC Router — Intake WaaS
// Procedimientos: checkClerkUserHasClient, submitV2
// ============================================================

import { randomUUID } from 'crypto';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure, protectedProcedure, router } from '@/server/trpc';
import {
  intakeSubmitSchemaV2,
  checkClerkUserHasClientInputSchema,
} from '@/lib/intake/schema';
import { detectPlan } from '@/lib/intake/plan-detector';
import { getPlanPriceCents } from '@/lib/intake/plan-detector';
import {
  mapCapabilitiesToFeatureChecklist,
  deriveMaterialStatus,
} from '@/lib/intake/v2-normalizers';
import type { NeededCapability, PrimaryGoal, BrandAssetsStatus } from '@/lib/intake/types';
import { db } from '@/db';
import { clients, projects } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resolveClientLink, canLinkPendingClient } from '@/lib/portal/client-link-logic';
import { getVerifiedPrimaryEmail } from '@/lib/portal/verified-email';
import { createRateLimiter } from '@/lib/security/rate-limit';

// Endpoint público que crea clientes y proyectos: 10 envíos por IP y hora.
const submitLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });

// Acota lo que llega en la interpretación de IA, que viene del navegador y luego
// se muestra en el panel de administración.
const shortText = z.string().max(300);

// ─── V2 helpers ───────────────────────────────────────────

/**
 * Maps V2 primaryGoals to NeededCapability[] for use with the legacy plan detector.
 *
 * Mapping (from task spec):
 * 'booking'        → booking
 * 'catalog'        → catalog
 * 'online_payments'→ online_payments + checkout (→ online_payments)
 * 'content_news'   → blog
 * 'full_ownership' → ownership
 * 'contacts'       → contact_requests
 * 'orders_sales'   → catalog + checkout (→ catalog + online_payments)
 * 'services_brand' → (informational only, no capability)
 */
function mapPrimaryGoalsToCapabilities(goals: PrimaryGoal[]): NeededCapability[] {
  const caps = new Set<NeededCapability>();
  for (const goal of goals) {
    switch (goal) {
      case 'booking':
        caps.add('booking');
        break;
      case 'catalog':
        caps.add('catalog');
        break;
      case 'online_payments':
        caps.add('online_payments');
        break;
      case 'content_news':
        caps.add('blog');
        break;
      case 'full_ownership':
        caps.add('ownership');
        break;
      case 'contacts':
        caps.add('contact_requests');
        break;
      case 'orders_sales':
        caps.add('catalog');
        caps.add('online_payments');
        break;
      case 'services_brand':
        // Informational only — no capability mapping
        break;
    }
  }
  return Array.from(caps);
}

/**
 * Maps V2 BrandIdentityStatus to BrandAssetsStatus (used by deriveMaterialStatus).
 * 'has_logo_and_style' → 'has_logo_and_brand'
 * 'has_logo_no_style'  → 'has_logo'
 * 'no_identity'        → 'no_clear_brand'
 */
function mapBrandIdentityToBrandAssets(
  brandIdentityStatus: 'has_logo_and_style' | 'has_logo_no_style' | 'no_identity'
): BrandAssetsStatus {
  switch (brandIdentityStatus) {
    case 'has_logo_and_style':
      return 'has_logo_and_brand';
    case 'has_logo_no_style':
      return 'has_logo';
    case 'no_identity':
      return 'no_clear_brand';
  }
}

export const intakeRouter = router({
  /**
   * Verifica si el usuario autenticado ya tiene un registro de cliente.
   * Requiere sesión Clerk — usa ctx.userId (server-side) como única fuente de verdad.
   * Ningún clerkUserId proporcionado por el cliente es aceptado como input.
   */
  checkClerkUserHasClient: protectedProcedure
    .input(checkClerkUserHasClientInputSchema)
    .query(async ({ ctx }) => {
      const existing = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.clerkUserId, ctx.userId))
        .limit(1);

      if (existing.length > 0) {
        return { hasClient: true, clientId: existing[0].id };
      }
      return { hasClient: false };
    }),

  /**
   * Envía el formulario de intake V2 (Wizard Comercial V2).
   * Crea cliente + proyecto en estado DRAFT o REQUIRES_REVIEW.
   * El plan se detecta server-side (fuente de verdad), nunca se confía en el cliente.
   * NO genera pago — El admin personaliza y envía propuesta manualmente.
   */
  submitV2: publicProcedure
    .input(
      intakeSubmitSchemaV2.extend({
        groqInterpretation: z
          .object({
            inferredIndustry: z.string().max(100).optional(),
            detectedNeeds: z.array(shortText).max(20),
            scopeRisks: z.array(shortText).max(20),
            planSignals: z.object({
              suggestsLegacy: z.boolean(),
              suggestsBusiness: z.boolean(),
              suggestsPro: z.boolean(),
            }),
            needsCopy: z.boolean(),
            needsVisuals: z.boolean(),
            needsBooking: z.boolean(),
            needsCatalog: z.boolean(),
            needsPayments: z.boolean(),
            needsContent: z.boolean(),
            questionsForAdmin: z.array(shortText).max(20),
            humanSummary: z.string().max(2000),
          })
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Límite por IP (cuando el proxy la informa; en local no hay IP que atribuir)
      if (ctx.ip && ctx.ip !== 'unknown' && !submitLimiter.check(ctx.ip).allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Has enviado demasiadas solicitudes. Intenta de nuevo más tarde.',
        });
      }

      // input.clerkUserId is NOT the source of truth — clients can send any value.
      // ctx.userId comes from Clerk's server-side auth() and is the only trusted identity.
      const authenticatedClerkUserId = ctx.userId ?? null;

      // 1. Map V2 primaryGoals → NeededCapability[] → FeatureChecklist
      const capabilities = mapPrimaryGoalsToCapabilities(
        input.primaryGoals as PrimaryGoal[]
      );
      const features = mapCapabilitiesToFeatureChecklist(capabilities);

      // 2. Map V2 brand identity → BrandAssetsStatus → MaterialStatus (legacy)
      const brandAssetsStatus = mapBrandIdentityToBrandAssets(input.brandIdentityStatus);
      const materialStatus = deriveMaterialStatus({
        brandAssetsStatus,
        photosStatus: input.photosStatus,
        copyStatus: input.copyStatus,
      });

      // 3. Detect plan server-side (source of truth)
      const serverPlanResult = detectPlan(features, materialStatus);
      const plan = serverPlanResult.plan;

      // full_ownership in primaryGoals → LEGACY + requiresReview (always)
      const hasFullOwnership = input.primaryGoals.includes('full_ownership');
      let requiresReview = serverPlanResult.requiresReview || hasFullOwnership;

      // groqInterpretation?.planSignals?.suggestsLegacy → flag for el admin review
      if (input.groqInterpretation?.planSignals?.suggestsLegacy) {
        requiresReview = true;
      }

      const monthlyPriceCents = getPlanPriceCents(plan);

      // 4. Build fullName from firstName + lastName
      const fullName = `${input.firstName} ${input.lastName}`;

      // 5. Create or find existing client by email
      let clientId: string;

      const existingClient = await db
        .select({ id: clients.id, clerkUserId: clients.clerkUserId })
        .from(clients)
        .where(eq(clients.email, input.email))
        .limit(1);

      if (existingClient.length > 0) {
        const existingClerkId = existingClient[0].clerkUserId ?? '';
        const decision = resolveClientLink(existingClerkId, authenticatedClerkUserId);

        if (decision === 'conflict') {
          throw new TRPCError({
            code: 'CONFLICT',
            message:
              'Ya existe una cuenta asociada a este email. Inicia sesión con esa cuenta o contacta a Xavier.',
          });
        }

        // Tomar el control de un cliente pendiente exige probar que el email del
        // formulario es el email verificado de la cuenta autenticada.
        const linkAllowed = canLinkPendingClient({
          decision,
          verifiedEmail: decision === 'update_clerk_id' ? await getVerifiedPrimaryEmail() : null,
          contactEmail: input.email,
        });
        if (!linkAllowed) {
          throw new TRPCError({
            code: 'CONFLICT',
            message:
              'Ya existe una solicitud con este email. Inicia sesión con una cuenta que use ese mismo correo verificado.',
          });
        }

        clientId = existingClient[0].id;

        if (decision === 'update_clerk_id' && authenticatedClerkUserId) {
          await db
            .update(clients)
            .set({
              clerkUserId: authenticatedClerkUserId,
              fullName,
              whatsapp: input.whatsapp,
              businessName: input.businessName,
              currentUrl: input.currentUrl || null,
              materialStatus: materialStatus,
            })
            .where(eq(clients.id, clientId));
        }
      } else {
        const [newClient] = await db
          .insert(clients)
          .values({
            clerkUserId: authenticatedClerkUserId ?? `pending_${randomUUID()}`,
            fullName,
            email: input.email,
            whatsapp: input.whatsapp,
            businessName: input.businessName,
            industry: input.industry,
            location: null,
            currentUrl: input.currentUrl || null,
            materialStatus: materialStatus,
          })
          .returning({ id: clients.id });

        clientId = newClient.id;
      }

      // 6. Build terms metadata
      const termsAcceptedAt = new Date();
      const termsVersion = input.termsVersion ?? '1.0';

      // 7. Create project in DRAFT or REQUIRES_REVIEW — never 'active'
      const intakeSnapshotV2 = {
        // Contact
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        whatsapp: input.whatsapp,
        businessName: input.businessName,
        industry: input.industry,
        // V2 context
        whatYouOffer: input.whatYouOffer,
        hasExistingSite: input.hasExistingSite,
        currentUrl: input.currentUrl || null,
        // V2 scope data
        primaryProblems: input.primaryProblems,
        primaryProblemsOther: input.primaryProblemsOther || null,
        primaryGoals: input.primaryGoals,
        freeformBrief: input.freeformBrief,
        // V2 materials
        brandIdentityStatus: input.brandIdentityStatus,
        copyStatus: input.copyStatus,
        photosStatus: input.photosStatus,
        domainStatus: input.domainStatus,
        currentAccessStatus: input.currentAccessStatus || null,
        // Plan intent (from client — informational only)
        selectedPlanIntent: input.selectedPlanIntent ?? null,
        // Server-side detection result (source of truth)
        serverDetectedPlan: {
          plan,
          requiresReview,
          reasons: serverPlanResult.reasons,
        },
        // Groq structured output (if present)
        groqInterpretation: input.groqInterpretation ?? null,
        submittedAt: new Date().toISOString(),
      };

      const [project] = await db
        .insert(projects)
        .values({
          clientId,
          plan: plan,
          monthlyPriceCents,
          setupFeeCents: 5000,
          status: requiresReview ? 'REQUIRES_REVIEW' : 'DRAFT',
          suggestedAddOns: null,
          intakeSnapshot: intakeSnapshotV2,
          domainTarget: input.currentUrl || null,
          termsAcceptedAt,
          termsVersion,
          // termsAcceptedIp: IP extraction requires request context; left null for now
        })
        .returning({ id: projects.id, status: projects.status });

      // 8. Return result
      return {
        projectId: project.id,
        status: project.status,
        plan,
        requiresReview,
      };
    }),
});
