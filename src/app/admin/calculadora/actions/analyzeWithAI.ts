'use server';
// ============================================================
// Server Action — Análisis de Brief del Cliente
//
// Arquitectura híbrida:
//   1. Motor DETERMINÍSTICO → siempre corre, siempre produce resultado
//   2. Groq (Llama 3.3 70B) → OPCIONAL, si GROQ_API_KEY está configurada
//      Si Groq falla → se usa el resultado determinístico sin error visible
//
// La calculadora NUNCA depende de una API externa para funcionar.
// el catálogo del prompt viene de DB-first vía getCatalogAISummaryAction.
// ============================================================

import { runDeterministicAnalysis } from '@/lib/calculadora/component-rules';
import {
  getAiCatalogSummary,
  getAvailableComponentIds,
  getCalculatorCatalogComponents,
} from '@/lib/calculadora/catalog-components';
import { getCatalogAISummaryAction } from './getCatalogBreakdown';
import type { ClientContextInput, AIAnalysisResult } from '@/lib/calculadora/types';
import type { SubscriptionPlan } from '@/lib/catalog/types';
import { isAdmin, UNAUTHORIZED_MESSAGE } from '@/lib/admin/auth';

const idToName = new Map<string, string>(
  getCalculatorCatalogComponents().map((component) => [component.id, component.name])
);

function humanizeMessage(msg: string, idToName: Map<string, string>): string {
  let result = msg;
  for (const [id, name] of idToName) {
    // Reemplazar el ID técnico por el nombre legible (case-insensitive, word boundary)
    result = result.replace(new RegExp(`\\b${id}\\b`, 'gi'), name);
  }
  return result;
}

export type AIAnalysisActionResult =
  | { success: true; data: AIAnalysisResult; source: 'deterministic' | 'groq' }
  | { success: false; error: string };

// ─── Server Action principal ──────────────────────────────
export async function analyzeClientBriefAction(
  clientInput: ClientContextInput
): Promise<AIAnalysisActionResult> {
  if (!(await isAdmin())) return { success: false, error: UNAUTHORIZED_MESSAGE };

  // Paso 1: Motor determinístico (siempre)
  const deterministicResult = runDeterministicAnalysis(clientInput);

  // obtener resumen del catálogo vivo para la IA y para merge validation
  const catalogPlan =
    clientInput.projectType === 'subscription' && clientInput.subscriptionPlan
      ? (clientInput.subscriptionPlan.toUpperCase() as SubscriptionPlan)
      : 'BUSINESS'; // catálogo más completo para LEGACY

  const catalogSummaryResult = await getCatalogAISummaryAction(catalogPlan).catch(() => null);

  // Fix 1: Filtrar sugerencias determinísticas contra validCodes del catálogo vivo.
  // Si un código fue ocultado/desactivado desde consola admin, no llega a la UI ni a Groq.
  const validCodesSet = catalogSummaryResult?.success
    ? new Set(catalogSummaryResult.validCodes)
    : null; // null = DB no disponible, no filtrar (fallback seed)

  if (validCodesSet) {
    deterministicResult.suggestedComponents = deterministicResult.suggestedComponents.filter(
      (c) => validCodesSet.has(c.componentId)
    );
  }

  // Fix 2: Construir idToName desde el catálogo vivo para humanizar flags con nombres actuales.
  // El summary tiene líneas como: `"C01": Copywriting ($X)` o `"B05": ... [INCLUIDO]`
  // Parseamos para extraer code → name.
  const activeIdToName: Map<string, string> = new Map();
  if (catalogSummaryResult?.success) {
    for (const line of catalogSummaryResult.summary.split('\n')) {
      const match = line.match(/^"([A-Z][A-Z0-9]*\d{2}[A-Z]?\d*)": (.+?)(?:\s*[\[\(]|$)/);
      if (match) activeIdToName.set(match[1], match[2].trim());
    }
  }
  // Fallback al mapa de seed si DB no respondió
  const nameMap = activeIdToName.size > 0 ? activeIdToName : idToName;

  // Paso 2: Groq (opcional) — enriquece si hay API key configurada
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && catalogSummaryResult?.success) {
    try {
      const enriched = await enrichWithGroq(
        clientInput,
        deterministicResult,
        groqKey,
        catalogSummaryResult.summary
      );
      if (enriched) {
        return {
          success: true,
          data: mergeResults(deterministicResult, enriched, new Set(catalogSummaryResult.validCodes), nameMap),
          source: 'groq',
        };
      }
    } catch {
      // Groq falló → silencioso, usamos el determinístico
    }
  } else if (groqKey) {
    // DB no disponible — Groq con catálogo seed como fallback
    try {
      const fallbackSummary = getAiCatalogSummary();
      const fallbackCodes = getAvailableComponentIds();
      const enriched = await enrichWithGroq(
        clientInput,
        deterministicResult,
        groqKey,
        fallbackSummary
      );
      if (enriched) {
        return {
          success: true,
          data: mergeResults(deterministicResult, enriched, new Set(fallbackCodes), nameMap),
          source: 'groq',
        };
      }
    } catch {
      // silencioso
    }
  }

  // Humanizar flags del resultado determinístico también
  if (deterministicResult.detectedFlags) {
    deterministicResult.detectedFlags = deterministicResult.detectedFlags.map(
      (f) => ({ ...f, message: humanizeMessage(f.message, nameMap) })
    );
  }

  return { success: true, data: deterministicResult, source: 'deterministic' };
}

// ─── Llamada a Groq vía fetch nativo (OpenAI-compatible) ─
async function enrichWithGroq(
  input: ClientContextInput,
  base: AIAnalysisResult,
  apiKey: string,
  catalogSummary: string
): Promise<Partial<AIAnalysisResult> | null> {

  const needsPlanRecommendation =
    input.projectType === 'subscription' && !input.subscriptionPlan;

  const planRecommendationSection = needsPlanRecommendation
    ? `

RECOMENDACIÓN DE PLAN: Este es un proyecto de suscripción sin plan seleccionado.
Determina el plan más adecuado según los requerimientos del proyecto e incluye "suggestedPlan" en tu respuesta:
- "basic" ($49/mes): Sitio informativo, contacto simple, sin citas/e-commerce/membresías
- "pro" ($89/mes): Necesita citas/agenda o catálogo de productos/menú
- "business" ($139/mes): Necesita área de miembros, checkout/e-commerce, o integraciones complejas`
    : '';

  const suggestedPlanSchema = needsPlanRecommendation
    ? `\n  "suggestedPlan": "basic|pro|business",`
    : '';

  const systemPrompt = `Eres el asistente interno de cotizaciones de WaaS (Website as a Service) para negocios en República Dominicana.
Tu función es MEJORAR y ENRIQUECER una propuesta ya generada automáticamente.

IDs de componentes disponibles (solo usa estos exactos):
${catalogSummary}

IMPORTANTE: En los "detectedFlags.message", usa siempre el nombre legible del componente en español natural. Nunca uses el ID técnico (ej: "whatsapp_button"). Usa el nombre del catálogo (ej: "Botón de WhatsApp").${planRecommendationSection}

Responde SOLO con JSON válido, sin texto adicional:
{${suggestedPlanSchema}
  "suggestedComponents": [{"componentId": "id_exacto", "reason": "máx 80 chars", "confidence": "high|medium|low"}],
  "executiveSummary": "párrafo 2-3 oraciones en español, natural y persuasivo, para incluir en propuesta",
  "detectedFlags": [{"type": "warning|ok|info", "message": "máx 80 chars"}],
  "complexityScore": número_1_al_10
}`;

  const userMessage = buildGroqUserMessage(input, base);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
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
    signal: AbortSignal.timeout(10000), // 10s timeout
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

  const parsed = JSON.parse(content) as Partial<AIAnalysisResult>;
  return parsed;
}

// ─── Merge: determinístico base + enriquecimiento de Groq ─
function mergeResults(
  base: AIAnalysisResult,
  groq: Partial<AIAnalysisResult>,
  validIds: Set<string>,
  nameMap: Map<string, string>
): AIAnalysisResult {
  // Merge de componentes: base siempre, Groq puede agregar nuevos
  const baseIds = new Set(base.suggestedComponents.map((c) => c.componentId));
  const extraComponents = (groq.suggestedComponents ?? []).filter(
    (c) => validIds.has(c.componentId) && !baseIds.has(c.componentId)
  );

  // Groq mejora el summary (más natural) — usar si no está vacío
  const executiveSummary = groq.executiveSummary?.trim()
    ? groq.executiveSummary.trim()
    : base.executiveSummary;

  // Flags: preferir los de Groq si los tiene, sino usar los determinísticos
  // Aplicar humanizeMessage para reemplazar IDs técnicos por nombres legibles
  const detectedFlags = (groq.detectedFlags?.length
    ? groq.detectedFlags
    : base.detectedFlags
  )?.map((f) => ({ ...f, message: humanizeMessage(f.message, nameMap) }));

  // Score: usar Groq si difiere en ≤ 2 puntos del base, sino mantener base
  const groqScore = groq.complexityScore;
  const complexityScore =
    typeof groqScore === 'number' && Math.abs(groqScore - base.complexityScore) <= 2
      ? groqScore
      : base.complexityScore;

  // suggestedPlan: usar el de Groq si es un valor válido
  const validPlans = new Set(['basic', 'pro', 'business']);
  const suggestedPlan = (groq.suggestedPlan && validPlans.has(groq.suggestedPlan))
    ? groq.suggestedPlan
    : base.suggestedPlan;

  return {
    ...base,
    suggestedComponents: [...base.suggestedComponents, ...extraComponents],
    executiveSummary,
    detectedFlags,
    complexityScore,
    suggestedPlan,
  };
}

// ─── Construir mensaje de usuario para Groq ───────────────
function buildGroqUserMessage(
  input: ClientContextInput,
  base: AIAnalysisResult
): string {
  const features: string[] = [];
  if (input.needsBooking)    features.push('Citas/Agenda online');
  if (input.needsCatalog)    features.push('Catálogo de productos');
  if (input.needsCheckout)   features.push('Checkout / venta directa');
  if (input.needsBlog)       features.push('Blog o noticias');
  if (input.needsMembership) features.push('Área de miembros');

  const baseComponents = base.suggestedComponents
    .map((c) => `- ${c.componentId}: ${c.reason}`)
    .join('\n');

  return `## Brief del Cliente
Negocio: ${input.businessName}
Niche: ${input.niche}
Tipo: ${input.projectType === 'legacy' ? 'LEGACY (pago único)' : `Suscripción ${input.subscriptionPlan?.toUpperCase() ?? ''}`}
Contenido: ${input.contentStatus}
Funcionalidades: ${features.length ? features.join(', ') : 'Solo sitio informativo'}
${input.freeformBrief.trim() ? `\nBrief libre: "${input.freeformBrief.trim()}"` : ''}
${input.domainTarget ? `Dominio objetivo: ${input.domainTarget}` : ''}

## Ya tenemos seleccionados automáticamente:
${baseComponents}

## Tu tarea:
1. Mejora el resumen ejecutivo (máx 3 oraciones, persuasivo, en español)
2. Agrega hasta 3 componentes adicionales que tengan sentido para este cliente (IDs exactos del catálogo)
3. Genera 3-4 flags detectados (riesgos, confirmaciones, observaciones)
4. Si el brief libre menciona datos concretos (número de empleados, sucursales, servicios específicos, detalles operativos), agrega hasta 2 flags adicionales de type "info" con prefijo "💡 Oportunidad:" citando el texto literal y el componente o acción recomendada. Solo si hay datos concretos — no inventes oportunidades genéricas.
5. Ajusta el complexityScore si es necesario`;
}
