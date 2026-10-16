'use client';

import { useState, useEffect, useMemo } from 'react';
import type { CatalogAdminItem, PortalCategoryAdmin } from '../catalog-actions';
import {
  listCatalogAdminAction,
  listPortalCategoriesAction,
  savePortalCategoryAction,
  deletePortalCategoryAction,
} from '../catalog-actions';
import { CapabilityDrawer } from './CapabilityDrawer';

type CategoryFilter = 'all' | 'design' | 'content' | 'integration' | 'revision' | 'custom';
type PricingFilter = 'all' | 'fixed' | 'included' | 'quote' | 'no-rules';
type SourceFilter = 'all' | 'waas_ticket' | 'legacy_calculator' | 'manual';

const CAT_COLORS: Record<string, { bg: string; color: string }> = {
  design:      { bg: 'rgba(255,140,0,0.12)',   color: '#FF8C00' },
  content:     { bg: 'rgba(107,159,255,0.12)', color: '#6B9FFF' },
  integration: { bg: 'rgba(93,214,156,0.12)',  color: '#5DD69C' },
  revision:    { bg: 'rgba(212,184,255,0.12)', color: '#D4B8FF' },
  custom:      { bg: 'rgba(249,249,249,0.06)', color: 'var(--text-2)' },
};
const PRICING_BADGE: Record<string, { label: string; color: string }> = {
  fixed:    { label: 'Fijo',       color: '#FF8C00' },
  included: { label: 'Incluido',   color: '#5DD69C' },
  quote:    { label: 'Cotización', color: '#6B9FFF' },
};
const SOURCE_LABEL: Record<string, string> = {
  waas_ticket: 'WaaS', legacy_calculator: 'Legacy', manual: 'Manual',
};

const s = {
  input: {
    background: 'var(--surface-2)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
    borderRadius: 8, padding: '8px 12px', color: 'var(--text)',
    fontFamily: 'Inter Tight', fontSize: 13, border: 'none', outline: 'none', width: '100%',
  } as const,
  label: { fontFamily: 'Inter Tight', fontSize: 11, color: 'var(--text-2)', marginBottom: 4, display: 'block' } as const,
  saveBtn: {
    background: '#FF8C00', color: '#121212', borderRadius: 100, padding: '7px 18px',
    fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'Inter Tight',
  } as const,
};

// ─── KPI bar ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '13px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
      <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 5, letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontFamily: 'Clash Grotesk', fontSize: 22, fontWeight: 700, color: accent ?? 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Portal Categories CRUD ───────────────────────────────────────────────────

function PortalCategoriesSection({
  categories,
  onUpdated,
}: {
  categories: PortalCategoryAdmin[];
  onUpdated: (cats: PortalCategoryAdmin[]) => void;
}) {
  const [editing, setEditing] = useState<Partial<PortalCategoryAdmin> | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    if (!editing?.name?.trim() || !editing?.publicName?.trim()) {
      setErr('Nombre interno y nombre público son requeridos.');
      return;
    }
    setSaving(true); setErr('');
    const result = await savePortalCategoryAction({
      id: editing.id, name: editing.name, publicName: editing.publicName,
      description: editing.description, icon: editing.icon,
      sortOrder: editing.sortOrder ?? 0, active: editing.active ?? true,
    });
    setSaving(false);
    if ('error' in result) { setErr(result.error); return; }
    const updated = categories.some((c) => c.id === result.category.id)
      ? categories.map((c) => c.id === result.category.id ? result.category : c)
      : [...categories, result.category];
    onUpdated(updated);
    setEditing(null);
  }

  async function del(id: string, name: string) {
    if (!window.confirm(`Eliminar la categoría "${name}"? El servidor verificará que no haya ítems asignados.`)) return;
    const result = await deletePortalCategoryAction(id);
    if ('error' in result) { setErr(result.error); return; }
    onUpdated(categories.filter((c) => c.id !== id));
  }

  return (
    <div style={{ marginTop: 32, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontFamily: 'Clash Grotesk', fontWeight: 700, fontSize: 16, color: 'var(--text)', margin: 0 }}>
          Categorías del Portal
        </h3>
        <button type="button" onClick={() => { setErr(''); setEditing({ active: true, sortOrder: 0 }); }} style={s.saveBtn}>
          + Nueva categoría
        </button>
      </div>
      {err && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#F87171', fontSize: 12 }}>{err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 12 }}>
        {categories.map((cat) => (
          <div key={cat.id} style={{
            background: 'var(--surface)', borderRadius: 10, padding: '12px 14px',
            boxShadow: '0 1px 6px rgba(0,0,0,0.2)',
            border: `1px solid ${cat.active ? 'rgba(93,214,156,0.12)' : 'rgba(255,255,255,0.04)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {cat.icon && <span style={{ fontSize: 14 }}>{cat.icon}</span>}
                <span style={{ fontFamily: 'Inter Tight', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{cat.publicName}</span>
              </div>
              <span style={{ fontSize: 9, color: cat.active ? '#5DD69C' : '#F87171' }}>●</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 8 }}>{cat.name} · orden {cat.sortOrder}</div>
            <div style={{ display: 'flex', gap: 5 }}>
              <button type="button" onClick={() => { setErr(''); setEditing({ ...cat }); }}
                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', color: 'var(--text-2)', fontSize: 10 }}>
                Editar
              </button>
              <button type="button" onClick={() => del(cat.id, cat.publicName)}
                style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', color: '#F87171', fontSize: 10 }}>
                Eliminar
              </button>
            </div>
          </div>
        ))}
        {categories.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '14px 0', color: 'var(--text-3)', fontSize: 12 }}>
            Sin categorías. Crea una para que los ítems sean visibles en el portal.
          </div>
        )}
      </div>

      {editing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setEditing(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: 'var(--surface)', borderRadius: 16, padding: 24, width: 440, zIndex: 1, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 style={{ fontFamily: 'Clash Grotesk', fontWeight: 700, fontSize: 17, color: 'var(--text)', margin: 0 }}>
                {editing.id ? 'Editar categoría' : 'Nueva categoría de portal'}
              </h3>
              <button type="button" onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={s.label}>Nombre interno (slug)</label>
                  <input value={editing.name ?? ''} onChange={(e) => setEditing((d) => ({ ...d, name: e.target.value }))}
                    placeholder="diseno-web" style={s.input} disabled={Boolean(editing.id)} />
                </div>
                <div>
                  <label style={s.label}>Icono (emoji)</label>
                  <input value={editing.icon ?? ''} onChange={(e) => setEditing((d) => ({ ...d, icon: e.target.value }))} placeholder="✨" style={s.input} />
                </div>
              </div>
              <div>
                <label style={s.label}>Nombre público (visible al cliente)</label>
                <input value={editing.publicName ?? ''} onChange={(e) => setEditing((d) => ({ ...d, publicName: e.target.value }))} style={s.input} />
              </div>
              <div>
                <label style={s.label}>Descripción</label>
                <textarea rows={2} value={editing.description ?? ''} onChange={(e) => setEditing((d) => ({ ...d, description: e.target.value || null }))} style={{ ...s.input, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'end' }}>
                <div>
                  <label style={s.label}>Orden de visualización</label>
                  <input type="number" min={0} value={editing.sortOrder ?? 0} onChange={(e) => setEditing((d) => ({ ...d, sortOrder: Number(e.target.value) }))} style={s.input} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
                  <span style={{ fontFamily: 'Inter Tight', fontSize: 12, color: 'var(--text-2)' }}>Activa</span>
                  <button type="button" onClick={() => setEditing((d) => ({ ...d, active: !d?.active }))}
                    style={{ width: 36, height: 20, borderRadius: 100, border: 'none', cursor: 'pointer', background: editing.active ? '#FF8C00' : 'rgba(255,255,255,0.12)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: editing.active ? 19 : 3, transition: 'left 0.2s' }} />
                  </button>
                </div>
              </div>
              {err && <p style={{ margin: 0, color: '#F87171', fontSize: 12 }}>{err}</p>}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button type="button" onClick={() => setEditing(null)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 100, padding: '7px 16px', cursor: 'pointer', fontSize: 12, color: 'var(--text)', fontFamily: 'Inter Tight' }}>Cancelar</button>
              <button type="button" onClick={save} disabled={saving} style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding: '4px 10px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 11,
        background: active ? 'rgba(255,140,0,0.15)' : 'rgba(255,255,255,0.06)',
        color: active ? '#FF8C00' : 'var(--text-3)', fontFamily: 'Inter Tight' }}>
      {label}
    </button>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function CapacidadesTab() {
  const [items, setItems] = useState<CatalogAdminItem[]>([]);
  const [categories, setCategories] = useState<PortalCategoryAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalErr, setGlobalErr] = useState('');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<CategoryFilter>('all');
  const [pricingFilter, setPricingFilter] = useState<PricingFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [selectedItem, setSelectedItem] = useState<CatalogAdminItem | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const [catalogResult, catsResult] = await Promise.all([
        listCatalogAdminAction(),
        listPortalCategoriesAction(),
      ]);
      if (!active) return;
      if ('error' in catalogResult) setGlobalErr(catalogResult.error);
      else setItems(catalogResult.items);
      if (!('error' in catsResult)) setCategories(catsResult.categories);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  const kpis = useMemo(() => {
    const total = items.length;
    const active = items.filter((i) => i.active).length;
    const portal = items.filter((i) => i.visibleInPortal).length;
    const noRules = items.filter((i) => i.planRules.length === 0).length;
    const misconfig = items.filter((i) => i.visibleInPortal && !i.portalCategoryId).length;
    const byPricing = { fixed: 0, included: 0, quote: 0 };
    const bySource: Record<string, number> = {};
    for (const item of items) {
      byPricing[item.pricingMode] = (byPricing[item.pricingMode] ?? 0) + 1;
      bySource[item.source] = (bySource[item.source] ?? 0) + 1;
    }
    return { total, active, portal, noRules, misconfig, byPricing, bySource };
  }, [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (catFilter !== 'all') result = result.filter((i) => i.category === catFilter);
    if (pricingFilter === 'no-rules') result = result.filter((i) => i.planRules.length === 0);
    else if (pricingFilter !== 'all') result = result.filter((i) => i.pricingMode === pricingFilter);
    if (sourceFilter !== 'all') result = result.filter((i) => i.source === sourceFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((i) =>
        i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q) ||
        (i.publicName ?? '').toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [items, catFilter, pricingFilter, sourceFilter, search]);

  function handleUpdated(updated: CatalogAdminItem) {
    setItems((curr) => curr.map((i) => i.id === updated.id ? updated : i));
    setSelectedItem(updated);
  }

  const catFilters: { key: CategoryFilter; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'design', label: 'Diseño' },
    { key: 'content', label: 'Contenido' },
    { key: 'integration', label: 'Integración' },
    { key: 'revision', label: 'Revisión' },
    { key: 'custom', label: 'Personalizado' },
  ];
  const pricingFilters: { key: PricingFilter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'fixed', label: 'Cobrables' },
    { key: 'included', label: 'Incluidos' },
    { key: 'quote', label: 'Cotizables' },
    { key: 'no-rules', label: 'Sin regla' },
  ];
  const sourceFilters: { key: SourceFilter; label: string }[] = [
    { key: 'all', label: 'Todas las fuentes' },
    { key: 'waas_ticket', label: 'WaaS' },
    { key: 'legacy_calculator', label: 'Legacy' },
    { key: 'manual', label: 'Manual' },
  ];

  return (
    <div>
      {/* KPI bar — row 1: core metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 10 }}>
        <KpiCard label="Total" value={kpis.total} />
        <KpiCard label="Activos" value={kpis.active} sub={`${kpis.total - kpis.active} inactivos`} />
        <KpiCard label="En portal" value={kpis.portal} sub="visibleInPortal=true" />
        <KpiCard label="Sin regla" value={kpis.noRules} accent={kpis.noRules > 0 ? '#F87171' : undefined} />
        <KpiCard label="Sin categoría" value={kpis.misconfig}
          sub="portal=true pero sin cat." accent={kpis.misconfig > 0 ? '#F87171' : undefined} />
        <KpiCard
          label="Fuentes"
          value={`${kpis.bySource['waas_ticket'] ?? 0}W ${kpis.bySource['legacy_calculator'] ?? 0}L ${kpis.bySource['manual'] ?? 0}M`}
          sub="WaaS · Legacy · Manual"
        />
      </div>
      {/* KPI bar — row 2: pricing breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
        <KpiCard label="Fijo (cobrables)" value={kpis.byPricing.fixed} accent="#FF8C00" />
        <KpiCard label="Incluidos" value={kpis.byPricing.included} accent="#5DD69C" />
        <KpiCard label="Cotizables" value={kpis.byPricing.quote} accent="#6B9FFF" />
      </div>

      {/* Search + filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código, nombre, descripción..."
          style={{ ...s.input, maxWidth: 340 }}
        />
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-3)', marginRight: 2 }}>Cat:</span>
          {catFilters.map((f) => (
            <Chip key={f.key} label={f.label} active={catFilter === f.key} onClick={() => setCatFilter(f.key)} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-3)', marginRight: 2 }}>Modo:</span>
          {pricingFilters.map((f) => (
            <Chip key={f.key} label={f.label} active={pricingFilter === f.key} onClick={() => setPricingFilter(f.key)} />
          ))}
          <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 10, marginRight: 2 }}>Fuente:</span>
          {sourceFilters.map((f) => (
            <Chip key={f.key} label={f.label} active={sourceFilter === f.key} onClick={() => setSourceFilter(f.key)} />
          ))}
        </div>
      </div>

      {globalErr && (
        <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#F87171', fontSize: 12 }}>
          {globalErr}
        </div>
      )}
      {loading && <div data-testid="catalog-loading" style={{ padding: 24, color: 'var(--text-3)', fontSize: 13 }}>Cargando catálogo...</div>}

      {/* Card grid */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {filtered.map((item) => {
            const cc = CAT_COLORS[item.category] ?? CAT_COLORS.custom;
            const pm = PRICING_BADGE[item.pricingMode] ?? PRICING_BADGE.fixed;
            const misconfig = item.visibleInPortal && !item.portalCategoryId;
            return (
              <button
                key={item.id}
                type="button"
                data-testid="catalog-item-card"
                onClick={() => setSelectedItem(item)}
                style={{
                  background: item.active ? 'var(--surface)' : 'rgba(255,255,255,0.025)',
                  borderRadius: 12, padding: '14px 16px',
                  boxShadow: item.active ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                  opacity: item.active ? 1 : 0.55,
                  border: `1px solid ${selectedItem?.id === item.id ? 'rgba(255,140,0,0.4)' : misconfig ? 'rgba(248,113,113,0.35)' : 'rgba(255,255,255,0.05)'}`,
                  cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: cc.bg, color: cc.color }}>{item.code}</span>
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${pm.color}1a`, color: pm.color }}>{pm.label}</span>
                    <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.05)', color: 'var(--text-3)' }}>{SOURCE_LABEL[item.source] ?? item.source}</span>
                  </div>
                  <span style={{ fontFamily: 'Clash Grotesk', fontWeight: 700, fontSize: 14, color: item.active ? '#FF8C00' : 'var(--text-3)' }}>
                    {item.pricingMode === 'fixed' ? `$${(item.priceCents / 100).toFixed(0)}` : '—'}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: item.active ? 'var(--text)' : 'var(--text-3)', marginBottom: 4 }}>
                  {item.publicName ?? item.name}
                </div>
                {item.description && (
                  <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.35, marginBottom: 8,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {item.description}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {item.visibleInPortal && <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: misconfig ? 'rgba(248,113,113,0.12)' : 'rgba(93,214,156,0.12)', color: misconfig ? '#F87171' : '#5DD69C' }}>Portal{misconfig ? ' ⚠' : ''}</span>}
                  {item.visibleInCalculator && <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'rgba(107,159,255,0.1)', color: '#6B9FFF' }}>Calc</span>}
                  {item.visibleInTickets && <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.07)', color: 'var(--text-3)' }}>Tickets</span>}
                  <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: item.planRules.length === 0 ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.05)', color: item.planRules.length === 0 ? '#F87171' : 'var(--text-3)' }}>
                    {item.planRules.length} reglas
                  </span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && !loading && (
            <div data-testid="catalog-empty-state" style={{ gridColumn: '1 / -1', padding: '20px 0', color: 'var(--text-3)', fontSize: 13 }}>
              {search || catFilter !== 'all' || pricingFilter !== 'all' || sourceFilter !== 'all'
                ? 'Sin resultados para este filtro.'
                : 'Catálogo vacío. Carga ítems desde la calculadora o créalos manualmente.'}
            </div>
          )}
        </div>
      )}

      <PortalCategoriesSection categories={categories} onUpdated={setCategories} />

      {selectedItem && (
        <CapabilityDrawer
          item={selectedItem}
          portalCategories={categories}
          onClose={() => setSelectedItem(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
