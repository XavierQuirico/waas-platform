'use client';
// ============================================================
// Calculadora Interna WaaS — Página Principal del Wizard
// Layout: dos columnas (izquierda: wizard, derecha: panel contextual)
// ============================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ClientContextStep } from './components/ClientContextStep';
import { AIComponentSuggestion } from './components/AIComponentSuggestion';
import { AdjustmentsStep } from './components/AdjustmentsStep';
import { ProposalPreview } from './components/ProposalPreview';
import { analyzeClientBriefAction } from './actions/analyzeWithAI';
import { calculateQuoteAction, saveQuoteAction, updateQuoteStatusAction } from './actions/calculate';
import { getCatalogBreakdownAction } from './actions/getCatalogBreakdown';
import { getExchangeRate } from './actions/getExchangeRate';
import { renderProposalPlainText } from '@/lib/calculadora/proposal-template';
import { LEGACY_BASE_PRICE } from '@/lib/calculadora/formulas';
import type { Currency } from '@/lib/calculadora/currency';
import type {
  ClientContextInput,
  AIAnalysisResult,
  AdjustmentsInput,
  SelectedComponent,
  ProposalData,
  Niche,
  ComplexityLevel,
  SubscriptionPlan,
  CalculationResult,
} from '@/lib/calculadora/types';
import type { CalculatorCatalogResult } from '@/lib/catalog/types';

type WizardStep = 1 | 2 | 3 | 4;

// ─────────────────────────────────────────────────────────────
// MOCK PROFILES
// ─────────────────────────────────────────────────────────────

interface MockProfile {
  clientName: string;
  businessName: string;
  niche: Niche;
  domainTarget: string;
  projectType: 'legacy' | 'subscription';
  subscriptionPlan?: SubscriptionPlan;
  includeSetupFee?: boolean;
  numPages?: number;
  complexityLevel: ComplexityLevel;
  contentStatus: 'ready' | 'partial' | 'none';
  needsBooking: boolean;
  needsCatalog: boolean;
  needsCheckout: boolean;
  needsBlog: boolean;
  needsMembership: boolean;
  freeformBrief: string;
  inspirationLinks?: string;
}

const MOCK_PROFILES: MockProfile[] = [
  {
    clientName: 'María González',
    businessName: 'Clínica Dental Dra. González',
    niche: 'salud',
    domainTarget: 'clinicagonzalez.com.do',
    projectType: 'legacy',
    numPages: 7,
    complexityLevel: 'premium',
    contentStatus: 'partial',
    needsBooking: true,
    needsCatalog: false,
    needsCheckout: false,
    needsBlog: true,
    needsMembership: false,
    freeformBrief: 'Clínica dental en Santiago con 3 dentistas especializados. Necesita agenda online para citas, galería de casos clínicos antes/después, y blog de consejos de salud bucal. Recibe muchos pacientes por WhatsApp y quiere formalizar el proceso. Ya tiene logo e imágenes de la clínica.',
    inspirationLinks: 'https://clinicabavaro.com',
  },
  {
    clientName: 'Ramón Herrera',
    businessName: 'Bufete Herrera & Asociados',
    niche: 'legal',
    domainTarget: 'herreraasociados.com',
    projectType: 'legacy',
    numPages: 6,
    complexityLevel: 'standard',
    contentStatus: 'ready',
    needsBooking: false,
    needsCatalog: false,
    needsCheckout: false,
    needsBlog: false,
    needsMembership: false,
    freeformBrief: 'Firma de abogados en Santo Domingo especializada en derecho corporativo e inmigración. Necesita presencia profesional en web para captar clientes empresariales. El cliente ya tiene todo el contenido listo: textos, fotos y logo.',
    inspirationLinks: 'https://freshfields.com',
  },
  {
    clientName: 'Luisa Pérez',
    businessName: 'FitLife Studios',
    niche: 'fitness',
    domainTarget: 'fitliferd.com',
    projectType: 'subscription',
    subscriptionPlan: 'pro',
    includeSetupFee: true,
    complexityLevel: 'premium',
    contentStatus: 'partial',
    needsBooking: true,
    needsCatalog: false,
    needsCheckout: false,
    needsBlog: false,
    needsMembership: true,
    freeformBrief: 'Gimnasio boutique en Piantini, Santo Domingo. Clases de spinning, yoga y funcional. Necesita sistema de reservas de clases con slots por horario, área de miembros donde los alumnos vean su progreso y accedan a rutinas en PDF.',
    inspirationLinks: 'https://mindbody.io',
  },
  {
    clientName: 'Carlos Martínez',
    businessName: 'El Mangú Catering',
    niche: 'gastronomia',
    domainTarget: 'elmangucatering.com',
    projectType: 'legacy',
    numPages: 5,
    complexityLevel: 'standard',
    contentStatus: 'none',
    needsBooking: true,
    needsCatalog: true,
    needsCheckout: false,
    needsBlog: false,
    needsMembership: false,
    freeformBrief: 'Servicio de catering dominicano en SD y Santiago. El cliente no tiene nada: ni logo, ni fotos, ni textos. Necesitamos crear todo desde cero.',
  },
  {
    clientName: 'Andrea Santos',
    businessName: 'Bienes Raíces Santos',
    niche: 'inmobiliaria',
    domainTarget: 'bienesraicesso.com',
    projectType: 'legacy',
    numPages: 10,
    complexityLevel: 'premium',
    contentStatus: 'partial',
    needsBooking: false,
    needsCatalog: true,
    needsCheckout: false,
    needsBlog: true,
    needsMembership: false,
    freeformBrief: 'Agencia inmobiliaria con propiedades en Punta Cana, Santo Domingo y Santiago. Portfolio de más de 40 propiedades.',
    inspirationLinks: 'https://properati.com.do',
  },
  {
    clientName: 'Javier Rodríguez',
    businessName: 'Academia Digital RD',
    niche: 'educacion',
    domainTarget: 'academiadigitalrd.com',
    projectType: 'subscription',
    subscriptionPlan: 'business',
    includeSetupFee: true,
    complexityLevel: 'ultra_premium',
    contentStatus: 'partial',
    needsBooking: false,
    needsCatalog: true,
    needsCheckout: true,
    needsBlog: true,
    needsMembership: true,
    freeformBrief: 'Plataforma de cursos online de marketing digital y redes sociales. 12 cursos grabados, 3 instructores.',
    inspirationLinks: 'https://domestika.org, https://platzi.com',
  },
  {
    clientName: 'Paola Jiménez',
    businessName: 'Coach Paola Jiménez',
    niche: 'marca_personal',
    domainTarget: 'paolajimenez.com',
    projectType: 'legacy',
    numPages: 5,
    complexityLevel: 'ultra_premium',
    contentStatus: 'ready',
    needsBooking: true,
    needsCatalog: false,
    needsCheckout: false,
    needsBlog: true,
    needsMembership: false,
    freeformBrief: 'Coach de vida y liderazgo femenino. Referente en LinkedIn con 15k seguidores. Portfolio personal ultra-premium.',
    inspirationLinks: 'https://amy.app, https://louisehayhome.com',
  },
  {
    clientName: 'Miguel Taveras',
    businessName: 'Farmacia Taveras Express',
    niche: 'salud',
    domainTarget: 'farmaciataverascar.com',
    projectType: 'subscription',
    subscriptionPlan: 'basic',
    includeSetupFee: true,
    complexityLevel: 'standard',
    contentStatus: 'partial',
    needsBooking: false,
    needsCatalog: true,
    needsCheckout: false,
    needsBlog: false,
    needsMembership: false,
    freeformBrief: 'Cadena de 3 farmacias en Santiago. Catálogo de medicamentos más vendidos (no checkout, solo informativo).',
  },
  {
    clientName: 'Daniela Cruz',
    businessName: 'The Cake Studio by Daniela',
    niche: 'gastronomia',
    domainTarget: 'thecakestudiord.com',
    projectType: 'legacy',
    numPages: 4,
    complexityLevel: 'premium',
    contentStatus: 'partial',
    needsBooking: false,
    needsCatalog: true,
    needsCheckout: true,
    needsBlog: false,
    needsMembership: false,
    freeformBrief: 'Pastelería artesanal premium en SD. Especializada en tortas de boda y eventos.',
    inspirationLinks: 'https://instagram.com/example-studio',
  },
  {
    clientName: 'Roberto Suárez',
    businessName: 'Constructora Suárez & Hijos',
    niche: 'inmobiliaria',
    domainTarget: 'constructorasuarez.com.do',
    projectType: 'legacy',
    numPages: 8,
    complexityLevel: 'standard',
    contentStatus: 'none',
    needsBooking: false,
    needsCatalog: true,
    needsCheckout: false,
    needsBlog: false,
    needsMembership: false,
    freeformBrief: 'Empresa constructora con 20 años en el mercado. No tienen logo, ni fotos profesionales, ni textos.',
  },
  {
    clientName: 'Francesca Alvarado',
    businessName: 'Studio Frankie Photography',
    niche: 'marca_personal',
    domainTarget: 'studiofrankie.do',
    projectType: 'legacy',
    numPages: 5,
    complexityLevel: 'ultra_premium',
    contentStatus: 'ready',
    needsBooking: true,
    needsCatalog: true,
    needsCheckout: false,
    needsBlog: false,
    needsMembership: false,
    freeformBrief: 'Fotógrafa profesional de bodas y lifestyle en Punta Cana. Clientela internacional.',
    inspirationLinks: 'https://jose-villa.com, https://magnolia-rouge.com',
  },
  {
    clientName: 'Nelson Batista',
    businessName: 'Clínica Veterinaria Amigos',
    niche: 'salud',
    domainTarget: 'veterinarianamigos.com',
    projectType: 'subscription',
    subscriptionPlan: 'pro',
    includeSetupFee: true,
    complexityLevel: 'standard',
    contentStatus: 'partial',
    needsBooking: true,
    needsCatalog: false,
    needsCheckout: false,
    needsBlog: true,
    needsMembership: false,
    freeformBrief: 'Clínica veterinaria en Los Prados, SD. 2 veterinarios, especialización en perros y gatos.',
  },
];

function getRandomProfile(): MockProfile {
  return MOCK_PROFILES[Math.floor(Math.random() * MOCK_PROFILES.length)];
}

function profileToClientInput(p: MockProfile): ClientContextInput {
  return {
    clientName: p.clientName,
    businessName: p.businessName,
    niche: p.niche,
    domainTarget: p.domainTarget,
    projectType: p.projectType,
    numPages: p.numPages ?? 5,
    complexityLevel: p.complexityLevel,
    subscriptionPlan: p.subscriptionPlan,
    includeSetupFee: p.includeSetupFee ?? true,
    contentStatus: p.contentStatus,
    needsBooking: p.needsBooking,
    needsCatalog: p.needsCatalog,
    needsCheckout: p.needsCheckout,
    needsBlog: p.needsBlog,
    needsMembership: p.needsMembership,
    freeformBrief: p.freeformBrief,
    inspirationLinks: p.inspirationLinks ?? '',
    inputMode: 'form',
  };
}

// ─────────────────────────────────────────────────────────────
// STEPPER STEPS
// ─────────────────────────────────────────────────────────────

const STEPS = [
  { n: 1 as WizardStep, label: 'Contexto', sub: 'Datos del cliente y brief' },
  { n: 2 as WizardStep, label: 'Componentes', sub: 'Revisión IA' },
  { n: 3 as WizardStep, label: 'Ajustes', sub: 'Descuentos y pago' },
  { n: 4 as WizardStep, label: 'Propuesta', sub: 'Preview y export' },
];

// ─────────────────────────────────────────────────────────────
// RIGHT PANEL — STEP 1: resumen en tiempo real
// ─────────────────────────────────────────────────────────────

function RightStep1({ preview, currency, dopRate }: { preview: Partial<ClientContextInput>; currency: Currency; dopRate: number | null }) {
  const fmt = (n: number) =>
    currency === 'DOP' && dopRate
      ? `RD$${Math.round(n * dopRate).toLocaleString('es-DO')}`
      : `$${n.toLocaleString('en-US')}`;

  const baseEst = (() => {
    if (!preview.projectType || preview.projectType !== 'legacy') return null;
    const base = LEGACY_BASE_PRICE;
    const extraPages = Math.max(0, (preview.numPages ?? 5) - 5) * 100;
    const multMap: Record<string, number> = { standard: 1.0, premium: 1.3, ultra_premium: 1.5 };
    const mult = multMap[preview.complexityLevel ?? 'standard'] ?? 1.0;
    return Math.round((base + extraPages) * mult);
  })();

  const nicheLabels: Record<string, string> = {
    salud: '🏥 Salud', legal: '⚖️ Legal', fitness: '💪 Fitness',
    gastronomia: '🍽️ Gastronomía', inmobiliaria: '🏠 Inmobiliaria',
    educacion: '📚 Educación', marca_personal: '🌟 Marca Personal', otro: '📦 Otro',
  };

  const features = [
    preview.needsBooking && 'Citas',
    preview.needsCatalog && 'Catálogo',
    preview.needsCheckout && 'Checkout',
    preview.needsBlog && 'Blog',
    preview.needsMembership && 'Membresía',
  ].filter(Boolean).join(', ') || '—';

  const rows = [
    { label: 'TIPO', value: preview.projectType === 'legacy' ? 'Legacy' : preview.projectType === 'subscription' ? 'Suscripción' : '—' },
    { label: 'NICHO', value: preview.niche ? nicheLabels[preview.niche] ?? preview.niche : '—' },
    { label: 'PLAN', value: preview.projectType === 'subscription' ? (preview.subscriptionPlan?.toUpperCase() ?? '—') : 'N/A' },
    { label: 'PÁGINAS', value: preview.projectType === 'legacy' ? String(preview.numPages ?? 5) : 'N/A' },
    { label: 'COMPLEJIDAD', value: preview.complexityLevel ?? '—' },
    { label: 'DOMINIO', value: preview.domainTarget || '—' },
    { label: 'CONTENIDO', value: preview.contentStatus ?? '—' },
    { label: 'FEATURES', value: features },
  ];

  return (
    <div className="space-y-3">
      <p className="text-[9px] font-['Inter_Tight'] font-semibold uppercase tracking-[.14em] text-white/40">Resumen en tiempo real</p>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between items-start gap-2">
            <span className="text-[9px] font-['Inter_Tight'] font-semibold text-white/30 uppercase tracking-[.08em] shrink-0">{r.label}</span>
            <span className="text-[11px] font-['Inter_Tight'] text-white/70 text-right">{r.value}</span>
          </div>
        ))}
      </div>
      {baseEst ? (
        <div className="mt-3 p-3 bg-[rgba(255,140,0,0.08)] border border-[#FF8C00]/20 rounded-lg">
          <p className="text-[9px] font-['Inter_Tight'] uppercase tracking-[.1em] text-[#FF8C00]/70 mb-1">ESTIMADO BASE</p>
          <p className="text-lg font-['Clash_Grotesk'] font-bold text-[#FF8C00]">{fmt(baseEst)}</p>
          <p className="text-[10px] font-['Inter_Tight'] text-white/30 mt-0.5">Antes de add-ons y ajustes</p>
        </div>
      ) : preview.projectType === 'subscription' && preview.subscriptionPlan ? (
        <div className="mt-3 p-3 bg-[rgba(255,140,0,0.08)] border border-[#FF8C00]/20 rounded-lg">
          <p className="text-[9px] font-['Inter_Tight'] uppercase tracking-[.1em] text-[#FF8C00]/70 mb-1">PLAN SELECCIONADO</p>
          <p className="text-lg font-['Clash_Grotesk'] font-bold text-[#FF8C00]">{preview.subscriptionPlan.toUpperCase()}</p>
        </div>
      ) : null}
      <div className="p-3 bg-purple-900/20 border border-purple-500/20 rounded-lg">
        <p className="text-[10px] font-['Inter_Tight'] text-purple-400">La IA analizará el brief y sugerirá componentes según el niche y tipo de proyecto.</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RIGHT PANEL — STEP 2: componentes seleccionados
// ─────────────────────────────────────────────────────────────

function RightStep2({ selectedComponents, currency, dopRate }: { selectedComponents: SelectedComponent[]; currency: Currency; dopRate: number | null }) {
  const fmt = (n: number) =>
    currency === 'DOP' && dopRate
      ? `RD$${Math.round(n * dopRate).toLocaleString('es-DO')}`
      : `$${n.toLocaleString('en-US')}`;

  // usar name y priceOverride embebidos en SelectedComponent desde catálogo vivo.
  // Fallback al componentId si el item viene de un snapshot legacy sin campo name.
  const items = selectedComponents.map((sc) => ({
    id: sc.componentId,
    name: sc.name ?? sc.componentId,
    price: typeof sc.priceOverride === 'number' ? sc.priceOverride : null,
  }));

  const subtotal = items.reduce((sum, c) => sum + (c.price ?? 0), 0);

  return (
    <div className="space-y-3">
      <p className="text-[9px] font-['Inter_Tight'] font-semibold uppercase tracking-[.14em] text-white/40">
        Componentes seleccionados ({selectedComponents.length})
      </p>
      {items.length === 0 ? (
        <p className="text-xs font-['Inter_Tight'] text-white/30">Sin componentes seleccionados</p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {items.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-['Inter_Tight'] text-white/70 truncate">{c.name}</span>
              <span className="text-[11px] font-['Inter_Tight'] text-white/50 shrink-0">
                {c.price !== null ? fmt(c.price) : 'Custom'}
              </span>
            </div>
          ))}
        </div>
      )}
      {subtotal > 0 && (
        <div className="border-t border-white/10 pt-2 flex justify-between">
          <span className="text-xs font-['Inter_Tight'] text-white/40">Subtotal add-ons</span>
          <span className="text-sm font-['Clash_Grotesk'] font-bold text-[#FF8C00]">{fmt(subtotal)}</span>
        </div>
      )}
      <p className="text-[10px] font-['Inter_Tight'] text-white/30">El precio final se calcula en el Paso 3 con descuentos y ajustes.</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RIGHT PANEL — STEP 3: desglose en tiempo real
// ─────────────────────────────────────────────────────────────

function RightStep3({
  step3Data,
  clientInput,
  currency,
  dopRate,
}: {
  step3Data: { preview: CalculationResult | null; validityDays: number; startDate?: Date };
  clientInput: ClientContextInput | null;
  currency: Currency;
  dopRate: number | null;
}) {
  const { preview, validityDays, startDate } = step3Data;
  const isLegacy = clientInput?.projectType === 'legacy';

  const fmt = (n: number) =>
    currency === 'DOP' && dopRate
      ? `RD$${Math.round(n * dopRate).toLocaleString('es-DO')}`
      : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const now = new Date();
  const start = startDate ?? now;
  const staging = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
  const delivery = new Date(staging.getTime() + 4 * 24 * 60 * 60 * 1000);
  const validUntil = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);
  const fmtDate = (d: Date) => d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' });

  return (
    <div className="space-y-3">
      <p className="text-[9px] font-['Inter_Tight'] font-semibold uppercase tracking-[.14em] text-white/40">Desglose en tiempo real</p>
      {preview ? (
        <>
          <div className="space-y-1.5">
            {isLegacy ? (
              <>
                <div className="flex justify-between text-[11px]">
                  <span className="font-['Inter_Tight'] text-white/50">Base</span>
                  <span className="font-['Inter_Tight'] text-white/70">{fmt(preview.basePrice)}</span>
                </div>
                {preview.additionalPagesPrice > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span className="font-['Inter_Tight'] text-white/50">Págs. adicionales</span>
                    <span className="font-['Inter_Tight'] text-white/70">{fmt(preview.additionalPagesPrice)}</span>
                  </div>
                )}
                {preview.complexityMultiplier > 1 && (
                  <div className="flex justify-between text-[11px]">
                    <span className="font-['Inter_Tight'] text-white/50">Complejidad ×{preview.complexityMultiplier}</span>
                    <span className="font-['Inter_Tight'] text-orange-400">+{fmt((preview.basePrice + preview.additionalPagesPrice) * (preview.complexityMultiplier - 1))}</span>
                  </div>
                )}
                {preview.componentsTotal > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span className="font-['Inter_Tight'] text-white/50">Add-ons</span>
                    <span className="font-['Inter_Tight'] text-white/70">{fmt(preview.componentsTotal)}</span>
                  </div>
                )}
                {preview.finalDiscountAmount > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span className="font-['Inter_Tight'] text-green-400">Descuento</span>
                    <span className="font-['Inter_Tight'] text-green-400">−{fmt(preview.finalDiscountAmount)}</span>
                  </div>
                )}
                {preview.paypalFeeIncluded && (
                  <div className="flex justify-between text-[11px]">
                    <span className="font-['Inter_Tight'] text-white/50">PayPal fee</span>
                    <span className="font-['Inter_Tight'] text-orange-400">+{fmt(preview.paypalFeeAmount)}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex justify-between text-[11px]">
                  <span className="font-['Inter_Tight'] text-white/50">Plan {clientInput?.subscriptionPlan?.toUpperCase()}</span>
                  <span className="font-['Inter_Tight'] text-white/70">{fmt(preview.basePrice)}/mes</span>
                </div>
                {preview.netAddOnsTotal > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span className="font-['Inter_Tight'] text-white/50">Add-ons</span>
                    <span className="font-['Inter_Tight'] text-white/70">{fmt(preview.netAddOnsTotal)}</span>
                  </div>
                )}
                {preview.setupFeeAmount > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span className="font-['Inter_Tight'] text-white/50">Setup fee</span>
                    <span className="font-['Inter_Tight'] text-white/70">{fmt(preview.setupFeeAmount)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="p-2.5 bg-[rgba(255,140,0,0.08)] border border-[#FF8C00]/20 rounded-lg">
            <p className="text-[9px] font-['Inter_Tight'] uppercase tracking-[.1em] text-[#FF8C00]/70 mb-0.5">★ CLIENTE PAGA</p>
            <p className="text-base font-['Clash_Grotesk'] font-bold text-[#FF8C00]">
              {isLegacy ? fmt(preview.finalClientPriceRounded) : `${fmt(preview.basePrice)}/mes`}
            </p>
          </div>

          {isLegacy && preview.maintenanceMonthlyAmount > 0 && (
            <div className="flex justify-between text-[11px]">
              <span className="font-['Inter_Tight'] text-white/40">Mant. referencia</span>
              <span className="font-['Inter_Tight'] text-white/40">{fmt(preview.maintenanceMonthlyAmount)}/mes</span>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs font-['Inter_Tight'] text-white/30">Configura los ajustes para ver el precio</p>
      )}

      <div className="border-t border-white/10 pt-2 space-y-1">
        <p className="text-[9px] font-['Inter_Tight'] uppercase tracking-[.1em] text-white/30 mb-1">CRONOGRAMA EST.</p>
        <div className="flex justify-between text-[11px]">
          <span className="font-['Inter_Tight'] text-white/40">Inicio</span>
          <span className="font-['Inter_Tight'] text-white/60">{fmtDate(start)}</span>
        </div>
        {isLegacy && (
          <>
            <div className="flex justify-between text-[11px]">
              <span className="font-['Inter_Tight'] text-white/40">Staging</span>
              <span className="font-['Inter_Tight'] text-white/60">{fmtDate(staging)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="font-['Inter_Tight'] text-white/40">Entrega</span>
              <span className="font-['Inter_Tight'] text-white/60">{fmtDate(delivery)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between text-[11px]">
          <span className="font-['Inter_Tight'] text-white/40">Válida hasta</span>
          <span className="font-['Inter_Tight'] text-white/60">{fmtDate(validUntil)}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RIGHT PANEL — STEP 4: acciones de la propuesta
// ─────────────────────────────────────────────────────────────

function RightStep4({
  proposalData,
  clientInput,
  editedSummary,
  adjustments,
  quoteId,
  onQuoteIdChange,
  onReset,
  router,
}: {
  proposalData: ProposalData;
  clientInput: ClientContextInput;
  editedSummary: string;
  adjustments: AdjustmentsInput;
  quoteId: string | null;
  onQuoteIdChange: (id: string) => void;
  onReset: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [emailInput, setEmailInput] = useState(clientInput.clientEmail ?? '');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Catalog breakdown for subscription projects
  const [catalogBreakdown, setCatalogBreakdown] = useState<CalculatorCatalogResult | null>(null);

  // Load catalog breakdown once for subscription projects
  useEffect(() => {
    if (clientInput.projectType !== 'subscription' || !clientInput.subscriptionPlan) return;
    const plan = clientInput.subscriptionPlan.toUpperCase() as 'BASIC' | 'PRO' | 'BUSINESS';
    getCatalogBreakdownAction(plan).then((res) => {
      if (res.success) setCatalogBreakdown(res.data);
    }).catch(() => { /* silent */ });
  }, [clientInput.projectType, clientInput.subscriptionPlan]);

  const currentProposal = { ...proposalData, executiveSummary: editedSummary };

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    const result = await saveQuoteAction(clientInput, adjustments, currentProposal);
    setIsSaving(false);
    if (result.success) onQuoteIdChange(result.quoteId);
    else setSaveError('error' in result ? String(result.error) : 'Error al guardar');
  }

  async function handleMarkSent() {
    if (!quoteId) return;
    await updateQuoteStatusAction(quoteId, 'sent');
  }

  async function handleCreateProject() {
    setIsCreatingProject(true);
    setSaveError(null);
    const { createProjectFromProposalAction } = await import('./actions/createProject');
    const result = await createProjectFromProposalAction(clientInput, currentProposal);
    setIsCreatingProject(false);
    if (result.success) {
      router.push(`/admin/proyectos/${result.projectId}/proposal`);
    } else {
      setSaveError('error' in result ? String(result.error) : 'Error al crear proyecto');
    }
  }

  async function handleCopyText() {
    const text = renderProposalPlainText(currentProposal);
    await navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }

  function handlePrint() {
    const orig = document.title;
    document.title = `Propuesta-${proposalData.businessName.replace(/\s+/g, '-')}`;
    window.print();
    document.title = orig;
  }

  async function handleSendEmail(email: string) {
    if (!email) return;
    setEmailSending(true);
    setEmailError(null);
    setEmailSuccess(null);
    try {
      const { sendProposalEmailAction } = await import('./actions/sendProposalEmail');
      const result = await sendProposalEmailAction(email, currentProposal);
      if (result.error) throw new Error(String(result.error));
      setEmailSuccess(`✅ ${email}`);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Error al enviar email');
    } finally {
      setEmailSending(false);
    }
  }

  const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

  return (
    <div className="space-y-3">
      {/* Status badge */}
      <div className="p-2.5 bg-white/4 border border-white/10 rounded-lg flex items-center gap-2">
        <span className="text-[10px] font-['Clash_Grotesk'] font-bold text-white/40 uppercase">DRAFT</span>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
        {quoteId && (
          <span className="text-[10px] font-['Inter_Tight'] text-green-400 truncate">ID: {quoteId.slice(0, 8)}…</span>
        )}
      </div>

      {/* Catalog breakdown (subscription only) */}
      {catalogBreakdown && clientInput.projectType === 'subscription' && (
        <div className="p-2.5 border border-white/10 rounded-lg space-y-1.5">
          <p className="text-[9px] font-['Inter_Tight'] uppercase tracking-[.12em] text-white/40">Catálogo comercial</p>
          {catalogBreakdown.included.length > 0 && (
            <div>
              <p className="text-[9px] font-['Inter_Tight'] text-emerald-400/70 uppercase tracking-[.08em] mb-0.5">
                ✓ Incluido ({catalogBreakdown.included.length})
              </p>
              <p className="text-[10px] font-['Inter_Tight'] text-white/50">
                Valor: {fmt(catalogBreakdown.totals.includedValueCents / 100)}
              </p>
            </div>
          )}
          {catalogBreakdown.paid.length > 0 && (
            <div>
              <p className="text-[9px] font-['Inter_Tight'] text-orange-400/70 uppercase tracking-[.08em] mb-0.5">
                + Add-ons cobrables ({catalogBreakdown.paid.length})
              </p>
              <p className="text-[10px] font-['Inter_Tight'] text-white/50">
                Total: {fmt(catalogBreakdown.totals.paidAddOnsCents / 100)}
              </p>
            </div>
          )}
          {catalogBreakdown.quoteRequired.length > 0 && (
            <p className="text-[9px] font-['Inter_Tight'] text-amber-400/70">
              ⚠ {catalogBreakdown.totals.quoteCount} requieren cotización
            </p>
          )}
        </div>
      )}

      {/* Crear proyecto */}
      <button
        type="button"
        onClick={handleCreateProject}
        disabled={isCreatingProject}
        className="w-full py-2.5 bg-[#FF8C00] text-[#121212] rounded-lg text-sm font-['Clash_Grotesk'] font-semibold hover:bg-[#E67E00] disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-2"
      >
        {isCreatingProject ? '⏳ Creando...' : '🚀 Crear proyecto'}
      </button>

      {/* Guardar / Marcar enviada + Copy + Print */}
      <div className="flex gap-2">
        {!quoteId ? (
          <button type="button" onClick={handleSave} disabled={isSaving}
            className="flex-1 py-2 bg-[#0047AB] text-[#F9F9F9] rounded-lg text-xs font-['Inter_Tight'] font-medium hover:bg-[#0047AB]/80 disabled:opacity-50 transition-all">
            {isSaving ? '⏳' : '💾 Guardar'}
          </button>
        ) : (
          <button type="button" onClick={handleMarkSent}
            className="flex-1 py-2 bg-[#043927] text-[#F9F9F9] rounded-lg text-xs font-['Inter_Tight'] font-medium hover:bg-[#043927]/80 transition-all">
            ✉️ Enviada
          </button>
        )}
        <button type="button" onClick={handleCopyText}
          className="px-3 py-2 border border-white/10 rounded-lg text-xs font-['Inter_Tight'] text-white/60 hover:bg-white/8 transition-all"
          title="Copiar propuesta como texto">
          {copySuccess ? '✅' : '📋'}
        </button>
        <button type="button" onClick={handlePrint}
          className="px-3 py-2 border border-white/10 rounded-lg text-xs font-['Inter_Tight'] text-white/60 hover:bg-white/8 transition-all"
          title="Descargar PDF">
          📄
        </button>
      </div>

      {/* Email */}
      <div className="border-t border-white/10 pt-2.5">
        <p className="text-[9px] font-['Inter_Tight'] uppercase tracking-[.1em] text-white/30 mb-2">Enviar propuesta</p>
        {emailSuccess ? (
          <p className="text-[11px] font-['Inter_Tight'] text-green-400">{emailSuccess}</p>
        ) : clientInput.clientEmail ? (
          <button type="button" onClick={() => handleSendEmail(clientInput.clientEmail!)} disabled={emailSending}
            className="w-full py-2 border border-white/10 rounded-lg text-[11px] font-['Inter_Tight'] text-white/60 hover:bg-white/8 disabled:opacity-50 transition-all truncate px-3 text-left">
            {emailSending ? '⏳ Enviando...' : `✉️ ${clientInput.clientEmail}`}
          </button>
        ) : (
          <div className="flex gap-1.5">
            <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Email del cliente"
              className="flex-1 min-w-0 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-['Inter_Tight'] text-[#F9F9F9] placeholder-white/30 focus:outline-none focus:border-[#FF8C00] transition-colors" />
            <button type="button" onClick={() => handleSendEmail(emailInput)} disabled={emailSending || !emailInput}
              className="px-2 py-1.5 border border-white/10 rounded-lg text-xs font-['Inter_Tight'] text-white/60 hover:bg-white/8 disabled:opacity-50 transition-all">
              {emailSending ? '⏳' : '✉️'}
            </button>
          </div>
        )}
        {emailError && <p className="mt-1 text-[10px] font-['Inter_Tight'] text-red-400">{emailError}</p>}
      </div>

      {saveError && <p className="text-xs font-['Inter_Tight'] text-red-400">❌ {saveError}</p>}

      {/* Nueva cotización */}
      <button type="button" onClick={onReset}
        className="w-full py-1.5 border border-white/8 rounded-lg text-[11px] font-['Inter_Tight'] text-white/30 hover:text-white/60 hover:border-white/20 transition-all">
        Nueva cotización
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CALCULADORA PAGE
// ─────────────────────────────────────────────────────────────

export default function CalculadoraPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Estado acumulado del wizard
  const [clientInput, setClientInput] = useState<ClientContextInput | null>(null);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [selectedComponents, setSelectedComponents] = useState<SelectedComponent[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentsInput | null>(null);
  const [proposalData, setProposalData] = useState<ProposalData | null>(null);

  // Estado para los paneles derechos
  const [clientInputPreview, setClientInputPreview] = useState<Partial<ClientContextInput>>({});
  const [step3Data, setStep3Data] = useState<{ preview: CalculationResult | null; validityDays: number; startDate?: Date }>({ preview: null, validityDays: 7 });
  const [editedSummary, setEditedSummary] = useState('');
  const [rightPanelQuoteId, setRightPanelQuoteId] = useState<string | null>(null);

  // ─── Moneda de display ──────────────────────────────────
  const [currency, setCurrency] = useState<Currency>('USD');
  const [dopRate, setDopRate] = useState<number | null>(null);
  const [dopRateLabel, setDopRateLabel] = useState<string | null>(null);
  const [dopLoading, setDopLoading] = useState(false);
  const [dopError, setDopError] = useState(false);

  async function fetchDopRate() {
    setDopLoading(true);
    setDopError(false);
    try {
      const result = await getExchangeRate();
      if (result) {
        setDopRate(result.rate);
        const d = new Date(result.updatedAt);
        const mins = Math.round((Date.now() - d.getTime()) / 60000);
        setDopRateLabel(
          `1 USD = ${result.rate.toFixed(1)} DOP · actualizado hace ${mins < 1 ? '<1' : mins} min`
        );
      } else {
        setDopError(true);
      }
    } catch {
      setDopError(true);
    } finally {
      setDopLoading(false);
    }
  }

  function handleCurrencyToggle(next: Currency) {
    setCurrency(next);
    if (next === 'DOP' && !dopRate) void fetchDopRate();
  }

  // Pre-relleno del Paso 1
  const [step1Prefill, setStep1Prefill] = useState<ClientContextInput | null>(null);
  const stepContainerRef = useRef<HTMLDivElement>(null);

  // Animación de entrada por paso
  useEffect(() => {
    const el = stepContainerRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.animate(
      [{ opacity: 0, transform: 'translateX(16px)' }, { opacity: 1, transform: 'translateX(0)' }],
      { duration: 220, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
    );
  }, [currentStep]);

  // Sincronizar editedSummary cuando llega nueva propuesta
  useEffect(() => {
    if (proposalData) setEditedSummary(proposalData.executiveSummary);
  }, [proposalData]);

  // Reset rightPanelQuoteId al resetear el wizard
  // (se hace dentro de handleReset)

  // Auto-save en beforeunload
  useEffect(() => {
    function handleBeforeUnload() {
      if (clientInput && proposalData && adjustments) {
        saveQuoteAction(clientInput, adjustments, { ...proposalData, executiveSummary: editedSummary || proposalData.executiveSummary });
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [clientInput, adjustments, proposalData, editedSummary]);

  // Guardar borrador y salir
  const handleSaveDraftAndExit = useCallback(async () => {
    if (!clientInput || !adjustments || !proposalData) return;
    setIsSavingDraft(true);
    await saveQuoteAction(clientInput, adjustments, { ...proposalData, executiveSummary: editedSummary || proposalData.executiveSummary });
    setIsSavingDraft(false);
    router.push('/admin/cotizaciones');
  }, [clientInput, adjustments, proposalData, editedSummary, router]);

  // ─── Paso 1 → 2 ─────────────────────────────────────────
  async function handleClientContextNext(data: ClientContextInput) {
    setClientInput(data);
    setSelectedComponents([]);
    setErrorMessage(null);
    setIsLoading(true);
    setLoadingMessage('Analizando el brief con IA...');

    const TIMEOUT_MS = 12000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
    );

    try {
      const result = await Promise.race([analyzeClientBriefAction(data), timeoutPromise]);
      setIsLoading(false);
      if (result.success) {
        setAiResult(result.data);
        setCurrentStep(2);
      } else {
        setErrorMessage('error' in result ? String(result.error) : 'Error desconocido');
      }
    } catch {
      setIsLoading(false);
      setErrorMessage('Análisis básico aplicado — la IA no respondió a tiempo. Puedes continuar.');
      const fallback = {
        suggestedComponents: [],
        suggestedComplexity: data.complexityLevel,
        complexityScore: 5,
        projectFlag: 'standard' as const,
        executiveSummary: `Proyecto web para ${data.businessName} — ${data.niche}.`,
        detectedFlags: [],
      };
      setAiResult(fallback);
      setCurrentStep(2);
    }
  }

  function handleComponentsChange(selected: SelectedComponent[]) {
    setSelectedComponents(selected);
  }

  function handleComponentsNext(selected: SelectedComponent[]) {
    setSelectedComponents(selected);
    setCurrentStep(3);
  }

  // ─── Paso 3 → 4 ─────────────────────────────────────────
  async function handleAdjustmentsNext(data: AdjustmentsInput) {
    if (!clientInput || !aiResult) {
      setErrorMessage('Faltan datos del paso anterior. Vuelve al Paso 1.');
      return;
    }
    setAdjustments(data);
    setErrorMessage(null);
    setIsLoading(true);
    setLoadingMessage('Calculando cotización...');

    const result = await calculateQuoteAction(clientInput, data, aiResult.executiveSummary);
    setIsLoading(false);

    if (result.success) {
      setProposalData(result.proposalData);
      setRightPanelQuoteId(null);
      setCurrentStep(4);
    } else {
      setErrorMessage('error' in result ? String(result.error) : 'Error desconocido');
    }
  }

  // ─── Reset ───────────────────────────────────────────────
  function handleReset() {
    setCurrentStep(1);
    setClientInput(null);
    setAiResult(null);
    setSelectedComponents([]);
    setAdjustments(null);
    setProposalData(null);
    setErrorMessage(null);
    setStep1Prefill(null);
    setClientInputPreview({});
    setStep3Data({ preview: null, validityDays: 7 });
    setEditedSummary('');
    setRightPanelQuoteId(null);
  }

  // ─── Modo Prueba ─────────────────────────────────────────
  async function activateMockMode() {
    const profile = getRandomProfile();
    const input = profileToClientInput(profile);

    setAiResult(null);
    setSelectedComponents([]);
    setAdjustments(null);
    setProposalData(null);
    setErrorMessage(null);
    setCurrentStep(1);
    setStep1Prefill(input);
    setClientInput(input);
    setIsLoading(true);
    setLoadingMessage(`Analizando perfil de prueba: ${profile.businessName}...`);

    const result = await analyzeClientBriefAction(input);
    setIsLoading(false);

    if (result.success) {
      setAiResult(result.data);
      setCurrentStep(2);
    } else {
      setErrorMessage('error' in result ? String(result.error) : 'Error al analizar perfil de prueba');
    }
  }

  // ─── Navegación libre ────────────────────────────────────
  function canNavigateTo(step: WizardStep): boolean {
    if (step === 1) return true;
    if (step === 2) return !!clientInput && !!aiResult;
    if (step === 3) return !!clientInput && !!aiResult && selectedComponents.length > 0;
    if (step === 4) return !!proposalData && !!clientInput && !!adjustments;
    return false;
  }

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#121212]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex gap-6 items-start">

          {/* ── COLUMNA IZQUIERDA ── */}
          <div className="flex-1 min-w-0">

            {/* Header */}
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-['Clash_Grotesk'] font-extrabold text-[#F9F9F9]">Calculadora de Cotizaciones</h1>
                <p className="text-white/40 font-['Inter_Tight'] mt-1 text-sm">Herramienta interna — WaaS</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Toggle USD / DOP */}
                <div className="flex flex-col items-end gap-0.5">
                  <div className="flex items-center rounded-lg border border-white/10 overflow-hidden">
                    {(['USD', 'DOP'] as Currency[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => handleCurrencyToggle(c)}
                        disabled={dopLoading}
                        className={`px-3 py-1.5 text-xs font-['Inter_Tight'] font-semibold transition-colors ${
                          currency === c
                            ? 'bg-[#FF8C00] text-[#121212]'
                            : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  {currency === 'DOP' && (
                    <p className="text-[9px] font-['Inter_Tight'] text-white/30 pr-0.5">
                      {dopLoading ? 'Obteniendo tasa...' : dopError ? (
                        <span className="text-red-400/60">
                          Error —{' '}
                          <button type="button" onClick={() => void fetchDopRate()} className="underline">reintentar</button>
                        </span>
                      ) : dopRateLabel}
                    </p>
                  )}
                </div>

                {clientInput !== null && adjustments !== null && proposalData !== null && (
                  <button
                    type="button"
                    onClick={handleSaveDraftAndExit}
                    disabled={isSavingDraft || isLoading}
                    className="px-3 py-1.5 text-xs font-['Inter_Tight'] font-medium border border-white/20 text-white/60 bg-white/5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingDraft ? 'Guardando...' : '💾 Guardar borrador'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => activateMockMode()}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-xs font-['Inter_Tight'] font-medium border border-[#FF8C00]/30 text-[#FF8C00] bg-[#FF8C00]/8 rounded-lg hover:bg-[#FF8C00]/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Selecciona un cliente de prueba aleatorio y ejecuta el análisis real de IA"
                >
                  🧪 Modo prueba
                </button>
              </div>
            </div>

            {/* Pill Stepper */}
            <div className="flex items-center gap-1 mb-8">
              {STEPS.map((step, index) => {
                const done = currentStep > step.n;
                const active = currentStep === step.n;
                const navigable = canNavigateTo(step.n) && !active;
                return (
                  <React.Fragment key={step.n}>
                    <button
                      type="button"
                      onClick={() => navigable && setCurrentStep(step.n)}
                      disabled={!navigable && !active}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg flex-1 transition-all duration-200 ${
                        active
                          ? 'bg-[rgba(255,140,0,0.1)]'
                          : done
                          ? 'bg-white/4 cursor-pointer hover:bg-white/6'
                          : 'cursor-default'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-['Clash_Grotesk'] font-bold shrink-0 ${
                        active
                          ? 'bg-[#FF8C00] text-[#121212]'
                          : done
                          ? 'bg-[#5DD69C] text-[#121212]'
                          : 'bg-white/10 text-white/30'
                      }`}>
                        {done ? '✓' : step.n}
                      </div>
                      <div className="text-left min-w-0">
                        <p className={`text-xs font-['Inter_Tight'] font-semibold truncate ${
                          active ? 'text-[#FF8C00]' : done ? 'text-[#F9F9F9]' : 'text-white/30'
                        }`}>{step.label}</p>
                        <p className="text-[10px] font-['Inter_Tight'] text-white/30 truncate hidden md:block">{step.sub}</p>
                      </div>
                    </button>
                    {index < 3 && (
                      <div className={`w-6 h-px shrink-0 ${done ? 'bg-[#5DD69C]' : 'bg-white/10'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Loading state */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="w-10 h-10 border-4 border-white/10 border-t-[#FF8C00] rounded-full animate-spin" />
                <p className="text-sm font-['Inter_Tight'] text-white/60">{loadingMessage}</p>
              </div>
            )}

            {/* Error state */}
            {errorMessage && !isLoading && (
              <div className="mb-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-start gap-3">
                <span className="text-red-500 shrink-0">❌</span>
                <div>
                  <p className="text-sm font-medium text-red-700">Error</p>
                  <p className="text-sm text-red-600">{errorMessage}</p>
                  <button type="button" onClick={() => setErrorMessage(null)} className="mt-2 text-xs text-red-500 hover:underline">
                    Cerrar
                  </button>
                </div>
              </div>
            )}

            {/* Contenido del wizard */}
            {!isLoading && (
              <div ref={stepContainerRef} className="bg-[#0F1014] rounded-xl border border-white/8 shadow-sm p-6">

                {currentStep === 1 && (
                  <div>
                    <h2 className="text-lg font-['Clash_Grotesk'] font-bold text-[#F9F9F9] mb-1">Paso 1 — Tipo proyecto</h2>
                    <p className="text-sm font-['Inter_Tight'] text-white/50 mb-6">
                      Ingresa los datos del proyecto. La IA analizará la información y sugerirá los componentes relevantes.
                    </p>
                    <ClientContextStep
                      onNext={handleClientContextNext}
                      initialData={step1Prefill ?? clientInput}
                      onFormChange={setClientInputPreview}
                    />
                  </div>
                )}

                {currentStep === 2 && aiResult && (
                  <div>
                    <h2 className="text-lg font-['Clash_Grotesk'] font-bold text-[#F9F9F9] mb-1">Paso 2 — Nicho / Funcionalidades</h2>
                    <p className="text-sm font-['Inter_Tight'] text-white/50 mb-6">
                      La IA pre-seleccionó los componentes. Confirma, agrega o elimina según el proyecto real.
                    </p>
                    <AIComponentSuggestion
                      aiResult={aiResult}
                      clientInput={clientInput}
                      initialSelected={selectedComponents.length > 0 ? selectedComponents : undefined}
                      onChange={handleComponentsChange}
                      onNext={handleComponentsNext}
                      onBack={() => setCurrentStep(1)}
                      onPlanChange={(plan) =>
                        setClientInput((prev) => prev ? { ...prev, subscriptionPlan: plan } : prev)
                      }
                    />
                  </div>
                )}

                {currentStep === 3 && (
                  <div>
                    <h2 className="text-lg font-['Clash_Grotesk'] font-bold text-[#F9F9F9] mb-1">Paso 3 — Ajustes</h2>
                    <p className="text-sm font-['Inter_Tight'] text-white/50 mb-6">
                      Define descuentos, estructura de pago y validez de la propuesta.
                    </p>
                    <AdjustmentsStep
                      selectedComponents={selectedComponents}
                      clientInput={clientInput}
                      initialAdjustments={adjustments}
                      onNext={handleAdjustmentsNext}
                      onBack={() => setCurrentStep(2)}
                      currency={currency}
                      dopRate={dopRate}
                      onPreviewChange={setStep3Data}
                    />
                  </div>
                )}

                {currentStep === 4 && proposalData && clientInput && adjustments && (
                  <div>
                    <h2 className="text-lg font-['Clash_Grotesk'] font-bold text-[#F9F9F9] mb-1">Paso 4 — Propuesta</h2>
                    <p className="text-sm font-['Inter_Tight'] text-white/50 mb-6">
                      Revisa, edita el resumen y exporta la propuesta.
                    </p>
                    <ProposalPreview
                      proposalData={proposalData}
                      clientInput={clientInput}
                      adjustments={adjustments}
                      onBack={() => setCurrentStep(3)}
                      onReset={handleReset}
                      currency={currency}
                      dopRate={dopRate}
                      editedSummary={editedSummary}
                      onSummaryChange={setEditedSummary}
                    />
                  </div>
                )}

              </div>
            )}

            {/* Link al historial */}
            <div className="mt-6 text-center">
              <a
                href="/admin/cotizaciones"
                className="text-sm font-['Inter_Tight'] text-white/25 hover:text-white/60 hover:underline"
              >
                Ver historial de cotizaciones →
              </a>
            </div>

          </div>{/* /columna izquierda */}

          {/* ── COLUMNA DERECHA — Panel contextual ── */}
          <div className="w-72 xl:w-80 shrink-0 sticky top-8 self-start">
            {!isLoading && (
              <div className="bg-[#0F1014] rounded-xl border border-white/8 p-4">
                <p className="text-[9px] font-['Inter_Tight'] font-bold uppercase tracking-[.16em] text-[#FF8C00] mb-4">
                  {currentStep === 1 && 'Vista previa'}
                  {currentStep === 2 && 'Componentes'}
                  {currentStep === 3 && 'Precio en tiempo real'}
                  {currentStep === 4 && 'Acciones'}
                </p>

                {currentStep === 1 && (
                  <RightStep1
                    preview={clientInputPreview}
                    currency={currency}
                    dopRate={dopRate}
                  />
                )}

                {currentStep === 2 && (
                  <RightStep2
                    selectedComponents={selectedComponents}
                    currency={currency}
                    dopRate={dopRate}
                  />
                )}

                {currentStep === 3 && (
                  <RightStep3
                    step3Data={step3Data}
                    clientInput={clientInput}
                    currency={currency}
                    dopRate={dopRate}
                  />
                )}

                {currentStep === 4 && proposalData && clientInput && adjustments && (
                  <RightStep4
                    proposalData={proposalData}
                    clientInput={clientInput}
                    editedSummary={editedSummary}
                    adjustments={adjustments}
                    quoteId={rightPanelQuoteId}
                    onQuoteIdChange={setRightPanelQuoteId}
                    onReset={handleReset}
                    router={router}
                  />
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
