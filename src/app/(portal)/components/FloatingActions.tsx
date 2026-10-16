'use client';

import * as React from 'react';
// Misma familia de iconos que el dashboard admin (FloatingActionsClient) para
// mantener consistencia exacta de tema/notificaciones entre portal y admin.
import { Bell, Moon, Sun } from 'lucide-react';
import { NotifPanel, type PortalNotification } from './NotifPanel';

interface FloatingActionsProps {
  activeTheme: 'dark' | 'light';
  toggleTheme: () => void;
  notifications?: PortalNotification[];
}

export function FloatingActions({
  activeTheme,
  toggleTheme,
  notifications = [],
}: FloatingActionsProps) {
  const [bellOpen, setBellOpen] = React.useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div
      style={{
        position: 'fixed',
        top: 14,
        right: 20,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {/* Theme toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={activeTheme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        title={activeTheme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
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
          boxShadow: 'var(--shadow-card)',
          transition: 'all 0.15s',
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
        {activeTheme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      {/* Notification bell */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setBellOpen((o) => !o)}
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
            position: 'relative',
          }}
        >
          <Bell size={15} />
          {unread > 0 && (
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
                fontFamily: "'Inter Tight', sans-serif",
              }}
            >
              {unread}
            </span>
          )}
        </button>

        {bellOpen && (
          <>
            <div
              onClick={() => setBellOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 98 }}
            />
            <NotifPanel
              notifications={notifications}
              onClose={() => setBellOpen(false)}
            />
          </>
        )}
      </div>
    </div>
  );
}
