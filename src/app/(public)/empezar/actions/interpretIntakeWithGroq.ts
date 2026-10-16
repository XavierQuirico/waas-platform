'use server';
// ============================================================
// Server Action — Interpretación de Brief con Groq (Wizard V2)
//
// Arquitectura híbrida:
//   1. Motor DETERMINÍSTICO → siempre corre primero, produce resultado base
//   2. Groq (Llama 3.3 70B) → OPCIONAL, enriquece si GROQ_API_KEY configurada
//      Si Groq falla por cualquier razón → se devuelve el resultado determinístico
//
// NUNCA expone credenciales al cliente. NUNCA lanza excepciones.
// NO determina precios ni planes definitivos — solo produce señales diagnósticas.
// ============================================================

import { z } from 'zod';
import { headers } from 'next/headers';
import type { GroqIntakeInterpretation, PrimaryGoal } from '@/lib/intake/types';
import { clientIpFromHeaders, createRateLimiter } from '@/lib/security/rate-limit';

// Cada llamada a Groq tiene costo: máximo 12 interpretaciones por IP y hora.
// Al excederlo no se falla: se devuelve el resultado determinístico.
const interpretationLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 12 });

// El input llega desde el navegador: se acota antes de armar el prompt.
const interpretationInputSchema = z.object({
  freeformBrief: z.string().max(2000),
  primaryProblems: z.array(z.string().max(60)).max(10),
  primaryGoals: z.array(z.string().max(60)).max(10),
  businessName: z.string().max(100),
  industry: z.string().max(50),
  hasExistingSite: z.boolean(),
  selectedPlanIntent: z.string().max(20).nullable().optional(),
});

// ─── Input ───────────────────────────────────────────────────
export interface IntakeInterpretationInput {
  freeformBrief: string;
  primaryProblems: string[];  // PrimaryProblem[] values
  primaryGoals: string[];     // PrimaryGoal[] values
  businessName: string;
  industry: string;
  hasExistingSite: boolean;
  selectedPlanIntent?: string | null;
}

// ─── Output ──────────────────────────────────────────────────
export type IntakeInterpretationResult =
  | { success: true; data: GroqIntakeInterpretation; source: 'groq' | 'fallback' }
  | { success: false; error: string };

// ─── Zod schema para validar respuesta de Groq ───────────────
const groqIntakeOutputSchema = z.object({
  inferredIndustry: z.string().optional(),
  detectedNeeds: z.array(z.string()),
  scopeRisks: z.array(z.string()),
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
  questionsForAdmin: z.array(z.string()),
  humanSummary: z.string(),
});

// ─── Traducciones de problemas primarios a español ───────────
const PROBLEM_TRANSLATIONS: Record<string, string> = {
  professional_presence: 'Necesita presencia profesional en línea',
  more_contacts: 'Quiere generar más contactos y prospectos',
  organize_services: 'Necesita organizar y mostrar sus servicios',
  reduce_manual_work: 'Quiere reducir trabajo manual y automatizar procesos',
  replace_existing_site: 'Quiere reemplazar su sitio web actual',
  launch_new_business: 'Está lanzando un nuevo negocio',
  other: 'Tiene otras necesidades específicas',
};

// ─── Traducciones de objetivos a español ─────────────────────
const GOAL_TRANSLATIONS: Record<string, string> = {
  contacts: 'Recibir consultas y contactos de clientes',
  services_brand: 'Mostrar servicios y fortalecer la marca',
  booking: 'Gestionar citas y reservas en línea',
  catalog: 'Mostrar catálogo de productos',
  orders_sales: 'Recibir pedidos y ventas',
  online_payments: 'Aceptar pagos en línea',
  content_news: 'Publicar contenido, blog o noticias',
  full_ownership: 'Tener propiedad total del sitio (sin mensualidad)',
};

// ─── Fallback determinístico ──────────────────────────────────
function buildDeterministicFallback(
  input: IntakeInterpretationInput
): GroqIntakeInterpretation {
  const goals = input.primaryGoals as PrimaryGoal[];
  const hasGoal = (goal: PrimaryGoal) => goals.includes(goal);

  const needsBooking = hasGoal('booking');
  const needsCatalog = hasGoal('catalog');
  const needsPayments = hasGoal('online_payments') || hasGoal('orders_sales');
  const needsContent = hasGoal('content_news');
  const suggestsLegacy = hasGoal('full_ownership');
  const suggestsBusiness = needsPayments || needsCatalog;
  const suggestsPro = needsBooking && !suggestsBusiness && !suggestsLegacy;

  const detectedNeeds: string[] = [];
  if (needsBooking) detectedNeeds.push('Sistema de citas y agenda en línea');
  if (needsCatalog) detectedNeeds.push('Catálogo de productos o servicios');
  if (needsPayments) detectedNeeds.push('Pasarela de pagos en línea');
  if (needsContent) detectedNeeds.push('Blog o sección de noticias');
  if (hasGoal('contacts')) detectedNeeds.push('Formulario de contacto y captación de prospectos');
  if (hasGoal('services_brand')) detectedNeeds.push('Presentación de servicios y marca profesional');

  const goalLabels = goals
    .map((g) => GOAL_TRANSLATIONS[g] ?? g)
    .filter(Boolean);

  const humanSummary = goalLabels.length > 0
    ? `${input.businessName} busca ${goalLabels.slice(0, 2).join(' y ').toLowerCase()}. Analizaremos los detalles para preparar una propuesta personalizada.`
    : `Hemos recibido la información de ${input.businessName}. Nuestro equipo revisará los detalles para preparar una propuesta adecuada.`;

  return {
    inferredIndustry: input.industry || undefined,
    detectedNeeds,
    scopeRisks: [],
    planSignals: {
      suggestsLegacy,
      suggestsBusiness,
      suggestsPro,
    },
    needsCopy: false,
    needsVisuals: false,
    needsBooking,
    needsCatalog,
    needsPayments,
    needsContent,
    questionsForAdmin: [],
    humanSummary,
  };
}

// ─── Mensaje de usuario para Groq ────────────────────────────
function buildUserMessage(input: IntakeInterpretationInput): string {
  const problemsEs = input.primaryProblems
    .map((p) => PROBLEM_TRANSLATIONS[p] ?? p)
    .join(', ');

  const goalsEs = input.primaryGoals
    .map((g) => GOAL_TRANSLATIONS[g] ?? g)
    .join(', ');

  return `Negocio: ${input.businessName}
Industria: ${input.industry}
Tiene sitio existente: ${input.hasExistingSite ? 'Sí' : 'No'}
${input.selectedPlanIntent ? `Intención de plan (landing): ${input.selectedPlanIntent}` : ''}

Problemas principales: ${problemsEs || 'No especificados'}
Objetivos del negocio: ${goalsEs || 'No especificados'}

Brief libre del cliente:
"${input.freeformBrief.trim() || 'No proporcionó brief adicional.'}"`;
}

// ─── Llamada a Groq vía fetch nativo ─────────────────────────
async function callGroq(
  input: IntakeInterpretationInput,
  apiKey: string
): Promise<GroqIntakeInterpretation | null> {
  const systemPrompt = `Eres un asistente de diagnóstico para QUIRICO STUDIOS, una agencia WaaS (Website as a Service) en República Dominicana.
Tu trabajo es analizar la descripción de un negocio y extraer señales estructuradas para ayudar al equipo a preparar una propuesta.

IMPORTANTE:
- NO determines precios finales ni planes definitivos. Solo das señales.
- NO uses códigos internos como C01, CA02, WA01, BASIC, PRO, etc. en humanSummary.
- humanSummary debe ser en español natural, 2-3 oraciones, para que el cliente lo lea en el resumen final.
- detectedNeeds y scopeRisks deben ser en español natural.
- questionsForAdmin son preguntas que el equipo debería aclarar con el cliente (en español).
- Si el brief menciona: proyecto muy grande, múltiples sitios, desarrollo a medida, aplicación web compleja → suggestsLegacy: true.
- Si el brief menciona: reservas/citas/agenda → needsBooking: true.
- Si el brief menciona: catálogo, productos, tienda → needsCatalog: true.
- Si el brief menciona: pagos, checkout, venta → needsPayments: true.
- Si el brief menciona: blog, noticias, artículos, contenido → needsContent: true.
- Si el brief menciona que no tiene textos/copy para el sitio → needsCopy: true.
- Si el brief menciona que no tiene fotos, imágenes o material visual propio → needsVisuals: true.
- Responde SOLO con JSON válido, sin texto adicional.`;

  const userMessage = buildUserMessage(input);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 800,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'unknown');
    throw new Error(`Groq HTTP ${response.status}: ${errText}`);
  }

  const json = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = json.choices?.[0]?.message?.content;
  if (!content) return null;

  const parsed: unknown = JSON.parse(content);
  const validated = groqIntakeOutputSchema.safeParse(parsed);

  if (!validated.success) {
    throw new Error(`Groq output failed Zod validation: ${validated.error.message}`);
  }

  const d = validated.data;
  return {
    inferredIndustry: d.inferredIndustry,
    detectedNeeds: d.detectedNeeds,
    scopeRisks: d.scopeRisks,
    planSignals: {
      suggestsLegacy: d.planSignals.suggestsLegacy,
      suggestsBusiness: d.planSignals.suggestsBusiness,
      suggestsPro: d.planSignals.suggestsPro,
    },
    needsCopy: d.needsCopy,
    needsVisuals: d.needsVisuals,
    needsBooking: d.needsBooking,
    needsCatalog: d.needsCatalog,
    needsPayments: d.needsPayments,
    needsContent: d.needsContent,
    questionsForAdmin: d.questionsForAdmin,
    humanSummary: d.humanSummary,
  };
}

// ─── Server Action principal ──────────────────────────────────
export async function interpretIntakeWithGroq(
  rawInput: IntakeInterpretationInput
): Promise<IntakeInterpretationResult> {
  const parsed = interpretationInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: 'Los datos enviados no son válidos.' };
  }
  const input = parsed.data as IntakeInterpretationInput;

  // Paso 1: Motor determinístico — siempre corre, produce resultado base
  const fallback = buildDeterministicFallback(input);

  // Límite por IP: si se excede, no se llama a Groq pero el usuario sigue adelante.
  let ip = 'unknown';
  try {
    ip = clientIpFromHeaders(await headers());
  } catch {
    // Fuera de un request (p. ej. en pruebas) no hay IP que atribuir.
  }
  const withinLimit = ip === 'unknown' || interpretationLimiter.check(ip).allowed;

  // Paso 2: Groq — opcional, enriquece si la clave está configurada
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && withinLimit) {
    try {
      const groqData = await callGroq(input, groqKey);
      if (groqData) {
        return { success: true, data: groqData, source: 'groq' };
      }
    } catch {
      // Groq falló — silencioso, caemos al determinístico
    }
  }

  // Paso 3: Fallback determinístico (Groq no disponible o falló)
  return { success: true, data: fallback, source: 'fallback' };
}
