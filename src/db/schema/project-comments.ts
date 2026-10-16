// ============================================================
// Drizzle ORM Schema — Comentarios de Proyectos WaaS
// Propósito: Comunicación estructurada el admin ↔ cliente
// sobre assets específicos o el proyecto en general
// ============================================================

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

import { projects } from './projects';
import { assetKeyEnum } from './project-assets';

// ─── Enum ─────────────────────────────────────────────────
export const commentVisibilityEnum = pgEnum('comment_visibility', [
  'internal', // Solo el admin — nunca se muestra al cliente
  'client',   // Visible en el portal del cliente
]);

// ─── Tabla de comentarios ─────────────────────────────────
export const projectComments = pgTable('project_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),

  // Asset relacionado (null = comentario general del proyecto)
  assetKey: assetKeyEnum('asset_key'),

  // Autor
  authorId: text('author_id').notNull(),    // clerkUserId
  authorType: text('author_type').notNull(), // 'admin' | 'system'

  visibility: commentVisibilityEnum('visibility').notNull(),
  body: text('body').notNull(),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ProjectComment = typeof projectComments.$inferSelect;
export type NewProjectComment = typeof projectComments.$inferInsert;
