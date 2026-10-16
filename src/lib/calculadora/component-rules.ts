// ============================================================
// Motor Deterministico de Componentes WaaS
// Fuente activa: catalogo comercial.
// ============================================================

import type { ClientContextInput, AIAnalysisResult, ComplexityLevel } from './types';
import { generateExecutiveSummary } from './summary-template';
import { ENTRY_POINT_TABLE } from './catalog-components';

type SuggestedComponent = AIAnalysisResult['suggestedComponents'][number];
type DetectedFlag = NonNullable<AIAnalysisResult['detectedFlags']>[number];

export function runDeterministicAnalysis(input: ClientContextInput): AIAnalysisResult {
  const addedIds = new Set<string>();
  const components: SuggestedComponent[] = [];

  function add(
    id: string,
    reason: string,
    confidence: SuggestedComponent['confidence'] = 'high'
  ) {
    if (!addedIds.has(id)) {
      components.push({ componentId: id, reason, confidence });
      addedIds.add(id);
    }
  }

  add('B05', 'Formulario de contacto incluido en base');

  if (input.needsBooking) {
    add('I02', 'Sistema de citas online solicitado');
  }

  if (input.needsCatalog) {
    add('I04', 'Catalogo solicitado para carga o importacion inicial');
  }

  if (input.needsCheckout) {
    add('EC01', 'Pasarela de pago requerida para checkout — módulo Legacy Commerce');
    add('EC04', 'Gestión de pedidos como parte del módulo Legacy Commerce');
  }

  if (input.needsBlog) {
    add('C02A', 'Blog o seccion de noticias solicitada');
  }

  if (input.needsMembership) {
    add('EC05', 'Portal de clientes o area de miembros solicitada');
  }

  switch (input.niche) {
    case 'salud':
      add('WA01', 'WhatsApp directo esencial para clinicas y consultorios en RD');
      add('C03', 'SEO on-page para mejor visibilidad en Google', 'medium');
      break;
    case 'gastronomia':
      add('WA02', 'Pedidos y consultas directas por WhatsApp con catalogo');
      add('I04', 'Menu digital o catalogo inicial');
      break;
    case 'inmobiliaria':
      add('CM02', 'Formulario multi-paso para consultas de propiedades');
      add('WA01', 'Contacto directo con el agente inmobiliario');
      break;
    case 'legal':
      add('CM02', 'Formulario de consulta legal detallado');
      add('C03', 'SEO on-page para abogados y firma legal', 'medium');
      break;
    case 'fitness':
      if (!input.needsBooking) {
        add('I02', 'Clases y sesiones requieren sistema de reservas');
      }
      add('WA01', 'Consultas de membresia directas por WhatsApp');
      break;
    case 'educacion':
      if (!input.needsBlog) add('C02A', 'Blog educativo para generar contenido de valor');
      if (!input.needsMembership) add('EC05', 'Portal para estudiantes o alumnos matriculados');
      break;
    case 'marca_personal':
      if (!input.needsBlog) add('C02A', 'Blog personal para posicionamiento de autoridad');
      add('WA01', 'Contacto directo con el profesional');
      break;
  }

  if (input.contentStatus === 'none') {
    add('C01', 'Cliente no tiene contenido - se necesita copywriting completo');
  }

  let featureCount = 0;
  if (input.needsBooking) featureCount++;
  if (input.needsCatalog) featureCount++;
  if (input.needsCheckout) featureCount++;
  if (input.needsBlog) featureCount++;
  if (input.needsMembership) featureCount++;
  if (input.contentStatus === 'none') featureCount++;

  const suggestedComplexity: ComplexityLevel = input.complexityLevel;
  const complexityBase =
    suggestedComplexity === 'ultra_premium' ? 7 :
    suggestedComplexity === 'premium' ? 4 : 2;
  const complexityScore = Math.min(10, complexityBase + featureCount);

  let projectFlag: AIAnalysisResult['projectFlag'] = 'standard';
  let enterpriseReason: string | undefined;
  if (input.contentStatus === 'none' || (input.needsCheckout && input.needsMembership)) {
    projectFlag = 'requires_review';
  }
  if (complexityScore >= 9) {
    projectFlag = 'enterprise';
    enterpriseReason = 'Proyecto con alta cantidad de modulos complejos - revisar alcance antes de enviar propuesta';
  }

  const detectedFlags: DetectedFlag[] = [];
  if (input.contentStatus === 'none') {
    detectedFlags.push({ type: 'warning', message: 'Sin contenido - se requiere copywriting completo antes de iniciar' });
  } else if (input.contentStatus === 'partial') {
    detectedFlags.push({ type: 'info', message: 'Contenido parcial - coordinar entrega de materiales antes del kick-off' });
  } else {
    detectedFlags.push({ type: 'ok', message: 'Contenido listo - proyecto puede comenzar de inmediato' });
  }

  if (input.needsCheckout) {
    detectedFlags.push({ type: 'warning', message: 'E-commerce/checkout - requiere proyecto Legacy Commerce (EC01/EC04). No es add-on SaaS.' });
  } else {
    detectedFlags.push({ type: 'ok', message: 'Sin e-commerce - no requiere pasarela de pago' });
  }

  if (input.needsBooking || (input.niche === 'fitness' && !input.needsBooking)) {
    detectedFlags.push({ type: 'info', message: 'Agenda online - definir horarios, capacidad de slots y politica de cancelacion' });
  }

  if (['salud', 'legal', 'gastronomia'].includes(input.niche)) {
    detectedFlags.push({ type: 'info', message: `Niche ${input.niche} - recomendar SEO local y Google Business Profile` });
  }

  let entryPointEstimate: string | undefined;
  if (input.projectType === 'legacy') {
    const baseEstimate = ENTRY_POINT_TABLE[0].estimate;
    const featureAddon = featureCount * 250;
    const multiplier =
      suggestedComplexity === 'ultra_premium' ? 1.5 :
      suggestedComplexity === 'premium' ? 1.3 : 1.0;
    const low = Math.ceil(((baseEstimate + featureAddon) * multiplier) / 100) * 100;
    const high = Math.ceil((low * 1.3) / 100) * 100;
    entryPointEstimate = `~$${low.toLocaleString('en-US')} - $${high.toLocaleString('en-US')} (orientativo)`;
  }

  const executiveSummary = generateExecutiveSummary(
    input,
    components.map((component) => component.componentId)
  );

  return {
    suggestedComponents: components,
    suggestedComplexity,
    complexityScore,
    projectFlag,
    enterpriseReason,
    executiveSummary,
    entryPointEstimate,
    detectedFlags,
  };
}
