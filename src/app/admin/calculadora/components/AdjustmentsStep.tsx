'use client';
// ============================================================
// Paso 3 — Ajustes y Overrides
// Descuentos, estructura de pago, validez de la propuesta
// ← Flujos COMPLETAMENTE separados: LEGACY vs SUSCRIPCIÓN
// ============================================================

import { useState, useMemo, useRef, useEffect } from 'react';
import type {
  AdjustmentsInput,
  ClientContextInput,
  ContractDuration,
  ExceptionDiscountLevel,
  SelectedComponent,
  CalculationResult,
} from '@/lib/calculadora/types';
import { calculateQuote, LEGACY_BASE_PRICE, LEGACY_EMERGENCY_FLOOR } from '@/lib/calculadora/formulas';
import type { Currency } from '@/lib/calculadora/currency';

interface Props {
  selectedComponents: SelectedComponent[];
  clientInput: ClientContextInput | null;
  initialAdjustments?: AdjustmentsInput | null;
  onNext: (adjustments: AdjustmentsInput) => void;
  onBack: () => void;
  currency?: Currency;
  dopRate?: number | null;
  onPreviewChange?: (data: { preview: CalculationResult | null; validityDays: number; startDate?: Date }) => void;
}

// ─── Maintenance tiers ───────────────────────────────────────
const MAINTENANCE_TIERS = [
  { value: 'care',      label: 'Care',      amount: 49,  desc: '1 cambio menor/mes + soporte técnico razonable' },
  { value: 'care_plus', label: 'Care Plus', amount: 89,  desc: '2 cambios menores/mes + soporte técnico razonable' },
  { value: 'care_pro',  label: 'Care Pro',  amount: 149, desc: '4 cambios menores/mes + revisión técnica recurrente' },
] as const;
type MaintenanceTier = 'care' | 'care_plus' | 'care_pro' | 'custom';

function getAutoTier(gross: number): MaintenanceTier {
  if (gross < 3500) return 'care';
  if (gross < 6000) return 'care_plus';
  return 'care_pro';
}

export function AdjustmentsStep({ selectedComponents, clientInput, initialAdjustments, onNext, onBack, currency = 'USD', dopRate, onPreviewChange }: Props) {
  const prev = initialAdjustments;
  const isLegacy = clientInput?.projectType === 'legacy';

  // ─── Descuento — 4 presets + input siempre visible ───────
  const [discountLevel, setDiscountLevel] = useState<ExceptionDiscountLevel>(prev?.exceptionDiscountLevel ?? 'none');
  const [discountPercent, setDiscountPercent] = useState(prev?.exceptionDiscountPercent ?? 0);
  const [discountReason, setDiscountReason] = useState(prev?.exceptionDiscountReason ?? '');
  const [reasonError, setReasonError] = useState('');
  const [discountFixedAmount, setDiscountFixedAmount] = useState<number>(0);
  const [discountMode, setDiscountMode] = useState<'$' | '%'>('%');

  // ─── Duración del contrato (solo suscripción) ───────────
  const [contractDuration, setContractDuration] = useState<ContractDuration>(prev?.contractDuration ?? 'monthly');

  // ─── Estructura de pago (solo legacy) ───────────────────
  const [paymentStructure, setPaymentStructure] = useState<'full' | 'installments'>(prev?.paymentStructure ?? 'full');

  // ─── Toggle PayPal ───────────────────────────────────────
  const [includePaypalFee, setIncludePaypalFee] = useState(prev?.includePaypalFee ?? true);

  // ─── Mantenimiento con tiers ─────────────────────────────
  const [includeMaintenanceFee, setIncludeMaintenanceFee] = useState(prev?.includeMaintenanceFee ?? false);
  const [maintenanceMonthlyAmount, setMaintenanceMonthlyAmount] = useState(prev?.maintenanceMonthlyAmount ?? 49);
  const [maintenanceTier, setMaintenanceTier] = useState<MaintenanceTier>(() => {
    const prevAmount = prev?.maintenanceMonthlyAmount ?? 0;
    if (prevAmount === 49) return 'care';
    if (prevAmount === 89) return 'care_plus';
    if (prevAmount === 149) return 'care_pro';
    return prevAmount > 0 ? 'custom' : 'care';
  });
  const [includeManagedBasicHosting, setIncludeManagedBasicHosting] = useState(false);
  const [maintenanceCustom, setMaintenanceCustom] = useState(prev?.maintenanceMonthlyAmount ?? 49);
  const [showMaintenanceCustom, setShowMaintenanceCustom] = useState(false);

  // ─── Servidor dedicado (solo legacy) ────────────────────
  const [includeDedicatedServer, setIncludeDedicatedServer] = useState(prev?.includeDedicatedServer ?? false);
  const [dedicatedServerMonthlyCost, setDedicatedServerMonthlyCost] = useState(prev?.dedicatedServerMonthlyCost ?? 25);

  // ─── Fechas ──────────────────────────────────────────────
  const [validityDays, setValidityDays] = useState(prev?.proposalValidityDays ?? 7);
  const [startDate, setStartDate] = useState(
    prev?.startDate instanceof Date ? prev.startDate.toISOString().split('T')[0] : ''
  );
  const [stagingDate, setStagingDate] = useState(
    prev?.stagingDate instanceof Date ? prev.stagingDate.toISOString().split('T')[0] : ''
  );
  const [deliveryDate, setDeliveryDate] = useState(
    prev?.deliveryDate instanceof Date ? prev.deliveryDate.toISOString().split('T')[0] : ''
  );
  const [internalNotes, setInternalNotes] = useState(prev?.internalNotes ?? '');

  // ─── Price flash (UX-3 MI-8) ────────────────────────────
  const [priceFlash, setPriceFlash] = useState(false);
  const prevFinalPrice = useRef<number | null>(null);

  // ─── Preview en tiempo real ──────────────────────────────
  const preview = useMemo(() => {
    if (!clientInput) return null;
    try {
      return calculateQuote(clientInput, {
        selectedComponents,
        exceptionDiscountLevel: discountLevel,
        exceptionDiscountPercent: discountPercent,
        exceptionDiscountReason: discountReason || undefined,
        contractDuration,
        paymentStructure,
        includePaypalFee,
        includeMaintenanceFee,
        maintenanceMonthlyAmount,
        includeDedicatedServer,
        dedicatedServerMonthlyCost,
        proposalValidityDays: validityDays,
        startDate: startDate ? new Date(startDate) : undefined,
        discountFixedAmount: discountFixedAmount > 0 ? discountFixedAmount : undefined,
      });
    } catch {
      return null;
    }
  }, [
    clientInput, selectedComponents, discountLevel, discountPercent, contractDuration,
    paymentStructure, includePaypalFee, includeMaintenanceFee,
    maintenanceMonthlyAmount, includeDedicatedServer, dedicatedServerMonthlyCost,
    validityDays, startDate, discountFixedAmount,
  ]);

  // Price flash effect
  useEffect(() => {
    if (preview && prevFinalPrice.current !== null && prevFinalPrice.current !== preview.finalClientPriceRounded) {
      setPriceFlash(true);
      setTimeout(() => setPriceFlash(false), 350);
    }
    if (preview) prevFinalPrice.current = preview.finalClientPriceRounded;
  }, [preview?.finalClientPriceRounded]);

  // Notify parent of real-time preview data for the right panel
  useEffect(() => {
    onPreviewChange?.({
      preview,
      validityDays,
      startDate: startDate ? new Date(startDate) : undefined,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, validityDays, startDate]); // onPreviewChange excluded: new reference each render

  function validate(): boolean {
    if (discountLevel !== 'none' && !discountReason.trim()) {
      setReasonError('El motivo es obligatorio para descuentos por excepción (registro interno)');
      return false;
    }
    setReasonError('');
    return true;
  }

  function handleSubmit() {
    if (!validate()) return;
    const data: AdjustmentsInput = {
      selectedComponents,
      exceptionDiscountLevel: discountLevel,
      exceptionDiscountPercent: discountPercent,
      exceptionDiscountReason: discountReason.trim() || undefined,
      contractDuration,
      paymentStructure,
      includePaypalFee,
      includeMaintenanceFee,
      maintenanceMonthlyAmount,
      includeDedicatedServer,
      dedicatedServerMonthlyCost,
      proposalValidityDays: validityDays,
      startDate: startDate ? new Date(startDate) : undefined,
      stagingDate: stagingDate ? new Date(stagingDate + 'T12:00:00') : undefined,
      deliveryDate: deliveryDate ? new Date(deliveryDate + 'T12:00:00') : undefined,
      internalNotes: internalNotes.trim() || undefined,
      discountFixedAmount: discountFixedAmount > 0 ? discountFixedAmount : undefined,
    };
    onNext(data);
  }

  const fmt = (n: number): string => {
    if (currency === 'DOP' && dopRate) {
      return `RD$${Math.round(n * dopRate).toLocaleString('es-DO')}`;
    }
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // ─── Discount level label with icon ─────────────────────
  const discountLevelIcon: Record<ExceptionDiscountLevel, string> = {
    none: '',
    solidario: '🤝',
    arranque: '🚀',
    favor: '❤️',
  };

  return (
    <div className="space-y-6">

      {/* ── SECCIÓN A: DESCUENTO POR EXCEPCIÓN ─────────────── */}
      <div>
        <label className="block text-sm font-['Inter_Tight'] font-medium text-white/60 mb-1">
          Descuento por excepción
          {discountLevel !== 'none' && (
            <span className="ml-2 text-[#FF8C00]">
              {discountLevelIcon[discountLevel]} {discountLevel}
            </span>
          )}
        </label>
        <p className="text-xs font-['Inter_Tight'] text-white/40 mb-3">
          {isLegacy
            ? 'El descuento por volumen se aplica automáticamente desde $3,000. Este campo es solo para casos especiales decididos por Xavier.'
            : 'Descuento especial decidido por Xavier. El descuento anual (−10%) se aplica debajo en "Duración del contrato".'}
        </p>

        {/* Presets + personalizado — una sola fila */}
        <div className="flex gap-2 flex-wrap items-center">
          {(['none', '20', '35', '50'] as const).map((mode) => {
            const label = mode === 'none' ? 'Sin descuento' : `${mode}%`;
            const pct = mode === 'none' ? 0 : parseInt(mode);
            const isActive = mode === 'none' ? discountLevel === 'none' : discountPercent === pct && discountLevel !== 'none';
            return (
              <button key={mode} type="button"
                onClick={() => {
                  if (mode === 'none') {
                    setDiscountPercent(0);
                    setDiscountLevel('none');
                    setDiscountFixedAmount(0);
                    setDiscountMode('%');
                  } else if (mode === '20') {
                    setDiscountPercent(20);
                    setDiscountLevel('solidario');
                    setDiscountFixedAmount(0);
                    setDiscountMode('%');
                  } else if (mode === '35') {
                    setDiscountPercent(35);
                    setDiscountLevel('arranque');
                    setDiscountFixedAmount(0);
                    setDiscountMode('%');
                  } else if (mode === '50') {
                    setDiscountPercent(50);
                    setDiscountLevel('favor');
                    setDiscountFixedAmount(0);
                    setDiscountMode('%');
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-['Inter_Tight'] font-medium border transition-all duration-150 ${
                  isActive
                    ? 'bg-[#FF8C00] text-[#121212] border-[#FF8C00]'
                    : 'bg-white/4 border-white/10 text-white/70 hover:border-white/30 hover:bg-white/8'
                }`}
              >
                {label}
              </button>
            );
          })}

        {/* Personalizado — inline en la misma fila de presets */}
        <div className="flex items-center rounded-lg border border-white/10 overflow-hidden w-fit">
          {/* Toggle $ */}
          <button
            type="button"
            title="Descuento en monto fijo ($)"
            onClick={() => {
              setDiscountMode('$');
              setDiscountPercent(0);
              setDiscountFixedAmount(0);
            }}
            className={`px-2.5 py-2 border-r border-white/10 transition-colors ${
              discountMode === '$'
                ? 'bg-white/20 text-white'
                : 'bg-white/4 text-white/40 hover:text-white/60'
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 7v10M9.5 9.5h3a2 2 0 0 1 0 4H11a2 2 0 0 0 0 4h3.5"/>
            </svg>
          </button>
          {/* Toggle % */}
          <button
            type="button"
            title="Descuento en porcentaje (%)"
            onClick={() => {
              setDiscountMode('%');
              setDiscountPercent(0);
              setDiscountFixedAmount(0);
            }}
            className={`px-2.5 py-2 border-r border-white/10 text-sm font-['Inter_Tight'] font-medium transition-colors ${
              discountMode === '%'
                ? 'bg-white/20 text-white'
                : 'bg-white/4 text-white/40 hover:text-white/60'
            }`}
          >
            %
          </button>
          {/* Input numérico */}
          <input
            type="number"
            min={0}
            max={discountMode === '%' ? 50 : undefined}
            step={discountMode === '%' ? 0.5 : 1}
            value={discountMode === '%' ? (discountPercent || '') : (discountFixedAmount || '')}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              if (discountMode === '%') {
                const clamped = Math.min(50, val);
                setDiscountPercent(clamped);
                setDiscountFixedAmount(0);
                if (clamped === 0) setDiscountLevel('none');
                else if (clamped <= 20) setDiscountLevel('solidario');
                else if (clamped <= 35) setDiscountLevel('arranque');
                else setDiscountLevel('favor');
              } else {
                setDiscountFixedAmount(val);
                setDiscountPercent(0);
                if (val > 0) setDiscountLevel('solidario');
                else setDiscountLevel('none');
              }
            }}
            placeholder="0"
            className="w-16 px-2 py-1.5 bg-white/4 text-sm font-['Inter_Tight'] text-[#F9F9F9] focus:outline-none focus:bg-white/8"
          />
        </div>
        </div>

        {/* Motivo del descuento */}
        {discountLevel !== 'none' && (
          <div className="mt-3">
            <label className="block text-sm font-['Inter_Tight'] font-medium text-white/60 mb-1">
              Motivo del descuento *
            </label>
            <textarea
              value={discountReason}
              onChange={(e) => { setDiscountReason(e.target.value); setReasonError(''); }}
              rows={2}
              placeholder="Ej: Referido de Dr. Pérez, primer año de negocio, proyecto para portafolio..."
              className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-sm font-['Inter_Tight'] text-[#F9F9F9] placeholder-white/30 focus:outline-none focus:ring-[3px] focus:ring-[#FF8C00]/15 focus:border-[#FF8C00] transition-[border-color,box-shadow] duration-150 ${
                reasonError ? 'border-red-400' : 'border-white/10'
              }`}
            />
            {reasonError && <p className="mt-1 text-xs text-red-400">{reasonError}</p>}
            <p className="mt-1 text-xs font-['Inter_Tight'] text-white/40">Este motivo queda en el historial interno — no se muestra al cliente.</p>
          </div>
        )}
      </div>

      {/* ── SECCIÓN B: DURACIÓN DEL CONTRATO (solo suscripción) */}
      {!isLegacy && (
        <div>
          <label className="block text-sm font-['Inter_Tight'] font-medium text-white/60 mb-1">
            Duración del contrato
          </label>
          <p className="text-xs font-['Inter_Tight'] text-white/40 mb-3">
            Compromisos más largos reciben descuento automático sobre el precio mensual.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'monthly', label: 'Mes a mes', badge: '0%',   desc: 'Sin compromiso mínimo' },
              { value: 'annual',  label: 'Anual',     badge: '−10%', desc: '12 meses de compromiso' },
            ] as { value: ContractDuration; label: string; badge: string; desc: string }[]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setContractDuration(opt.value)}
                className={`p-3 border-2 rounded-lg text-left transition-all ${
                  contractDuration === opt.value
                    ? 'border-[#FF8C00] bg-[#FF8C00]/10 text-[#F9F9F9]'
                    : 'border-white/10 bg-white/4 hover:border-white/20'
                }`}
              >
                <div className={`text-sm font-['Inter_Tight'] font-semibold ${contractDuration === opt.value ? 'text-[#F9F9F9]' : 'text-white/70'}`}>
                  {opt.label}
                </div>
                <div className={`text-xs font-['Inter_Tight'] font-bold mt-0.5 ${contractDuration === opt.value ? 'text-green-400' : 'text-green-500'}`}>
                  {opt.badge}
                </div>
                <div className={`text-xs mt-1 font-['Inter_Tight'] ${contractDuration === opt.value ? 'text-white/60' : 'text-white/40'}`}>
                  {opt.desc}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── SECCIÓN C: ESTRUCTURA DE PAGO (solo legacy) ──── */}
      {isLegacy && (
        <div>
          <label className="block text-sm font-['Inter_Tight'] font-medium text-white/60 mb-3">
            Estructura de pago
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPaymentStructure('full')}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                paymentStructure === 'full'
                  ? 'border-[#FF8C00] bg-[#FF8C00]/10 text-[#F9F9F9]'
                  : 'border-white/10 bg-white/4 hover:border-white/20'
              }`}
            >
              <div className={`text-sm font-['Inter_Tight'] font-semibold ${paymentStructure === 'full' ? 'text-[#F9F9F9]' : 'text-white/70'}`}>
                Pago completo
              </div>
              <div className={`text-xs mt-1 font-['Inter_Tight'] ${paymentStructure === 'full' ? 'text-white/60' : 'text-white/40'}`}>
                1 sola transacción — menor comisión total
              </div>
            </button>
            <button
              type="button"
              onClick={() => setPaymentStructure('installments')}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                paymentStructure === 'installments'
                  ? 'border-[#FF8C00] bg-[#FF8C00]/10 text-[#F9F9F9]'
                  : 'border-white/10 bg-white/4 hover:border-white/20'
              }`}
            >
              <div className={`text-sm font-['Inter_Tight'] font-semibold ${paymentStructure === 'installments' ? 'text-[#F9F9F9]' : 'text-white/70'}`}>
                3 Cuotas (50/25/25)
              </div>
              <div className={`text-xs mt-1 font-['Inter_Tight'] ${paymentStructure === 'installments' ? 'text-white/60' : 'text-white/40'}`}>
                {includePaypalFee ? 'Cada cuota tiene su propia comisión PayPal' : '3 pagos simples sin fee adicional'}
              </div>
            </button>
          </div>
          {paymentStructure === 'installments' && (
            <div className="mt-3 p-3 bg-white/4 rounded-lg border border-white/10 text-xs font-['Inter_Tight'] text-white/60">
              <strong className="text-white/80">Cuota 1 (50%)</strong> al firmar → <strong className="text-white/80">Cuota 2 (25%)</strong> al aprobar staging → <strong className="text-white/80">Cuota 3 (25%)</strong> al aprobar final.<br />
              Los entregables (repositorio, Figma, dominio) se liberan con el 100% cobrado.
            </div>
          )}
        </div>
      )}

      {/* ── SECCIÓN D: TOGGLE PAYPAL FEE (solo legacy) ──── */}
      {isLegacy && (
        <div className="p-4 border border-white/10 rounded-xl bg-[#121212]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-['Inter_Tight'] font-semibold text-white/80">Comisión PayPal (5.4% + $0.30)</p>
              <p className="text-xs font-['Inter_Tight'] text-white/40 mt-0.5">
                {includePaypalFee
                  ? 'El cliente corre con la comisión — se aplica gross-up automático'
                  : 'Sin comisión — el cliente paga por transferencia, efectivo u otro método'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIncludePaypalFee(!includePaypalFee)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                includePaypalFee ? 'bg-[#FF8C00]' : 'bg-white/20'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  includePaypalFee ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      )}
      {!isLegacy && (
        <p className="text-xs font-['Inter_Tight'] text-white/40 italic">
          Las suscripciones de PayPal incluyen su propia comisión — no se aplica gross-up
        </p>
      )}

      {/* ── SECCIÓN E: SERVICIOS RECURRENTES (solo legacy) ── */}
      {isLegacy && (
        <div className="space-y-3">
          <label className="block text-sm font-['Inter_Tight'] font-medium text-white/60">
            Servicios recurrentes post-entrega
          </label>
          <p className="text-xs font-['Inter_Tight'] text-white/40">
            Estos costos se muestran como referencia informativa en la propuesta — no se suman al precio único del proyecto.
          </p>

          {/* Mantenimiento mensual — tiers */}
          <div className="p-4 border border-white/10 rounded-xl bg-[#121212] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-['Inter_Tight'] font-semibold text-white/80">Mantenimiento mensual</p>
                <p className="text-xs font-['Inter_Tight'] text-white/40">Actualizaciones, soporte técnico, cambios menores</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const checked = !includeMaintenanceFee;
                  setIncludeMaintenanceFee(checked);
                  if (checked && preview) {
                    const auto = getAutoTier(preview.grossSubtotal);
                    setMaintenanceTier(auto);
                    const tierData = MAINTENANCE_TIERS.find((t) => t.value === auto)!;
                    setMaintenanceMonthlyAmount(tierData.amount);
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  includeMaintenanceFee ? 'bg-[#FF8C00]' : 'bg-white/20'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${includeMaintenanceFee ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {includeMaintenanceFee && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  {MAINTENANCE_TIERS.map((t) => (
                    <button key={t.value} type="button"
                      onClick={() => { setMaintenanceTier(t.value); setMaintenanceMonthlyAmount(t.amount + (includeManagedBasicHosting ? 20 : 0)); setShowMaintenanceCustom(false); }}
                      className={`flex-1 p-2 border rounded-lg text-left transition-all duration-150 ${
                        maintenanceTier === t.value && !showMaintenanceCustom
                          ? 'border-[#FF8C00] bg-[#FF8C00]/8'
                          : 'border-white/10 bg-white/4 hover:border-white/20'
                      }`}
                    >
                      <div className="text-xs font-['Clash_Grotesk'] font-semibold text-[#F9F9F9]">{t.label}</div>
                      <div className="text-xs font-['Clash_Grotesk'] font-bold text-[#FF8C00]">${t.amount + (includeManagedBasicHosting ? 20 : 0)}/mes</div>
                      <div className="text-[10px] font-['Inter_Tight'] text-white/40 mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
                {/* Toggle Hosting gestionado básico */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={includeManagedBasicHosting} onChange={(e) => {
                    setIncludeManagedBasicHosting(e.target.checked);
                    const base = MAINTENANCE_TIERS.find((t) => t.value === maintenanceTier)?.amount ?? maintenanceMonthlyAmount;
                    setMaintenanceMonthlyAmount(base + (e.target.checked ? 20 : 0));
                  }} className="rounded border-white/20 bg-transparent focus:ring-[#FF8C00]" />
                  <span className="text-xs font-['Inter_Tight'] text-white/70">Hosting gestionado básico (LM04) <span className="text-[#FF8C00] font-semibold">+$20/mes</span></span>
                </label>
                {/* Override manual */}
                <button type="button"
                  onClick={() => setShowMaintenanceCustom((v) => !v)}
                  className="text-xs font-['Inter_Tight'] text-white/40 hover:text-white/60 underline"
                >
                  {showMaintenanceCustom ? 'Usar tiers estándar' : 'Precio personalizado'}
                </button>
                {showMaintenanceCustom && (
                  <input type="number" min={0} value={maintenanceCustom}
                    onChange={(e) => { const v = parseInt(e.target.value) || 0; setMaintenanceCustom(v); setMaintenanceMonthlyAmount(v); }}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-['Inter_Tight'] text-[#F9F9F9] focus:border-[#FF8C00] focus:ring-[3px] focus:ring-[#FF8C00]/15 focus:outline-none"
                    placeholder="USD/mes personalizado"
                  />
                )}
              </div>
            )}
          </div>

          {/* Servidor dedicado */}
          <div className="p-4 border border-white/10 rounded-xl bg-[#121212] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-['Inter_Tight'] font-semibold text-white/80">Servidor dedicado</p>
                <p className="text-xs font-['Inter_Tight'] text-white/40">Si el proyecto requiere hosting independiente (VPS, servidor custom)</p>
              </div>
              <button
                type="button"
                onClick={() => setIncludeDedicatedServer(!includeDedicatedServer)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  includeDedicatedServer ? 'bg-[#FF8C00]' : 'bg-white/20'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${includeDedicatedServer ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {includeDedicatedServer && (
              <div className="flex items-center gap-3">
                <label className="text-xs font-['Inter_Tight'] text-white/60 shrink-0">Costo mensual:</label>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-['Inter_Tight'] text-white/40">$</span>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    step={5}
                    value={dedicatedServerMonthlyCost}
                    onChange={(e) => setDedicatedServerMonthlyCost(parseFloat(e.target.value) || 0)}
                    className="w-24 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm font-['Inter_Tight'] text-[#F9F9F9] focus:outline-none focus:ring-[3px] focus:ring-[#FF8C00]/15 focus:border-[#FF8C00]"
                  />
                  <span className="text-xs font-['Inter_Tight'] text-white/40">/mes</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SECCIÓN F: VALIDEZ Y FECHAS ──────────────────── */}
      <div className="space-y-3">
        <label className="block text-sm font-['Inter_Tight'] font-medium text-white/60">
          Validez y fechas del proyecto
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Validez */}
          <div className="bg-white/4 border border-white/10 rounded-lg px-3 py-2.5">
            <p className="text-[10px] font-['Inter_Tight'] font-semibold uppercase tracking-[.1em] text-white/40 mb-1.5">Validez</p>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={30}
                value={validityDays}
                onChange={(e) => setValidityDays(parseInt(e.target.value) || 7)}
                className="w-12 px-2 py-1 bg-white/8 border border-white/10 rounded text-sm font-['Inter_Tight'] font-bold text-[#F9F9F9] text-center focus:outline-none focus:border-[#FF8C00]"
              />
              <span className="text-xs font-['Inter_Tight'] text-white/50">días</span>
            </div>
          </div>
          {/* Inicio */}
          <div className="bg-white/4 border border-white/10 rounded-lg px-3 py-2.5">
            <p className="text-[10px] font-['Inter_Tight'] font-semibold uppercase tracking-[.1em] text-white/40 mb-1.5">Inicio</p>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full bg-transparent text-sm font-['Inter_Tight'] text-[#F9F9F9] focus:outline-none"
            />
          </div>
          {/* Staging */}
          <div className="bg-white/4 border border-white/10 rounded-lg px-3 py-2.5">
            <p className="text-[10px] font-['Inter_Tight'] font-semibold uppercase tracking-[.1em] text-white/40 mb-1.5">Staging</p>
            <input
              type="date"
              value={stagingDate}
              onChange={(e) => setStagingDate(e.target.value)}
              className="w-full bg-transparent text-sm font-['Inter_Tight'] text-[#F9F9F9] focus:outline-none"
            />
          </div>
          {/* Entrega */}
          <div className="bg-white/4 border border-white/10 rounded-lg px-3 py-2.5">
            <p className="text-[10px] font-['Inter_Tight'] font-semibold uppercase tracking-[.1em] text-white/40 mb-1.5">Entrega</p>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full bg-transparent text-sm font-['Inter_Tight'] text-[#F9F9F9] focus:outline-none"
            />
          </div>
        </div>
        <p className="text-xs font-['Inter_Tight'] text-white/30">Staging y Entrega se calculan automáticamente si se dejan vacíos.</p>
      </div>

      {/* ── NOTAS INTERNAS ────────────────────────────────── */}
      <div>
        <label className="block text-sm font-['Inter_Tight'] font-medium text-white/60 mb-1">
          Notas internas
        </label>
        <textarea
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          rows={3}
          placeholder="Ej: Cliente referido por Juan Martínez. Prefiere reuniones por WhatsApp. Tiene dominio en GoDaddy..."
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-['Inter_Tight'] text-[#F9F9F9] placeholder-white/30 focus:outline-none focus:ring-[3px] focus:ring-[#FF8C00]/15 focus:border-[#FF8C00] transition-[border-color,box-shadow] duration-150"
        />
        <p className="mt-1 text-xs font-['Inter_Tight'] text-white/40">Solo visible para Xavier — nunca se incluye en la propuesta del cliente.</p>
      </div>

      {/* ── DESGLOSE EN TIEMPO REAL ───────────────────────── */}
      {preview && (
        <div className="border border-white/10 rounded-xl overflow-hidden bg-[#121212]">
          <div className="bg-white/4 px-4 py-2.5 border-b border-white/10">
            <p className="text-xs font-['Inter_Tight'] font-semibold text-white/60 uppercase tracking-wider">
              Desglose estimado — actualiza en tiempo real
            </p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {/* Precio base */}
              <tr className="border-b border-white/10">
                <td className="px-4 py-2 font-['Inter_Tight'] text-white/60">
                  {isLegacy
                    ? `Proyecto base (hasta 5 págs)`
                    : contractDuration === 'annual'
                      ? `Plan ${clientInput?.subscriptionPlan?.toUpperCase()} — compromiso anual 12 meses`
                      : `Plan ${clientInput?.subscriptionPlan?.toUpperCase()} — mensualidad`
                  }
                </td>
                <td className="px-4 py-2 text-right font-['Inter_Tight'] text-[#F9F9F9]">
                  {fmt(
                    isLegacy
                      ? LEGACY_BASE_PRICE
                      : preview.components.find((c) => c.id === 'base_price_display')?.price ?? 0
                  )}
                </td>
              </tr>

              {/* Annual plan breakdown (solo suscripción anual) */}
              {!isLegacy && contractDuration === 'annual' && preview.planAnnualBase && (
                <>
                  <tr className="border-b border-white/10">
                    <td className="px-4 py-2 pl-7 font-['Inter_Tight'] text-white/60 text-xs">
                      Plan {clientInput?.subscriptionPlan?.toUpperCase()} × 12 meses
                    </td>
                    <td className="px-4 py-2 text-right font-['Inter_Tight'] text-[#F9F9F9] text-xs">
                      {fmt(preview.planAnnualBase)}
                    </td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="px-4 py-2 pl-7 font-['Inter_Tight'] text-white/60 text-xs">Descuento anual (−10% sobre plan)</td>
                    <td className="px-4 py-2 text-right font-['Inter_Tight'] text-green-400 text-xs">
                      −{fmt(preview.planAnnualBase - (preview.planAnnualAfterDiscount ?? 0))}
                    </td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="px-4 py-2 pl-7 font-['Inter_Tight'] font-semibold text-white/60 text-xs">Total anual del plan</td>
                    <td className="px-4 py-2 text-right font-['Inter_Tight'] font-semibold text-[#FF8C00] text-xs">
                      {fmt(preview.planAnnualAfterDiscount ?? 0)}
                    </td>
                  </tr>
                </>
              )}

              {/* Páginas adicionales */}
              {isLegacy && preview.additionalPagesPrice > 0 && (
                <tr className="border-b border-white/10">
                  <td className="px-4 py-2 font-['Inter_Tight'] text-white/60 pl-7 text-xs">
                    + {(clientInput?.numPages ?? 5) - 5} págs. adicionales
                  </td>
                  <td className="px-4 py-2 text-right font-['Inter_Tight'] text-[#F9F9F9] text-xs">{fmt(preview.additionalPagesPrice)}</td>
                </tr>
              )}

              {/* Multiplicador de complejidad */}
              {isLegacy && preview.complexityMultiplier > 1 && (
                <tr className="border-b border-white/10">
                  <td className="px-4 py-2 font-['Inter_Tight'] text-white/60 pl-7 text-xs">
                    x Complejidad {clientInput?.complexityLevel} ({preview.complexityMultiplier}x)
                  </td>
                  <td className="px-4 py-2 text-right font-['Inter_Tight'] text-orange-400 text-xs">
                    +{fmt((LEGACY_BASE_PRICE + preview.additionalPagesPrice) * (preview.complexityMultiplier - 1))}
                  </td>
                </tr>
              )}

              {/* Add-ons seleccionados */}
              {preview.componentsTotal > 0 && (
                <>
                  <tr className="border-b border-white/10 bg-white/2">
                    <td className="px-4 py-1.5 text-xs font-['Inter_Tight'] font-semibold text-white/40 uppercase tracking-wide" colSpan={2}>
                      Add-ons seleccionados
                    </td>
                  </tr>
                  {preview.components
                    .filter((c) => c.id !== 'base_price_display' && c.id !== 'pages_extra_display')
                    .map((c) => (
                      <tr key={c.id} className="border-b border-white/10">
                        <td className="px-4 py-1.5 font-['Inter_Tight'] text-white/60 pl-7 text-xs">{c.name}</td>
                        <td className="px-4 py-1.5 text-right font-['Inter_Tight'] text-[#F9F9F9] text-xs">{fmt(c.price)}</td>
                      </tr>
                    ))}
                </>
              )}

              {/* Descuento por volumen de add-ons (3+ add-ons = 10%) */}
              {preview.addOnDiscountPercent > 0 && (
                <tr className="border-b border-white/10">
                  <td className="px-4 py-1.5 font-['Inter_Tight'] text-green-400 pl-7 text-xs">
                    Descuento por volumen add-ons ({selectedComponents.length} add-ons, −10%)
                  </td>
                  <td className="px-4 py-1.5 text-right font-['Inter_Tight'] text-green-400 text-xs">
                    −{fmt(preview.addOnDiscountAmount)}
                  </td>
                </tr>
              )}

              {/* Subtotal */}
              <tr className="border-b border-white/20 border-t border-t-white/10">
                <td className="px-4 py-2 font-['Inter_Tight'] font-medium text-white/60">Subtotal</td>
                <td className="px-4 py-2 text-right font-['Inter_Tight'] font-semibold text-[#F9F9F9]">{fmt(preview.grossSubtotal)}</td>
              </tr>

              {/* Mantenimiento mensual (informativo) */}
              {isLegacy && preview.maintenanceMonthlyAmount > 0 && (
                <tr className="border-b border-white/10 bg-white/2">
                  <td className="px-4 py-2 font-['Inter_Tight'] text-white/50 text-xs">Mantenimiento mensual (informativo)</td>
                  <td className="px-4 py-2 text-right font-['Inter_Tight'] text-white/50 text-xs">{fmt(preview.maintenanceMonthlyAmount)}/mes</td>
                </tr>
              )}

              {/* Servidor dedicado (informativo) */}
              {isLegacy && preview.dedicatedServerMonthlyCost > 0 && (
                <tr className="border-b border-white/10 bg-white/2">
                  <td className="px-4 py-2 font-['Inter_Tight'] text-white/50 text-xs">Servidor dedicado (informativo)</td>
                  <td className="px-4 py-2 text-right font-['Inter_Tight'] text-white/50 text-xs">{fmt(preview.dedicatedServerMonthlyCost)}/mes</td>
                </tr>
              )}

              {/* Dominio */}
              {preview.domainStatus !== 'none' && (
                <tr className="border-b border-white/10 bg-white/2">
                  {preview.domainStatus === 'client_has_domain' ? (
                    <td className="px-4 py-2 font-['Inter_Tight'] text-white/50 text-xs" colSpan={2}>
                      🌐 Dominio: El cliente ya tiene dominio — solo configurar DNS
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-2 font-['Inter_Tight'] text-white/50 text-xs">
                        🌐 <strong className="text-white/70">{preview.domainTarget ?? 'Dominio'}</strong>{' '}
                        — El cliente comprará el dominio (referencia anual)
                      </td>
                      <td className="px-4 py-2 text-right font-['Inter_Tight'] text-white/50 text-xs">
                        {preview.domainPrice !== undefined ? fmt(preview.domainPrice) : ''}
                      </td>
                    </>
                  )}
                </tr>
              )}

              {/* Descuento por volumen */}
              {preview.volumeDiscountPercent > 0 && preview.volumeDiscountPercent >= preview.exceptionDiscountPercent && (
                <tr className="border-b border-white/10">
                  <td className="px-4 py-2 font-['Inter_Tight'] text-white/60">
                    Descuento por volumen ({(preview.volumeDiscountPercent * 100).toFixed(0)}%) — automático
                  </td>
                  <td className="px-4 py-2 text-right font-['Inter_Tight'] text-green-400">−{fmt(preview.volumeDiscountAmount)}</td>
                </tr>
              )}

              {/* Descuento por excepción */}
              {preview.exceptionDiscountPercent > 0 && (
                <tr className="border-b border-white/10">
                  <td className="px-4 py-2 font-['Inter_Tight'] text-white/60">
                    Descuento excepción ({(preview.exceptionDiscountPercent * 100).toFixed(0)}%)
                    {preview.exceptionDiscountPercent > preview.volumeDiscountPercent
                      ? ' — aplicado (mayor que volumen)'
                      : ' — no aplicado (menor que volumen)'}
                  </td>
                  <td className={`px-4 py-2 text-right font-['Inter_Tight'] ${
                    preview.exceptionDiscountPercent > preview.volumeDiscountPercent
                      ? 'text-green-400'
                      : 'text-white/30 line-through'
                  }`}>
                    −{fmt(preview.exceptionDiscountAmount)}
                  </td>
                </tr>
              )}

              {/* Total con descuento (solo si hay descuento aplicado) */}
              {preview.netSubtotal < preview.grossSubtotal && (
                <tr className="border-b border-white/10 bg-white/4">
                  <td className="px-4 py-2 font-['Inter_Tight'] font-semibold text-green-400">Total con descuento</td>
                  <td className="px-4 py-2 text-right font-['Inter_Tight'] font-bold text-green-400">{fmt(preview.netSubtotal)}</td>
                </tr>
              )}

              {/* Fee PayPal (solo legacy) */}
              {isLegacy && (
                <tr className="border-b border-white/10">
                  <td className="px-4 py-2 font-['Inter_Tight'] text-white/60">
                    Comisión PayPal (5.4% + $0.30)
                    {!preview.paypalFeeIncluded && <span className="ml-1 text-xs text-white/30">[desactivado]</span>}
                  </td>
                  <td className={`px-4 py-2 text-right font-['Inter_Tight'] ${preview.paypalFeeIncluded ? 'text-orange-400' : 'text-white/30'}`}>
                    {preview.paypalFeeIncluded ? `+${fmt(preview.paypalFeeAmount)}` : '$0.00'}
                  </td>
                </tr>
              )}

              {/* Total legacy */}
              {isLegacy && (
                <>
                  <tr className="bg-white/8">
                    <td className="px-4 py-3 font-['Clash_Grotesk'] font-bold text-[#F9F9F9]">Total a cobrar al cliente</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-3xl font-['Clash_Grotesk'] font-bold ${priceFlash ? 'animate-price-flash' : 'text-[#FF8C00]'}`}>
                        {fmt(preview.finalClientPrice)}
                      </span>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>

          {/* Suscripción — bloques separados */}
          {!isLegacy && preview && (
            <div className="space-y-1.5 px-4 py-3 border-t border-white/10">
              {/* Plan: mensualidad o total anual */}
              <div className="flex justify-between items-center">
                <span className="text-xs font-['Inter_Tight'] text-white/60">
                  {contractDuration === 'annual' ? 'Plan (anual)' : 'Mensualidad'}
                </span>
                <span className="font-['Clash_Grotesk'] font-bold text-[#FF8C00]">
                  {contractDuration === 'annual'
                    ? `${fmt(preview.planAnnualAfterDiscount ?? preview.basePrice * 12 * 0.9)}/año`
                    : `${fmt(preview.basePrice)}/mes`}
                </span>
              </div>
              {/* Add-ons: cobro único */}
              {preview.netAddOnsTotal > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs font-['Inter_Tight'] text-white/60">
                    Add-ons — cobro único{preview.addOnDiscountPercent > 0 ? ' (con desc. volumen)' : ''}
                  </span>
                  <span className="font-['Inter_Tight'] font-semibold text-white/80">{fmt(preview.netAddOnsTotal)}</span>
                </div>
              )}
              {/* Setup fee */}
              {preview.setupFeeAmount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs font-['Inter_Tight'] text-white/60">Activación única (setup fee)</span>
                  <span className="font-['Inter_Tight'] font-semibold text-white/80">{fmt(preview.setupFeeAmount)}</span>
                </div>
              )}
              {/* Dominio (referencia) */}
              {preview.domainStatus === 'client_will_buy' && preview.domainPrice !== undefined && (
                <div className="flex justify-between items-center">
                  <span className="text-xs font-['Inter_Tight'] text-white/50">
                    🌐 {preview.domainTarget ?? 'Dominio'} (referencia)
                  </span>
                  <span className="font-['Inter_Tight'] text-white/50 text-xs">{fmt(preview.domainPrice)}</span>
                </div>
              )}
              {/* Total primer cobro */}
              {(preview.netAddOnsTotal + preview.setupFeeAmount) > 0 && (
                <div className="border-t border-[#FF8C00]/30 pt-1.5 flex justify-between items-center">
                  <span className="text-xs font-['Inter_Tight'] font-semibold text-white/80">
                    TOTAL PRIMER COBRO
                  </span>
                  <span className={`font-['Clash_Grotesk'] font-bold text-white ${priceFlash ? 'animate-price-flash' : ''}`}>
                    {contractDuration === 'annual'
                      ? fmt((preview.planAnnualAfterDiscount ?? preview.basePrice * 12 * 0.9) + preview.netAddOnsTotal + preview.setupFeeAmount)
                      : fmt(preview.basePrice + preview.netAddOnsTotal + preview.setupFeeAmount)}
                  </span>
                </div>
              )}
              {/* Mensualidades siguientes */}
              {!isLegacy && (
                <div className="flex justify-between items-center">
                  <span className="text-xs font-['Inter_Tight'] text-white/50">Mensualidades siguientes</span>
                  <span className="text-xs font-['Inter_Tight'] text-white/60">{fmt(preview.basePrice)}/mes</span>
                </div>
              )}
            </div>
          )}

          {/* Cuotas (solo legacy con installments) */}
          {isLegacy && paymentStructure === 'installments' && preview.installments && (
            <div className="bg-white/4 border-t border-white/10 px-4 py-3">
              <p className="text-xs font-['Inter_Tight'] font-semibold text-white/60 mb-2">
                Desglose en 3 cuotas{includePaypalFee ? ' (con fee PayPal individual por cuota)' : ' (sin fee — pago directo)'}:
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { label: 'Cuota 1 — 50%', amount: preview.installments.installment1, fee: preview.installments.paypalFeeI1, when: 'Al firmar' },
                  { label: 'Cuota 2 — 25%', amount: preview.installments.installment2, fee: preview.installments.paypalFeeI2, when: 'Al staging' },
                  { label: 'Cuota 3 — 25%', amount: preview.installments.installment3, fee: preview.installments.paypalFeeI3, when: 'Al aprobar' },
                ].map((q) => (
                  <div key={q.label} className="bg-white/4 rounded-lg p-2 text-center border border-white/10">
                    <p className="font-['Inter_Tight'] text-white/50 font-medium">{q.label}</p>
                    <p className="font-['Clash_Grotesk'] font-bold text-[#F9F9F9] mt-0.5">${q.amount.toLocaleString('en-US')}</p>
                    {includePaypalFee && q.fee > 0 && (
                      <p className="text-orange-400 text-xs">fee: ${q.fee.toFixed(2)}</p>
                    )}
                    <p className="font-['Inter_Tight'] text-white/40">{q.when}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs font-['Inter_Tight'] text-white/50 mt-2 text-right">
                Total cliente: <strong className="text-white/70">${preview.installments.totalClientPays.toLocaleString('en-US')}</strong>
                {' | '}Neto Xavier: <strong className="text-[#FF8C00]">${preview.installments.providerTotalReceived.toLocaleString('en-US')}</strong>
              </p>
            </div>
          )}

          {/* Alertas */}
          {preview.alerts.length > 0 && (
            <div className="border-t border-amber-500/20 bg-amber-500/5 px-4 py-3 space-y-1">
              {preview.alerts.map((alert, i) => (
                <p key={i} className="text-xs font-['Inter_Tight'] text-amber-400">⚠ {alert}</p>
              ))}
            </div>
          )}

          {/* ─── RESUMEN INTERNO ADMIN (no se envía al cliente) ─── */}
          <div className="border-t-2 border-dashed border-white/10 mt-4 pt-4 px-4 pb-4 space-y-2">
            <p className="text-xs font-['Inter_Tight'] font-semibold text-white/30 uppercase tracking-wide mb-2">
              Resumen interno — solo para Xavier
            </p>
            {!isLegacy ? (
              <>
                <div className="flex justify-between">
                  <span className="text-xs text-white/40">MRR neto (después de PayPal ~5.4%)</span>
                  <span className="font-['Inter_Tight'] text-xs text-[#FF8C00]">{fmt(preview.mrrNeto ?? 0)}/mes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-white/40">Primer cobro neto total (después de PayPal)</span>
                  <span className="font-['Inter_Tight'] text-xs text-[#FF8C00]">{fmt(preview.primerCobroNeto ?? 0)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span className="text-xs text-white/40">Neto para Xavier (después de PayPal)</span>
                <span className="font-['Inter_Tight'] text-xs text-[#FF8C00]">{fmt(preview.providerNetAmount)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nota del piso mínimo */}
      {isLegacy && (
        <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
          <p className="text-xs font-['Inter_Tight'] text-amber-400">
            <strong>Piso de emergencia:</strong> El sistema protege un mínimo de ${LEGACY_EMERGENCY_FLOOR} neto para Xavier en proyectos LEGACY.
            Este piso solo es alcanzable con descuentos manuales explícitos (solidario extremo / precio de favor).
            El precio de mercado mínimo real es ${LEGACY_BASE_PRICE.toLocaleString('en-US')}.
          </p>
        </div>
      )}

      {/* CTA */}
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 border border-white/20 rounded-lg text-sm font-['Inter_Tight'] text-white/60 hover:bg-white/8 transition-colors"
        >
          Atras
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="px-6 py-3 bg-[#FF8C00] text-[#121212] rounded-lg text-sm font-['Clash_Grotesk'] font-semibold hover:bg-[#E67E00] hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(255,140,0,.35)] transition-all duration-200"
        >
          Calcular cotizacion
        </button>
      </div>
    </div>
  );
}
