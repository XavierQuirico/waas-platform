'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import type { ProjectType } from '@/lib/portal/project-type';
import { getPortalShellNavItems, isPortalNavItemActive } from '@/lib/portal/nav';

const SB_BG = '#1A1A18';
const SB_TEXT = 'rgba(249,249,249,0.55)';
const SB_DIM = 'rgba(249,249,249,0.28)';
const SB_AMB = '#FF8C00';
const SB_EASE = '0.22s cubic-bezier(0.4,0,0.2,1)';

const Q_PATH =
  'M122.46,250.73c-25.68,0-47.66-5.14-65.95-15.44-18.29-10.29-32.28-24.83-41.97-43.6C4.84,172.91,0,150.8,0,125.36s4.84-47.54,14.54-66.32c9.69-18.77,23.68-33.31,41.97-43.6C74.79,5.15,96.78,0,122.46,0s47.6,5.15,65.77,15.44c18.17,10.3,32.1,24.83,41.79,43.6,9.69,18.78,14.54,40.88,14.54,66.32s-4.85,47.54-14.54,66.32c-9.69,18.78-23.62,33.31-41.79,43.6-18.17,10.3-40.1,15.44-65.77,15.44ZM122.46,184.23c12.59,0,22.4-1.64,29.43-4.91,7.02-3.27,11.99-9.2,14.9-17.81,2.91-8.6,4.36-20.65,4.36-36.16s-1.45-27.85-4.36-36.34c-2.91-8.48-7.88-14.35-14.9-17.62-7.03-3.27-16.84-4.91-29.43-4.91s-22.47,1.64-29.62,4.91c-7.15,3.27-12.17,9.15-15.08,17.62-2.91,8.48-4.36,20.59-4.36,36.34s1.45,27.56,4.36,36.16c2.91,8.6,7.93,14.54,15.08,17.81,7.14,3.27,17.02,4.91,29.62,4.91ZM231.83,298.33h-89.75l-59.59-102.47h71.58l77.76,102.47Z';

const icons: Record<string, React.FC> = {
  dashboard: () => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  ),
  folder: () => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  globe: () => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /><line x1="2" x2="22" y1="12" y2="12" />
    </svg>
  ),
  ticket: () => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
    </svg>
  ),
  alert: () => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  ),
  creditcard: () => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  ),
  wrench: () => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  lifebuoy: () => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" />
      <line x1="4.93" x2="9.17" y1="4.93" y2="9.17" /><line x1="14.83" x2="19.07" y1="14.83" y2="19.07" />
      <line x1="14.83" x2="19.07" y1="9.17" y2="4.93" /><line x1="4.93" x2="9.17" y1="19.07" y2="14.83" />
    </svg>
  ),
  settings: () => (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  logout: () => (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  ),
  chevleft: () => (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  chevright: () => (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  chevdown: () => (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
};

function NavIcon({ name }: { name: string }) {
  const Icon = icons[name];
  if (!Icon) return <span style={{ width: 16, height: 16, display: 'inline-block' }} />;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
      <Icon />
    </span>
  );
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: SB_AMB,
        color: '#121212',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Clash Grotesk', sans-serif",
        fontWeight: 800,
        fontSize: size * 0.36,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

export interface PortalSidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  hasProject: boolean;
  projectType: ProjectType;
  projectId: string | null;
  clientName: string;
}

export function PortalSidebar({
  isCollapsed,
  setIsCollapsed,
  hasProject,
  projectType,
  projectId,
  clientName,
}: PortalSidebarProps) {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const [avatarOpen, setAvatarOpen] = React.useState(false);

  const NAV = getPortalShellNavItems({ hasProject, projectType, projectId });
  const w = isCollapsed ? 60 : 240;

  const dropStyle: React.CSSProperties = isCollapsed
    ? {
        position: 'fixed',
        bottom: 60,
        left: 68,
        width: 220,
        background: '#222220',
        borderRadius: 10,
        zIndex: 999,
        boxShadow: '8px 0 32px rgba(0,0,0,0.7)',
        overflow: 'hidden',
      }
    : {
        position: 'absolute',
        bottom: '100%',
        left: 0,
        right: 0,
        marginBottom: 4,
        background: '#222220',
        borderRadius: 10,
        zIndex: 99,
        boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      };

  return (
    <aside
      style={{
        width: w,
        minWidth: w,
        height: '100vh',
        background: SB_BG,
        boxShadow: 'var(--shadow-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
        zIndex: 10,
        transition: `width ${SB_EASE}, min-width ${SB_EASE}`,
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Logo header */}
      <div style={{ height: 60, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: isCollapsed ? 0 : 1,
            pointerEvents: isCollapsed ? 'none' : 'auto',
            transform: isCollapsed ? 'translateX(-10px)' : 'translateX(0)',
            transition: `opacity ${SB_EASE}, transform ${SB_EASE}`,
          }}
        >
          <div style={{ position: 'relative', width: 130, height: 24 }}>
            <Image
              src="/brand/logo/LOGO HORIZONTAL.svg"
              alt="Quirico Studios"
              fill
              style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.88 }}
              priority
            />
          </div>
          <button
            onClick={() => {
              setIsCollapsed(true);
              localStorage.setItem('qs-portal-collapsed', 'true');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: SB_DIM,
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
              display: 'flex',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#F9F9F9')}
            onMouseLeave={(e) => (e.currentTarget.style.color = SB_DIM)}
            aria-label="Colapsar menú"
          >
            <NavIcon name="chevleft" />
          </button>
        </div>

        {/* Collapsed: isotipo */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isCollapsed ? 1 : 0,
            transition: `opacity ${SB_EASE}`,
            pointerEvents: 'none',
          }}
        >
          <svg width={26} height={26} viewBox="0 0 245 298" fill="none">
            <path d={Q_PATH} fill={SB_AMB} />
          </svg>
        </div>
      </div>

      {/* Expand button when collapsed */}
      {isCollapsed && (
        <button
          onClick={() => {
            setIsCollapsed(false);
            localStorage.setItem('qs-portal-collapsed', 'false');
          }}
          style={{
            background: 'none',
            border: 'none',
            color: SB_DIM,
            cursor: 'pointer',
            padding: '4px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#F9F9F9')}
          onMouseLeave={(e) => (e.currentTarget.style.color = SB_DIM)}
          aria-label="Expandir menú"
        >
          <NavIcon name="chevright" />
        </button>
      )}

      {/* Navigation */}
      <nav
        aria-label="Navegación principal"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: isCollapsed ? '4px 6px' : '4px 8px',
        }}
      >
        <div style={{ marginTop: 14 }}>
          {!isCollapsed && (
            <div
              style={{
                fontFamily: "'Clash Grotesk', sans-serif",
                fontWeight: 500,
                fontSize: 10,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: SB_DIM,
                padding: '0 10px 6px',
              }}
            >
              PORTAL
            </div>
          )}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV.map((item) => {
              const active = isPortalNavItemActive(item, pathname);
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    title={isCollapsed ? item.label : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: isCollapsed ? 0 : 9,
                      justifyContent: isCollapsed ? 'center' : 'flex-start',
                      width: '100%',
                      padding: isCollapsed ? '10px 0' : '8px 10px',
                      borderRadius: 7,
                      textDecoration: 'none',
                      background: active ? 'rgba(255,140,0,0.12)' : 'transparent',
                      color: active ? SB_AMB : SB_TEXT,
                      fontFamily: "'Inter Tight', sans-serif",
                      fontWeight: active ? 600 : 400,
                      fontSize: 13,
                      transition: 'background 0.12s, color 0.12s',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = active ? 'rgba(255,140,0,0.12)' : 'transparent';
                    }}
                  >
                    {active && !isCollapsed && (
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: '20%',
                          bottom: '20%',
                          width: 2,
                          borderRadius: 2,
                          background: SB_AMB,
                        }}
                      />
                    )}
                    <span
                      style={{
                        color: active ? SB_AMB : SB_DIM,
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <NavIcon name={item.icon} />
                    </span>
                    <span
                      style={{
                        flex: isCollapsed ? '0 0 auto' : 1,
                        opacity: isCollapsed ? 0 : 1,
                        maxWidth: isCollapsed ? 0 : 140,
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        transform: isCollapsed ? 'translateX(-6px)' : 'translateX(0)',
                        transition: `opacity ${SB_EASE}, max-width ${SB_EASE}, transform ${SB_EASE}`,
                      }}
                    >
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Footer / avatar */}
      <div style={{ flexShrink: 0, padding: isCollapsed ? '8px 6px' : '8px 8px' }}>
        <div style={{ height: 1, background: 'rgba(249,249,249,0.06)', marginBottom: 8 }} />
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setAvatarOpen((o) => !o)}
            aria-label="Menú de cuenta"
            aria-expanded={avatarOpen}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isCollapsed ? 0 : 10,
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: isCollapsed ? '6px 0' : '8px 10px',
              borderRadius: 8,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <Avatar name={clientName} size={32} />
            {!isCollapsed && (
              <>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#F9F9F9',
                      fontFamily: "'Inter Tight', sans-serif",
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {clientName}
                  </div>
                  <div style={{ fontSize: 10, color: SB_DIM, marginTop: 1 }}>Cliente</div>
                </div>
                <span style={{ color: SB_DIM, display: 'flex' }}>
                  <NavIcon name="chevdown" />
                </span>
              </>
            )}
          </button>

          {avatarOpen && (
            <>
              <div
                onClick={() => setAvatarOpen(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 98 }}
                aria-hidden="true"
              />
              <div style={dropStyle}>
                <div
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#F9F9F9',
                      fontFamily: "'Inter Tight', sans-serif",
                    }}
                  >
                    {clientName}
                  </div>
                  <div style={{ fontSize: 11, color: SB_DIM, marginTop: 2 }}>Portal de cliente</div>
                </div>
                <div style={{ padding: '4px 6px' }}>
                  <Link
                    href="/configuracion"
                    onClick={() => setAvatarOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 7,
                      textDecoration: 'none',
                      color: SB_TEXT,
                      fontFamily: "'Inter Tight', sans-serif",
                      fontSize: 12,
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <span style={{ color: SB_TEXT }}><NavIcon name="settings" /></span>
                    Configuración
                  </Link>
                  <button
                    onClick={() => {
                      setAvatarOpen(false);
                      signOut({ redirectUrl: '/acceder' });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 7,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#F87171',
                      fontFamily: "'Inter Tight', sans-serif",
                      fontSize: 12,
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <span style={{ color: '#F87171' }}><NavIcon name="logout" /></span>
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
