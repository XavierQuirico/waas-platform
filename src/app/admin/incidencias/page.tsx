'use client';

import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  createIncident,
  getAdminIncidentData,
  resolveIncident,
  takeIncident,
} from './actions';

type IncidentStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
type IncidentSeverity = 'P1' | 'P2' | 'P3';
type IncidentReporter = 'CLIENT' | 'ADMIN' | 'SYSTEM';
type StatusFilter = 'ALL' | IncidentStatus;
type SeverityFilter = 'ALL' | IncidentSeverity;

type AdminIncident = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  affectedUrl: string | null;
  evidenceUrl: string | null;
  status: IncidentStatus;
  severity: IncidentSeverity;
  reportedBy: IncidentReporter;
  resolvedAt: string | null;
  resolvedNote: string | null;
  notifyClientOnResolve: boolean;
  createdAt: string;
  updatedAt: string;
  businessName: string;
  clientName: string;
  clientEmail: string;
  productionUrl: string | null;
  stagingUrl: string | null;
};

type IncidentProject = {
  id: string;
  clientId: string;
  businessName: string;
  clientName: string;
  productionUrl: string | null;
  stagingUrl: string | null;
  domainTarget: string | null;
};

const PAGE_SIZE = 20;

const SEVERITY_META: Record<IncidentSeverity, { bg: string; color: string; border: string }> = {
  P1: { bg: 'rgba(239,68,68,0.15)', color: 'var(--red)', border: 'rgba(239,68,68,0.3)' },
  P2: { bg: 'rgba(255,140,0,0.15)', color: '#FF8C00', border: 'rgba(255,140,0,0.3)' },
  P3: { bg: 'rgba(107,159,255,0.15)', color: '#6B9FFF', border: 'rgba(107,159,255,0.3)' },
};

const SEVERITY_OPTIONS: Record<IncidentSeverity, { title: string; detail: string; eta: string }> = {
  P1: { title: 'Sitio caído', detail: 'Producción inaccesible, seguridad o datos críticos.', eta: 'Atención inmediata' },
  P2: { title: 'Función crítica', detail: 'Pagos, formularios, reservas o flujo principal roto.', eta: 'Alta prioridad' },
  P3: { title: 'Error menor', detail: 'Ajuste visual, contenido o comportamiento no bloqueante.', eta: 'Prioridad normal' },
};

const inputStyle = {
  background: 'var(--surface-2)',
  border: 'none',
  borderRadius: 8,
  padding: '9px 12px',
  color: 'var(--text)',
  fontFamily: "'Inter Tight', sans-serif",
  fontSize: 13,
  outline: 'none',
  width: '100%',
  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
} as const;

function hoursOpen(createdAt: string) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60));
}

function timeAgo(createdAt: string) {
  const hours = hoursOpen(createdAt);
  if (hours < 1) return '<1h';
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
      <h1 style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 800, fontSize: 24, color: 'var(--text)' }}>{title}</h1>
      {action}
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
      <div style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 700, fontSize: 32, color: accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5, fontFamily: "'Inter Tight', sans-serif" }}>{label}</div>
    </div>
  );
}

function SearchInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
      <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.35, color: 'var(--text-3)' }}>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar por cliente o descripción..."
        style={{ width: '100%', background: 'var(--surface)', border: 'none', borderRadius: 8, padding: '8px 12px 8px 30px', fontFamily: "'Inter Tight', sans-serif", fontSize: 13, color: 'var(--text)', outline: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}
      />
    </div>
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      style={{ background: 'var(--surface)', border: 'none', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontFamily: "'Inter Tight', sans-serif", fontSize: 13, cursor: 'pointer', outline: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function Button({
  children,
  variant = 'primary',
  onClick,
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'green';
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const styles = {
    primary: { background: 'var(--amber)', color: '#121212' },
    secondary: { background: 'var(--surface-2)', color: 'var(--text)' },
    danger: { background: 'rgba(239,68,68,0.12)', color: 'var(--red)' },
    green: { background: 'rgba(93,214,156,0.12)', color: 'var(--green)' },
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ ...styles, border: 'none', borderRadius: 8, padding: '8px 15px', fontFamily: "'Inter Tight', sans-serif", fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, whiteSpace: 'nowrap' }}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: IncidentStatus }) {
  const cls = status === 'OPEN' ? 'badge-red badge-pill' : status === 'IN_PROGRESS' ? 'badge-blue badge-pill' : 'badge-green badge-pill';
  const label = status === 'OPEN' ? 'Abierta' : status === 'IN_PROGRESS' ? 'En progreso' : 'Resuelta';
  return <span className={cls}>{label}</span>;
}

function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0' }}>
      <span style={{ fontSize: 10, fontFamily: "'Inter Tight', sans-serif", color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'rgba(128,128,128,0.15)' }} />
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>
        {label}
        {required && <span style={{ color: 'var(--amber)', marginLeft: 2 }}>*</span>}
      </span>
      {children}
    </label>
  );
}

function IncidentDrawer({
  incident,
  onClose,
  onTake,
  onResolve,
  busy,
}: {
  incident: AdminIncident | null;
  onClose: () => void;
  onTake: (incidentId: string) => Promise<void>;
  onResolve: (incidentId: string, note: string, notifyClient: boolean) => Promise<void>;
  busy: boolean;
}) {
  const [resolveNote, setResolveNote] = useState('');
  const [notifyClient, setNotifyClient] = useState(true);

  useEffect(() => {
    setResolveNote('');
    setNotifyClient(true);
  }, [incident?.id]);

  if (!incident) return null;

  const sev = SEVERITY_META[incident.severity];
  const events = [
    { title: `Incidencia reportada - ${incident.severity}`, sub: `Por ${incident.reportedBy}`, time: new Date(incident.createdAt).toLocaleString('es-DO'), accent: sev.color },
    ...(incident.status === 'IN_PROGRESS' || incident.status === 'RESOLVED' ? [{ title: 'Incidencia tomada', sub: 'Estado actualizado a en progreso', time: new Date(incident.updatedAt).toLocaleString('es-DO'), accent: '#6B9FFF' }] : []),
    ...(incident.status === 'RESOLVED' ? [{ title: 'Resuelta', sub: incident.resolvedNote ?? undefined, time: incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString('es-DO') : '', accent: 'var(--green)' }] : []),
  ];

  return (
    <>
      <button type="button" aria-label="Cerrar detalle" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', border: 'none', zIndex: 200, backdropFilter: 'blur(2px)' }} />
      <aside style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: '55%', minWidth: 420, maxWidth: 960, background: 'var(--surface)', boxShadow: '-8px 0 48px rgba(0,0,0,0.55)', zIndex: 201, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 24, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--text)', marginBottom: 4 }}>{incident.title}</div>
              <div style={{ fontSize: 12, color: 'var(--amber)' }}>{incident.clientName} · {incident.businessName}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18, padding: 8 }}>x</button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', background: sev.bg, color: sev.color, border: `1px solid ${sev.border}`, padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700 }}>{incident.severity}</span>
            <StatusBadge status={incident.status} />
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Abierta hace {timeAgo(incident.createdAt)}</span>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Descripción</div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>{incident.description || 'Sin descripción.'}</p>
          </div>

          {(incident.affectedUrl || incident.evidenceUrl) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {incident.affectedUrl && (
                <a href={incident.affectedUrl} target="_blank" rel="noreferrer" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, textDecoration: 'none' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>URL afectada</div>
                  <div style={{ fontSize: 12, color: '#6B9FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{incident.affectedUrl}</div>
                </a>
              )}
              {incident.evidenceUrl && (
                <a href={incident.evidenceUrl} target="_blank" rel="noreferrer" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, textDecoration: 'none' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>Evidencia</div>
                  <div style={{ fontSize: 12, color: '#6B9FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{incident.evidenceUrl}</div>
                </a>
              )}
            </div>
          )}

          <Divider label="Historial de actualizaciones" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {events.map((event, index) => (
              <div key={`${event.title}-${index}`} style={{ display: 'flex', gap: 12, paddingBottom: index < events.length - 1 ? 18 : 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: event.accent, flexShrink: 0, marginTop: 4 }} />
                  {index < events.length - 1 && <div style={{ width: 1, flex: 1, background: 'rgba(128,128,128,0.15)', marginTop: 4 }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{event.title}</div>
                  {event.sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{event.sub}</div>}
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3, opacity: 0.7 }}>{event.time}</div>
                </div>
              </div>
            ))}
          </div>

          <Divider label="Acciones" />
          {incident.status === 'OPEN' && (
            <Button disabled={busy} onClick={() => onTake(incident.id)}>
              Tomar incidencia -&gt; IN_PROGRESS
            </Button>
          )}
          {incident.status === 'IN_PROGRESS' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <textarea value={resolveNote} onChange={(event) => setResolveNote(event.target.value)} placeholder="Nota de resolución (qué se hizo, qué causó el problema)..." rows={3} style={inputStyle} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={notifyClient} onChange={(event) => setNotifyClient(event.target.checked)} />
                Notificar al cliente al resolver
              </label>
              <Button variant="green" disabled={busy} onClick={() => onResolve(incident.id, resolveNote, notifyClient)}>
                Marcar como resuelta
              </Button>
            </div>
          )}
          {incident.status === 'RESOLVED' && (
            <div style={{ padding: 14, background: 'rgba(93,214,156,0.08)', borderRadius: 10, border: '1px solid rgba(93,214,156,0.2)', fontSize: 13, color: 'var(--green)' }}>
              Incidencia resuelta. {incident.resolvedNote}
            </div>
          )}

          <Button variant="secondary" onClick={() => window.open(`/admin/proyectos/${incident.projectId}`, '_blank', 'noopener,noreferrer')}>
            Ver proyecto / sitio afectado
          </Button>
        </div>
      </aside>
    </>
  );
}

function ReportModal({
  open,
  projects,
  onClose,
  onSubmit,
  busy,
}: {
  open: boolean;
  projects: IncidentProject[];
  onClose: () => void;
  onSubmit: (input: { projectId: string; title: string; severity: IncidentSeverity; description?: string; affectedUrl?: string; evidenceUrl?: string }) => Promise<void>;
  busy: boolean;
}) {
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('P2');
  const [description, setDescription] = useState('');
  const [affectedUrl, setAffectedUrl] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');

  const clients = useMemo(() => {
    const map = new Map<string, { id: string; label: string; count: number }>();
    projects.forEach((project) => {
      const existing = map.get(project.clientId);
      if (existing) {
        existing.count += 1;
        return;
      }
      map.set(project.clientId, { id: project.clientId, label: project.clientName, count: 1 });
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [projects]);

  const clientProjects = useMemo(
    () => projects.filter((project) => project.clientId === clientId),
    [clientId, projects],
  );

  const selectedProject = projects.find((project) => project.id === projectId) ?? null;

  useEffect(() => {
    if (!open) return;
    const firstClientId = clients[0]?.id ?? '';
    setClientId(firstClientId);
  }, [open, clients]);

  useEffect(() => {
    if (!open) return;
    setProjectId(clientProjects.length === 1 ? clientProjects[0].id : '');
  }, [clientId, clientProjects, open]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      projectId,
      title,
      severity,
      description: description || undefined,
      affectedUrl: affectedUrl || undefined,
      evidenceUrl: evidenceUrl || undefined,
    });
    setClientId(clients[0]?.id ?? '');
    setProjectId('');
    setTitle('');
    setSeverity('P2');
    setDescription('');
    setAffectedUrl('');
    setEvidenceUrl('');
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button type="button" aria-label="Cerrar reporte" onClick={onClose} style={{ position: 'absolute', inset: 0, border: 'none', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }} />
      <form onSubmit={handleSubmit} style={{ position: 'relative', background: 'var(--surface)', borderRadius: 16, padding: 28, width: 680, maxWidth: 'calc(100vw - 32px)', maxHeight: '88vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.65)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <h3 style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>Reportar incidencia</h3>
            <div style={{ marginTop: 5, fontSize: 12, color: 'var(--text-3)', fontFamily: "'Inter Tight', sans-serif" }}>
              Registra un evento real vinculado a un sitio activo.
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18, padding: 4, lineHeight: 1 }}>x</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Cliente" required>
              <select value={clientId} onChange={(event) => setClientId(event.target.value)} required style={inputStyle}>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.label} ({client.count})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sitio / proyecto activo" required>
              <select value={projectId} onChange={(event) => setProjectId(event.target.value)} required style={inputStyle}>
                <option value="">Seleccionar sitio...</option>
                {clientProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.businessName}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {selectedProject && (
            <div style={{ padding: '10px 12px', background: 'rgba(107,159,255,0.08)', border: '1px solid rgba(107,159,255,0.18)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, fontFamily: "'Inter Tight', sans-serif" }}>{selectedProject.businessName}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{selectedProject.productionUrl || selectedProject.stagingUrl || selectedProject.domainTarget || 'Sin URL registrada'}</div>
              </div>
              <span style={{ alignSelf: 'center', fontSize: 10, color: '#6B9FFF', border: '1px solid rgba(107,159,255,0.25)', borderRadius: 999, padding: '3px 8px', whiteSpace: 'nowrap' }}>
                Origen: Admin
              </span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Título" required>
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required minLength={5} placeholder="Ej. Formulario no envía leads" style={inputStyle} />
            </Field>
            <Field label="URL afectada">
              <input value={affectedUrl} onChange={(event) => setAffectedUrl(event.target.value)} maxLength={500} placeholder="https://sitio.com/contacto" style={inputStyle} />
            </Field>
          </div>

          <div>
            <div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 12, color: 'var(--text-2)', fontWeight: 500, marginBottom: 8 }}>
              Severidad <span style={{ color: 'var(--amber)' }}>*</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {(['P1', 'P2', 'P3'] as IncidentSeverity[]).map((option) => {
                const meta = SEVERITY_META[option];
                const copy = SEVERITY_OPTIONS[option];
                const active = severity === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSeverity(option)}
                    style={{
                      textAlign: 'left',
                      padding: 12,
                      borderRadius: 10,
                      border: active ? `1px solid ${meta.border}` : '1px solid var(--border)',
                      background: active ? meta.bg : 'var(--surface-2)',
                      cursor: 'pointer',
                      minHeight: 106,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 800, fontSize: 13, color: meta.color }}>{option}</span>
                      <span style={{ fontSize: 10, color: active ? meta.color : 'var(--text-3)' }}>{copy.eta}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>{copy.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.35 }}>{copy.detail}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="Descripción">
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={2000} placeholder="Qué pasa, desde cuándo, pasos para reproducirlo..." style={inputStyle} />
          </Field>

          <Field label="Evidencia">
            <input value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} maxLength={500} placeholder="Link a screenshot, Loom, ticket externo..." style={inputStyle} />
          </Field>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="danger" disabled={busy || !projectId || title.trim().length < 5}>Reportar incidencia</Button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function AdminIncidenciasPage() {
  const [incidents, setIncidents] = useState<AdminIncident[]>([]);
  const [projects, setProjects] = useState<IncidentProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminIncidentData();
      setIncidents(data.incidents as AdminIncident[]);
      setProjects(data.projects);
      setVisibleCount(PAGE_SIZE);
    } catch {
      setError('Error cargando incidencias. Intenta actualizar la página.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return incidents.filter((incident) => {
      const matchesSearch =
        !needle ||
        incident.title.toLowerCase().includes(needle) ||
        (incident.description?.toLowerCase().includes(needle) ?? false) ||
        incident.businessName.toLowerCase().includes(needle) ||
        incident.clientName.toLowerCase().includes(needle);
      const matchesSeverity = severityFilter === 'ALL' || incident.severity === severityFilter;
      const matchesStatus = statusFilter === 'ALL' || incident.status === statusFilter;
      return matchesSearch && matchesSeverity && matchesStatus;
    });
  }, [incidents, search, severityFilter, statusFilter]);

  const selected = incidents.find((incident) => incident.id === selectedId) ?? null;
  const visibleIncidents = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;
  const thisMonth = new Date().getMonth();

  const kpis = [
    { label: 'P1 Abiertas', value: incidents.filter((i) => i.severity === 'P1' && i.status !== 'RESOLVED').length, accent: 'var(--red)' },
    { label: 'P2 Abiertas', value: incidents.filter((i) => i.severity === 'P2' && i.status !== 'RESOLVED').length, accent: '#FF8C00' },
    { label: 'P3 Abiertas', value: incidents.filter((i) => i.severity === 'P3' && i.status !== 'RESOLVED').length, accent: '#6B9FFF' },
    { label: 'Resueltas este mes', value: incidents.filter((i) => i.status === 'RESOLVED' && new Date(i.updatedAt).getMonth() === thisMonth).length, accent: 'var(--green)' },
  ];

  async function handleTake(incidentId: string) {
    setBusy(true);
    setError('');
    try {
      await takeIncident(incidentId);
      await refresh();
    } catch {
      setError('Error al tomar incidencia. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  async function handleResolve(incidentId: string, note: string, notifyClient: boolean) {
    setBusy(true);
    setError('');
    try {
      await resolveIncident(incidentId, note, notifyClient);
      await refresh();
    } catch {
      setError('Error al resolver incidencia. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(input: { projectId: string; title: string; severity: IncidentSeverity; description?: string; affectedUrl?: string; evidenceUrl?: string }) {
    setBusy(true);
    setError('');
    try {
      await createIncident(input);
      setShowReportModal(false);
      await refresh();
    } catch {
      setError('Error al reportar incidencia. Revisa los campos e intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 pt-7 pb-0 shrink-0">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 20 }}>
          {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
        </div>

        <SectionHeader title="Incidencias" action={<Button variant="danger" onClick={() => setShowReportModal(true)}>+ Reportar incidencia</Button>} />

        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <SearchInput value={search} onChange={setSearch} />
          <Select<SeverityFilter>
            value={severityFilter}
            onChange={(value) => { setSeverityFilter(value); setVisibleCount(PAGE_SIZE); }}
            options={[
              { value: 'ALL', label: 'Toda severidad' },
              { value: 'P1', label: 'P1' },
              { value: 'P2', label: 'P2' },
              { value: 'P3', label: 'P3' },
            ]}
          />
          <Select<StatusFilter>
            value={statusFilter}
            onChange={(value) => { setStatusFilter(value); setVisibleCount(PAGE_SIZE); }}
            options={[
              { value: 'ALL', label: 'Todos los estados' },
              { value: 'OPEN', label: 'Abierta' },
              { value: 'IN_PROGRESS', label: 'En progreso' },
              { value: 'RESOLVED', label: 'Resuelta' },
            ]}
          />
        </div>
      </div>

      {error && (
        <div className="mx-8 mb-4 rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.25)' }}>
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto px-8 pb-8">
        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Cargando...</p>
        ) : filtered.length === 0 ? (
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '48px 24px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.22)' }}>
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No hay incidencias con estos filtros.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visibleIncidents.map((incident) => {
              const sev = SEVERITY_META[incident.severity];
              const isResolved = incident.status === 'RESOLVED';
              return (
                <button
                  key={incident.id}
                  type="button"
                  onClick={() => setSelectedId(incident.id)}
                  style={{ width: '100%', textAlign: 'left', background: 'var(--surface)', border: `1px solid ${isResolved ? 'var(--border)' : sev.border}`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'flex-start', opacity: isResolved ? 0.68 : 1, transition: 'background 0.15s' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, background: sev.bg, flexShrink: 0 }}>
                    <span style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 800, fontSize: 11, color: sev.color }}>{incident.severity}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 3 }}>{incident.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>{incident.clientName} · {incident.businessName}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <StatusBadge status={incident.status} />
                      <span style={{ fontSize: 10, color: 'var(--text-3)' }}>abierta hace {timeAgo(incident.createdAt)} · por {incident.reportedBy}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {hasMore && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Button variant="secondary" onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}>
              Ver más ({filtered.length - visibleCount} restantes)
            </Button>
          </div>
        )}
      </div>

      <IncidentDrawer incident={selected} onClose={() => setSelectedId(null)} onTake={handleTake} onResolve={handleResolve} busy={busy} />
      <ReportModal open={showReportModal} projects={projects} onClose={() => setShowReportModal(false)} onSubmit={handleCreate} busy={busy} />
    </div>
  );
}
