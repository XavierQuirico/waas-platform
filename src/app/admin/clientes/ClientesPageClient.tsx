'use client';

import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Check, Edit3, Globe, MapPin, MessageCircle, Plus, Search, Users, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientAction, updateClientAction } from './actions';

interface ClientRow {
  id: string;
  fullName: string;
  email: string;
  whatsapp: string | null;
  businessName: string;
  industry: string;
  location: string | null;
  currentUrl: string | null;
  createdAt: Date;
  projectCount: number;
  mrrCents: number;
}

interface ClientesPageClientProps {
  initialRows: ClientRow[];
}

interface ClientDraft {
  fullName: string;
  businessName: string;
  industry: string;
  currentUrl: string;
  notes: string;
}

type ClientEditableField =
  | 'fullName'
  | 'email'
  | 'whatsapp'
  | 'businessName'
  | 'industry'
  | 'currentUrl'
  | 'location';

export function ClientesPageClient({ initialRows }: ClientesPageClientProps) {
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [showNewClientDrawer, setShowNewClientDrawer] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get('newClient') === 'true') {
      setShowNewClientDrawer(true);
    }
  }, [searchParams]);

  const clientDraft: ClientDraft = {
    fullName: searchParams.get('fullName') ?? '',
    businessName: searchParams.get('businessName') ?? '',
    industry: searchParams.get('industry') ?? 'otro',
    currentUrl: searchParams.get('domain') ?? '',
    notes: searchParams.get('notes') ?? '',
  };

  const industries = Array.from(new Set(initialRows.map((c) => c.industry))).sort();
  const totalMRR = initialRows.reduce((sum, c) => sum + c.mrrCents, 0);

  const filtered = initialRows.filter((c) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.fullName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.businessName.toLowerCase().includes(q) ||
      (c.currentUrl?.toLowerCase().includes(q) ?? false);
    const matchesIndustry = !industryFilter || c.industry === industryFilter;
    const matchesStatus =
      !statusFilter ||
      (statusFilter === 'activos' ? c.mrrCents > 0 : c.mrrCents === 0);

    return matchesSearch && matchesIndustry && matchesStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '28px 32px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <KpiCard label="Total Clientes" value={initialRows.length} />
          <KpiCard
            label="Con proyecto activo"
            value={initialRows.filter((c) => c.mrrCents > 0).length}
          />
          <KpiCard label="MRR Total" value={formatMoney(totalMRR)} accent="var(--amber)" />
        </div>

        <SectionHeader
          title="Clientes"
          action={
            <button
              type="button"
              onClick={() => setShowNewClientDrawer(true)}
              className="flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{
                background: 'var(--amber)',
                color: '#121212',
                border: 'none',
                borderRadius: 8,
                padding: '8px 14px',
                fontFamily: 'Inter Tight',
                cursor: 'pointer',
              }}
            >
              <Plus size={14} strokeWidth={2.5} />
              Nuevo cliente
            </button>
          }
        />

        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nombre, email o negocio..."
          />
          <FilterSelect
            value={industryFilter}
            onChange={setIndustryFilter}
            options={industries.map((industry) => ({ value: industry, label: industry }))}
            placeholder="Todas las industrias"
          />
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'activos', label: 'Con proyecto activo' },
              { value: 'sin', label: 'Sin proyectos activos' },
            ]}
            placeholder="Todos los estados"
          />
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 32px 32px' }}>
        {filtered.length === 0 ? (
          <EmptyClientsState
            hasFilters={Boolean(search || industryFilter || statusFilter)}
          />
        ) : (
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Cliente / Negocio', 'Contacto', 'Industria', 'Proyectos', 'MRR', 'Desde'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontFamily: 'Inter Tight',
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'var(--text-3)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <ClientTableRow
                    key={c.id}
                    client={c}
                    isLast={i === filtered.length - 1}
                    onClick={() => setSelectedClient(c)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedClient && (
        <ClientDrawer
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onUpdated={(client) => {
            setSelectedClient((current) => (current ? { ...current, ...client } : current));
            router.refresh();
          }}
        />
      )}

      <NewClientDrawer
        open={showNewClientDrawer}
        initialData={clientDraft}
        onClose={() => {
          setShowNewClientDrawer(false);
          router.replace('/admin/clientes');
        }}
        onCreated={() => {
          setShowNewClientDrawer(false);
          router.replace('/admin/clientes');
          router.refresh();
        }}
      />
    </div>
  );
}

function ClientTableRow({
  client,
  isLast,
  onClick,
}: {
  client: ClientRow;
  isLast: boolean;
  onClick: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      style={{
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        cursor: 'pointer',
        transition: 'background 0.12s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <td style={{ padding: '14px 16px' }}>
        <div style={{ fontFamily: 'Inter Tight', fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
          {client.fullName}
        </div>
        <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 2 }}>
          {client.businessName}
        </div>
      </td>
      <td style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'Inter Tight' }}>
          {client.email}
        </div>
        {client.whatsapp ? (
          <a
            href={`https://wa.me/${client.whatsapp.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-80"
            style={{ fontSize: 11, color: '#5DD69C', fontFamily: 'Inter Tight', marginTop: 2 }}
          >
            <MessageCircle size={12} strokeWidth={1.5} />
            {client.whatsapp}
          </a>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>—</div>
        )}
      </td>
      <td style={{ padding: '14px 16px' }}>
        <span
          style={{
            fontSize: 12,
            color: 'var(--text-2)',
            background: 'var(--surface-2)',
            padding: '3px 8px',
            borderRadius: 6,
            fontFamily: 'Inter Tight',
          }}
        >
          {client.industry}
        </span>
      </td>
      <td style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'Inter Tight' }}>
          {client.projectCount} proyecto{client.projectCount !== 1 ? 's' : ''}
        </div>
        <span className={client.mrrCents > 0 ? 'badge-pill badge-green' : 'badge-pill badge-neutral'}>
          {client.mrrCents > 0 ? 'Activo' : 'Sin activo'}
        </span>
      </td>
      <td style={{ padding: '14px 16px' }}>
        <span
          style={{
            fontFamily: 'Clash Grotesk',
            fontWeight: 700,
            fontSize: 15,
            color: client.mrrCents > 0 ? 'var(--amber)' : 'var(--text-3)',
          }}
        >
          {formatMoney(client.mrrCents)}
        </span>
        {client.mrrCents > 0 && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>/mes</span>}
      </td>
      <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text-3)', fontFamily: 'Inter Tight' }}>
        {formatSince(client.createdAt)}
      </td>
    </tr>
  );
}

function ClientDrawer({
  client,
  onClose,
  onUpdated,
}: {
  client: ClientRow;
  onClose: () => void;
  onUpdated: (client: Partial<ClientRow>) => void;
}) {
  const [draft, setDraft] = useState({
    fullName: client.fullName,
    email: client.email,
    whatsapp: client.whatsapp ?? '',
    businessName: client.businessName,
    industry: client.industry,
    currentUrl: client.currentUrl ?? '',
    location: client.location ?? '',
  });
  const [editing, setEditing] = useState<ClientEditableField | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function saveDraft() {
    setSaving(true);
    setError('');
    try {
      const result = await updateClientAction({
        id: client.id,
        fullName: draft.fullName,
        email: draft.email,
        businessName: draft.businessName,
        whatsapp: draft.whatsapp,
        industry: draft.industry as
          | 'salud'
          | 'legal'
          | 'fitness'
          | 'gastronomia'
          | 'inmobiliaria'
          | 'educacion'
          | 'marca_personal'
          | 'otro',
        currentUrl: draft.currentUrl,
        location: draft.location || undefined,
      });
      if ('error' in result) {
        setError(result.error);
        return;
      }
      onUpdated({
        fullName: result.client.fullName,
        email: result.client.email,
        businessName: result.client.businessName,
        whatsapp: result.client.whatsapp,
        industry: result.client.industry,
        currentUrl: result.client.currentUrl,
        location: result.client.location,
      });
      setEditing(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al actualizar cliente');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      <aside
        className="fixed right-0 top-0 z-50 flex h-full flex-col"
        style={{
          width: '50%',
          maxWidth: 960,
          minWidth: 420,
          background: 'var(--surface)',
          boxShadow: '-8px 0 48px rgba(0,0,0,0.55)',
        }}
      >
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display, "Clash Grotesk", sans-serif)',
                fontWeight: 700,
                fontSize: 20,
                color: 'var(--text)',
                letterSpacing: '-0.02em',
              }}
            >
              {draft.fullName}
            </div>
            <div style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 600, marginTop: 2 }}>
              {draft.businessName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, fontSize: 12, color: 'var(--text-3)', fontFamily: 'Inter Tight' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Globe size={12} strokeWidth={1.6} />
                {draft.currentUrl || 'Sin dominio'}
              </span>
              {draft.location && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <MapPin size={12} strokeWidth={1.6} />
                  {draft.location}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-3)',
              cursor: 'pointer',
              padding: 8,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
            }}
            className="transition-opacity hover:opacity-70"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div
            style={{
              background: 'var(--surface-2)',
              borderRadius: 10,
              padding: 16,
              border: '1px solid var(--border)',
            }}
          >
            <SectionLabel>Datos editables</SectionLabel>
            <EditableInfoRow label="Nombre" field="fullName" value={draft.fullName} editing={editing} setEditing={setEditing} onChange={(value) => setDraft((current) => ({ ...current, fullName: value }))} onSave={saveDraft} saving={saving} required />
            <EditableInfoRow label="Email" field="email" value={draft.email} type="email" editing={editing} setEditing={setEditing} onChange={(value) => setDraft((current) => ({ ...current, email: value }))} onSave={saveDraft} saving={saving} required />
            <EditableInfoRow label="WhatsApp" field="whatsapp" value={draft.whatsapp} editing={editing} setEditing={setEditing} onChange={(value) => setDraft((current) => ({ ...current, whatsapp: value }))} onSave={saveDraft} saving={saving} required />
            <EditableInfoRow label="Negocio" field="businessName" value={draft.businessName} editing={editing} setEditing={setEditing} onChange={(value) => setDraft((current) => ({ ...current, businessName: value }))} onSave={saveDraft} saving={saving} required />
            <EditableInfoRow label="Dominio" field="currentUrl" value={draft.currentUrl} editing={editing} setEditing={setEditing} onChange={(value) => setDraft((current) => ({ ...current, currentUrl: value }))} onSave={saveDraft} saving={saving} required />
            <EditableInfoRow label="Ubicación" field="location" value={draft.location} editing={editing} setEditing={setEditing} onChange={(value) => setDraft((current) => ({ ...current, location: value }))} onSave={saveDraft} saving={saving} />
            <EditableSelectRow label="Industria" field="industry" value={draft.industry} editing={editing} setEditing={setEditing} onChange={(value) => setDraft((current) => ({ ...current, industry: value }))} onSave={saveDraft} saving={saving} />
            {error && <p style={{ margin: '10px 0 0', color: '#FF6B6B', fontSize: 12, fontFamily: 'Inter Tight' }}>{error}</p>}
          </div>

          <div
            style={{
              background: 'var(--surface-2)',
              borderRadius: 10,
              padding: 16,
              border: '1px solid var(--border)',
            }}
          >
            <SectionLabel>Resumen operativo</SectionLabel>
            {([
              ['MRR Aportado', `${formatMoney(client.mrrCents)}/mes`],
              ['Cliente desde', formatSince(client.createdAt)],
              ['Proyectos', String(client.projectCount)],
            ] as [string, string][]).map(([label, value]) => (
              <InfoRow key={label} label={label} value={value} />
            ))}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <SectionLabel>Proyectos ({client.projectCount})</SectionLabel>
              <Link
                href="/admin/proyectos/nuevo"
                onClick={onClose}
                className="flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-90"
                style={{
                  background: 'var(--amber)',
                  color: '#121212',
                  borderRadius: 8,
                  padding: '5px 11px',
                  fontFamily: 'Inter Tight',
                }}
              >
                <Plus size={12} strokeWidth={2.5} />
                Nuevo proyecto
              </Link>
            </div>
            <div
              style={{
                background: 'var(--surface-2)',
                borderRadius: 10,
                padding: '12px 14px',
                border: '1px solid var(--border)',
                fontSize: 13,
                color: 'var(--text-2)',
                fontFamily: 'var(--font-body, "Inter Tight", sans-serif)',
              }}
            >
              Ver proyectos en{' '}
              <Link
                href={`/admin/proyectos?clientId=${client.id}`}
                style={{ color: 'var(--amber)' }}
                className="hover:underline"
                onClick={onClose}
              >
                /admin/proyectos →
              </Link>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <h1
        style={{
          fontFamily: 'Clash Grotesk',
          fontWeight: 700,
          fontSize: 22,
          color: 'var(--text)',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h1>
      {action}
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 12,
        padding: '18px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        minWidth: 180,
      }}
    >
      <span
        style={{
          fontFamily: 'Inter Tight',
          fontSize: 10,
          color: 'var(--text-3)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'Clash Grotesk',
          fontWeight: 700,
          fontSize: 28,
          color: accent ?? 'var(--text)',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative" style={{ flex: 1, maxWidth: 320, minWidth: 240 }}>
      <Search
        size={13}
        strokeWidth={1.5}
        className="absolute left-3 top-1/2 -translate-y-1/2"
        style={{ color: 'var(--text-3)' }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          background: 'var(--surface)',
          border: 'none',
          borderRadius: 8,
          padding: '8px 12px 8px 34px',
          fontFamily: 'Inter Tight',
          fontSize: 13,
          color: 'var(--text)',
          outline: 'none',
          boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
        }}
      />
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: 'var(--surface)',
        border: 'none',
        borderRadius: 8,
        padding: '8px 12px',
        color: value ? 'var(--text)' : 'var(--text-3)',
        fontFamily: 'Inter Tight',
        fontSize: 13,
        cursor: 'pointer',
        outline: 'none',
        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function EmptyClientsState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-24 text-center"
      style={{
        minHeight: 280,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
      }}
    >
      <Users size={40} strokeWidth={1} style={{ color: 'var(--text-3)', marginBottom: 16 }} />
      <h2 style={{ margin: 0, color: 'var(--text)', fontFamily: 'Clash Grotesk', fontSize: 20, fontWeight: 700 }}>
        {hasFilters ? 'Sin resultados para tus filtros' : 'Todavía no tienes clientes registrados'}
      </h2>
      <p style={{ margin: '8px 0 0', maxWidth: 440, color: 'var(--text-3)', fontFamily: 'Inter Tight', fontSize: 13, lineHeight: 1.5 }}>
        {hasFilters
          ? 'Prueba ajustando la búsqueda, industria o estado para encontrar el cliente correcto.'
          : 'Cuando agregues el primero, podrás vincular proyectos, sitios, tickets e incidencias desde un solo perfil.'}
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--text-3)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

function EditableInfoRow({
  label,
  field,
  value,
  type = 'text',
  editing,
  setEditing,
  onChange,
  onSave,
  saving,
  required,
}: {
  label: string;
  field: ClientEditableField;
  value: string;
  type?: string;
  editing: ClientEditableField | null;
  setEditing: (field: ClientEditableField | null) => void;
  onChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  required?: boolean;
}) {
  const isEditing = editing === field;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '110px 1fr auto',
        alignItems: 'center',
        gap: 10,
        padding: '9px 0',
        borderBottom: '1px solid var(--border)',
        fontSize: 12,
      }}
    >
      <span style={{ color: 'var(--text-3)', fontFamily: 'Inter Tight' }}>
        {label}{required ? ' *' : ''}
      </span>
      {isEditing ? (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
          required={required}
          style={{
            width: '100%',
            background: 'var(--surface)',
            border: '1px solid rgba(255,140,0,0.35)',
            borderRadius: 7,
            padding: '7px 9px',
            color: 'var(--text)',
            outline: 'none',
            fontFamily: 'Inter Tight',
          }}
        />
      ) : (
        <span style={{ color: value ? 'var(--text)' : 'var(--text-3)', fontWeight: 500, fontFamily: 'Inter Tight' }}>
          {value || '—'}
        </span>
      )}
      <button
        type="button"
        onClick={isEditing ? onSave : () => setEditing(field)}
        disabled={saving}
        aria-label={isEditing ? `Guardar ${label}` : `Editar ${label}`}
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 7,
          border: '1px solid var(--border)',
          background: isEditing ? 'var(--amber)' : 'rgba(255,255,255,0.04)',
          color: isEditing ? '#121212' : 'var(--text-3)',
          cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {isEditing ? <Check size={13} strokeWidth={2.2} /> : <Edit3 size={12} strokeWidth={1.8} />}
      </button>
    </div>
  );
}

function EditableSelectRow({
  label,
  field,
  value,
  editing,
  setEditing,
  onChange,
  onSave,
  saving,
}: {
  label: string;
  field: ClientEditableField;
  value: string;
  editing: ClientEditableField | null;
  setEditing: (field: ClientEditableField | null) => void;
  onChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const isEditing = editing === field;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '110px 1fr auto',
        alignItems: 'center',
        gap: 10,
        padding: '9px 0',
        borderBottom: '1px solid var(--border)',
        fontSize: 12,
      }}
    >
      <span style={{ color: 'var(--text-3)', fontFamily: 'Inter Tight' }}>{label} *</span>
      {isEditing ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
          style={{
            width: '100%',
            background: 'var(--surface)',
            border: '1px solid rgba(255,140,0,0.35)',
            borderRadius: 7,
            padding: '7px 9px',
            color: 'var(--text)',
            outline: 'none',
            fontFamily: 'Inter Tight',
          }}
        >
          {NICHE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <span style={{ color: 'var(--text)', fontWeight: 500, fontFamily: 'Inter Tight' }}>
          {NICHE_OPTIONS.find((option) => option.value === value)?.label ?? value}
        </span>
      )}
      <button
        type="button"
        onClick={isEditing ? onSave : () => setEditing(field)}
        disabled={saving}
        aria-label={isEditing ? `Guardar ${label}` : `Editar ${label}`}
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 7,
          border: '1px solid var(--border)',
          background: isEditing ? 'var(--amber)' : 'rgba(255,255,255,0.04)',
          color: isEditing ? '#121212' : 'var(--text-3)',
          cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {isEditing ? <Check size={13} strokeWidth={2.2} /> : <Edit3 size={12} strokeWidth={1.8} />}
      </button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: '1px solid var(--border)',
        fontSize: 12,
        gap: 16,
      }}
    >
      <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-body, "Inter Tight", sans-serif)' }}>
        {label}
      </span>
      <span
        style={{
          color: 'var(--text)',
          fontWeight: 500,
          fontFamily: 'var(--font-body, "Inter Tight", sans-serif)',
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatSince(date: Date) {
  return new Date(date).toLocaleDateString('es-DO', {
    year: 'numeric',
    month: 'short',
  });
}

const NICHE_OPTIONS: { value: string; label: string }[] = [
  { value: 'salud', label: 'Salud' },
  { value: 'legal', label: 'Legal' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'gastronomia', label: 'Gastronomía' },
  { value: 'inmobiliaria', label: 'Inmobiliaria' },
  { value: 'educacion', label: 'Educación' },
  { value: 'marca_personal', label: 'Marca Personal' },
  { value: 'otro', label: 'Otro' },
];

function NewClientDrawer({
  open,
  initialData,
  onClose,
  onCreated,
}: {
  open: boolean;
  initialData: ClientDraft;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [industry, setIndustry] = useState('otro');
  const [currentUrl, setCurrentUrl] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setFullName(initialData.fullName);
    setEmail('');
    setBusinessName(initialData.businessName);
    setWhatsapp('');
    setCurrentUrl(initialData.currentUrl);
    setLocation('');
    setIndustry(NICHE_OPTIONS.some((option) => option.value === initialData.industry) ? initialData.industry : 'otro');
    setError('');
  }, [initialData.businessName, initialData.currentUrl, initialData.fullName, initialData.industry, open]);

  function resetForm() {
    setFullName('');
    setEmail('');
    setBusinessName('');
    setWhatsapp('');
    setCurrentUrl('');
    setLocation('');
    setIndustry('otro');
    setError('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = await createClientAction({
        fullName,
        email,
        businessName,
        whatsapp,
        industry: industry as
          | 'salud'
          | 'legal'
          | 'fitness'
          | 'gastronomia'
          | 'inmobiliaria'
          | 'educacion'
          | 'marca_personal'
          | 'otro',
        currentUrl,
        location: location || undefined,
      });
      if ('error' in result) {
        setError(result.error);
        return;
      }
      resetForm();
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear cliente');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const inputStyle = {
    width: '100%',
    background: 'var(--surface-2)',
    border: 'none',
    borderRadius: 7,
    padding: '8px 10px',
    fontFamily: 'Inter Tight',
    fontSize: 13,
    color: 'var(--text)',
    outline: 'none',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600 as const,
    color: 'var(--text-3)' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginBottom: 6,
    fontFamily: 'Inter Tight',
  };

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => {
          resetForm();
          onClose();
        }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 40,
          border: 'none',
          cursor: 'pointer',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 420,
          maxWidth: '100vw',
          background: 'var(--surface)',
          zIndex: 50,
          boxShadow: '-8px 0 48px rgba(0,0,0,0.55)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <h2 style={{ fontFamily: 'Clash Grotesk', fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>
            Nuevo cliente
          </h2>
          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 4 }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <div style={{ padding: '12px 14px', background: 'rgba(255,140,0,0.08)', border: '1px solid rgba(255,140,0,0.18)', borderRadius: 10 }}>
            <div style={{ fontFamily: 'Inter Tight', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
              Datos base del cliente
            </div>
            <div style={{ marginTop: 3, fontFamily: 'Inter Tight', fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>
              Campos necesarios para conectar proyectos, sitios, tickets e incidencias. WhatsApp y dominio son obligatorios.
            </div>
          </div>
          {initialData.notes && (
            <div style={{ padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'Inter Tight', fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>
              Nota de la cotización: {initialData.notes}
            </div>
          )}
          <div>
            <label style={labelStyle}>
              Nombre completo <span style={{ color: 'var(--amber)' }}>*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Nombre y apellido"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>
              Email <span style={{ color: 'var(--amber)' }}>*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="correo@dominio.com"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>
              Nombre del negocio <span style={{ color: 'var(--amber)' }}>*</span>
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
              placeholder="Nombre comercial"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>
              WhatsApp <span style={{ color: 'var(--amber)' }}>*</span>
            </label>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              required
              placeholder="+1 809 000 0000"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>
              Dominio <span style={{ color: 'var(--amber)' }}>*</span>
            </label>
            <input
              type="text"
              value={currentUrl}
              onChange={(e) => setCurrentUrl(e.target.value)}
              required
              placeholder="dominio principal"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>
              Industria <span style={{ color: 'var(--amber)' }}>*</span>
            </label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              required
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {NICHE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>
              Ubicación <span style={{ color: 'var(--text-3)' }}>(opcional)</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ciudad, país"
              style={inputStyle}
            />
          </div>

          {error && (
            <p style={{ fontSize: 12, color: '#FF6B6B', fontFamily: 'Inter Tight', margin: 0 }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, marginTop: 'auto' }}>
            <button
              type="button"
              onClick={() => {
                resetForm();
                onClose();
              }}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text-2)',
                fontFamily: 'Inter Tight',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--amber)',
                color: '#121212',
                fontFamily: 'Inter Tight',
                fontSize: 13,
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Creando...' : 'Crear cliente'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
