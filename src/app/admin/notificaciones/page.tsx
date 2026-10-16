'use client';

import { useEffect, useState } from 'react';
import { CheckCheck, Clock } from 'lucide-react';
import {
  completeAdminReminder,
  createAdminReminder,
  getAdminNotifications,
  getAdminReminders,
  getNotificationPreferences,
  markAllNotificationsRead,
  markNotificationRead,
  postponeAdminReminder,
  setNotificationPreference,
} from './actions';

type NotiTab = 'alertas' | 'config' | 'historial' | 'recordatorios';

type Notification = {
  id: string;
  type: 'sla' | 'p1' | 'assets' | 'ticket' | 'payment' | 'staging' | 'proposal';
  title: string;
  message: string;
  time: string;
  read: boolean;
};

type Reminder = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: 'alta' | 'media' | 'baja';
  client: string;
  recurrence: 'none' | 'weekly' | 'monthly';
  done: boolean;
};

const TYPE_ICONS: Record<Notification['type'], string> = {
  sla: '⚡',
  p1: '🔴',
  assets: '📁',
  ticket: '🎫',
  payment: '💰',
  staging: '🌐',
  proposal: '📧',
};

const EMAIL_CONFIG_ITEMS = [
  { key: 'sla_12h',          label: 'SLA crítico',            desc: 'Cuando un proyecto tiene menos de 12h para su deadline', defaultOn: true },
  { key: 'p1_open',          label: 'Incidencia P1',          desc: 'Cuando se reporta una incidencia de severidad P1', defaultOn: true },
  { key: 'payment_received', label: 'Pago fallido',           desc: 'Cuando un cobro de PayPal falla', defaultOn: true },
  { key: 'assets_uploaded',  label: 'Assets subidos',         desc: 'Cuando un cliente sube sus materiales', defaultOn: true },
  { key: 'staging_feedback', label: 'Feedback de staging',    desc: 'Cuando un cliente envía feedback desde el portal', defaultOn: false },
  { key: 'new_ticket',       label: 'Nuevo ticket',           desc: 'Cuando un cliente crea un nuevo ticket de add-on', defaultOn: true },
  { key: 'proposal_expired', label: 'Propuesta expirada',     desc: 'Cuando una propuesta enviada llega a su fecha de vencimiento', defaultOn: false },
];

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Hace un momento';
  if (h < 24) return `Hace ${h}h`;
  const d = Math.floor(h / 24);
  return `Hace ${d}d`;
}

export default function NotificacionesPage() {
  const [tab, setTab] = useState<NotiTab>('alertas');
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refreshReminders() {
    const rows = await getAdminReminders();
    setReminders(rows);
  }

  useEffect(() => {
    let mounted = true;
    Promise.all([getAdminNotifications(), getAdminReminders()])
      .then(([notificationRows, reminderRows]) => {
        if (!mounted) return;
        setNotifs(notificationRows.map((row) => ({ ...row, id: row.key })));
        setReminders(reminderRows);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const unreadCount = notifs.filter((n) => !n.read).length;
  const overdueCount = reminders.filter((r) => !r.done && new Date(r.dueDate) < new Date()).length;

  const tabs: { key: NotiTab; label: string; count?: number }[] = [
    { key: 'alertas',   label: 'Alertas activas', count: unreadCount },
    { key: 'config',    label: 'Config. emails' },
    { key: 'historial', label: 'Historial' },
    { key: 'recordatorios', label: 'Recordatorios', count: overdueCount },
  ];

  const markAllRead = async () => {
    const unreadKeys = notifs.filter((n) => !n.read).map((n) => n.id);
    setNotifs((ns) => ns.map((n) => ({ ...n, read: true })));
    await markAllNotificationsRead(unreadKeys);
  };
  const markRead = async (id: string) => {
    setNotifs((ns) => ns.map((n) => n.id === id ? { ...n, read: true } : n));
    await markNotificationRead(id);
  };
  const completeReminder = async (id: string) => {
    setReminders((rs) => rs.map((r) => r.id === id ? { ...r, done: true } : r));
    await completeAdminReminder(id);
  };
  const postponeReminder = async (id: string) => {
    setReminders((rs) => rs.map((r) => {
      if (r.id !== id) return r;
      const next = new Date(r.dueDate);
      next.setDate(next.getDate() + 2);
      return { ...r, dueDate: next.toISOString().slice(0, 10) };
    }));
    await postponeAdminReminder(id);
  };

  return (
    <div className="flex flex-col" style={{ padding: '28px 32px 32px', gap: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 style={{ fontFamily: 'Clash Grotesk', fontWeight: 800, fontSize: 24, color: 'var(--text)' }}>
          Centro de Notificaciones
        </h1>
        {tab === 'recordatorios' && (
          <button
            type="button"
            onClick={() => setShowReminderModal(true)}
            style={{ background: 'var(--amber)', border: 'none', color: '#121212', borderRadius: 100, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter Tight' }}
          >
            Nuevo recordatorio
          </button>
        )}
        {tab === 'alertas' && unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,140,0,0.4)',
              color: '#FF8C00',
              borderRadius: 100,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Inter Tight',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <CheckCheck size={13} strokeWidth={2} />
            Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
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
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span style={{
                background: '#FF8C00',
                color: '#121212',
                borderRadius: 100,
                padding: '1px 6px',
                fontSize: 10,
                fontWeight: 700,
                lineHeight: 1.4,
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alertas activas */}
      {tab === 'alertas' && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid rgba(255,140,0,0.2)', boxShadow: '0 2px 8px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <p style={{ fontFamily: 'Inter Tight', fontSize: 13, color: 'var(--text-3)' }}>Cargando alertas reales...</p>
            </div>
          ) : notifs.filter((n) => !n.read).length === 0 ? (
            <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 30 }}>⚡</span>
              <p style={{ fontFamily: 'Inter Tight', fontSize: 13, color: 'var(--text-3)' }}>Sin alertas pendientes</p>
            </div>
          ) : (
            <div style={{ padding: '4px 0' }}>
              {notifs.filter((n) => !n.read).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => markRead(n.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    gap: 12,
                    padding: '12px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,140,0,0.04)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    border: 'none',
                    borderBottomColor: 'rgba(255,255,255,0.06)',
                    borderBottomWidth: 1,
                    borderBottomStyle: 'solid',
                  }}
                >
                  {/* Icon + unread dot */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: 'rgba(255,140,0,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FF8C00',
                      fontSize: 17,
                    }}>
                      {TYPE_ICONS[n.type]}
                    </div>
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#FF8C00',
                    }} />
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'Inter Tight',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text)',
                      marginBottom: 2,
                    }}>
                      {n.title}
                    </div>
                    <div style={{ fontFamily: 'Inter Tight', fontSize: 12, color: 'var(--text-2)' }}>{n.message}</div>
                    <div style={{ fontFamily: 'Inter Tight', fontSize: 11, color: 'var(--text-3)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={10} strokeWidth={1.5} />
                      {timeAgo(n.time)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Config emails */}
      {tab === 'config' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 600 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.22)' }}>
            <h2 style={{ fontFamily: 'Inter Tight', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Email destino</h2>
            <p style={{ fontFamily: 'Inter Tight', fontSize: 13, color: '#FF8C00' }}>hola@quiricostudios.com</p>
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 style={{ fontFamily: 'Inter Tight', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Alertas por email</h2>
            </div>
            <ConfigEmailPanel />
          </div>
        </div>
      )}

      {/* Historial */}
      {tab === 'historial' && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
          {notifs.length === 0 ? (
            <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 30, opacity: 0.45 }}>📧</span>
              <p style={{ fontFamily: 'Inter Tight', fontSize: 13, color: 'var(--text-3)' }}>Sin historial de notificaciones</p>
            </div>
          ) : (
            <div style={{ padding: '4px 0' }}>
              {notifs.map((n) => (
                <div
                  key={n.id}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '12px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: !n.read ? 'rgba(255,140,0,0.04)' : 'transparent',
                    opacity: n.read ? 0.65 : 1,
                  }}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-3)',
                      fontSize: 16,
                    }}>
                      {TYPE_ICONS[n.type]}
                    </div>
                    {!n.read && (
                      <div style={{ position: 'absolute', top: 0, right: 0, width: 6, height: 6, borderRadius: '50%', background: '#FF8C00' }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'Inter Tight',
                      fontSize: 13,
                      fontWeight: n.read ? 400 : 600,
                      color: 'var(--text)',
                      marginBottom: 2,
                    }}>
                      {n.title}
                    </div>
                    <div style={{ fontFamily: 'Inter Tight', fontSize: 12, color: 'var(--text-2)' }}>{n.message}</div>
                    <div style={{ fontFamily: 'Inter Tight', fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                      {timeAgo(n.time)} · {n.read ? 'Leída' : 'No leída'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {tab === 'recordatorios' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 820 }}>
          {reminders.filter((r) => !r.done).map((r) => {
            const overdue = new Date(r.dueDate) < new Date();
            const priorityColor = r.priority === 'alta' ? 'var(--red)' : r.priority === 'media' ? 'var(--amber)' : 'var(--green)';
            return (
              <div
                key={r.id}
                style={{ background: 'var(--surface)', border: `1px solid ${overdue ? 'rgba(239,68,68,0.25)' : 'var(--border)'}`, borderRadius: 12, padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.22)', display: 'flex', gap: 14, alignItems: 'flex-start' }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 8, background: overdue ? 'rgba(239,68,68,0.12)' : 'rgba(255,140,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⏰</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h2 style={{ fontFamily: 'Inter Tight', fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{r.title}</h2>
                    {overdue && <span className="badge-red badge-pill">VENCIDO</span>}
                    <span style={{ fontFamily: 'Inter Tight', fontSize: 10, fontWeight: 700, color: priorityColor, background: `${priorityColor}1F`, borderRadius: 100, padding: '2px 7px', textTransform: 'uppercase' }}>{r.priority}</span>
                  </div>
                  <p style={{ fontFamily: 'Inter Tight', fontSize: 12, color: 'var(--text-2)', margin: '0 0 8px' }}>{r.description}</p>
                  <p style={{ fontFamily: 'Inter Tight', fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{r.client} · {r.dueDate} · {r.recurrence === 'none' ? 'Sin recurrencia' : r.recurrence}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => completeReminder(r.id)} style={{ background: 'rgba(93,214,156,0.12)', border: 'none', borderRadius: 100, color: 'var(--green)', cursor: 'pointer', fontFamily: 'Inter Tight', fontSize: 12, fontWeight: 600, padding: '7px 12px' }}>Hecho ✓</button>
                  <button type="button" onClick={() => postponeReminder(r.id)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 100, color: 'var(--text)', cursor: 'pointer', fontFamily: 'Inter Tight', fontSize: 12, fontWeight: 600, padding: '7px 12px' }}>Posponer</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {showReminderModal && (
        <NewReminderModal
          onClose={() => setShowReminderModal(false)}
          onCreated={async () => {
            setShowReminderModal(false);
            await refreshReminders();
          }}
        />
      )}
    </div>
  );
}

function NewReminderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [priority, setPriority] = useState<Reminder['priority']>('media');
  const [client, setClient] = useState('');
  const [recurrence, setRecurrence] = useState<Reminder['recurrence']>('none');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inputStyle = { width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '9px 10px', fontFamily: 'Inter Tight', fontSize: 13, outline: 'none' };
  const labelStyle = { display: 'block', fontFamily: 'Inter Tight', fontSize: 12, color: 'var(--text-2)', marginBottom: 10 };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await createAdminReminder({ title, description, dueDate, priority, client, recurrence });
      await onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear recordatorio');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.62)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} style={{ width: 500, background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.65)' }}>
        <h2 style={{ fontFamily: 'Clash Grotesk', fontWeight: 700, fontSize: 20, color: 'var(--text)', marginBottom: 16 }}>Nuevo recordatorio</h2>
        <label style={labelStyle}>
          Título
          <input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={3} maxLength={140} placeholder="Ej. Seguimiento a propuesta PRO" style={{ ...inputStyle, marginTop: 5 }} />
        </label>
        <label style={labelStyle}>
          Descripción
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Contexto o próxima acción..." style={{ ...inputStyle, marginTop: 5, resize: 'vertical' }} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={labelStyle}>
            Fecha
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required style={{ ...inputStyle, marginTop: 5 }} />
          </label>
          <label style={labelStyle}>
            Prioridad
            <select value={priority} onChange={(event) => setPriority(event.target.value as Reminder['priority'])} style={{ ...inputStyle, marginTop: 5 }}>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={labelStyle}>
            Cliente / contexto
            <input value={client} onChange={(event) => setClient(event.target.value)} placeholder="Cliente o General" style={{ ...inputStyle, marginTop: 5 }} />
          </label>
          <label style={labelStyle}>
            Recurrencia
            <select value={recurrence} onChange={(event) => setRecurrence(event.target.value as Reminder['recurrence'])} style={{ ...inputStyle, marginTop: 5 }}>
              <option value="none">Sin recurrencia</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensual</option>
            </select>
          </label>
        </div>
        {error && <p style={{ fontFamily: 'Inter Tight', fontSize: 12, color: 'var(--red)', margin: '6px 0 0' }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 100, color: 'var(--text)', cursor: 'pointer', fontFamily: 'Inter Tight', fontSize: 12, fontWeight: 600, padding: '8px 14px' }}>Cancelar</button>
          <button type="submit" disabled={submitting} style={{ background: 'var(--amber)', border: 'none', borderRadius: 100, color: '#121212', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, fontFamily: 'Inter Tight', fontSize: 12, fontWeight: 600, padding: '8px 14px' }}>{submitting ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  );
}

function ConfigEmailPanel() {
  const [config, setConfig] = useState<Record<string, boolean>>(Object.fromEntries(EMAIL_CONFIG_ITEMS.map((i) => [i.key, i.defaultOn])));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNotificationPreferences(EMAIL_CONFIG_ITEMS.map((item) => ({ key: item.key, emailEnabled: item.defaultOn })))
      .then((rows) => {
        setConfig(Object.fromEntries(rows.map((row) => [row.key, row.emailEnabled])));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {loading && (
        <div style={{ padding: '12px 20px', fontFamily: 'Inter Tight', fontSize: 12, color: 'var(--text-3)' }}>
          Cargando preferencias...
        </div>
      )}
      {EMAIL_CONFIG_ITEMS.map((item) => (
        <div
          key={item.key}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '13px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Inter Tight', fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{item.label}</div>
            <div style={{ fontFamily: 'Inter Tight', fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{item.desc}</div>
          </div>
          <button
            type="button"
            onClick={async () => {
              const next = !config[item.key];
              setConfig((c) => ({ ...c, [item.key]: next }));
              await setNotificationPreference(item.key, next);
            }}
            style={{
              width: 44,
              height: 24,
              borderRadius: 100,
              border: 'none',
              cursor: 'pointer',
              background: config[item.key] ? 'var(--amber)' : 'rgba(255,255,255,0.12)',
              position: 'relative',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}
          >
            <div style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: '#fff',
              position: 'absolute',
              top: 3,
              left: config[item.key] ? 23 : 3,
              transition: 'left 0.2s',
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }} />
          </button>
        </div>
      ))}
    </div>
  );
}
