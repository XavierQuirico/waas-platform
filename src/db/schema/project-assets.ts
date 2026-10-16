// ============================================================
// Drizzle ORM Schema — Assets de Proyectos WaaS (Módulo 3)
// Upload: Cloudflare R2 (presigned PUT, cliente directo)
// ============================================================

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { projects } from './projects';

// ─── Enums ────────────────────────────────────────────────

// Claves de asset — alineadas con ASSET_REQUIREMENTS en src/lib/assets/asset-requirements.ts
export const assetKeyEnum = pgEnum('asset_key', [
  'logo',
  'photos',
  'brand_guide',
  'hex_colors',
  'copy_doc',
  'social_links',
  'brief',
  'special_instructions',
  'product_data',
]);

export const assetStatusEnum = pgEnum('asset_status', [
  'pending',       // No subido aún
  'uploaded',      // Subido por el cliente, esperando revisión del admin
  'under_review',  // El admin abrió la revisión (estado transitorio)
  'approved',      // El admin aprobó
  'rejected',      // El admin rechazó — rejectionComment obligatorio
]);

// ─── Tabla de assets ──────────────────────────────────────
export const projectAssets = pgTable(
  'project_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id),
    assetKey: assetKeyEnum('asset_key').notNull(),

    // Archivo en R2 (null para assets de tipo texto/URL)
    // Ruta: projects/{projectId}/assets/{assetKey}/{uuid}.{ext}
    r2Key: text('r2_key'),
    originalName: text('original_name'),    // Nombre sanitizado para mostrar (NUNCA usar para paths)
    mimeType: text('mime_type'),
    fileSizeBytes: integer('file_size_bytes'),

    // Assets de tipo texto (hex_colors, social_links, brief, special_instructions)
    // o URLs (copy_doc con Google Docs link, brand_guide con Canva link)
    textValue: text('text_value'),

    // Índice para assets multi-archivo (fotos): 0-based
    fileIndex: integer('file_index').notNull().default(0),

    // Estado del asset
    status: assetStatusEnum('status').notNull().default('pending'),

    // Revisión del admin
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: text('reviewed_by'),         // clerkUserId del admin
    rejectionComment: text('rejection_comment'), // obligatorio si status = 'rejected'

    // Timestamps
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // Único por proyecto + clave + índice (permite múltiples fotos con índices distintos)
    projectAssetIdx: uniqueIndex('project_asset_idx').on(
      table.projectId,
      table.assetKey,
      table.fileIndex
    ),
  })
);

export type ProjectAsset = typeof projectAssets.$inferSelect;
export type NewProjectAsset = typeof projectAssets.$inferInsert;
export type AssetKey = (typeof assetKeyEnum.enumValues)[number];
export type AssetStatus = (typeof assetStatusEnum.enumValues)[number];
