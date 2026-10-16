'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PROJECT_STATUS_LABELS, type ProjectStatus } from '@/lib/projects/state-machine';

interface SiteRow {
  id: string;
  status: string;
  plan: string;
  monthlyPriceCents: number;
  productionUrl: string | null;
  stagingUrl: string | null;
  liveAt: Date | null;
  updatedAt: Date;
  clientName: string;
  clientEmail: string;
  clientWhatsapp: string | null;
  businessName: string;
  activeIncidentCount?: number;
}

interface SitiosListProps {
  live: SiteRow[];
  inProgress: SiteRow[];
  suspended: SiteRow[];
}

type StatusFilter = 'ALL' | 'LIVE' | 'PRODUCTION' | 'SUSPENDED';

const STATUS_BADGE_CLASS: Partial<Record<string, string>> = {
  LIVE: 'badge-green badge-pill',
  SUSPENDED: 'badge-red badge-pill',
  PRODUCTION_STARTED: 'badge-blue badge-pill',
  STAGING_REVIEW: 'badge-violet badge-pill',
  REVISIONS: 'badge-amber badge-pill',
  REVISIONS_DONE: 'badge-green badge-pill',
};

const PLAN_BADGE_CLASS: Record<string, string> = {
  BASIC: 'badge-neutral badge-pill',
  PRO: 'badge-pro badge-pill',
  BUSINESS: 'badge-business badge-pill',
  LEGACY: 'badge-legacy badge-pill',
};

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
      <svg
        aria-hidden="true"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        style={{
          position: 'absolute',
          left: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          opacity: 0.35,
          color: 'var(--text-3)',
        }}
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          background: 'var(--surface)',
          border: 'none',
          borderRadius: 8,
          padding: '8px 12px 8px 30px',
          fontFamily: "'Inter Tight', sans-serif",
          fontSize: 13,
          color: 'var(--text)',
          outline: 'none',
          boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
        }}
      />
    </div>
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as StatusFilter)}
      style={{
        background: 'var(--surface)',
        border: 'none',
        borderRadius: 8,
        padding: '8px 12px',
        color: 'var(--text)',
        fontFamily: "'Inter Tight', sans-serif",
        fontSize: 13,
        cursor: 'pointer',
        outline: 'none',
        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
      }}
    >
      <option value="ALL">Todos los estados</option>
      <option value="LIVE">LIVE</option>
      <option value="PRODUCTION">En producción</option>
      <option value="SUSPENDED">Suspendido</option>
    </select>
  );
}

function SiteToggle({
  isLive,
  loading,
  onClick,
}: {
  isLive: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={loading ? undefined : onClick}
      aria-label={isLive ? 'Suspender sitio' : 'Reactivar sitio'}
      aria-pressed={isLive}
      style={{
        width: 44,
        height: 24,
        borderRadius: 100,
        border: 'none',
        cursor: loading ? 'not-allowed' : 'pointer',
        background: isLive ? '#22C55E' : 'rgba(255,255,255,0.12)',
        boxShadow: isLive ? '0 0 8px rgba(34,197,94,0.55)' : 'none',
        display: 'flex',
        alignItems: 'center',
        padding: 3,
        transition: 'background 0.18s',
        opacity: loading ? 0.5 : 1,
        flexShrink: 0,
        outline: isLive ? 'none' : '1px solid rgba(255,255,255,0.15)',
        outlineOffset: -1,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: isLive ? '#fff' : 'rgba(255,255,255,0.4)',
          marginLeft: isLive ? 'auto' : 0,
          transition: 'margin 0.18s, background 0.18s',
          boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
        }}
      />
    </button>
  );
}

function ConfirmToggleModal({
  site,
  action,
  loading,
  onClose,
  onConfirm,
}: {
  site: SiteRow;
  action: 'suspend' | 'reactivate';
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button
        type="button"
        aria-label="Cerrar confirmación"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, border: 'none', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`confirm-${site.id}`}
        style={{
          position: 'relative',
          width: 400,
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--surface)',
          borderRadius: 16,
          padding: 28,
          boxShadow: '0 24px 64px rgba(0,0,0,0.65)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 id={`confirm-${site.id}`} style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>
            Confirmar cambio de estado
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18, padding: 4, lineHeight: 1 }}>
            x
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 16 }}>
          ¿Seguro que deseas {action === 'suspend' ? 'suspender' : 'reactivar'} el sitio{' '}
          <strong style={{ color: 'var(--text)' }}>{site.businessName}</strong>?
          {action === 'suspend' ? ' Esto hará el sitio inaccesible para los visitantes.' : ''}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{ background: 'var(--surface-2)', color: 'var(--text)', border: 'none', borderRadius: 8, padding: '8px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              background: action === 'suspend' ? 'rgba(239,68,68,0.12)' : 'rgba(93,214,156,0.12)',
              color: action === 'suspend' ? 'var(--red)' : 'var(--green)',
              border: 'none',
              borderRadius: 8,
              padding: '8px 15px',
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {action === 'suspend' ? 'Suspender sitio' : 'Reactivar sitio'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SiteCard({
  site,
  onSuspend,
  onReactivate,
}: {
  site: SiteRow;
  onSuspend?: (id: string) => void;
  onReactivate?: (id: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'suspend' | 'reactivate' | null>(null);
  const isLive = site.status === 'LIVE';
  const isSuspended = site.status === 'SUSPENDED';
  const canToggle = isLive || isSuspended;
  const incidentCount = site.activeIncidentCount ?? 0;

  async function handleAction(action: 'suspend' | 'reactivate') {
    setLoading(true);
    try {
      const endpoint = action === 'suspend'
        ? '/api/trpc/admin.suspendProject'
        : '/api/trpc/admin.reactivateProject';

      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { projectId: site.id } }),
      });

      if (action === 'suspend') onSuspend?.(site.id);
      else onReactivate?.(site.id);

      window.location.reload();
    } catch {
      setConfirmAction(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${isSuspended ? 'rgba(239,68,68,0.25)' : 'var(--border)'}`,
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
        transition: 'box-shadow 0.18s',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.36)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.22)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
            {site.businessName}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
            {site.clientName} · {site.clientEmail}
          </div>
        </div>

        {canToggle && (
          <SiteToggle
            isLive={isLive}
            loading={loading}
            onClick={() => setConfirmAction(isLive ? 'suspend' : 'reactivate')}
          />
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {site.status === 'LIVE' ? (
          <span className="badge-green badge-pill">ACTIVO</span>
        ) : site.status === 'SUSPENDED' ? (
          <span className="badge-red badge-pill">SUSPENDIDO</span>
        ) : (
          <span className={STATUS_BADGE_CLASS[site.status] ?? 'badge-neutral badge-pill'}>
            {PROJECT_STATUS_LABELS[site.status as ProjectStatus] ?? site.status}
          </span>
        )}
        <span className={PLAN_BADGE_CLASS[site.plan] ?? 'badge-neutral badge-pill'}>{site.plan}</span>
        {incidentCount > 0 && (
          <span
            style={{
              background: 'rgba(239,68,68,0.12)',
              color: 'var(--red)',
              border: '1px solid rgba(239,68,68,0.25)',
              padding: '2px 8px',
              borderRadius: 100,
              fontSize: 10,
              fontWeight: 700,
              fontFamily: "'Inter Tight', sans-serif",
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            ! {incidentCount} incidencia{incidentCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {site.productionUrl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0, fontWeight: 600, letterSpacing: '0.05em' }}>PROD</span>
          <a
            href={site.productionUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: '#6B9FFF', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Inter Tight', sans-serif", textDecoration: 'none' }}
          >
            {site.productionUrl}
          </a>
          <a href={site.productionUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-3)', fontSize: 12, flexShrink: 0 }}>
            ↗
          </a>
        </div>
      )}

      {site.stagingUrl && !site.productionUrl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0, fontWeight: 600, letterSpacing: '0.05em' }}>STAGING</span>
          <a
            href={site.stagingUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: 'var(--text-3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Inter Tight', sans-serif", textDecoration: 'none' }}
          >
            {site.stagingUrl}
          </a>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
          {site.productionUrl ?? site.stagingUrl ?? 'Sin dominio'}
          {' · '}
          {site.liveAt
            ? `LIVE desde ${new Date(site.liveAt).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })}`
            : 'Sin fecha LIVE'}
        </span>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link
            href={`/admin/proyectos/${site.id}`}
            style={{ borderRadius: 100, border: '1px solid var(--border)', padding: '2px 10px', fontSize: 11, color: 'var(--text-2)', fontWeight: 500, textDecoration: 'none', background: 'none', transition: 'background 0.15s' }}
          >
            Ver →
          </Link>

          {site.clientWhatsapp && (
            <a
              href={`https://wa.me/${site.clientWhatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ borderRadius: 100, border: '1px solid rgba(93,214,156,0.3)', padding: '2px 10px', fontSize: 11, color: '#5DD69C', fontWeight: 500, textDecoration: 'none', background: 'rgba(93,214,156,0.08)' }}
            >
              WA
            </a>
          )}
        </div>
      </div>

      {confirmAction && (
        <ConfirmToggleModal
          site={site}
          action={confirmAction}
          loading={loading}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => handleAction(confirmAction)}
        />
      )}
    </div>
  );
}

function SectionLabel({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)', fontFamily: "'Clash Grotesk', sans-serif" }}>
        {label}
      </span>
    </div>
  );
}

export function SitiosList({ live, inProgress, suspended }: SitiosListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [incidentCounts, setIncidentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;

    async function fetchIncidentCounts() {
      try {
        const res = await fetch('/api/trpc/incidents.getAllOpenIncidents', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) return;

        const data = await res.json();
        const result = data.result?.data?.json ?? data.result?.data;
        if (!Array.isArray(result) || !active) return;

        const nextCounts: Record<string, number> = {};
        for (const incident of result) {
          if (incident?.projectId) {
            nextCounts[incident.projectId] = (nextCounts[incident.projectId] ?? 0) + 1;
          }
        }
        setIncidentCounts(nextCounts);
      } catch {
        if (active) setIncidentCounts({});
      }
    }

    fetchIncidentCounts();
    return () => {
      active = false;
    };
  }, []);

  const allSites = useMemo(
    () => [...suspended, ...inProgress, ...live].map((site) => ({
      ...site,
      activeIncidentCount: incidentCounts[site.id] ?? site.activeIncidentCount ?? 0,
    })),
    [incidentCounts, inProgress, live, suspended]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return allSites.filter((site) => {
      const matchesSearch =
        !needle ||
        site.businessName.toLowerCase().includes(needle) ||
        site.clientName.toLowerCase().includes(needle) ||
        site.clientEmail.toLowerCase().includes(needle) ||
        (site.productionUrl?.toLowerCase().includes(needle) ?? false) ||
        (site.stagingUrl?.toLowerCase().includes(needle) ?? false);

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'LIVE' && site.status === 'LIVE') ||
        (statusFilter === 'SUSPENDED' && site.status === 'SUSPENDED') ||
        (statusFilter === 'PRODUCTION' && !['LIVE', 'SUSPENDED'].includes(site.status));

      return matchesSearch && matchesStatus;
    });
  }, [allSites, search, statusFilter]);

  if (allSites.length === 0) {
    return (
      <div style={{ borderRadius: 12, border: '1px dashed var(--border)', padding: '48px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No hay sitios activos aún.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por cliente o dominio..." />
        <StatusSelect value={statusFilter} onChange={setStatusFilter} />
      </div>

      {filtered.length === 0 ? (
        <div style={{ borderRadius: 12, border: '1px dashed var(--border)', padding: '40px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No hay sitios que coincidan con los filtros.</p>
        </div>
      ) : (
        <section>
          <SectionLabel color="#5DD69C" label={`Sitios (${filtered.length})`} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {filtered.map((site) => <SiteCard key={site.id} site={site} />)}
          </div>
        </section>
      )}
    </div>
  );
}
