'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
// Misma familia de iconos (lucide-react) que FloatingActions / FloatingActionsClient
// del admin, para unificar la iconografía del menú móvil del portal.
import {
  CreditCard,
  FolderOpen,
  Globe,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Moon,
  Settings,
  Sun,
  TriangleAlert,
  Ticket,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { ProjectType } from '@/lib/portal/project-type';
import { getPortalShellNavItems, isPortalNavItemActive } from '@/lib/portal/nav';
import { PORTAL_MOBILE_MENU_ID } from './PortalTopBar';

const SB_TEXT = 'rgba(249,249,249,0.75)';
const SB_DIM = 'rgba(249,249,249,0.38)';
const SB_AMB = '#FF8C00';

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
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
        fontSize: size * 0.35,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

// Mapa tipado nombre-de-nav → icono lucide. Las claves coinciden con los
// strings `icon` que devuelve getPortalShellNavItems (src/lib/portal/nav.ts).
const navIconMap = {
  dashboard: LayoutDashboard,
  folder: FolderOpen,
  globe: Globe,
  ticket: Ticket,
  alert: TriangleAlert,
  creditcard: CreditCard,
  wrench: Wrench,
  lifebuoy: LifeBuoy,
  settings: Settings,
  logout: LogOut,
} satisfies Record<string, LucideIcon>;

function Icon({ name }: { name: string }) {
  const C = navIconMap[name as keyof typeof navIconMap];
  return C ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
      <C size={18} strokeWidth={1.5} aria-hidden="true" />
    </span>
  ) : null;
}

interface PortalHamburgerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  hasProject: boolean;
  projectType: ProjectType;
  projectId: string | null;
  clientName: string;
  activeTheme: 'dark' | 'light';
  toggleTheme: () => void;
}

export function PortalHamburgerMenu({
  isOpen,
  onClose,
  hasProject,
  projectType,
  projectId,
  clientName,
  activeTheme,
  toggleTheme,
}: PortalHamburgerMenuProps) {
  const { signOut } = useClerk();
  const pathname = usePathname();
  const menuRef = React.useRef<HTMLDivElement>(null);
  const NAV = getPortalShellNavItems({ hasProject, projectType, projectId });

  // Body scroll lock
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Focus trap + ESC
  React.useEffect(() => {
    if (!isOpen) return;
    const el = menuRef.current;
    if (!el) return;

    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      id={PORTAL_MOBILE_MENU_ID}
      role="dialog"
      aria-modal="true"
      aria-label="Menú de navegación"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: '#1A1A18',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        animation: 'fadeInSlide 0.2s ease-out',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 'max(16px, calc(env(safe-area-inset-top, 0px) + 8px))',
          paddingBottom: 16,
          paddingLeft: 20,
          paddingRight: 20,
          borderBottom: '1px solid rgba(249,249,249,0.06)',
        }}
      >
        <div style={{ position: 'relative', width: 120, height: 22 }}>
          <Image
            src="/brand/logo/LOGO HORIZONTAL.svg"
            alt="Quirico Studios"
            fill
            style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.88 }}
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar menú"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'rgba(249,249,249,0.55)',
            display: 'flex',
            padding: 6,
            borderRadius: 8,
          }}
        >
          <X size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      {/* Client info */}
      <div style={{ padding: '20px 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={clientName} size={44} />
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#F9F9F9',
                fontFamily: "'Inter Tight', sans-serif",
              }}
            >
              {clientName}
            </div>
            <div style={{ fontSize: 12, color: SB_DIM, fontFamily: "'Inter Tight', sans-serif", marginTop: 2 }}>
              Portal de cliente
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(249,249,249,0.06)', margin: '0 20px 8px' }} />

      {/* Nav items */}
      <nav aria-label="Navegación principal" style={{ flex: 1, padding: '8px 12px' }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map((item) => {
            const active = isPortalNavItemActive(item, pathname);
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 12px',
                    borderRadius: 8,
                    textDecoration: 'none',
                    color: active ? SB_AMB : SB_TEXT,
                    fontFamily: "'Inter Tight', sans-serif",
                    fontSize: 15,
                    fontWeight: active ? 600 : 400,
                    background: active ? 'rgba(255,140,0,0.10)' : 'transparent',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = active ? 'rgba(255,140,0,0.10)' : 'transparent';
                  }}
                >
                  <span style={{ color: active ? SB_AMB : SB_DIM, display: 'flex' }}>
                    <Icon name={item.icon} />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div style={{ height: 1, background: 'rgba(249,249,249,0.06)', margin: '0 20px 8px' }} />

      {/* Bottom actions */}
      <div style={{ paddingTop: 8, paddingLeft: 12, paddingRight: 12, paddingBottom: 'max(32px, calc(env(safe-area-inset-bottom, 0px) + 16px))', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Link
          href="/configuracion"
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 12px',
            borderRadius: 8,
            textDecoration: 'none',
            color: SB_TEXT,
            fontFamily: "'Inter Tight', sans-serif",
            fontSize: 15,
            transition: 'background 0.12s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ color: SB_DIM, display: 'flex' }}><Icon name="settings" /></span>
          Configuración
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={activeTheme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 12px',
            borderRadius: 8,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: SB_TEXT,
            fontFamily: "'Inter Tight', sans-serif",
            fontSize: 15,
            transition: 'background 0.12s',
            width: '100%',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ color: SB_DIM, display: 'flex' }}>
            {activeTheme === 'dark'
              ? <Sun size={16} strokeWidth={1.5} aria-hidden="true" />
              : <Moon size={16} strokeWidth={1.5} aria-hidden="true" />}
          </span>
          {activeTheme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        </button>

        <button
          type="button"
          onClick={() => {
            onClose();
            signOut({ redirectUrl: '/acceder' });
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 12px',
            borderRadius: 8,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#F87171',
            fontFamily: "'Inter Tight', sans-serif",
            fontSize: 15,
            transition: 'background 0.12s',
            width: '100%',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ color: '#F87171', display: 'flex' }}>
            <LogOut size={18} strokeWidth={1.5} aria-hidden="true" />
          </span>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
