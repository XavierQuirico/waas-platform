'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Moon, Sun } from 'lucide-react';
import { getAdminNotifications, markNotificationRead, type AdminNotification } from '@/app/admin/notificaciones/actions';

const TYPE_ICONS: Record<AdminNotification['type'], string> = {
  sla: '⚡',
  p1: '!',
  assets: '□',
  ticket: '#',
  payment: '$',
  staging: '↗',
  proposal: '✉',
};

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Ahora';
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function FloatingActionsClient({ unreadCount }: { unreadCount: number }) {
  const [dark, setDark] = useState(true);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('waas_theme');
    const isDark = stored !== 'light';
    setDark(isDark);
    if (!isDark) document.documentElement.classList.add('theme-light');
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    localStorage.setItem('waas_theme', next ? 'dark' : 'light');

    if (next) {
      document.documentElement.classList.remove('theme-light');
    } else {
      document.documentElement.classList.add('theme-light');
    }
  }

  useEffect(() => {
    if (!bellOpen) return;
    let mounted = true;
    setLoadingNotifications(true);
    getAdminNotifications()
      .then((rows) => {
        if (mounted) setNotifications(rows.filter((row) => !row.read).slice(0, 5));
      })
      .finally(() => {
        if (mounted) setLoadingNotifications(false);
      });
    return () => {
      mounted = false;
    };
  }, [bellOpen]);

  async function handleNotificationClick(notification: AdminNotification) {
    setNotifications((rows) => rows.filter((row) => row.key !== notification.key));
    await markNotificationRead(notification.key);
    setBellOpen(false);
  }

  return (
    <div style={{ position: 'fixed', top: 16, right: 20, zIndex: 50, display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        onClick={toggleTheme}
        title={dark ? 'Modo claro' : 'Modo oscuro'}
        aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'var(--surface)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-2)',
          transition: 'all 0.15s',
          boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--amber)';
          e.currentTarget.style.background = 'rgba(255,140,0,0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-2)';
          e.currentTarget.style.background = 'var(--surface)';
        }}
      >
        {dark ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setBellOpen((open) => !open)}
          aria-label="Notificaciones"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: bellOpen ? 'rgba(255,140,0,0.1)' : 'var(--surface-2)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: bellOpen ? 'var(--amber)' : 'var(--text-2)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
            transition: 'all 0.15s',
          }}
        >
          <Bell size={15} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                background: 'var(--amber)',
                color: '#121212',
                borderRadius: '50%',
                width: 15,
                height: 15,
                fontSize: 9,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        {bellOpen && (
          <>
            <div onClick={() => setBellOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
            <div
              style={{
                position: 'absolute',
                top: 44,
                right: 0,
                width: 340,
                background: 'var(--surface)',
                borderRadius: 14,
                zIndex: 99,
                boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
                overflow: 'hidden',
                animation: 'fadeInSlide 0.18s ease-out',
              }}
            >
              <div
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid rgba(128,128,128,0.15)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                  Notificaciones
                </span>
                {unreadCount > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 600 }}>{unreadCount} no leídas</span>
                )}
              </div>
              {loadingNotifications ? (
                <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <Bell size={20} style={{ color: 'var(--text-3)', opacity: 0.4 }} />
                  <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>Cargando alertas...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <Bell size={20} style={{ color: 'var(--text-3)', opacity: 0.4 }} />
                  <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>Sin notificaciones nuevas</p>
                </div>
              ) : (
                <div style={{ maxHeight: 312, overflowY: 'auto' }}>
                  {notifications.map((notification) => (
                    <Link
                      key={notification.key}
                      href={notification.href}
                      onClick={() => handleNotificationClick(notification)}
                      style={{
                        display: 'flex',
                        gap: 10,
                        padding: '11px 14px',
                        borderBottom: '1px solid rgba(128,128,128,0.1)',
                        background: 'rgba(255,140,0,0.035)',
                        color: 'inherit',
                        textDecoration: 'none',
                      }}
                    >
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 7,
                          background: 'rgba(255,140,0,0.1)',
                          color: 'var(--amber)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 800,
                          flexShrink: 0,
                          fontFamily: "'Inter Tight', sans-serif",
                        }}
                      >
                        {TYPE_ICONS[notification.type]}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontFamily: "'Inter Tight', sans-serif", fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {notification.title}
                        </span>
                        <span style={{ display: 'block', marginTop: 2, fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {notification.message}
                        </span>
                        <span style={{ display: 'block', marginTop: 3, fontSize: 10, color: 'var(--text-3)', opacity: 0.75 }}>
                          Hace {timeAgo(notification.time)}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(128,128,128,0.1)' }}>
                <Link
                  href="/admin/notificaciones"
                  onClick={() => setBellOpen(false)}
                  style={{
                    display: 'block',
                    width: '100%',
                    background: 'var(--surface-2)',
                    border: 'none',
                    borderRadius: 7,
                    padding: '7px',
                    color: 'var(--text-2)',
                    fontFamily: "'Inter Tight', sans-serif",
                    fontSize: 11,
                    cursor: 'pointer',
                    textAlign: 'center',
                    textDecoration: 'none',
                  }}
                >
                  Ver todas las notificaciones
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
