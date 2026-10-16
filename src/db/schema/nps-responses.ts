// ============================================================
// Drizzle ORM Schema — NPS Responses
// Encuestas NPS enviadas en día 7 y día 30 desde LIVE
// E16 (día 7), E17 (día 30) — disparadas por Inngest
// ============================================================

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';

import { projects } from './projects';
import { clients } from './clients';

export const npsTriggerEnum = pgEnum('nps_trigger', [
  'day_7',   // E16
  'day_30',  // E17
]);

export const npsResponses = pgTable('nps_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),

  // Cuándo se envió la encuesta (desde Inngest)
  trigger: npsTriggerEnum('trigger').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),

  // Respuesta del cliente (0-10)
  // NULL = email enviado pero cliente no respondió aún
  score: integer('score'),
  comment: text('comment'),
  respondedAt: timestamp('responded_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type NpsResponse = typeof npsResponses.$inferSelect;
export type NewNpsResponse = typeof npsResponses.$inferInsert;
