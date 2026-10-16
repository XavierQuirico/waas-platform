'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { CapacidadesTab } from './components/CapacidadesTab';

type ConfigTab = 'negocio' | 'planes' | 'addons' | 'params' | 'sla' | 'integraciones';

// ─── Types ───────────────────────────────────────────────────────────────────

type PlanKey = 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY';

type Plan = {
  price: number;
  setup: number;
  buyout: number;
  color: string;
  bg: string;
  features: string[];
};

type Fee = {
  id: string;
  label: string;
  type: 'pct' | 'rate' | 'flat';
  value: number;
  fixed: number;
  enabled: boolean;
  removable: boolean;
};

// ─── Data ────────────────────────────────────────────────────────────────────

// Las features de abajo son un resumen estático para esta vista de configuración y pueden
// diferir de las reglas del catálogo comercial; la fuente de verdad del producto es el catálogo.
const DEFAULT_PLANS: Record<PlanKey, Plan> = {
  BASIC: {
    price: 49, setup: 50, buyout: 350,
    color: 'rgba(249,249,249,0.7)', bg: 'rgba(249,249,249,0.08)',
    features: ['Sitio informativo de hasta 5 páginas', 'Diseño responsive mobile-first', 'Formulario de contacto', 'Botón WhatsApp flotante', 'Dominio + hosting incluido', 'SSL incluido', 'SEO básico on-page', '1 ronda de revisiones', 'Soporte por WhatsApp/email'],
  },
  PRO: {
    price: 89, setup: 50, buyout: 600,
    color: '#FF8C00', bg: 'rgba(255,140,0,0.08)',
    features: ['Todo lo de BASIC', 'Hasta 8 páginas', 'Sistema de citas/booking', 'Galería avanzada', 'Integración Google Calendar', 'Blog básico', '2 rondas de revisiones', 'Reporte de rendimiento mensual', 'Soporte prioritario'],
  },
  BUSINESS: {
    price: 139, setup: 50, buyout: 900,
    color: '#FFB347', bg: 'rgba(255,140,0,0.12)',
    features: ['Todo lo de PRO', 'Páginas ilimitadas', 'Catálogo de productos/servicios', 'Checkout / carrito de compras', 'Dashboard de administración', 'Membresías / acceso restringido', 'Integraciones avanzadas (CRM, API)', 'Análisis de conversión', '3 rondas de revisiones', 'SLA de respuesta garantizado'],
  },
  LEGACY: {
    price: 0, setup: 0, buyout: 0,
    color: '#D4B8FF', bg: 'rgba(91,45,142,0.12)',
    features: ['Proyecto de pago único', 'Sin mensualidad recurrente', 'Entregable final + código fuente', 'Precio según complejidad del proyecto', 'Alcance negociado caso por caso', 'Mantenimiento opcional por separado'],
  },
};

const INTEGRATIONS = [
  { id: 'paypal',   name: 'PayPal',          desc: 'Suscripciones y pagos únicos',              status: 'active',   verified: '2026-04-18' },
  { id: 'resend',   name: 'Resend',          desc: 'Emails transaccionales y propuestas',        status: 'active',   verified: '2026-04-18' },
  { id: 'clerk',    name: 'Clerk Auth',      desc: 'Autenticación del portal admin',             status: 'active',   verified: '2026-04-18' },
  { id: 'vercel',   name: 'Vercel',          desc: 'Deploy de sitios de clientes',               status: 'active',   verified: '2026-04-17' },
  { id: 'r2',       name: 'Cloudflare R2',   desc: 'Storage de assets de clientes',              status: 'active',   verified: '2026-04-17' },
  { id: 'uptime',   name: 'UptimeRobot',     desc: 'Monitoreo 24/7 de sitios',                   status: 'active',   verified: '2026-04-18' },
  { id: 'inngest',  name: 'Inngest',         desc: 'Jobs en background y SLA timers',            status: 'active',   verified: '2026-04-16' },
  { id: 'groq',     name: 'Groq API',        desc: 'IA para análisis de briefs',                 status: 'inactive', verified: '2026-04-10' },
];

// ─── Helper components ────────────────────────────────────────────────────────

function EditableField({
  label, value, onChange, type = 'text', suffix,
}: {
  label: string; value: string | number; onChange: (v: string) => void;
  type?: string; suffix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  return (
    <div
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <label style={{ fontFamily: 'Inter Tight', fontSize: 12, color: 'var(--text-2)', marginBottom: 0, display: 'block' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {editing ? (
          <input
            ref={inputRef}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
            style={{
              background: 'var(--surface-2)',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
              borderRadius: 8,
              padding: '8px 12px',
              color: 'var(--text)',
              fontFamily: 'Inter Tight',
              fontSize: 13,
              border: '1px solid rgba(255,140,0,0.4)',
              outline: 'none',
              minWidth: 160,
              textAlign: 'right',
            }}
          />
        ) : (
          <span style={{ fontFamily: 'Inter Tight', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
            {value}{suffix ? ` ${suffix}` : ''}
          </span>
        )}
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#FF8C00', padding: '3px 6px', borderRadius: 5,
            opacity: hovered ? 1 : 0, transition: 'opacity 0.15s', fontSize: 12,
          }}
          title="Editar"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
      </div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 100, border: 'none', cursor: 'pointer',
        background: value ? '#FF8C00' : 'rgba(255,255,255,0.12)', position: 'relative',
        transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, left: value ? 23 : 3,
        transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
    </button>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState<ConfigTab>(
    isConfigTab(initialTab) ? initialTab : 'negocio',
  );

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (isConfigTab(requestedTab)) setTab(requestedTab);
  }, [searchParams]);

  // Business data
  const [biz, setBiz] = useState({
    nombre: 'Quirico Studios',
    email: 'hola@quiricostudios.com',
    whatsapp: '+1-809-555-0000',
    instagram: '@quiricostudios',
    linkedin: 'linkedin.com/in/xavierquirico',
    website: 'quiricostudios.com',
    ubicacion: 'Santo Domingo, RD',
    descripcion: 'Estudio de diseño y desarrollo web — WaaS para negocios en RD.',
  });

  // Plans
  const [plans, setPlans] = useState<Record<PlanKey, Plan>>(DEFAULT_PLANS);
  const setPlanField = (plan: PlanKey, field: keyof Plan, val: Plan[keyof Plan]) =>
    setPlans((p) => ({ ...p, [plan]: { ...p[plan], [field]: val } }));
  const [editingPlan, setEditingPlan] = useState<PlanKey | null>(null);
  const [editPlanFeatures, setEditPlanFeatures] = useState<string[]>([]);

  // Fees
  const [fees, setFees] = useState<Fee[]>([
    { id: 'paypal', label: 'Comisión PayPal', type: 'pct', value: 5.4, fixed: 0.30, enabled: true, removable: false },
    { id: 'dop',    label: 'Tasa USD→DOP',    type: 'rate', value: 58.5, fixed: 0, enabled: true, removable: false },
  ]);
  const [customFees, setCustomFees] = useState<Fee[]>([]);
  const [showAddFee, setShowAddFee] = useState(false);
  const [newFee, setNewFee] = useState<Omit<Fee, 'id' | 'enabled' | 'removable'>>({ label: '', type: 'pct', value: 0, fixed: 0 });
  const [minMonths, setMinMonths] = useState(6);
  const [earlyExit, setEarlyExit] = useState(50);

  // SLA
  const [sla, setSla] = useState({ workDays: 'Lunes–Viernes', workStart: '09:00', workEnd: '18:00', delivery: 72, staging: 72, proposalDays: 7, p1: 2, p2: 4, p3: 24 });

  // Holidays
  const [holidays, setHolidays] = useState([
    { name: 'Año Nuevo', date: '2026-01-01' },
    { name: 'Día de la Constitución', date: '2026-01-26' },
    { name: 'Independencia', date: '2026-02-27' },
    { name: 'Día del Trabajo', date: '2026-05-01' },
    { name: 'Restauración', date: '2026-08-16' },
  ]);
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '' });

  const tabs: { key: ConfigTab; label: string }[] = [
    { key: 'negocio',       label: 'Negocio' },
    { key: 'planes',        label: 'Planes & precios' },
    { key: 'addons',        label: 'Capacidades & Add-ons' },
    { key: 'params',        label: 'Parámetros' },
    { key: 'sla',           label: 'SLA & tiempos' },
    { key: 'integraciones', label: 'Integraciones' },
  ];

  const allFees = [...fees, ...customFees];

  const inputStyle = {
    background: 'var(--surface-2)',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
    borderRadius: 8,
    padding: '8px 12px',
    color: 'var(--text)',
    fontFamily: 'Inter Tight',
    fontSize: 13,
    border: 'none',
    outline: 'none',
    width: '100%',
  } as const;

  const labelStyle = {
    fontFamily: 'Inter Tight',
    fontSize: 12,
    color: 'var(--text-2)',
    marginBottom: 4,
    display: 'block',
  } as const;

  const saveBtn = {
    background: '#FF8C00',
    color: '#121212',
    borderRadius: 100,
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'Inter Tight',
  } as const;

  const cardStyle = {
    background: 'var(--surface)',
    borderRadius: 14,
    padding: '20px 22px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
    marginBottom: 16,
  } as const;

  const sectionTitle = {
    fontFamily: 'Inter Tight',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 16,
  } as const;

  return (
    <div style={{ padding: '28px 32px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Clash Grotesk', fontWeight: 700, fontSize: 24, color: 'var(--text)' }}>
          Configuración
        </h1>
        <span style={{ fontFamily: 'Inter Tight', fontSize: 11, color: 'var(--text-3)' }}>
          Pasa el cursor sobre un valor para editarlo
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              border: `1px solid ${tab === t.key ? 'rgba(255,140,0,0.5)' : 'rgba(255,255,255,0.08)'}`,
              background: tab === t.key ? 'rgba(255,140,0,0.1)' : 'var(--surface)',
              color: tab === t.key ? '#FF8C00' : 'var(--text-3)',
              fontFamily: 'Inter Tight',
              fontWeight: 500,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── NEGOCIO ── */}
      {tab === 'negocio' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 900 }}>
          <div style={cardStyle}>
            <h2 style={sectionTitle}>Identidad del Estudio</h2>
            <EditableField label="Nombre comercial" value={biz.nombre}    onChange={(v) => setBiz((b) => ({ ...b, nombre: v }))} />
            <EditableField label="Sitio web"         value={biz.website}   onChange={(v) => setBiz((b) => ({ ...b, website: v }))} />
            <EditableField label="Ubicación"          value={biz.ubicacion} onChange={(v) => setBiz((b) => ({ ...b, ubicacion: v }))} />
            <div style={{ paddingTop: 12 }}>
              <label style={labelStyle}>Descripción corta</label>
              <textarea
                value={biz.descripcion}
                onChange={(e) => setBiz((b) => ({ ...b, descripcion: e.target.value }))}
                rows={2}
                style={{ ...inputStyle, resize: 'none' }}
              />
            </div>
            <div style={{ marginTop: 16 }}>
              <button type="button" style={saveBtn}>Guardar cambios</button>
            </div>
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitle}>Contacto</h2>
            <EditableField label="Email principal"   value={biz.email}     onChange={(v) => setBiz((b) => ({ ...b, email: v }))} />
            <EditableField label="WhatsApp Business" value={biz.whatsapp}  onChange={(v) => setBiz((b) => ({ ...b, whatsapp: v }))} />
            <EditableField label="Instagram"         value={biz.instagram} onChange={(v) => setBiz((b) => ({ ...b, instagram: v }))} />
            <EditableField label="LinkedIn"          value={biz.linkedin}  onChange={(v) => setBiz((b) => ({ ...b, linkedin: v }))} />
            <div style={{ marginTop: 16 }}>
              <button type="button" style={saveBtn}>Guardar cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PLANES & PRECIOS ── */}
      {tab === 'planes' && (
        <div>
          <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(255,140,0,0.08)', borderRadius: 8, fontFamily: 'Inter Tight', fontSize: 11, color: '#FF8C00' }}>
            Vista estática de referencia. Las reglas comerciales activas están en el motor de catálogo (tab &quot;Capacidades &amp; Add-ons&quot;).
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {(Object.entries(plans) as [PlanKey, Plan][]).map(([planKey, p]) => (
              <div key={planKey} style={{ background: 'var(--surface)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.22)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px 16px 12px', background: p.bg, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontFamily: 'Clash Grotesk', fontWeight: 800, fontSize: 14, color: p.color, letterSpacing: '0.04em' }}>{planKey}</span>
                    <button
                      type="button"
                      onClick={() => { setEditingPlan(planKey); setEditPlanFeatures([...p.features]); }}
                      style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, color: 'var(--text-3)' }}
                    >
                      Editar
                    </button>
                  </div>
                  {planKey !== 'LEGACY' && (
                    <div style={{ fontFamily: 'Clash Grotesk', fontWeight: 700, fontSize: 20, color: p.color }}>
                      ${p.price}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-3)' }}>/mes</span>
                    </div>
                  )}
                  {p.setup > 0 && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Setup: ${p.setup} · Buy-out: ${p.buyout}</div>}
                </div>
                <div style={{ padding: '12px 14px', flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>Incluye</div>
                  {p.features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '3px 0' }}>
                      <span style={{ color: p.color, fontSize: 10, marginTop: 2, flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Plan edit modal */}
          {editingPlan && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div onClick={() => setEditingPlan(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }} />
              <div style={{ position: 'relative', background: 'var(--surface)', borderRadius: 16, padding: 28, width: 520, maxHeight: '85vh', overflow: 'auto', zIndex: 1, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ fontFamily: 'Clash Grotesk', fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>Editar plan {editingPlan}</h3>
                  <button type="button" onClick={() => setEditingPlan(null)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18 }}>✕</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {editPlanFeatures.map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        value={f}
                        onChange={(e) => setEditPlanFeatures((fs) => fs.map((x, j) => j === i ? e.target.value : x))}
                        style={{ flex: 1, background: 'var(--surface-2)', border: 'none', borderRadius: 7, padding: '7px 10px', color: 'var(--text)', fontFamily: 'Inter Tight', fontSize: 12, outline: 'none', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)' }}
                      />
                      <button
                        type="button"
                        onClick={() => setEditPlanFeatures((fs) => fs.filter((_, j) => j !== i))}
                        style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', color: '#F87171', fontSize: 13 }}
                      >✕</button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setEditPlanFeatures((fs) => [...fs, ''])}
                  style={{ marginTop: 10, padding: '7px 12px', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, color: 'var(--text-2)' }}
                >
                  + Agregar característica
                </button>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <button type="button" onClick={() => setEditingPlan(null)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 100, padding: '8px 16px', cursor: 'pointer', fontSize: 12, color: 'var(--text)', fontFamily: 'Inter Tight' }}>Cancelar</button>
                  <button
                    type="button"
                    onClick={() => { setPlanField(editingPlan, 'features', editPlanFeatures.filter((f) => f.trim())); setEditingPlan(null); }}
                    style={saveBtn}
                  >
                    Guardar cambios
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CAPACIDADES & ADD-ONS ── */}
      {tab === 'addons' && (
        <div>
          <CapacidadesTab />
        </div>
      )}

      {/* ── PARÁMETROS ── */}
      {tab === 'params' && (
        <div style={{ maxWidth: 900 }}>
          <div style={cardStyle}>
            <h2 style={sectionTitle}>Tasas y Comisiones</h2>
            <p style={{ fontFamily: 'Inter Tight', fontSize: 11, color: 'var(--text-3)', marginBottom: 14, lineHeight: 1.6 }}>
              Estos parámetros alimentan automáticamente la Calculadora y el desglose de pagos.
            </p>
            {allFees.map((fee) => (
              <div key={fee.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Inter Tight', fontSize: 13, fontWeight: 500, color: fee.enabled ? 'var(--text)' : 'var(--text-3)' }}>{fee.label}</div>
                  <div style={{ fontFamily: 'Inter Tight', fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    {fee.type === 'pct' && `${fee.value}%${fee.fixed > 0 ? ` + $${fee.fixed}` : ''} sobre subtotal`}
                    {fee.type === 'rate' && `1 USD = ${fee.value} DOP`}
                    {fee.type === 'flat' && `$${fee.value} cargo fijo`}
                  </div>
                </div>
                <Toggle
                  value={fee.enabled}
                  onChange={() => {
                    if (fee.removable) setCustomFees((fs) => fs.filter((f) => f.id !== fee.id));
                    else setFees((fs) => fs.map((f) => f.id === fee.id ? { ...f, enabled: !f.enabled } : f));
                  }}
                />
              </div>
            ))}
            {!showAddFee ? (
              <button type="button" onClick={() => setShowAddFee(true)} style={{ marginTop: 12, padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-2)', fontFamily: 'Inter Tight' }}>
                + Agregar fee personalizado (ej. ITBIS 18%)
              </button>
            ) : (
              <div style={{ marginTop: 12, padding: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
                <div style={{ fontFamily: 'Inter Tight', fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Nuevo fee</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
                  <input value={newFee.label} onChange={(e) => setNewFee((f) => ({ ...f, label: e.target.value }))} placeholder="Nombre (ej. ITBIS)" style={inputStyle} />
                  <select value={newFee.type} onChange={(e) => setNewFee((f) => ({ ...f, type: e.target.value as Fee['type'] }))} style={{ ...inputStyle }}>
                    <option value="pct">% porcentaje</option>
                    <option value="flat">$ fijo</option>
                    <option value="rate">Tasa</option>
                  </select>
                  <input type="number" value={newFee.value} onChange={(e) => setNewFee((f) => ({ ...f, value: Number(e.target.value) }))} placeholder="0" style={inputStyle} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button type="button" onClick={() => setShowAddFee(false)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 100, padding: '7px 14px', cursor: 'pointer', fontSize: 12, color: 'var(--text)', fontFamily: 'Inter Tight' }}>Cancelar</button>
                  <button
                    type="button"
                    disabled={!newFee.label}
                    onClick={() => { setCustomFees((f) => [...f, { ...newFee, id: 'cf' + Date.now(), enabled: true, removable: true }]); setShowAddFee(false); setNewFee({ label: '', type: 'pct', value: 0, fixed: 0 }); }}
                    style={{ ...saveBtn, opacity: newFee.label ? 1 : 0.4 }}
                  >
                    Agregar fee
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitle}>Vista previa del cálculo</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                ['Plan', 'PRO'],
                ['Mensualidad', '$89/mes'],
                ['Setup', '$50'],
                ['PayPal', '3.49% + $0.49'],
              ].map(([label, value]) => (
                <div key={label} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontFamily: 'Inter Tight', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>{label}</div>
                  <div style={{ fontFamily: 'Clash Grotesk', fontSize: 18, fontWeight: 700, color: value === 'PRO' ? 'var(--amber)' : 'var(--text)' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitle}>Condiciones del contrato</h2>
            <EditableField label="Permanencia mínima"         value={`${minMonths} meses`}               onChange={(v) => setMinMonths(parseInt(v) || 6)} />
            <EditableField label="Penalidad salida anticipada" value={`${earlyExit}% del valor restante`} onChange={(v) => setEarlyExit(parseInt(v) || 50)} />
          </div>
        </div>
      )}

      {/* ── SLA & TIEMPOS ── */}
      {tab === 'sla' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 900 }}>
          <div style={cardStyle}>
            <h2 style={sectionTitle}>Horario hábil</h2>
            <EditableField label="Días hábiles"   value={sla.workDays}  onChange={(v) => setSla((s) => ({ ...s, workDays: v }))} />
            <EditableField label="Hora de inicio" value={sla.workStart} onChange={(v) => setSla((s) => ({ ...s, workStart: v }))} type="time" />
            <EditableField label="Hora de cierre" value={sla.workEnd}   onChange={(v) => setSla((s) => ({ ...s, workEnd: v }))} type="time" />
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitle}>Plazos de entrega</h2>
            <EditableField label="Entrega inicial (h hábiles)"    value={sla.delivery}     onChange={(v) => setSla((s) => ({ ...s, delivery: Number(v) }))} type="number" suffix="h" />
            <EditableField label="Ventana de staging (h hábiles)" value={sla.staging}      onChange={(v) => setSla((s) => ({ ...s, staging: Number(v) }))} type="number" suffix="h" />
            <EditableField label="Validez de propuesta (días)"    value={sla.proposalDays} onChange={(v) => setSla((s) => ({ ...s, proposalDays: Number(v) }))} type="number" suffix="días" />
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitle}>SLA de incidencias</h2>
            {([['P1 — Crítico', 'p1', '#F87171'], ['P2 — Alto', 'p2', '#FF8C00'], ['P3 — Medio', 'p3', '#6B9FFF']] as const).map(([label, key, color]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, background: `${color}22`, color, padding: '2px 6px', borderRadius: 4 }}>{key.toUpperCase()}</span>
                  <label style={{ fontFamily: 'Inter Tight', fontSize: 12, color: 'var(--text-2)', marginBottom: 0, display: 'block' }}>{label}</label>
                </div>
                <span style={{ fontFamily: 'Clash Grotesk', fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                  {sla[key as 'p1' | 'p2' | 'p3']}h
                </span>
              </div>
            ))}
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitle}>Feriados — República Dominicana</h2>
            <div style={{ maxHeight: 200, overflow: 'auto', marginBottom: 12 }}>
              {holidays.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ flex: 1, fontFamily: 'Inter Tight', fontSize: 12, color: 'var(--text)' }}>{h.name}</span>
                  <span style={{ fontFamily: 'Inter Tight', fontSize: 11, color: 'var(--text-3)' }}>{h.date}</span>
                  <button type="button" onClick={() => setHolidays((hs) => hs.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: 13, padding: '0 4px', opacity: 0.6 }}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={newHoliday.name} onChange={(e) => setNewHoliday((h) => ({ ...h, name: e.target.value }))} placeholder="Nombre del feriado" style={{ ...inputStyle, width: 'auto', flex: 1 }} />
              <input type="date" value={newHoliday.date} onChange={(e) => setNewHoliday((h) => ({ ...h, date: e.target.value }))} style={{ ...inputStyle, width: 140, flexShrink: 0 }} />
              <button type="button" onClick={() => { if (newHoliday.name && newHoliday.date) { setHolidays((hs) => [...hs, newHoliday]); setNewHoliday({ name: '', date: '' }); } }} style={{ ...saveBtn, padding: '8px 14px' }}>+</button>
            </div>
            <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(255,140,0,0.08)', borderRadius: 8, fontFamily: 'Inter Tight', fontSize: 11, color: '#FF8C00' }}>
              Los feriados afectan el cálculo de SLA en todos los proyectos activos.
            </div>
          </div>
        </div>
      )}

      {/* ── INTEGRACIONES ── */}
      {tab === 'integraciones' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 900 }}>
          {INTEGRATIONS.map((int) => (
            <div key={int.id} style={{ background: 'var(--surface)', borderRadius: 12, padding: 18, boxShadow: `0 2px 8px rgba(0,0,0,0.2), inset 0 0 0 1px ${int.status === 'active' ? 'rgba(93,214,156,0.22)' : 'rgba(239,68,68,0.22)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontFamily: 'Clash Grotesk', fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{int.name}</span>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 100, background: int.status === 'active' ? 'rgba(93,214,156,0.12)' : 'rgba(239,68,68,0.12)', color: int.status === 'active' ? '#5DD69C' : '#F87171' }}>
                  {int.status === 'active' ? '● Activa' : '○ Inactiva'}
                </span>
              </div>
              <p style={{ fontFamily: 'Inter Tight', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 6 }}>{int.desc}</p>
              <p style={{ fontFamily: 'Inter Tight', fontSize: 10, color: 'var(--text-3)', marginBottom: 12 }}>Verificado: {int.verified}</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 100, padding: '6px 14px', cursor: 'pointer', fontSize: 12, color: 'var(--text)', fontFamily: 'Inter Tight' }}>Probar conexión</button>
                {int.status === 'inactive' && (
                  <button type="button" style={saveBtn}>Reconectar</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function isConfigTab(value: string | null): value is ConfigTab {
  return ['negocio', 'planes', 'addons', 'params', 'sla', 'integraciones'].includes(value ?? '');
}
