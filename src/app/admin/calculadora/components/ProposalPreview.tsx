'use client';
// ============================================================
// Paso 4 — Preview de la Propuesta (display-only)
// Las acciones (save/create/email/copy/print) viven en RightStep4
// ============================================================

import { useState } from 'react';
import type { ProposalData } from '@/lib/calculadora/types';
import type { Currency } from '@/lib/calculadora/currency';
import type { ClientContextInput, AdjustmentsInput } from '@/lib/calculadora/types';

interface Props {
  proposalData: ProposalData;
  clientInput: ClientContextInput;
  adjustments: AdjustmentsInput;
  onBack: () => void;
  onReset: () => void;
  currency?: Currency;
  dopRate?: number | null;
  editedSummary: string;
  onSummaryChange: (s: string) => void;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function ProposalPreview({ proposalData, clientInput, adjustments, onBack, onReset, currency = 'USD', dopRate, editedSummary, onSummaryChange }: Props) {
  const { calculation, paymentStructure } = proposalData;
  const validUntil = toDate(proposalData.validUntil);
  const isLegacy = clientInput.projectType === 'legacy';
  const contractDuration = adjustments.contractDuration ?? 'monthly';

  const [activeTab, setActiveTab] = useState<'resumen' | 'propuesta'>('resumen');

  const fmt = (n: number): string => {
    if (currency === 'DOP' && dopRate) {
      return `RD$${Math.round(n * dopRate).toLocaleString('es-DO')}`;
    }
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6">
      {/* Alertas del cálculo */}
      {calculation.alerts.length > 0 && (
        <div className="space-y-2">
          {calculation.alerts.map((alert, i) => (
            <div key={i} className="flex gap-2 p-3 bg-[rgba(245,158,11,0.08)] border border-[#FF8C00]/20 rounded-lg text-sm text-[#FF8C00]">
              <span>⚠️</span>
              <span>{alert}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {[
          { id: 'resumen', label: '💰 Resumen Financiero' },
          { id: 'propuesta', label: '📄 Vista Propuesta' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-[#FF8C00] text-[#FF8C00]'
                : 'border-transparent text-white/50 hover:text-white/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════
          TAB: RESUMEN FINANCIERO
      ═══════════════════════════════════════════════════ */}
      {activeTab === 'resumen' && (
        <div className="space-y-5">

          {/* Desglose completo */}
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <div className="bg-white/4 px-4 py-2.5 border-b border-white/10">
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                Desglose de la cotización — {isLegacy ? 'Pago único' : `Suscripción ${clientInput.subscriptionPlan?.toUpperCase()}`}
              </p>
            </div>
            <table className="w-full text-sm">
              <tbody>

                {/* ── PRECIO BASE ── */}
                <tr className="border-b border-white/10">
                  <td className="px-4 py-2.5 text-white/70 font-medium">
                    {isLegacy
                      ? `Proyecto base (hasta 5 páginas)`
                      : `Plan ${clientInput.subscriptionPlan?.toUpperCase()} — mensual`}
                  </td>
                  <td className="px-4 py-2.5 text-right font-['Inter_Tight'] font-semibold text-[#F9F9F9]">
                    {fmt(calculation.basePrice)}{!isLegacy && <span className="text-xs text-white/50 ml-1">/mes</span>}
                  </td>
                </tr>

                {/* ── Páginas adicionales (solo LEGACY) ── */}
                {isLegacy && calculation.additionalPagesPrice > 0 && (
                  <tr className="border-b border-white/10">
                    <td className="px-4 py-1.5 text-white/50 pl-8 text-xs">
                      + {(clientInput.numPages ?? 5) - 5} páginas adicionales ×$100
                    </td>
                    <td className="px-4 py-1.5 text-right font-['Inter_Tight'] text-white/70 text-xs">
                      {fmt(calculation.additionalPagesPrice)}
                    </td>
                  </tr>
                )}

                {/* ── Multiplicador complejidad (solo LEGACY) ── */}
                {isLegacy && calculation.complexityMultiplier > 1 && (
                  <tr className="border-b border-white/10">
                    <td className="px-4 py-1.5 text-white/50 pl-8 text-xs">
                      × Complejidad {clientInput.complexityLevel} ({calculation.complexityMultiplier}×)
                    </td>
                    <td className="px-4 py-1.5 text-right font-['Inter_Tight'] text-orange-600 text-xs">
                      +{fmt((calculation.basePrice + calculation.additionalPagesPrice) * (calculation.complexityMultiplier - 1))}
                    </td>
                  </tr>
                )}

                {/* ── ADD-ONS ── */}
                {calculation.components.length > 0 && (
                  <>
                    <tr className="bg-white/4 border-b border-white/10">
                      <td className="px-4 py-1.5 text-xs font-semibold text-white/50 uppercase tracking-wide" colSpan={2}>
                        Add-ons seleccionados
                      </td>
                    </tr>
                    {calculation.components.map((c, i) => (
                      <tr key={i} className="border-b border-white/10">
                        <td className="px-4 py-1.5 text-white/70 pl-8 text-xs">{c.name}</td>
                        <td className="px-4 py-1.5 text-right font-['Inter_Tight'] text-white/70 text-xs">{fmt(c.price)}</td>
                      </tr>
                    ))}
                  </>
                )}

                {/* ── DESCUENTO VOLUMEN ADD-ONS ── */}
                {calculation.addOnDiscountPercent > 0 && (
                  <tr className="border-b border-white/10">
                    <td className="px-4 py-1.5 text-green-400 pl-8 text-xs">
                      Descuento por volumen add-ons ({adjustments.selectedComponents.length} add-ons, −10%)
                    </td>
                    <td className="px-4 py-1.5 text-right font-['Inter_Tight'] text-green-400 text-xs">
                      −{fmt(calculation.addOnDiscountAmount)}
                    </td>
                  </tr>
                )}

                {/* ── SUBTOTAL ── */}
                <tr className="border-b border-white/10 border-t-2">
                  <td className="px-4 py-2.5 font-semibold text-white/70">Subtotal</td>
                  <td className="px-4 py-2.5 text-right font-['Inter_Tight'] font-bold text-[#F9F9F9]">{fmt(calculation.grossSubtotal)}</td>
                </tr>

                {/* ── SERVICIOS RECURRENTES INFORMATIVOS (solo LEGACY) ── */}
                {isLegacy && calculation.maintenanceMonthlyAmount > 0 && (
                  <tr className="bg-[#0047AB]/8 border-b border-[#0047AB]/15">
                    <td className="px-4 py-2 text-[rgba(249,249,249,0.6)] text-xs">
                      📋 <strong className="text-[rgba(249,249,249,0.8)]">Mantenimiento mensual</strong> — referencia informativa para el cliente
                    </td>
                    <td className="px-4 py-2 text-right font-['Inter_Tight'] font-semibold text-[rgba(249,249,249,0.7)] text-xs">
                      {fmt(calculation.maintenanceMonthlyAmount)}/mes
                    </td>
                  </tr>
                )}

                {isLegacy && calculation.dedicatedServerMonthlyCost > 0 && (
                  <tr className="bg-[#0047AB]/8 border-b border-[#0047AB]/15">
                    <td className="px-4 py-2 text-[rgba(249,249,249,0.6)] text-xs">
                      🖥️ <strong className="text-[rgba(249,249,249,0.8)]">Servidor dedicado</strong> — referencia informativa
                    </td>
                    <td className="px-4 py-2 text-right font-['Inter_Tight'] font-semibold text-[rgba(249,249,249,0.7)] text-xs">
                      {fmt(calculation.dedicatedServerMonthlyCost)}/mes
                    </td>
                  </tr>
                )}

                {calculation.domainStatus !== 'none' && (
                  <tr className="bg-[#0047AB]/8 border-b border-[#0047AB]/15">
                    {calculation.domainStatus === 'client_has_domain' ? (
                      <td className="px-4 py-2 text-[rgba(249,249,249,0.6)] text-xs" colSpan={2}>
                        🌐 <strong>Dominio:</strong> El cliente ya tiene dominio — solo configuración DNS
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-2 text-[rgba(249,249,249,0.6)] text-xs">
                          🌐 <strong className="text-[rgba(249,249,249,0.8)]">
                            {calculation.domainTarget ?? 'Dominio'}
                          </strong>
                          <span className="block text-[rgba(249,249,249,0.45)] mt-0.5">
                            ↳ El cliente comprará el dominio — entregas los registros DNS
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-['Inter_Tight'] font-semibold text-[rgba(249,249,249,0.7)] text-xs align-top">
                          {calculation.domainPrice !== undefined ? fmt(calculation.domainPrice) : ''}
                        </td>
                      </>
                    )}
                  </tr>
                )}

                {/* ── DESCUENTO POR VOLUMEN ── */}
                {calculation.volumeDiscountPercent > 0 && calculation.volumeDiscountPercent >= calculation.exceptionDiscountPercent && (
                  <tr className="border-b border-white/10 text-green-400">
                    <td className="px-4 py-2">
                      Descuento por volumen ({(calculation.volumeDiscountPercent * 100).toFixed(0)}%) — automático
                    </td>
                    <td className="px-4 py-2 text-right font-['Inter_Tight']">−{fmt(calculation.volumeDiscountAmount)}</td>
                  </tr>
                )}

                {/* ── DESCUENTO POR EXCEPCIÓN ── */}
                {calculation.exceptionDiscountPercent > 0 && (
                  <tr className={`border-b border-white/10 ${
                    calculation.exceptionDiscountPercent > calculation.volumeDiscountPercent
                      ? 'text-green-400'
                      : 'text-white/50'
                  }`}>
                    <td className="px-4 py-2">
                      Descuento excepción ({(calculation.exceptionDiscountPercent * 100).toFixed(0)}%)
                      {calculation.exceptionDiscountPercent > calculation.volumeDiscountPercent
                        ? ''
                        : ' — no aplicado (menor que volumen)'}
                    </td>
                    <td className="px-4 py-2 text-right font-['Inter_Tight']">
                      {calculation.exceptionDiscountPercent > calculation.volumeDiscountPercent
                        ? `−${fmt(calculation.exceptionDiscountAmount)}`
                        : <span className="line-through">−{fmt(calculation.exceptionDiscountAmount)}</span>}
                    </td>
                  </tr>
                )}

                {/* ── TOTAL CON DESCUENTO ── */}
                {calculation.netSubtotal < calculation.grossSubtotal && (
                  <tr className="border-b border-white/10 bg-white/4">
                    <td className="px-4 py-2.5 font-semibold text-green-400">Total con descuento</td>
                    <td className="px-4 py-2.5 text-right font-['Inter_Tight'] font-bold text-green-400">
                      {fmt(calculation.netSubtotal)}
                    </td>
                  </tr>
                )}

                {/* ── COMISIÓN PAYPAL (solo LEGACY) ── */}
                {isLegacy && (
                  <tr className="border-b border-white/10">
                    <td className={`px-4 py-2 ${calculation.paypalFeeIncluded ? 'text-orange-600' : 'text-white/50'}`}>
                      Comisión PayPal (5.4% + $0.30)
                      {!calculation.paypalFeeIncluded && (
                        <span className="ml-2 text-xs">[desactivado — pago directo]</span>
                      )}
                    </td>
                    <td className={`px-4 py-2 text-right font-['Inter_Tight'] ${calculation.paypalFeeIncluded ? 'text-orange-600' : 'text-white/50'}`}>
                      {calculation.paypalFeeIncluded ? `+${fmt(calculation.paypalFeeAmount)}` : '$0.00'}
                    </td>
                  </tr>
                )}

                {/* ── TOTAL ── */}
                {isLegacy ? (
                  <tr className="bg-[#121212]">
                    <td className="px-4 py-4 font-bold text-[#F9F9F9] font-['Clash_Grotesk'] text-base">
                      TOTAL A COBRAR AL CLIENTE
                    </td>
                    <td className="px-4 py-4 text-right font-['Clash_Grotesk'] font-bold text-[#FF8C00] text-xl">
                      {fmt(calculation.finalClientPriceRounded)}
                    </td>
                  </tr>
                ) : (
                  <>
                    <tr className="bg-[#121212] border-t-2 border-white/20">
                      <td className="px-4 py-3 font-bold text-[#F9F9F9] font-['Clash_Grotesk'] text-sm uppercase tracking-wide">
                        {contractDuration === 'annual' ? 'ANUALIDAD' : 'MENSUALIDAD'}
                      </td>
                      <td className="px-4 py-3 text-right font-['Clash_Grotesk'] font-bold text-[#FF8C00] text-lg">
                        {contractDuration === 'annual'
                          ? `${fmt(calculation.planAnnualAfterDiscount ?? calculation.basePrice * 12 * 0.9)}/año`
                          : `${fmt(calculation.basePrice)}/mes`}
                      </td>
                    </tr>
                    {calculation.netAddOnsTotal > 0 && (
                      <tr className="bg-[#121212]">
                        <td className="px-4 py-3 font-bold text-[#F9F9F9] font-['Clash_Grotesk'] text-sm uppercase tracking-wide">
                          ADD-ONS (COBRO ÚNICO)
                        </td>
                        <td className="px-4 py-3 text-right font-['Inter_Tight'] font-semibold text-white/80">
                          {fmt(calculation.netAddOnsTotal)}
                        </td>
                      </tr>
                    )}
                    {calculation.setupFeeAmount > 0 && (
                      <tr className="bg-[#121212]">
                        <td className="px-4 py-3 font-bold text-[#F9F9F9] font-['Clash_Grotesk'] text-sm uppercase tracking-wide">
                          ACTIVACIÓN ÚNICA (setup fee)
                        </td>
                        <td className="px-4 py-3 text-right font-['Inter_Tight'] font-semibold text-white/80">
                          {fmt(calculation.setupFeeAmount)}
                        </td>
                      </tr>
                    )}
                    {(calculation.netAddOnsTotal + calculation.setupFeeAmount) > 0 && (
                      <tr className="bg-[#FF8C00]/10 border-t border-[#FF8C00]/30">
                        <td className="px-4 py-3 font-bold text-[#F9F9F9] font-['Clash_Grotesk'] text-sm uppercase tracking-wide">
                          TOTAL PRIMER COBRO
                        </td>
                        <td className="px-4 py-3 text-right font-['Clash_Grotesk'] font-bold text-white text-lg">
                          {contractDuration === 'annual'
                            ? fmt((calculation.planAnnualAfterDiscount ?? calculation.basePrice * 12 * 0.9) + calculation.netAddOnsTotal + calculation.setupFeeAmount)
                            : fmt(calculation.basePrice + calculation.netAddOnsTotal + calculation.setupFeeAmount)}
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* ── CUOTAS (solo LEGACY con 3 cuotas) ── */}
          {isLegacy && paymentStructure === 'installments' && calculation.installments && (
            <div className="border border-white/10 rounded-xl overflow-hidden">
              <div className="bg-white/4 px-4 py-2.5 border-b border-white/10">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  Estructura de 3 cuotas (50 / 25 / 25)
                  {calculation.paypalFeeIncluded && ' — con comisión PayPal individual por cuota'}
                </p>
              </div>
              <div className="divide-y divide-white/8">
                {[
                  { label: 'Cuota 1 — Al firmar', pct: '50%', amount: calculation.installments.installment1, fee: calculation.installments.paypalFeeI1, hint: 'Xavier inicia el desarrollo' },
                  { label: 'Cuota 2 — Al aprobar staging', pct: '25%', amount: calculation.installments.installment2, fee: calculation.installments.paypalFeeI2, hint: 'Xavier sube el preview al servidor' },
                  { label: 'Cuota 3 — Al aprobar el final', pct: '25%', amount: calculation.installments.installment3, fee: calculation.installments.paypalFeeI3, hint: 'Xavier entrega repositorio + dominio + accesos' },
                ].map((q, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-['Inter_Tight'] font-semibold text-[#F9F9F9]">
                        {q.label}
                        <span className="ml-2 text-xs font-normal text-white/40">({q.pct})</span>
                      </p>
                      <p className="text-xs text-white/40 font-['Inter_Tight'] mt-0.5">{q.hint}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-['Clash_Grotesk'] font-bold text-[#F9F9F9]">{fmt(q.amount)}</p>
                      {calculation.paypalFeeIncluded && q.fee > 0 && (
                        <p className="text-xs text-orange-400 font-['Inter_Tight']">fee: {fmt(q.fee)}</p>
                      )}
                    </div>
                  </div>
                ))}
                <div className="px-4 py-3 bg-white/4 flex justify-between border-t border-white/10">
                  <span className="text-sm font-['Inter_Tight'] text-white/60">Total cliente</span>
                  <span className="text-sm font-['Clash_Grotesk'] font-bold text-[#F9F9F9]">
                    {fmt(calculation.installments.totalClientPays)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── CRONOGRAMA ── */}
          <div className="p-4 bg-white/4 border border-white/10 rounded-xl">
            <h3 className="text-sm font-['Inter_Tight'] font-semibold text-white/70 mb-2">
              {isLegacy ? 'Cronograma de entrega estimado' : 'Fechas de activación'}
            </h3>
            <div className="space-y-1.5 text-sm font-['Inter_Tight'] text-white/60">
              <p>📅 Inicio: <span className="font-medium">{proposalData.startDateEstimate}</span></p>
              {isLegacy && (
                <>
                  <p>🖥️ Staging: <span className="font-medium">{proposalData.stagingDeadline}</span></p>
                  <p>✅ Entrega final: <span className="font-medium">~{proposalData.finalDeliveryEstimate}</span></p>
                </>
              )}
              <p>⏱ Propuesta válida hasta: <span className="font-medium">{validUntil.toLocaleDateString('es-DO')}</span></p>
            </div>
          </div>

          {/* ── REFERENCIA INTERNA ── */}
          {(clientInput.domainTarget || clientInput.inspirationLinks || proposalData.internalNotes) && (
            <div className="p-4 bg-[#FF8C00]/6 border border-[#FF8C00]/20 rounded-xl">
              <h3 className="text-xs font-['Inter_Tight'] font-semibold text-[#FF8C00] uppercase tracking-wider mb-2">
                Referencia interna — no se envía al cliente
              </h3>
              <div className="space-y-1.5 text-sm font-['Inter_Tight'] text-white/60">
                {clientInput.domainTarget && (
                  <p>🌐 <strong>Dominio:</strong> {clientInput.domainTarget}</p>
                )}
                {clientInput.inspirationLinks && (
                  <p>🔗 <strong>Inspiración:</strong> {clientInput.inspirationLinks}</p>
                )}
                {proposalData.internalNotes && (
                  <p>📋 <strong>Notas:</strong> {proposalData.internalNotes}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          TAB: VISTA PROPUESTA (para el cliente)
      ═══════════════════════════════════════════════════ */}
      {activeTab === 'propuesta' && (
        <div className="space-y-4">
          {/* Editar resumen ejecutivo */}
          <div>
            <label className="block text-sm font-['Inter_Tight'] font-semibold text-white/60 mb-1">
              Resumen ejecutivo
              <span className="ml-2 text-xs text-white/30 font-normal">Editable — aparece en la propuesta del cliente</span>
            </label>
            <textarea
              value={editedSummary}
              onChange={(e) => onSummaryChange(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-['Inter_Tight'] text-[#F9F9F9] placeholder-white/30 focus:outline-none focus:ring-[3px] focus:ring-[#FF8C00]/15 focus:border-[#FF8C00] transition-[border-color,box-shadow] duration-150"
            />
          </div>

          {/* Propuesta visual */}
          <div className="border border-white/10 rounded-xl overflow-hidden print:shadow-none">
            <div className="bg-[#0F1014] px-6 py-5 border-b border-white/8">
              <p className="text-xs font-['Inter_Tight'] text-white/30 uppercase tracking-wider">Website as a Service — Propuesta Ejecutiva</p>
              <h2 className="text-xl font-['Clash_Grotesk'] font-bold text-[#F9F9F9] mt-1">{proposalData.businessName}</h2>
              <p className="text-white/50 font-['Inter_Tight'] mt-1 text-sm">{clientInput.clientName}</p>
            </div>
            <div className="bg-white/4 px-6 py-3 flex justify-between text-xs border-b border-white/8">
              <div>
                <p className="font-['Inter_Tight'] text-white/30">Preparada por</p>
                <p className="font-['Inter_Tight'] font-medium text-[#F9F9F9]">Xavier Quirico</p>
              </div>
              <div className="text-right">
                <p className="font-['Inter_Tight'] text-white/30">Válida hasta</p>
                <p className="font-['Inter_Tight'] font-medium text-[#FF8C00]">{validUntil.toLocaleDateString('es-DO')}</p>
              </div>
            </div>
            <div className="p-6 space-y-5 bg-[#121212]">
              <div className="p-4 bg-white/4 rounded-lg border-l-4 border-[#FF8C00]">
                <p className="text-xs font-['Inter_Tight'] font-semibold text-white/40 uppercase mb-1">Resumen del Proyecto</p>
                <p className="text-sm font-['Inter_Tight'] text-white/70 leading-relaxed">{editedSummary}</p>
              </div>

              <div>
                <p className="text-xs font-['Inter_Tight'] font-semibold text-white/40 uppercase mb-2">Inversión</p>
                <div className="space-y-1.5">
                  {isLegacy ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="font-['Inter_Tight'] text-white/60">Desarrollo web completo</span>
                        <span className="font-['Inter_Tight'] font-medium text-[#F9F9F9]">{fmt(calculation.grossSubtotal)}</span>
                      </div>
                      {calculation.finalDiscountAmount > 0 && (
                        <div className="flex justify-between text-sm text-green-400 font-['Inter_Tight']">
                          <span>Descuento especial ({(calculation.finalDiscountPercent * 100).toFixed(0)}%)</span>
                          <span>−{fmt(calculation.finalDiscountAmount)}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex justify-between text-sm">
                      <span className="font-['Inter_Tight'] text-white/60">Plan {clientInput.subscriptionPlan?.toUpperCase()} — mensual</span>
                      <span className="font-['Inter_Tight'] font-medium text-[#F9F9F9]">{fmt(calculation.netSubtotal)}/mes</span>
                    </div>
                  )}
                  <div className="border-t border-white/10 mt-2 pt-2 flex justify-between">
                    <span className="font-['Clash_Grotesk'] font-bold text-[#F9F9F9]">TOTAL</span>
                    <span className="font-['Clash_Grotesk'] font-bold text-[#FF8C00] text-lg">{fmt(calculation.finalClientPriceRounded)}</span>
                  </div>
                </div>
              </div>

              {isLegacy && paymentStructure === 'installments' && calculation.installments && (
                <div>
                  <p className="text-xs font-['Inter_Tight'] font-semibold text-white/40 uppercase mb-2">Plan de Pagos</p>
                  <div className="space-y-1.5">
                    {[
                      { label: '50% al firmar', amount: calculation.installments.installment1 },
                      { label: '25% al aprobar staging', amount: calculation.installments.installment2 },
                      { label: '25% al aprobar final', amount: calculation.installments.installment3 },
                    ].map((q, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="font-['Inter_Tight'] text-white/60">{q.label}</span>
                        <span className="font-['Inter_Tight'] font-medium text-[#F9F9F9]">{fmt(q.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isLegacy && (
                <div>
                  <p className="text-xs font-['Inter_Tight'] font-semibold text-white/40 uppercase mb-2">Cronograma Estimado</p>
                  <div className="space-y-1 text-sm font-['Inter_Tight'] text-white/60">
                    <p>📅 Inicio: {proposalData.startDateEstimate}</p>
                    <p>🖥️ Versión staging: {proposalData.stagingDeadline}</p>
                    <p>✅ Entrega final: {proposalData.finalDeliveryEstimate}</p>
                  </div>
                </div>
              )}

              <div className="text-center">
                <p className="text-sm font-['Inter_Tight'] text-white/40 mb-2">¿Listo para comenzar?</p>
                <div className="inline-block px-6 py-3 bg-[#FF8C00] text-[#121212] rounded-lg text-sm font-['Clash_Grotesk'] font-bold cursor-default">
                  Confírmala hoy →
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── NAVEGACIÓN ───────────────────────────────────── */}
      <div className="flex justify-between pt-4 border-t border-white/10">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 border border-white/10 rounded-lg text-sm font-['Inter_Tight'] text-white/60 hover:bg-white/8 hover:border-white/20 transition-all duration-150"
        >
          ← Ajustar
        </button>
        <button
          type="button"
          onClick={onReset}
          className="px-4 py-2 border border-white/10 rounded-lg text-sm font-['Inter_Tight'] text-white/60 hover:bg-white/8 hover:border-white/20 transition-all duration-150"
        >
          Nueva cotización
        </button>
      </div>

      {/* Solo visible al imprimir */}
      <div className="hidden print:block print-proposal" id="print-proposal-content">
        <style>{`
          @media print {
            body > *:not(#print-proposal-content) { display: none !important; }
            #print-proposal-content { display: block !important; }
          }
        `}</style>
        <div style={{ fontFamily: 'sans-serif', padding: '20px', background: 'white', color: '#111827' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>Propuesta Ejecutiva</h1>
          <p style={{ fontSize: '16px', color: '#374151', marginBottom: '24px' }}>{proposalData.businessName} — {clientInput.clientName}</p>
          <p style={{ fontSize: '14px', lineHeight: 1.7, marginBottom: '24px', color: '#374151' }}>{editedSummary}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Componente</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Precio</th>
              </tr>
            </thead>
            <tbody>
              {calculation.components.map((c) => (
                <tr key={c.id}>
                  <td style={{ padding: '8px 12px', fontSize: '14px', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{c.name}</td>
                  <td style={{ padding: '8px 12px', fontSize: '14px', color: '#374151', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>{c.price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#111827' }}>
                <td style={{ padding: '12px', fontWeight: 800, color: '#fff', fontSize: '16px' }}>
                  {isLegacy ? 'INVERSIÓN TOTAL' : 'MENSUALIDAD'}
                </td>
                <td style={{ padding: '12px', fontWeight: 800, color: '#fff', fontSize: '18px', textAlign: 'right' }}>
                  {isLegacy
                    ? calculation.finalClientPriceRounded.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                    : `${calculation.basePrice.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}/mes`}
                </td>
              </tr>
            </tfoot>
          </table>
          <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', marginTop: '32px' }}>
            Xavier Quirico · Website as a Service · Propuesta válida hasta {validUntil.toLocaleDateString('es-DO')}
          </p>
        </div>
      </div>
    </div>
  );
}
