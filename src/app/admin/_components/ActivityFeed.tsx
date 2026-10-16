'use client';

import { useState } from 'react';
import Link from 'next/link';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador',
  PROPOSAL_SENT: 'Propuesta enviada',
  REQUIRES_REVIEW: 'En revision',
  PAYMENT_RECEIVED: 'Pago recibido',
  AWAITING_ASSETS: 'Esperando materiales',
  ASSETS_SUBMITTED: 'Materiales enviados',
  ASSETS_UNDER_REVIEW: 'En revision',
  ASSETS_INCOMPLETE: 'Incompleto',
  PRODUCTION_STARTED: 'En produccion',
  STAGING_REVIEW: 'Revision staging',
  REVISIONS: 'Revisiones',
  REVISIONS_DONE: 'Revisiones listas',
  LIVE: 'En vivo',
  CANCELLED: 'Cancelado',
  CLOSED: 'Cerrado',
  SUSPENDED: 'Suspendido',
};

const EVENT_LABELS: Record<string, string> = {
  status_changed: 'Estado cambiado',
  asset_uploaded: 'Asset subido',
  asset_approved: 'Asset aprobado',
  asset_rejected: 'Asset rechazado',
  assets_submitted_for_review: 'Assets enviados',
  production_started: 'Produccion iniciada',
  staging_deployed: 'Staging desplegado',
  staging_feedback_submitted: 'Feedback de staging',
  revision_completed: 'Revision completada',
  proposal_sent: 'Propuesta enviada',
  proposal_expired: 'Propuesta expirada',
  comment_added: 'Comentario',
  email_sent: 'Email enviado',
  payment_received: 'Pago recibido',
};

const EVENT_DOT: Record<string, string> = {
  status_changed: '#FF8C00',
  asset_uploaded: '#6B9FFF',
  asset_approved: 'var(--green)',
  asset_rejected: 'var(--red)',
  assets_submitted_for_review: '#6B9FFF',
  production_started: '#C084FC',
  staging_deployed: '#C084FC',
  staging_feedback_submitted: '#FF8C00',
  revision_completed: 'var(--green)',
  proposal_sent: '#6B9FFF',
  proposal_expired: 'var(--red)',
  comment_added: 'var(--text-3)',
  email_sent: 'var(--text-3)',
  payment_received: 'var(--green)',
};

type ActivityEvent = {
  id: string;
  eventType: string;
  actorType: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  createdAt: Date;
  projectId: string;
  businessName: string;
};

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
}

export function ActivityFeed({ recentActivity }: { recentActivity: ActivityEvent[] }) {
  const [filter, setFilter] = useState<'hoy' | '7d' | 'todos'>('todos');

  const filteredActivity = recentActivity.filter((event) => {
    const createdAt = new Date(event.createdAt);
    const age = Date.now() - createdAt.getTime();
    if (filter === 'hoy') return createdAt.toDateString() === new Date().toDateString();
    if (filter === '7d') return age <= 7 * 24 * 60 * 60 * 1000;
    return true;
  });

  return (
    <div className="bento-span-2" style={{ background: 'var(--surface)', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 10, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Actividad Reciente
        </div>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as 'hoy' | '7d' | 'todos')}
          style={{ background: 'rgba(128,128,128,0.1)', border: 'none', borderRadius: 6, padding: '3px 8px', color: 'var(--text-3)', fontSize: 10, cursor: 'pointer', outline: 'none', fontFamily: "'Inter Tight', sans-serif" }}
        >
          <option value="hoy">Hoy</option>
          <option value="7d">Ultimos 7 dias</option>
          <option value="todos">Todos</option>
        </select>
      </div>
      {filteredActivity.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Sin actividad reciente.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filteredActivity.slice(0, 8).map((event, i) => {
            const label = EVENT_LABELS[event.eventType] ?? event.eventType;
            const dotColor = EVENT_DOT[event.eventType] ?? 'var(--text-3)';
            const desc = event.fromStatus && event.toStatus
              ? `${label}: ${STATUS_LABEL[event.fromStatus] ?? event.fromStatus} -> ${STATUS_LABEL[event.toStatus] ?? event.toStatus}`
              : label;
            return (
              <Link key={event.id} href={`/admin/proyectos/${event.projectId}`}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 8px', borderBottom: i < Math.min(filteredActivity.length, 8) - 1 ? '1px solid rgba(128,128,128,0.08)' : 'none', textDecoration: 'none', borderRadius: 7, transition: 'background 0.12s' }}
                onMouseEnter={(event) => ((event.currentTarget as HTMLAnchorElement).style.background = 'rgba(128,128,128,0.08)')}
                onMouseLeave={(event) => ((event.currentTarget as HTMLAnchorElement).style.background = 'transparent')}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: 5 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</p>
                  <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {event.businessName} · {timeAgo(event.createdAt)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
