// ============================================================
// Zod Schemas — WaaS Intake Wizard
// Validación type-safe para cada paso del wizard
// ============================================================

import { z } from 'zod';

// ─── Enums ────────────────────────────────────────────────

export const nicheValues = [
  'salud',
  'legal',
  'fitness',
  'gastronomia',
  'inmobiliaria',
  'educacion',
  'marca_personal',
  'otro',
] as const;

export const materialStatusValues = [
  'tiene_todo',
  'tiene_logo_no_fotos',
  'no_tiene_nada',
] as const;

// ─── Step 1: Contacto ─────────────────────────────────────
export const step1Schema = z.object({
  fullName: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  email: z
    .string()
    .email('Ingresa un email válido')
    .max(255, 'El email no puede superar 255 caracteres'),
  whatsapp: z
    .string()
    .min(7, 'El número de WhatsApp debe tener al menos 7 dígitos')
    .max(20, 'El número no puede superar 20 caracteres')
    .regex(/^[+\d\s\-()]+$/, 'Ingresa un número de teléfono válido (incluye código de país)'),
  businessName: z
    .string()
    .min(2, 'El nombre del negocio debe tener al menos 2 caracteres')
    .max(100, 'El nombre del negocio no puede superar 100 caracteres'),
});

// ─── Step 2: Contexto ─────────────────────────────────────
export const step2Schema = z.object({
  industry: z.enum(nicheValues, {
    errorMap: () => ({ message: 'Selecciona una industria' }),
  }),
  location: z
    .string()
    .min(2, 'Ingresa tu ciudad o país')
    .max(100, 'La ubicación no puede superar 100 caracteres'),
  currentUrl: z
    .string()
    .url('Ingresa una URL válida (ej: https://tuempresa.com)')
    .optional()
    .or(z.literal('')),
  materialStatus: z.enum(materialStatusValues, {
    errorMap: () => ({ message: 'Selecciona el estado de tus materiales' }),
  }),
  referenceUrls: z
    .string()
    .max(1000, 'Las referencias no pueden superar 1000 caracteres')
    .optional(),
});

// ─── Step 3: Funcionalidades ──────────────────────────────
export const step3Schema = z.object({
  features: z.object({
    needsBooking: z.boolean().default(false),
    needsCatalog: z.boolean().default(false),
    needsCheckout: z.boolean().default(false),
    needsBlog: z.boolean().default(false),
    wantsOwnership: z.boolean().default(false),
    needsCrmIntegration: z.boolean().default(false),
    needsMultiEmployeeCalendar: z.boolean().default(false),
  }),
  freeformBrief: z
    .string()
    .max(2000, 'El brief no puede superar 2000 caracteres')
    .optional(),
});

// ─── Schema completo del intake (para el servidor) ───────
export const intakeSubmitSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema);

export type Step1Data = z.infer<typeof step1Schema>;
export type Step2Data = z.infer<typeof step2Schema>;
export type Step3Data = z.infer<typeof step3Schema>;
export type IntakeSubmitData = z.infer<typeof intakeSubmitSchema>;

// ============================================================
// V2 Schemas — Wizard Comercial V2
// ============================================================

export const primaryProblemValues = [
  'professional_presence',
  'more_contacts',
  'organize_services',
  'reduce_manual_work',
  'replace_existing_site',
  'launch_new_business',
  'other',
] as const;

export const primaryGoalValues = [
  'contacts',
  'services_brand',
  'booking',
  'catalog',
  'orders_sales',
  'online_payments',
  'content_news',
  'full_ownership',
] as const;

export const brandIdentityStatusValues = [
  'has_logo_and_style',
  'has_logo_no_style',
  'no_identity',
] as const;

export const domainStatusValues = ['has_domain', 'no_domain', 'not_sure'] as const;
export const currentAccessStatusValues = ['has_access', 'no_access', 'not_sure'] as const;
export const copyStatusValues = ['ready', 'ideas_only', 'needs_help'] as const;
export const photosStatusValues = ['ready', 'needs_stock', 'needs_help'] as const;

// Step 1 V2: Contact (firstName + lastName separate)
export const step1SchemaV2 = z.object({
  firstName: z.string().min(1, 'Nombre requerido').max(50),
  lastName: z.string().min(1, 'Apellido requerido').max(50),
  email: z.string().email('Email inválido').max(255),
  whatsapp: z
    .string()
    .min(7, 'WhatsApp requerido')
    .max(20)
    .regex(/^[+\d\s\-()]+$/, 'Número inválido'),
  businessName: z.string().min(2, 'Nombre del negocio requerido').max(100),
  industry: z.enum(nicheValues, { errorMap: () => ({ message: 'Selecciona una industria' }) }),
});

// Step 2 V2: Business context + primary problems
export const step2SchemaV2 = z.object({
  whatYouOffer: z.string().min(3, 'Cuéntanos qué ofreces').max(500),
  hasExistingSite: z.boolean(),
  currentUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  primaryProblems: z
    .array(z.enum(primaryProblemValues))
    .min(1, 'Selecciona al menos una opción')
    .max(7),
  primaryProblemsOther: z.string().max(200).optional(),
});

// Step 3 V2: Primary goals (multiselect)
export const step3SchemaV2 = z.object({
  primaryGoals: z
    .array(z.enum(primaryGoalValues))
    .min(1, 'Selecciona al menos una opción')
    .max(8),
});

// Step 4 V2: Freeform brief (interpreted by Groq)
export const step4SchemaV2 = z.object({
  freeformBrief: z.string().min(20, 'Cuéntanos un poco más (mínimo 20 caracteres)').max(2000),
});

// Step 5 V2: Materials + preparation
export const step5SchemaV2 = z.object({
  brandIdentityStatus: z.enum(brandIdentityStatusValues, {
    errorMap: () => ({ message: 'Selecciona una opción' }),
  }),
  copyStatus: z.enum(copyStatusValues, {
    errorMap: () => ({ message: 'Selecciona una opción' }),
  }),
  photosStatus: z.enum(photosStatusValues, {
    errorMap: () => ({ message: 'Selecciona una opción' }),
  }),
  domainStatus: z.enum(domainStatusValues, {
    errorMap: () => ({ message: 'Selecciona una opción' }),
  }),
  currentAccessStatus: z.enum(currentAccessStatusValues).optional(),
});

// Complete V2 submit schema (server-side validation)
export const intakeSubmitSchemaV2 = step1SchemaV2
  .merge(step2SchemaV2)
  .merge(step3SchemaV2)
  .merge(step4SchemaV2)
  .merge(step5SchemaV2)
  .extend({
    selectedPlanIntent: z.enum(['BASIC', 'PRO', 'BUSINESS', 'LEGACY']).nullable().optional(),
    clerkUserId: z.string().optional(),
    termsAccepted: z.literal(true),
    termsVersion: z.string().default('1.0'),
  });

export type Step1DataV2 = z.infer<typeof step1SchemaV2>;
export type Step2DataV2 = z.infer<typeof step2SchemaV2>;
export type Step3DataV2 = z.infer<typeof step3SchemaV2>;
export type Step4DataV2 = z.infer<typeof step4SchemaV2>;
export type Step5DataV2 = z.infer<typeof step5SchemaV2>;
export type IntakeSubmitDataV2 = z.infer<typeof intakeSubmitSchemaV2>;

// Security contract: checkClerkUserHasClient accepts NO client-supplied ID.
// The procedure is protectedProcedure — server uses ctx.userId exclusively.
// Exported to enable regression tests that verify no clerkUserId field exists.
export const checkClerkUserHasClientInputSchema = z.object({});
