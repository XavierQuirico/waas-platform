// ============================================================
// Drizzle ORM Schema — Clientes WaaS
// ============================================================

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

import { nicheEnum } from './quotes';

// ─── Enum: Estado de materiales (Módulo 1, Step 2 del wizard) ────
// Lógica de negocio: "no_tiene_nada" → sugerir Add-on C01 Copywriting
//                   "tiene_logo_no_fotos" → nota sobre banco de imágenes
export const materialStatusEnum = pgEnum('material_status', [
  'tiene_todo',            // "Tengo logo y fotos"
  'tiene_logo_no_fotos',   // "Tengo logo, no fotos"
  'no_tiene_nada',         // "No tengo nada"
]);

// ─── Tabla de clientes ────────────────────────────────────
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Auth (Clerk magic link) — NULL hasta que el cliente crea su cuenta
  // Se actualiza via webhook Clerk "user.created" al hacer match por email
  clerkUserId: text('clerk_user_id').unique(),

  // Contacto
  fullName: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  whatsapp: text('whatsapp'),

  // Negocio
  businessName: text('business_name').notNull(),
  industry: nicheEnum('industry').notNull(),
  location: text('location'),
  currentUrl: text('current_url'),

  // Estado de materiales al momento del intake
  materialStatus: materialStatusEnum('material_status'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
