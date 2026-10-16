'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AIAnalysisResult, ClientContextInput, SelectedComponent } from '@/lib/calculadora/types';
import {
  SECTION_NAMES,
  getCalculatorCatalogComponents,
  getCalculatorComponentsFromBreakdown,
  toCommercialPlan,
} from '@/lib/calculadora/catalog-components';
import { formatUSD } from '@/lib/calculadora/formulas';
import { getCatalogBreakdownAction } from '../actions/getCatalogBreakdown';

interface Props {
  aiResult: AIAnalysisResult;
  initialSelected?: SelectedComponent[];
  clientInput?: ClientContextInput | null;
  onNext: (selected: SelectedComponent[]) => void;
  onBack: () => void;
  onChange?: (selected: SelectedComponent[]) => void;
  onPlanChange?: (plan: 'basic' | 'pro' | 'business') => void;
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

const PLAN_ORDER = ['basic', 'pro', 'business'] as const;

function planIsInsufficient(current: string | undefined, required: 'pro' | 'business') {
  if (!current) return false;
  return PLAN_ORDER.indexOf(current as (typeof PLAN_ORDER)[number]) < PLAN_ORDER.indexOf(required);
}

function requiredPlanForSection(section: number): 'pro' | 'business' | null {
  if (section === 3) return 'pro';
  if ([4, 6, 7].includes(section)) return 'business';
  return null;
}

export function AIComponentSuggestion({
  aiResult,
  initialSelected,
  clientInput,
  onNext,
  onBack,
  onChange,
  onPlanChange,
}: Props) {
  const [catalogComponents, setCatalogComponents] = useState(getCalculatorCatalogComponents);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([2, 4, 5, 7]));
  const [selected, setSelected] = useState<Record<string, SelectedComponent>>(() => {
    const map: Record<string, SelectedComponent> = {};
    const source = initialSelected?.length
      ? initialSelected
      : aiResult.suggestedComponents.map((suggestion) => ({
          componentId: suggestion.componentId,
          aiSuggested: true,
          aiReason: suggestion.reason,
          quantity: 1,
        }));
    for (const item of source) {
      map[item.componentId] = item;
    }
    return map;
  });
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [editPriceInput, setEditPriceInput] = useState('');

  useEffect(() => {
    const plan =
      clientInput?.projectType === 'legacy'
        ? 'LEGACY'
        : toCommercialPlan(clientInput?.subscriptionPlan);
    if (!plan) {
      setCatalogComponents(getCalculatorCatalogComponents());
      return;
    }

    let cancelled = false;
    getCatalogBreakdownAction(plan)
      .then((res) => {
        if (!cancelled && res.success) {
          setCatalogComponents(getCalculatorComponentsFromBreakdown(res.data));
        }
      })
      .catch(() => {
        if (!cancelled) setCatalogComponents(getCalculatorCatalogComponents());
      });

    return () => {
      cancelled = true;
    };
  }, [clientInput?.projectType, clientInput?.subscriptionPlan]);

  const componentById = useMemo(() => {
    return new Map(catalogComponents.map((component) => [component.id, component]));
  }, [catalogComponents]);

  const selectedList = useMemo(() => {
    return Object.values(selected).map((item) => {
      const component = componentById.get(item.componentId);
      const catalogPrice = typeof component?.price === 'number' ? component.price : undefined;
      return {
        ...item,
        // embeber nombre y sección del catálogo vivo en el SelectedComponent
        // para que calcComponentsTotal no requiera acceso al catálogo en runtime.
        name: item.name ?? component?.name,
        sectionName: item.sectionName ?? component?.sectionName,
        priceOverride: priceOverrides[item.componentId] ?? catalogPrice,
      };
    });
  }, [componentById, priceOverrides, selected]);

  useEffect(() => {
    onChange?.(selectedList);
  }, [onChange, selectedList]);

  const suggestedById = useMemo(() => {
    return new Map(aiResult.suggestedComponents.map((suggestion) => [suggestion.componentId, suggestion]));
  }, [aiResult.suggestedComponents]);

  const selectedPaidItems = selectedList.filter((item) => {
    const component = componentById.get(item.componentId);
    return typeof component?.price === 'number';
  });

  const estimatedTotal = selectedPaidItems.reduce((sum, item) => {
    const component = componentById.get(item.componentId);
    const unitPrice = priceOverrides[item.componentId] ?? (typeof component?.price === 'number' ? component.price : 0);
    return sum + unitPrice * (item.quantity ?? 1);
  }, 0);

  const sections = useMemo(() => {
    return Array.from(new Set(catalogComponents.map((component) => component.section))).sort((a, b) => a - b);
  }, [catalogComponents]);

  function toggleSection(section: number) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  function toggleComponent(componentId: string) {
    const component = componentById.get(componentId);
    if (!component || component.price === 'quote' || component.price === 'included') return;

    setSelected((prev) => {
      const next = { ...prev };
      if (next[componentId]) {
        delete next[componentId];
      } else {
        const suggestion = suggestedById.get(componentId);
        next[componentId] = {
          componentId,
          aiSuggested: Boolean(suggestion),
          aiReason: suggestion?.reason,
          quantity: 1,
        };
      }
      return next;
    });
  }

  function removeComponent(componentId: string) {
    setSelected((prev) => {
      const next = { ...prev };
      delete next[componentId];
      return next;
    });
  }

  function handleSubmit() {
    onNext(selectedList);
  }

  return (
    <div className="space-y-6">
      <div
        className={`p-4 rounded-xl border-2 ${
          aiResult.projectFlag === 'enterprise'
            ? 'bg-[rgba(239,68,68,0.08)] border-red-500/30'
            : aiResult.projectFlag === 'requires_review'
              ? 'bg-[rgba(245,158,11,0.08)] border-yellow-500/30'
              : 'bg-[rgba(4,57,39,0.15)] border-[#043927]/50'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#F9F9F9]">
              {aiResult.projectFlag === 'enterprise' && 'Proyecto Enterprise - requiere cotizacion manual'}
              {aiResult.projectFlag === 'requires_review' && 'Proyecto complejo - revisar antes de enviar'}
              {aiResult.projectFlag === 'standard' && 'Proyecto estandar - listo para cotizar'}
            </p>
            <p className="text-sm text-[rgba(249,249,249,0.7)] mt-1">
              Complejidad estimada:{' '}
              <strong className="text-[#F9F9F9]">{aiResult.complexityScore}/10</strong>
            </p>
            {aiResult.enterpriseReason && (
              <p className="text-sm text-red-400 mt-1">{aiResult.enterpriseReason}</p>
            )}
            {aiResult.entryPointEstimate && (
              <p className="text-sm text-[rgba(249,249,249,0.7)] mt-1">{aiResult.entryPointEstimate}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-['Inter_Tight'] text-white/40">Sugerencias</p>
            <p className="text-2xl font-['Clash_Grotesk'] font-bold text-[#FF8C00]">
              {aiResult.suggestedComponents.length}
            </p>
          </div>
        </div>

        {aiResult.executiveSummary && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1">
              Resumen para la propuesta
            </p>
            <p className="text-sm text-[rgba(249,249,249,0.7)] italic">
              &ldquo;{aiResult.executiveSummary}&rdquo;
            </p>
          </div>
        )}
      </div>

      {aiResult.suggestedPlan && !clientInput?.subscriptionPlan && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-[#FF8C00]/30 bg-[rgba(255,140,0,0.06)]">
          <div>
            <p className="text-sm font-['Clash_Grotesk'] font-semibold text-[#FF8C00]">
              La IA recomienda el Plan {aiResult.suggestedPlan.toUpperCase()}
            </p>
            <p className="text-xs text-white/40 mt-0.5">
              Basado en el catalogo comercial y las funcionalidades solicitadas
            </p>
          </div>
          <button
            type="button"
            onClick={() => onPlanChange?.(aiResult.suggestedPlan!)}
            className="shrink-0 px-3 py-1.5 bg-[#FF8C00] text-[#121212] rounded-lg text-xs font-['Clash_Grotesk'] font-semibold hover:bg-[#E67E00] transition-colors"
          >
            Usar Plan {aiResult.suggestedPlan.toUpperCase()}
          </button>
        </div>
      )}

      {aiResult.detectedFlags?.length ? (
        <div>
          <h3 className="text-sm font-['Clash_Grotesk'] font-semibold text-[#F9F9F9] mb-2">
            Flags detectados
          </h3>
          <div className="space-y-1.5">
            {aiResult.detectedFlags.map((flag, index) => (
              <div
                key={`${flag.type}-${index}`}
                className={`px-3 py-2 rounded-lg text-sm border ${
                  flag.type === 'warning'
                    ? 'bg-[rgba(245,158,11,0.08)] border-[#FF8C00]/20 text-[#FF8C00]'
                    : flag.type === 'ok'
                      ? 'bg-[rgba(4,57,39,0.15)] border-[#043927]/50 text-green-400'
                      : 'bg-white/4 border-white/10 text-white/60'
                }`}
              >
                {flag.message}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <h3 className="text-[9px] font-['Inter_Tight'] font-semibold uppercase tracking-[.14em] text-[#FF8C00] mb-3">
          Capacidades seleccionadas ({selectedPaidItems.length})
        </h3>
        {selectedPaidItems.length === 0 ? (
          <div className="flex items-center justify-center py-8 border border-dashed border-white/10 rounded-lg">
            <p className="text-sm text-white/30 font-['Inter_Tight']">
              Selecciona capacidades cobrables del catalogo comercial
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {selectedPaidItems.map((item) => {
              const component = componentById.get(item.componentId);
              if (!component || typeof component.price !== 'number') return null;
              const effectivePrice = priceOverrides[item.componentId] ?? component.price;
              const suggestion = suggestedById.get(item.componentId);
              return (
                <div
                  key={item.componentId}
                  className="relative p-3 border border-[#FF8C00]/40 bg-[rgba(255,140,0,0.06)] rounded-lg group"
                >
                  <button
                    type="button"
                    onClick={() => removeComponent(item.componentId)}
                    className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 rounded-full text-xs transition-colors"
                  >
                    x
                  </button>
                  <div className="pr-6">
                    {suggestion && (
                      <span className="inline-block mb-1 px-1.5 py-0.5 bg-[rgba(255,140,0,0.15)] text-[#FF8C00] text-[9px] font-['Inter_Tight'] uppercase tracking-[.1em] rounded border border-[#FF8C00]/30">
                        IA {CONFIDENCE_LABELS[suggestion.confidence]}
                      </span>
                    )}
                    <p className="text-xs font-['Inter_Tight'] font-medium text-[rgba(249,249,249,0.9)] leading-tight">
                      {component.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <p className="text-sm font-bold text-[#FF8C00]">{formatUSD(effectivePrice)}</p>
                      <button
                        type="button"
                        title="Editar precio"
                        onClick={() => {
                          setEditingPrice(item.componentId);
                          setEditPriceInput(String(effectivePrice));
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-white/40 hover:text-white/70"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-['Clash_Grotesk'] font-semibold text-[#F9F9F9]">
            Agregar capacidades del catalogo
          </h3>
        </div>

        <div className="space-y-2">
          {sections.map((section) => {
            const sectionComponents = catalogComponents.filter((component) => component.section === section);
            const sectionHasSelected = sectionComponents.some((component) => selected[component.id]);
            const requiredPlan = requiredPlanForSection(section);
            const locked =
              clientInput?.projectType === 'subscription' &&
              requiredPlan &&
              planIsInsufficient(clientInput.subscriptionPlan, requiredPlan);

            return (
              <div key={section} className="border border-white/10 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection(section)}
                  className={`w-full flex items-center justify-between px-4 py-3 bg-white/4 transition-colors hover:bg-white/8 ${
                    locked ? 'opacity-60' : ''
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {sectionHasSelected && <span className="w-2 h-2 bg-[#FF8C00] rounded-full inline-block" />}
                    <span className="font-['Clash_Grotesk'] font-semibold text-[#F9F9F9]">
                      {SECTION_NAMES[section] ?? `Seccion ${section}`}
                    </span>
                    <span className="text-[rgba(249,249,249,0.3)] text-xs font-['Inter_Tight'] tracking-[.08em]">
                      {sectionComponents.length} items
                    </span>
                    {locked && (
                      <span className="px-2 py-0.5 bg-[#FF8C00]/10 text-[#FF8C00] text-[9px] font-['Inter_Tight'] uppercase tracking-[.1em] rounded">
                        Plan {requiredPlan?.toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="text-white/40 text-xs">
                    {expandedSections.has(section) ? '▲' : '▼'}
                  </span>
                </button>

                {expandedSections.has(section) && (
                  <div className="divide-y divide-white/5">
                    {sectionComponents.map((component) => {
                      const isNumericPrice = typeof component.price === 'number';
                      const isIncluded = component.price === 'included';
                      const isQuote = component.price === 'quote';
                      const isUnavailable = component.availability === 'unavailable';
                      const isSelected = Boolean(selected[component.id]);
                      const suggestion = suggestedById.get(component.id);
                      const isSelectable = isNumericPrice && !locked && !isUnavailable;

                      return (
                        <div
                          key={component.id}
                          className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                            !isSelectable
                              ? 'cursor-default bg-white/2 opacity-60'
                              : isSelected
                                ? 'cursor-pointer bg-white/5'
                                : 'cursor-pointer hover:bg-white/5'
                          }`}
                          onClick={() => isSelectable && toggleComponent(component.id)}
                        >
                          {isSelectable ? (
                            <div
                              className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-[#FF8C00] border-[#FF8C00]' : 'border-2 border-white/20'
                              }`}
                            >
                              {isSelected && <span className="text-[#121212] text-xs">✓</span>}
                            </div>
                          ) : (
                            <div className="mt-0.5 w-5 h-5 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-['Inter_Tight'] leading-tight text-[rgba(249,249,249,0.8)]">
                                {component.name}
                                {suggestion && (
                                  <span className="ml-2 px-1.5 py-0.5 bg-[rgba(245,158,11,0.08)] text-[#FF8C00] text-xs rounded border border-[#FF8C00]/20">
                                    IA
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0">
                                {isNumericPrice && (
                                  <span className="text-sm font-semibold text-[#FF8C00]">
                                    {formatUSD(component.price as number)}
                                  </span>
                                )}
                                {isIncluded && (
                                  <span className="px-2 py-0.5 bg-[rgba(4,57,39,0.15)] text-green-400 text-xs font-medium rounded-full border border-[#043927]/50">
                                    Incluido
                                  </span>
                                )}
                                {isQuote && (
                                  <span className="px-2 py-0.5 bg-[rgba(245,158,11,0.08)] text-[#FF8C00] text-xs font-medium rounded-full border border-[#FF8C00]/20">
                                    A cotizar
                                  </span>
                                )}
                                {isUnavailable && (
                                  <span className="px-2 py-0.5 bg-white/5 text-white/35 text-xs font-medium rounded-full border border-white/10">
                                    No disponible
                                  </span>
                                )}
                              </span>
                            </div>
                            {component.notes && (
                              <p className="text-xs text-white/30 mt-0.5">{component.notes}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {editingPrice && (() => {
        const component = componentById.get(editingPrice);
        if (!component) return null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setEditingPrice(null)}
          >
            <div
              className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-80 space-y-4"
              onClick={(event) => event.stopPropagation()}
            >
              <h4 className="text-sm font-['Clash_Grotesk'] font-semibold text-[#F9F9F9]">
                Editar precio
              </h4>
              <p className="text-xs text-white/40 font-['Inter_Tight']">{component.name}</p>
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-sm">$</span>
                <input
                  type="number"
                  value={editPriceInput}
                  onChange={(event) => setEditPriceInput(event.target.value)}
                  className="flex-1 bg-white/6 border border-white/15 rounded-lg px-3 py-2 text-sm text-[#F9F9F9] font-['Inter_Tight'] focus:outline-none focus:border-[#FF8C00]/50"
                  placeholder="0"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPrice(null)}
                  className="flex-1 py-2 border border-white/15 rounded-lg text-sm text-white/50 hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const value = Number.parseFloat(editPriceInput);
                    if (!Number.isNaN(value) && value >= 0) {
                      setPriceOverrides((prev) => ({ ...prev, [editingPrice]: value }));
                    }
                    setEditingPrice(null);
                  }}
                  className="flex-1 py-2 bg-[#FF8C00] text-[#121212] rounded-lg text-sm font-['Clash_Grotesk'] font-semibold hover:bg-[#E67E00] transition-colors"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="sticky bottom-0 bg-[#121212] border-t border-white/10 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-['Inter_Tight'] text-white/40">Add-ons seleccionados</p>
            <p className="text-2xl font-['Clash_Grotesk'] font-bold text-[#FF8C00]">
              {formatUSD(estimatedTotal)}
            </p>
            <p className="text-xs font-['Inter_Tight'] text-white/40">
              {selectedPaidItems.length} capacidades cobrables
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 border border-white/15 rounded-lg text-sm text-white/50 hover:bg-white/5 transition-colors"
            >
              Atras
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-6 py-2 bg-[#FF8C00] text-[#121212] rounded-lg text-sm font-['Clash_Grotesk'] font-semibold hover:bg-[#E67E00] transition-colors"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
