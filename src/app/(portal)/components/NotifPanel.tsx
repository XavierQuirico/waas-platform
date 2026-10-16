'use client';

import * as React from 'react';

export type PortalNotification = {
  id: string;
  title: string;
  desc?: string;
  time: string;
  read: boolean;
};

interface NotifPanelProps {
  notifications: PortalNotification[];
  onClose: () => void;
}

export function NotifPanel({ notifications, onClose }: NotifPanelProps) {
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div
      style={{
        position: 'absolute',
        top: 44,
        right: 0,
        width: 340,
        background: 'var(--surface)',
        borderRadius: 14,
        zIndex: 99,
        boxShadow: 'var(--shadow-dropdown)',
        overflow: 'hidden',
        animation: 'fadeInSlide 0.18s ease-out',
      }}
    >
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--divider)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontFamily: "'Clash Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 14,
            color: 'var(--text)',
          }}
        >
          Notificaciones
        </span>
        {unread > 0 && (
          <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 600 }}>
            {unread} no leídas
          </span>
        )}
      </div>

      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--text-3)',
              fontSize: 12,
              fontFamily: "'Inter Tight', sans-serif",
            }}
          >
            No tienes notificaciones nuevas.
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              style={{
                display: 'flex',
                gap: 10,
                padding: '11px 14px',
                borderBottom: '1px solid rgba(128,128,128,0.08)',
                background: n.read ? 'transparent' : 'rgba(255,140,0,0.04)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: n.read ? 400 : 600,
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: "'Inter Tight', sans-serif",
                  }}
                >
                  {n.title}
                </div>
                {n.desc && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-3)',
                      marginTop: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontFamily: "'Inter Tight', sans-serif",
                    }}
                  >
                    {n.desc}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text-3)',
                    marginTop: 2,
                    opacity: 0.7,
                    fontFamily: "'Inter Tight', sans-serif",
                  }}
                >
                  Hace {n.time}
                </div>
              </div>
              {!n.read && (
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--amber)',
                    flexShrink: 0,
                    marginTop: 6,
                  }}
                />
              )}
            </div>
          ))
        )}
      </div>

      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--divider)' }}>
        <button
          onClick={onClose}
          style={{
            width: '100%',
            background: 'var(--surface-2)',
            border: 'none',
            borderRadius: 7,
            padding: '7px',
            color: 'var(--text-2)',
            fontFamily: "'Inter Tight', sans-serif",
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
