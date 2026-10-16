'use client';

import { useState, useEffect } from 'react';
import type {
  CatalogAdminItem,
  CatalogAdminPlanRule,
  PortalCategoryAdmin,
} from '../catalog-actions';
import {
  updateCatalogItemV3Action,
  getItemUsageAction,
} from '../catalog-actions';
import {
  isCatalogPriceEditable,
  isCatalogPortalVisibilityEditable,
  getCatalogProtectionLevel,
  validateOperationalPriceChange,
} from '@/lib/catalog/catalog-safety';

type DrawerTab = 'presentacion' | 'pricing' | 'reglas' | 'visibilidad' | 'uso';

type Props = {
  item: CatalogAdminItem;
  portalCategories: PortalCategoryAdmin[];
  onClose: () => void;
  onUpdated: (updated: CatalogAdminItem) => void;
};

const PLANS = ['BASIC', 'PRO', 'BUSINESS', 'LEGACY'] as const;
const REQUEST_KIND_LABELS: Record<string, string> = {
  initial_delivery: 'Entrega inicial', change: 'Cambio', correction: 'Correccion',
  expansion: 'Expansion', maintenance: 'Mantenimiento', reactivation: 'Reactivacion',
};
const PLAN_COLORS: Record<string, string> = {
  BASIC: '#D4B8FF', PRO: '#FF8C00', BUSINESS: '#FFB347', LEGACY: '#6B9FFF',
};
const AVAILABILITY_LABELS: Record<string, string> = {
  included: 'Incluido', paid: 'Pago', quote: 'Cotizacion', unavailable: 'No disponible',
};
const CATEGORY_LABELS: Record<string, string> = {
  design: 'Diseno', content: 'Contenido', integration: 'Integracion',
  revision: 'Revision', custom: 'Personalizado',
};

const s = {
  input: {
    background: 'var(--surface-2)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
    borderRadius: 8, padding: '8px 12px', color: 'var(--text)',
    fontFamily: 'Inter Tight', fontSize: 13, border: 'none', outline: 'none', width: '100%',
  } as const,
  inputRO: {
    background: 'var(--surface-2)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
    borderRadius: 8, padding: '8px 12px', color: 'var(--text)',
    fontFamily: 'Inter Tight', fontSize: 13, border: 'none', outline: 'none', width: '100%',
    opacity: 0.45, cursor: 'not-allowed',
  } as const,
  label: {
    fontFamily: 'Inter Tight', fontSize: 11, color: 'var(--text-2)', marginBottom: 4, display: 'block',
  } as const,
  saveBtn: {
    background: '#FF8C00', color: '#121212', borderRadius: 100, padding: '7px 18px',
    fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'Inter Tight',
  } as const,
  row: { display: 'flex', flexDirection: 'column' as const, gap: 4 },
  roNote: { fontSize: 10, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.4 } as const,
  infoBox: {
    padding: '10px 12px', borderRadius: 8, background: 'rgba(107,159,255,0.07)',
    border: '1px solid rgba(107,159,255,0.12)', fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5,
  } as const,
  warnBox: {
    padding: '10px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.07)',
    border: '1px solid rgba(248,113,113,0.12)', fontSize: 11, color: '#F87171', lineHeight: 1.5,
  } as const,
};

function PlanRuleReadOnly({ plan, rule }: { plan: typeof PLANS[number]; rule: CatalogAdminPlanRule | undefined }) {
  const color = PLAN_COLORS[plan];
  if (!rule) {
    return (
      <div style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, background: `${color}22`, color, padding: '2px 7px', borderRadius: 4 }}>{plan}</span>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Sin regla</span>
      </div>
    );
  }
  return (
    <div style={{ borderRadius: 10, border: `1px solid ${color}30`, marginBottom: 8, background: `${color}08` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${color}18` }}>
        <span style={{ fontSize: 10, fontWeight: 700, background: `${color}22`, color, padding: '2px 7px', borderRadius: 4 }}>{plan}</span>
        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{AVAILABILITY_LABELS[rule.availability] ?? rule.availability}</span>
        {rule.inclusionScope && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{rule.inclusionScope}</span>}
      </div>
      <div style={{ padding: '8px 14px', display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 10, color: 'var(--text-3)' }}>
        {rule.availability === 'included' && (
          <>
            {rule.initialIncludedQty > 0 && <span>Inicial: {rule.initialIncludedQty}</span>}
            {rule.recurringIncludedQty > 0 && <span>Recurrente: {rule.recurringIncludedQty}/{rule.recurringPeriod}</span>}
            <span>Overage: {rule.overageMode}</span>
          </>
        )}
        {rule.allowedRequestKinds.length > 0 && (
          <span>Solicitudes: {rule.allowedRequestKinds.map((k) => REQUEST_KIND_LABELS[k] ?? k).join(', ')}</span>
        )}
      </div>
    </div>
  );
}

export function CapabilityDrawer({ item, portalCategories, onClose, onUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('presentacion');
  const [draft, setDraft] = useState<CatalogAdminItem>({ ...item });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [usage, setUsage] = useState<{ total: number; projects: number; usages: import('../catalog-actions').ItemUsageEntry[] } | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  const priceEditable = isCatalogPriceEditable({ code: item.code, pricingMode: item.pricingMode });
  const portalVisEditable = isCatalogPortalVisibilityEditable(item.code);
  const protectionLevel = getCatalogProtectionLevel(item.source);

  useEffect(() => {
    setDraft({ ...item });
    setActiveTab('presentacion');
    setUsage(null);
    setUsageLoading(false);
    setErr('');
  }, [item]);

  async function savePresentation() {
    setSaving(true); setErr('');
    const result = await updateCatalogItemV3Action({
      id: draft.id,
      publicName: draft.publicName,
      publicDescription: draft.publicDescription,
      adminNotes: draft.adminNotes,
    });
    setSaving(false);
    if ('error' in result) { setErr(result.error); return; }
    onUpdated({ ...draft, planRules: item.planRules });
  }

  async function savePricing() {
    if (!priceEditable) return;
    const priceErr = validateOperationalPriceChange(
      { code: item.code, pricingMode: item.pricingMode },
      { priceCents: draft.priceCents, listPriceCents: draft.listPriceCents },
    );
    if (priceErr) { setErr(priceErr); return; }
    setSaving(true); setErr('');
    const result = await updateCatalogItemV3Action({
      id: draft.id,
      priceCents: draft.priceCents,
      listPriceCents: draft.listPriceCents,
    });
    setSaving(false);
    if ('error' in result) { setErr(result.error); return; }
    onUpdated({ ...draft, planRules: item.planRules });
  }

  async function saveVisibility() {
    setSaving(true); setErr('');
    const updates: Parameters<typeof updateCatalogItemV3Action>[0] = {
      id: draft.id,
      portalCategoryId: draft.portalCategoryId,
      sortOrder: draft.sortOrder,
    };
    if (portalVisEditable) {
      updates.visibleInPortal = draft.visibleInPortal;
    }
    const result = await updateCatalogItemV3Action(updates);
    setSaving(false);
    if ('error' in result) { setErr(result.error); return; }
    onUpdated({ ...draft, planRules: item.planRules });
  }

  async function loadUsage() {
    if (usage || usageLoading) return;
    setUsageLoading(true);
    const result = await getItemUsageAction(item.id);
    setUsageLoading(false);
    if ('error' in result) return;
    setUsage(result);
  }

  useEffect(() => { if (activeTab === 'uso') loadUsage(); }, [activeTab]);

  const tabs: { key: DrawerTab; label: string }[] = [
    { key: 'presentacion', label: 'Presentacion' },
    { key: 'pricing', label: 'Pricing' },
    { key: 'reglas', label: `Reglas (${item.planRules.length})` },
    { key: 'visibilidad', label: 'Visibilidad' },
    { key: 'uso', label: 'Uso' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }} />
      <div data-testid="capability-drawer" style={{ position: 'relative', background: 'var(--surface)', width: '100%', maxWidth: 740, display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,0.5)', zIndex: 1, overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,140,0,0.15)', color: '#FF8C00' }}>{item.code}</span>
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{item.source}</span>
                <span style={{ fontSize: 10, color: item.active ? '#5DD69C' : '#F87171' }}>● {item.active ? 'Activo' : 'Inactivo'}</span>
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(212,184,255,0.1)', color: '#D4B8FF' }}>
                  {protectionLevel === 'canonical' ? 'Canonica protegida' : 'Manual editable'}
                </span>
              </div>
              <h2 style={{ fontFamily: 'Clash Grotesk', fontWeight: 700, fontSize: 20, color: 'var(--text)', margin: 0 }}>{item.name}</h2>
            </div>
            <button type="button" onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: 'var(--text-2)', fontSize: 14 }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {tabs.map((t) => (
              <button key={t.key} type="button" onClick={() => setActiveTab(t.key)}
                style={{ padding: '7px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'Inter Tight', fontSize: 12, fontWeight: 500,
                  color: activeTab === t.key ? '#FF8C00' : 'var(--text-3)',
                  borderBottom: `2px solid ${activeTab === t.key ? '#FF8C00' : 'transparent'}`,
                  marginBottom: -1, transition: 'color 0.15s' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err && <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#F87171', fontSize: 12 }}>{err}</div>}

          {/* Tab: Presentacion */}
          {activeTab === 'presentacion' && (
            <>
              <div style={s.infoBox}>
                Puedes editar como se presenta al cliente sin cambiar reglas del plan.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={s.row}>
                  <label style={s.label}>Codigo (solo lectura)</label>
                  <input value={item.code} readOnly style={s.inputRO} />
                </div>
                <div style={s.row}>
                  <label style={s.label}>Fuente (solo lectura)</label>
                  <input value={item.source} readOnly style={s.inputRO} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={s.row}>
                  <label style={s.label}>Nombre interno (solo lectura)</label>
                  <input value={item.name} readOnly style={s.inputRO} />
                </div>
                <div style={s.row}>
                  <label style={s.label}>Categoria interna (solo lectura)</label>
                  <input value={CATEGORY_LABELS[item.category] ?? item.category} readOnly style={s.inputRO} />
                </div>
              </div>
              <div style={s.row}>
                <label style={s.label}>Estado (solo lectura)</label>
                <input value={item.active ? 'Activo' : 'Inactivo'} readOnly style={s.inputRO} />
                <span style={s.roNote}>El estado de capacidades canonicas no se edita desde admin.</span>
              </div>
              <div style={s.row}>
                <label style={s.label}>Nombre publico (portal cliente)</label>
                <input value={draft.publicName ?? ''} onChange={(e) => setDraft((d) => ({ ...d, publicName: e.target.value || null }))} placeholder="Si vacio, usa el nombre interno" style={s.input} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Descripcion publica (portal cliente)</label>
                <textarea rows={3} value={draft.publicDescription ?? ''} onChange={(e) => setDraft((d) => ({ ...d, publicDescription: e.target.value || null }))} placeholder="Si vacia, usa la descripcion interna" style={{ ...s.input, resize: 'vertical' }} />
              </div>
              <div style={s.row}>
                <label style={s.label}>Notas para admin</label>
                <textarea rows={2} value={draft.adminNotes ?? ''} onChange={(e) => setDraft((d) => ({ ...d, adminNotes: e.target.value || null }))} style={{ ...s.input, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" onClick={savePresentation} disabled={saving} style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Guardando...' : 'Guardar Presentacion'}
                </button>
              </div>
            </>
          )}

          {/* Tab: Pricing */}
          {activeTab === 'pricing' && (
            <>
              <div style={s.row}>
                <label style={s.label}>Modo de precio (solo lectura)</label>
                <input value={item.pricingMode} readOnly style={s.inputRO} />
                <span style={s.roNote}>Este campo alimenta el motor comercial y no se edita desde admin.</span>
              </div>
              {!priceEditable && (
                <div style={s.infoBox}>
                  {item.pricingMode === 'included'
                    ? 'Esta capacidad esta incluida por regla del motor. Su precio de venta no se edita aqui.'
                    : item.pricingMode === 'quote'
                    ? 'Esta capacidad requiere cotizacion. No debe tener precio fijo desde admin.'
                    : 'Capacidad base protegida. Cambios requieren actualizacion del catalogo canonico.'}
                </div>
              )}
              {priceEditable && (
                <div style={s.infoBox}>
                  Precio operativo: cambia lo que se cobra, no cambia si esta incluido o requiere cotizacion.
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={s.row}>
                  <label style={s.label}>Precio operativo (centavos)</label>
                  <input
                    type="number" min={0}
                    value={draft.priceCents}
                    onChange={(e) => { if (priceEditable) setDraft((d) => ({ ...d, priceCents: Number(e.target.value) })); }}
                    readOnly={!priceEditable}
                    style={priceEditable ? s.input : s.inputRO}
                  />
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>= ${(draft.priceCents / 100).toFixed(2)} USD</span>
                </div>
                <div style={s.row}>
                  <label style={s.label}>Precio de lista (centavos, 0 = sin precio tachado)</label>
                  <input
                    type="number" min={0}
                    value={draft.listPriceCents}
                    onChange={(e) => { if (priceEditable) setDraft((d) => ({ ...d, listPriceCents: Number(e.target.value) })); }}
                    readOnly={!priceEditable}
                    style={priceEditable ? s.input : s.inputRO}
                  />
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
                    {draft.listPriceCents > 0 ? `= $${(draft.listPriceCents / 100).toFixed(2)} USD` : '— sin precio de lista'}
                  </span>
                </div>
              </div>
              {priceEditable && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={savePricing} disabled={saving} style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }}>
                    {saving ? 'Guardando...' : 'Guardar Precio Operativo'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Tab: Reglas */}
          {activeTab === 'reglas' && (
            <>
              <div style={s.infoBox}>
                Estas reglas alimentan el motor comercial. Para cambiarlas, actualiza catalogo canonico y corre validacion.
              </div>
              {PLANS.map((plan) => (
                <PlanRuleReadOnly
                  key={plan}
                  plan={plan}
                  rule={item.planRules.find((r) => r.plan === plan)}
                />
              ))}
              <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Dependencias y conflictos
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ ...s.label, marginBottom: 6 }}>Dependencias (requiere)</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {(item.dependencies ?? []).length > 0
                        ? (item.dependencies ?? []).map((code) => (
                          <span key={code} style={{ padding: '2px 8px', borderRadius: 100, background: 'rgba(255,140,0,0.1)', color: '#FF8C00', fontSize: 11 }}>{code}</span>
                        ))
                        : <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Sin dependencias</span>}
                    </div>
                  </div>
                  <div>
                    <div style={{ ...s.label, marginBottom: 6 }}>Conflictos (incompatible con)</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {((item.conflicts ?? []).filter(Boolean) as string[]).length > 0
                        ? ((item.conflicts ?? []).filter(Boolean) as string[]).map((code) => (
                          <span key={code} style={{ padding: '2px 8px', borderRadius: 100, background: 'rgba(248,113,113,0.1)', color: '#F87171', fontSize: 11 }}>{code}</span>
                        ))
                        : <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Sin conflictos</span>}
                    </div>
                  </div>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
                Para cambiar reglas, abre una sesion tecnica y actualiza catalogo + tests.
              </p>
            </>
          )}

          {/* Tab: Visibilidad */}
          {activeTab === 'visibilidad' && (
            <>
              <div style={s.infoBox}>
                Puedes editar la organizacion del portal. Los campos de calculadora, tickets y propuestas son solo lectura.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {([
                  { field: 'visibleInCalculator' as const, label: 'Visible en Calculadora (solo lectura)' },
                  { field: 'visibleInTickets' as const, label: 'Visible en Tickets / Admin (solo lectura)' },
                  { field: 'visibleInProposals' as const, label: 'Visible en Propuestas (solo lectura)' },
                ] as const).map(({ field, label }) => (
                  <div key={field} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontFamily: 'Inter Tight', fontSize: 12, color: 'var(--text-3)' }}>{label}</span>
                    <span style={{ fontSize: 11, color: item[field] ? '#5DD69C' : 'var(--text-3)', fontWeight: 600 }}>
                      {item[field] ? 'Si' : 'No'}
                    </span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontFamily: 'Inter Tight', fontSize: 12, color: portalVisEditable ? 'var(--text-2)' : 'var(--text-3)' }}>
                    Visible en Portal Cliente{!portalVisEditable ? ' (solo lectura)' : ''}
                  </span>
                  {portalVisEditable ? (
                    <button type="button" onClick={() => setDraft((d) => ({ ...d, visibleInPortal: !d.visibleInPortal }))}
                      style={{ width: 36, height: 20, borderRadius: 100, border: 'none', cursor: 'pointer',
                        background: draft.visibleInPortal ? '#FF8C00' : 'rgba(255,255,255,0.12)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute',
                        top: 3, left: draft.visibleInPortal ? 19 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: item.visibleInPortal ? '#5DD69C' : 'var(--text-3)', fontWeight: 600 }}>
                      {item.visibleInPortal ? 'Si' : 'No'}
                    </span>
                  )}
                </div>
              </div>
              {draft.visibleInPortal && !draft.portalCategoryId && (
                <div style={s.warnBox}>
                  Visible en portal pero sin categoria asignada. El item no aparecera en el portal hasta asignar una categoria.
                </div>
              )}
              <div style={s.row}>
                <label style={s.label}>Categoria del portal</label>
                <select value={draft.portalCategoryId ?? ''} onChange={(e) => setDraft((d) => ({ ...d, portalCategoryId: e.target.value || null }))} style={s.input}>
                  <option value="">— Sin categoria —</option>
                  {portalCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.publicName} ({c.name})</option>
                  ))}
                </select>
              </div>
              <div style={s.row}>
                <label style={s.label}>Orden de visualizacion</label>
                <input type="number" min={0} value={draft.sortOrder} onChange={(e) => setDraft((d) => ({ ...d, sortOrder: Number(e.target.value) }))} style={{ ...s.input, width: 100 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" onClick={saveVisibility} disabled={saving} style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Guardando...' : 'Guardar Visibilidad'}
                </button>
              </div>
            </>
          )}

          {/* Tab: Uso */}
          {activeTab === 'uso' && (
            <>
              {usageLoading && <p style={{ color: 'var(--text-3)', fontSize: 12 }}>Cargando...</p>}
              {!usageLoading && usage && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    {([['Usos totales (BD)', usage.total], ['Proyectos distintos', usage.projects]] as const).map(([label, val]) => (
                      <div key={label} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                        <div style={{ fontFamily: 'Clash Grotesk', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  {usage.usages.length > 0 ? (
                    <>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                        Ultimas {usage.usages.length} entradas
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {usage.usages.map((u, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>
                                {u.clientName ?? 'Cliente desconocido'}
                                <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 6 }}>{u.projectPlan} · {u.projectStatus}</span>
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                                {u.requestKind} · {u.decision} · x{u.quantity}
                                {u.ticketId && <span style={{ marginLeft: 6 }}>· ticket vinculado</span>}
                              </div>
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>
                              {new Date(u.createdAt).toLocaleDateString('es-DO', { day: '2-digit', month: 'short' })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>Sin usos registrados todavia.</p>
                  )}
                </>
              )}
              {!usageLoading && !usage && (
                <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>No se pudo cargar el historial de uso.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
