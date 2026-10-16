// ============================================================
// tRPC Router — Assets WaaS
// Procedimientos: getUploadUrl, confirmUpload, saveTextValue, submitForReview
// Seguridad: IDOR protection via Clerk userId → clientId → projectId chain
// ============================================================

import { z } from 'zod';
import { protectedProcedure, router } from '@/server/trpc';
import { db } from '@/db';
import { clients, projects, projectAssets } from '@/db/schema';
import { assetKeyEnum } from '@/db/schema/project-assets';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { r2Client } from '@/lib/r2-client';
import { PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { inngest } from '@/inngest/client';
import { deriveProjectType } from '@/lib/portal/project-type';
import { resolveAssetRequirementPlan } from '@/lib/assets/asset-ui';
import { canSubmitForReview } from '@/lib/assets/asset-requirements';

// Tipos MIME permitidos
const ALLOWED_MIMES = [
  'image/svg+xml', 'image/png', 'image/jpeg', 'image/webp',
  'application/pdf', 'application/postscript',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILE_INDEX = 29; // 30 archivos por tipo de material como máximo
const UPLOAD_URL_TTL_SECONDS = 900; // 15 minutos

// Las claves de material son exactamente las del enum de la base de datos.
const assetKeySchema = z.enum(assetKeyEnum.enumValues);

// Extensión derivada de una tabla fija: nunca del string MIME que envía el cliente.
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/postscript': 'ai',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'text/csv': 'csv',
};

const UPLOAD_STATES = ['AWAITING_ASSETS', 'ASSETS_INCOMPLETE'];

/**
 * Verifica que el projectId pertenece al usuario autenticado.
 * Anti-IDOR: busca por projectId + clientId, nunca por "primer proyecto del cliente".
 * Retorna el proyecto con plan, portfolioFlag y status para validaciones posteriores.
 */
async function requireClientProjectForAssets(clerkUserId: string, projectId: string) {
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.clerkUserId, clerkUserId))
    .limit(1);

  if (!client) throw new Error('No autorizado.');

  const [project] = await db
    .select({
      id: projects.id,
      plan: projects.plan,
      portfolioFlag: projects.portfolioFlag,
      status: projects.status,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.clientId, client.id)))
    .limit(1);

  if (!project) throw new Error('No autorizado.');

  return { clientId: client.id, project };
}

export const assetsRouter = router({
  /**
   * Genera una URL presignada de R2 para upload directo (cliente → R2, sin pasar por servidor).
   * Valida autorización: Clerk userId → clientId → projectId (anti-IDOR).
   * Valida MIME type y tamaño en servidor (validación client-side es solo UX).
   */
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        assetKey: assetKeySchema,
        mimeType: z.string().max(150),
        fileSize: z.number().int().positive(),
        fileIndex: z.number().int().min(0).max(MAX_FILE_INDEX).default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { project } = await requireClientProjectForAssets(ctx.userId, input.projectId);

      if (!UPLOAD_STATES.includes(project.status)) {
        throw new Error('No puedes subir archivos en el estado actual del proyecto.');
      }

      // Validar MIME en servidor (client-side es solo UX)
      const ext = EXTENSION_BY_MIME[input.mimeType];
      if (!ALLOWED_MIMES.includes(input.mimeType) || !ext) {
        throw new Error('Tipo de archivo no permitido.');
      }

      if (input.fileSize > MAX_FILE_SIZE) {
        throw new Error('El archivo supera el tamaño máximo permitido (50MB).');
      }

      // Un material ya aprobado no se puede reemplazar desde el portal.
      const [existingAsset] = await db
        .select({ status: projectAssets.status })
        .from(projectAssets)
        .where(
          and(
            eq(projectAssets.projectId, input.projectId),
            eq(projectAssets.assetKey, input.assetKey),
            eq(projectAssets.fileIndex, input.fileIndex),
          ),
        )
        .limit(1);

      if (existingAsset?.status === 'approved') {
        throw new Error('Este material ya fue aprobado y no se puede reemplazar.');
      }

      // Generar R2 key con UUID (nunca usar nombre del cliente)
      const uuid = randomUUID();
      const r2Key = `projects/${input.projectId}/assets/${input.assetKey}/${uuid}.${ext}`;

      // Crear registro pending en DB
      const [asset] = await db
        .insert(projectAssets)
        .values({
          projectId: input.projectId,
          assetKey: input.assetKey,
          mimeType: input.mimeType,
          fileSizeBytes: input.fileSize,
          r2Key,
          status: 'pending',
          fileIndex: input.fileIndex,
        })
        .onConflictDoUpdate({
          target: [projectAssets.projectId, projectAssets.assetKey, projectAssets.fileIndex],
          set: {
            mimeType: input.mimeType,
            fileSizeBytes: input.fileSize,
            r2Key,
            status: 'pending' as const,
            updatedAt: new Date(),
          },
        })
        .returning({ id: projectAssets.id });

      const uploadUrl = await generateR2PresignedPutUrl(r2Key, input.mimeType);

      return { uploadUrl, r2Key, assetId: asset.id };
    }),

  /**
   * Confirma que el upload a R2 fue exitoso y marca el asset como 'uploaded'.
   * Verifica ownership real del asset → proyecto → cliente (anti-IDOR, sin "primer proyecto").
   */
  confirmUpload: protectedProcedure
    .input(
      z.object({
        assetId: z.string().uuid(),
        r2Key: z.string(),
        originalName: z.string().max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [client] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.clerkUserId, ctx.userId))
        .limit(1);

      if (!client) throw new Error('No autorizado.');

      const [asset] = await db
        .select({
          projectId: projectAssets.projectId,
          r2Key: projectAssets.r2Key,
          status: projectAssets.status,
        })
        .from(projectAssets)
        .where(eq(projectAssets.id, input.assetId))
        .limit(1);

      if (!asset) throw new Error('No tienes permiso sobre este asset.');

      // Verificar que el proyecto del asset pertenece al cliente autenticado (anti-IDOR)
      const [project] = await db
        .select({ id: projects.id, status: projects.status })
        .from(projects)
        .where(and(eq(projects.id, asset.projectId), eq(projects.clientId, client.id)))
        .limit(1);

      if (!project) throw new Error('No tienes permiso sobre este asset.');

      if (!UPLOAD_STATES.includes(project.status)) {
        throw new Error('No puedes confirmar archivos en el estado actual del proyecto.');
      }

      if (asset.status === 'approved') {
        throw new Error('Este material ya fue aprobado y no se puede reemplazar.');
      }

      if (!asset.r2Key || asset.r2Key !== input.r2Key) {
        throw new Error('No se pudo confirmar este archivo.');
      }

      // El objeto debe existir en R2 y respetar el tamaño máximo: la URL firmada
      // no limita el tamaño, así que se comprueba aquí y se elimina si excede.
      const head = await r2Client
        .send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: asset.r2Key }))
        .catch(() => null);

      if (!head) {
        throw new Error('El archivo no se subió correctamente. Intenta de nuevo.');
      }
      if ((head.ContentLength ?? 0) > MAX_FILE_SIZE) {
        await r2Client
          .send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: asset.r2Key }))
          .catch(() => undefined);
        throw new Error('El archivo supera el tamaño máximo permitido (50MB).');
      }

      // Sanitizar nombre original (solo para display, nunca para paths)
      const safeName = input.originalName.replace(/[^a-zA-Z0-9.\-_ ]/g, '_').slice(0, 100);

      const [updated] = await db
        .update(projectAssets)
        .set({
          status: 'uploaded' as const,
          originalName: safeName,
          uploadedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(projectAssets.id, input.assetId))
        .returning();

      return { asset: updated };
    }),

  /**
   * Guarda el valor de texto/URL para assets de tipo text/textarea/url.
   */
  saveTextValue: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        assetKey: assetKeySchema,
        textValue: z.string().trim().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { project } = await requireClientProjectForAssets(ctx.userId, input.projectId);

      if (!UPLOAD_STATES.includes(project.status)) {
        throw new Error('No puedes guardar en el estado actual del proyecto.');
      }

      const [asset] = await db
        .insert(projectAssets)
        .values({
          projectId: input.projectId,
          assetKey: input.assetKey,
          textValue: input.textValue,
          status: 'uploaded' as const,
          fileIndex: 0,
          uploadedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [projectAssets.projectId, projectAssets.assetKey, projectAssets.fileIndex],
          set: {
            textValue: input.textValue,
            status: 'uploaded' as const,
            uploadedAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();

      return { asset };
    }),

  /**
   * El cliente envía todos sus assets para revisión del admin.
   * Permite transición desde AWAITING_ASSETS o ASSETS_INCOMPLETE (F2).
   * Valida server-side que todos los requeridos están completos (F6).
   */
  submitForReview: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { project } = await requireClientProjectForAssets(ctx.userId, input.projectId);

      if (project.status !== 'AWAITING_ASSETS' && project.status !== 'ASSETS_INCOMPLETE') {
        throw new Error('El proyecto no está en estado correcto para enviar assets.');
      }

      // Leer assets actuales del proyecto para validación server-side
      const assets = await db
        .select({ assetKey: projectAssets.assetKey, status: projectAssets.status })
        .from(projectAssets)
        .where(eq(projectAssets.projectId, input.projectId));

      // Resolver plan de requisitos según tipo real de proyecto (Portfolio → BASIC, LEGACY → BASIC)
      const projectType = deriveProjectType(project.plan, project.portfolioFlag);
      const resolvedPlan = resolveAssetRequirementPlan(project.plan, projectType);

      // Validar server-side con la misma lógica que el cliente (no confiar solo en UI)
      if (!canSubmitForReview(resolvedPlan, assets)) {
        throw new Error('Completa todos los materiales requeridos antes de enviar.');
      }

      const [updated] = await db
        .update(projects)
        .set({ status: 'ASSETS_SUBMITTED' as const, updatedAt: new Date() })
        .where(eq(projects.id, input.projectId))
        .returning({ id: projects.id, status: projects.status });

      if (!updated) throw new Error('No se pudo actualizar el estado del proyecto.');

      // Disparar evento Inngest: on-assets-submitted → E06 + E07 + transición ASSETS_UNDER_REVIEW
      await inngest.send({ name: 'waas/assets.submitted', data: { projectId: updated.id } });

      return { status: updated.status };
    }),
});

async function generateR2PresignedPutUrl(r2Key: string, mimeType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: r2Key,
    ContentType: mimeType,
  });
  return getSignedUrl(r2Client, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
}
