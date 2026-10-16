// ============================================================
// Intérprete de Solicitudes de Cambio — Groq / Llama 3.3 70B
// Adaptado desde interpretIntakeWithGroq — schema diferente.
//
// Contrato:
// - NUNCA escribe en BD. Solo interpreta y sugiere.
// - NUNCA acepta precio, descuento, inclusión, fecha ni decisión comercial desde Groq.
// - El motor determinista siempre valida y aplica los límites del catálogo.
// - Si Groq falla → fallback vacío; el flujo continúa con catálogo manual.
// ============================================================

import { z } from 'zod';

// ─── Tipos públicos ───────────────────────────────────────

export interface CatalogHint {
  code: string;
  publicName: string;
  publicDescription: string;
}

export interface ChangeInterpretationInput {
  naturalText: string;            // 20-2000 chars
  projectContext: {
    productionUrl: string | null;
    plan: string;                 // 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY'
  };
  availableCatalogItems: CatalogHint[]; // solo nombres y descripciones públicas
}

export interface CatalogSuggestion {
  catalogCode: string;
  requestKind: 'change' | 'correction' | 'expansion' | 'maintenance';
  quantity: number;
  clientSummary: string;
  confidence: number;             // 0–1
  needsClarification: boolean;
  clarificationQuestion?: string;
}

export interface ChangeInterpretationResult {
  suggestions: CatalogSuggestion[];
  overallSummary: string;
  source: 'groq' | 'fallback';
}

// ─── Zod schema para validar salida de Groq ──────────────

const catalogSuggestionSchema = z.object({
  catalogCode: z.string().min(1).max(50),
  requestKind: z.enum(['change', 'correction', 'expansion', 'maintenance']),
  quantity: z.number().int().min(1).max(50),
  clientSummary: z.string().min(1).max(300),
  confidence: z.number().min(0).max(1),
  needsClarification: z.boolean(),
  clarificationQuestion: z.string().max(300).optional(),
});

const groqOutputSchema = z.object({
  suggestions: z.array(catalogSuggestionSchema).max(8),
  overallSummary: z.string().min(1).max(500),
});

// ─── Fallback vacío ───────────────────────────────────────

function buildFallback(): ChangeInterpretationResult {
  return {
    suggestions: [],
    overallSummary: '',
    source: 'fallback',
  };
}

// ─── Llamada a Groq ───────────────────────────────────────

async function callGroq(
  input: ChangeInterpretationInput,
  apiKey: string,
): Promise<ChangeInterpretationResult | null> {
  // Catálogo limitado a nombres/descripciones públicos — sin IDs internos ni precios
  const catalogLines = input.availableCatalogItems
    .slice(0, 40) // límite razonable de contexto
    .map((i) => `- ${i.code}: ${i.publicName} — ${i.publicDescription}`)
    .join('\n');

  const systemPrompt = `Eres un asistente de interpretación de solicitudes para QUIRICO STUDIOS, una agencia de sitios web.
Tu tarea es analizar una solicitud de cambio de un cliente en lenguaje natural y sugerir los elementos del catálogo que mejor la describen.

REGLAS ABSOLUTAS:
- NO determines precios, costos ni tarifas.
- NO determines si algo está incluido o requiere pago.
- NO inventes códigos de catálogo — solo usa los de la lista proporcionada.
- NO asumas fechas de entrega ni SLA.
- clientSummary debe ser en español natural para que el cliente lo lea.
- Si el texto es ambiguo, marca needsClarification: true.
- confidence: 0.0 = muy incierto, 1.0 = muy seguro.
- Responde SOLO con JSON válido, sin texto adicional.

Catálogo disponible:
${catalogLines}`;

  const userMessage = `Solicitud del cliente:
"${input.naturalText.trim()}"

Plan del cliente: ${input.projectContext.plan}
Sitio: ${input.projectContext.productionUrl ?? 'No disponible'}

Sugiere los cambios más relevantes del catálogo.`;

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
      max_tokens: 1200,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Groq HTTP ${response.status}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = json.choices?.[0]?.message?.content;
  if (!content) return null;

  const parsed: unknown = JSON.parse(content);
  const validated = groqOutputSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Groq output schema inválido: ${validated.error.message}`);
  }

  const data = validated.data;

  // Filtrar códigos que no existan en el catálogo disponible; mapear explícito para tipado seguro
  const validCodes = new Set(input.availableCatalogItems.map((i) => i.code));
  const filteredSuggestions: CatalogSuggestion[] = data.suggestions
    .filter((s) => validCodes.has(s.catalogCode))
    .map((s) => ({
      catalogCode: s.catalogCode,
      requestKind: s.requestKind,
      quantity: s.quantity,
      clientSummary: s.clientSummary,
      confidence: s.confidence,
      needsClarification: s.needsClarification,
      clarificationQuestion: s.clarificationQuestion,
    }));

  return {
    suggestions: filteredSuggestions,
    overallSummary: data.overallSummary,
    source: 'groq',
  };
}

// ─── Función principal ────────────────────────────────────

/**
 * Interpreta una solicitud de cambio en lenguaje natural.
 * NUNCA escribe en base de datos. Solo produce sugerencias editables.
 *
 * Umbrales de confianza:
 * - >= 0.75: sugerencia editable directamente
 * - 0.45 - 0.74: mostrar con confirmación explícita
 * - < 0.45: no seleccionar automáticamente; orientar al catálogo manual
 */
export async function interpretChangeRequest(
  input: ChangeInterpretationInput,
): Promise<ChangeInterpretationResult> {
  // Validación de entrada
  const cleanText = input.naturalText.trim();
  if (cleanText.length < 20 || cleanText.length > 2000) {
    return buildFallback();
  }

  if (input.availableCatalogItems.length === 0) {
    return buildFallback();
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    // Groq no configurado — catálogo manual disponible
    return buildFallback();
  }

  try {
    const result = await callGroq(input, apiKey);
    if (result && result.suggestions.length > 0) {
      return result;
    }
    return buildFallback();
  } catch {
    // Cualquier error de Groq (timeout, JSON inválido, red) → fallback silencioso
    return buildFallback();
  }
}

/** Umbrales de confianza para la UI */
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.75,   // sugerencia editable directamente
  MEDIUM: 0.45, // mostrar con confirmación explícita
} as const;
