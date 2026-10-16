// ============================================================
// Generador de Resumen Ejecutivo por Plantilla
// Sin IA — output siempre disponible y predecible
// ============================================================

import type { ClientContextInput } from './types';

const NICHE_DESCRIPTIONS: Record<string, string> = {
  salud:          'el sector salud',
  legal:          'el sector legal',
  fitness:        'el sector fitness y bienestar',
  gastronomia:    'gastronomía y restauración',
  inmobiliaria:   'el sector inmobiliario',
  educacion:      'educación y capacitación',
  marca_personal: 'marca personal y consultoría',
  otro:           'su industria',
};

const COMPLEXITY_LABELS: Record<string, string> = {
  standard:      'profesional',
  premium:       'premium con animaciones y layouts elaborados',
  ultra_premium: 'ultra-premium con scroll storytelling y micro-interacciones',
};

/**
 * Genera un resumen ejecutivo interpolado basado en los datos del cliente.
 * No requiere IA. El resultado es editable en el Paso 4.
 */
export function generateExecutiveSummary(
  input: ClientContextInput,
  selectedComponentIds: string[]
): string {
  const nicheDesc = NICHE_DESCRIPTIONS[input.niche] ?? 'su industria';
  const complexityDesc = COMPLEXITY_LABELS[input.complexityLevel] ?? 'profesional';

  // Construir lista de funcionalidades activas para el resumen
  const features: string[] = [];
  if (input.needsBooking || selectedComponentIds.includes('I02')) {
    features.push('sistema de citas online');
  }
  if (input.needsCatalog || selectedComponentIds.includes('I04')) {
    features.push('catálogo de productos');
  }
  if (input.needsCheckout || selectedComponentIds.includes('EC01')) {
    features.push('checkout integrado');
  }
  if (input.needsBlog || selectedComponentIds.includes('C02A') || selectedComponentIds.includes('C02B')) {
    features.push('blog o sección de noticias');
  }
  if (input.needsMembership || selectedComponentIds.includes('EC05')) {
    features.push('portal de clientes con login');
  }
  if (selectedComponentIds.includes('WA01')) {
    features.push('botón de WhatsApp directo');
  }
  if (selectedComponentIds.includes('WA02')) {
    features.push('pedido por WhatsApp');
  }
  if (selectedComponentIds.includes('CM02')) {
    features.push('formulario de consulta multi-paso');
  }
  if (selectedComponentIds.includes('C03')) {
    features.push('SEO local optimizado');
  }

  // Armar la oración de funcionalidades
  let featuresText = '';
  if (features.length === 1) {
    featuresText = ` con ${features[0]}`;
  } else if (features.length === 2) {
    featuresText = ` con ${features[0]} y ${features[1]}`;
  } else if (features.length >= 3) {
    const last = features[features.length - 1];
    const rest = features.slice(0, -1).join(', ');
    featuresText = ` con ${rest}, y ${last}`;
  }

  // Oración de contenido
  const contentSentence =
    input.contentStatus === 'ready'
      ? 'El cliente cuenta con todos los materiales listos para comenzar.'
      : input.contentStatus === 'partial'
      ? 'Se coordinará la entrega del contenido faltante antes del inicio.'
      : 'Se incluye apoyo en copywriting dado que el cliente no tiene contenido disponible.';

  if (input.projectType === 'legacy') {
    const pageNote = input.numPages && input.numPages > 5
      ? ` de ${input.numPages} páginas`
      : '';
    return (
      `Propuesta para ${input.businessName}: sitio web ${complexityDesc}${pageNote}${featuresText}, ` +
      `orientado a ${nicheDesc}. ${contentSentence}`
    );
  } else {
    const planName = input.subscriptionPlan?.toUpperCase() ?? 'BASIC';
    return (
      `Propuesta de suscripción WaaS — Plan ${planName} para ${input.businessName}${featuresText}. ` +
      `Diseño ${complexityDesc} orientado a ${nicheDesc}. ${contentSentence} ` +
      `Actualizaciones mensuales y soporte incluidos en el plan.`
    );
  }
}
