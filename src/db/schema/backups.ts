// ============================================================
// Drizzle ORM Schema — Backups
// Registro de backups de sitios LIVE
// Inngest cron semanal alerta si >30 días sin backup
// ============================================================

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

import { projects } from './projects';

export const backupMethodEnum = pgEnum('backup_method', [
  'zip_manual',   // ZIP descargado manualmente
  'github_repo',  // Repositorio GitHub
  'r2_storage',   // Cloudflare R2
  'other',
]);

export const backups = pgTable('backups', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),

  method: backupMethodEnum('method').notNull(),

  // Notas adicionales (ej: URL del repo, ruta en R2)
  notes: text('notes'),

  // Fecha en que se realizó el backup (puede ser distinta a createdAt si se registra retroactivamente)
  backedUpAt: timestamp('backed_up_at', { withTimezone: true }).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Backup = typeof backups.$inferSelect;
export type NewBackup = typeof backups.$inferInsert;
