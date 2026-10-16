// ============================================================
// Drizzle ORM Schema — Días feriados República Dominicana
// Propósito: Fuente de verdad para el motor de SLA en horas
// hábiles (src/lib/sla/business-hours.ts). Un registro por día.
// ============================================================

import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  date,
} from 'drizzle-orm/pg-core';

// ─── Tabla de feriados RD ─────────────────────────────────
export const holidaysRd = pgTable('holidays_rd', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Fecha exacta — restricción UNIQUE evita duplicados
  date: date('date').notNull().unique(),
  name: text('name').notNull(),
  year: integer('year').notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type HolidayRd = typeof holidaysRd.$inferSelect;
export type NewHolidayRd = typeof holidaysRd.$inferInsert;
