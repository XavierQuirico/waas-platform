'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Globe,
  Ticket,
  AlertTriangle,
  Calculator,
  FileText,
  CreditCard,
  BarChart2,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
} from 'lucide-react';
import { SignOutButton } from '@clerk/nextjs';
import { getAdminNavMetrics } from '@/app/admin/notificaciones/actions';

// ── Design tokens ────────────────────────────────────────────────────────────
const SIDEBAR_BG  = '#1A1A18';
const SIDEBAR_TEXT = 'rgba(249,249,249,0.55)';
const SIDEBAR_DIM  = 'rgba(249,249,249,0.28)';
const SIDEBAR_AMB  = '#FF8C00';
const SIDEBAR_EASE = '0.22s cubic-bezier(0.4,0,0.2,1)';
const SIDEBAR_FADE = `opacity ${SIDEBAR_EASE}, transform ${SIDEBAR_EASE}, max-width ${SIDEBAR_EASE}`;

interface AdminNavClientProps {
  queueCount?: number;
  urgentIncidents?: number;
  liveClientsCount?: number;
  unreadNotifications?: number;
  pendingTicketsCount?: number;
  useCleanRoutes?: boolean;
}

// On admin subdomain, converts /admin/* hrefs to clean paths.
function toCleanHref(path: string, clean: boolean): string {
  if (!clean) return path;
  if (path === '/admin') return '/dashboard';
  if (path.startsWith('/admin/')) return path.slice('/admin'.length);
  return path;
}

// ── Nav group structure ──────────────────────────────────────────────────────
interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number | null;
  badgeColor?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export function AdminNavClient({
  queueCount = 0,
  urgentIncidents = 0,
  liveClientsCount = 0,
  unreadNotifications = 0,
  pendingTicketsCount = 0,
  useCleanRoutes = false,
}: AdminNavClientProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [metrics, setMetrics] = useState({
    queueCount,
    urgentIncidents,
    liveClientsCount,
    unreadNotifications,
    pendingTicketsCount,
  });
  const sidebarWidth = collapsed ? 60 : 240;

  useEffect(() => {
    const stored = localStorage.getItem('waas_sidebar_collapsed');
    if (stored === 'true') setCollapsed(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    getAdminNavMetrics()
      .then((nextMetrics) => {
        if (mounted) setMetrics(nextMetrics);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('waas_sidebar_collapsed', String(next));
    window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: { collapsed: next } }));
  }

  function isActive(href: string) {
    const resolved = toCleanHref(href, useCleanRoutes);
    if (resolved === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/admin';
    }
    return pathname === resolved || pathname.startsWith(resolved + '/');
  }

  // ── Nav groups ─────────────────────────────────────────────────────────────
  const navGroups: NavGroup[] = [
    {
      label: 'OPERACIONES',
      items: [
        {
          label: 'Dashboard',
          href: '/admin',
          icon: <LayoutDashboard size={16} />,
          badge: null,
        },
        {
          label: 'Proyectos',
          href: '/admin/proyectos',
          icon: <FolderKanban size={16} />,
          badge: metrics.queueCount > 0 ? metrics.queueCount : null,
          badgeColor: SIDEBAR_AMB,
        },
        {
          label: 'Clientes',
          href: '/admin/clientes',
          icon: <Users size={16} />,
          badge: null,
        },
        {
          label: 'Sitios',
          href: '/admin/sitios',
          icon: <Globe size={16} />,
          badge: null,
        },
        {
          label: 'Tickets',
          href: '/admin/tickets',
          icon: <Ticket size={16} />,
          badge: metrics.pendingTicketsCount > 0 ? metrics.pendingTicketsCount : null,
          badgeColor: '#FFB347',
        },
        {
          label: 'Incidencias',
          href: '/admin/incidencias',
          icon: <AlertTriangle size={16} />,
          badge: metrics.urgentIncidents > 0 ? metrics.urgentIncidents : null,
          badgeColor: '#F87171',
        },
      ],
    },
    {
      label: 'VENTAS',
      items: [
        {
          label: 'Calculadora',
          href: '/admin/calculadora',
          icon: <Calculator size={16} />,
          badge: null,
        },
        {
          label: 'Cotizaciones',
          href: '/admin/cotizaciones',
          icon: <FileText size={16} />,
          badge: null,
        },
        {
          label: 'Facturación',
          href: '/admin/facturacion',
          icon: <CreditCard size={16} />,
          badge: null,
        },
      ],
    },
    {
      label: 'ANALYTICS',
      items: [
        {
          label: 'Insights',
          href: '/admin/insights',
          icon: <BarChart2 size={16} />,
          badge: null,
        },
        {
          label: 'Notificaciones',
          href: '/admin/notificaciones',
          icon: <Bell size={16} />,
          badge: metrics.unreadNotifications > 0 ? metrics.unreadNotifications : null,
          badgeColor: '#A78BFA',
        },
      ],
    },
  ];

  // ── NavItem component ───────────────────────────────────────────────────────
  function NavItemEl({ item }: { item: NavItem }) {
    const active = isActive(item.href);
    const badgeColor = item.badgeColor ?? SIDEBAR_AMB;
    const resolvedHref = toCleanHref(item.href, useCleanRoutes);

    return (
      <li>
        <Link
          href={resolvedHref}
          prefetch={false}
          title={collapsed ? item.label : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: collapsed ? 0 : 9,
            justifyContent: collapsed ? 'center' : 'flex-start',
            width: '100%',
            padding: collapsed ? '10px 0' : '8px 10px',
            borderRadius: 7,
            textDecoration: 'none',
            background: active ? 'rgba(255,140,0,0.12)' : 'transparent',
            color: active ? SIDEBAR_AMB : SIDEBAR_TEXT,
            fontFamily: "'Inter Tight', sans-serif",
            fontWeight: active ? 600 : 400,
            fontSize: 13,
            transition: `background 0.12s, color 0.12s, gap ${SIDEBAR_EASE}, padding ${SIDEBAR_EASE}`,
            position: 'relative',
          }}
          onMouseEnter={(e) => {
            if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.05)';
          }}
          onMouseLeave={(e) => {
            if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
          }}
        >
          {/* Active left border indicator */}
          {active && !collapsed && (
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: '20%',
                bottom: '20%',
                width: 2,
                borderRadius: 2,
                background: SIDEBAR_AMB,
              }}
            />
          )}

          {/* Icon */}
          <span
            style={{
              color: active ? SIDEBAR_AMB : SIDEBAR_DIM,
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            {item.icon}
          </span>

          {/* Label */}
          <span
            style={{
              flex: collapsed ? '0 0 auto' : 1,
              textAlign: 'left',
              opacity: collapsed ? 0 : 1,
              maxWidth: collapsed ? 0 : 140,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
              transition: SIDEBAR_FADE,
            }}
          >
            {item.label}
          </span>

          {/* Badge */}
          {item.badge != null && (
            <span
              style={{
                background: active ? SIDEBAR_AMB : badgeColor,
                color: '#121212',
                borderRadius: 100,
                fontSize: 9,
                fontWeight: 800,
                padding: '2px 5px',
                minWidth: 16,
                textAlign: 'center',
                position: collapsed ? 'absolute' : 'static',
                top: collapsed ? 4 : undefined,
                right: collapsed ? 4 : undefined,
                boxShadow: `0 0 6px ${badgeColor}88`,
                letterSpacing: '0.03em',
                lineHeight: 1.4,
              }}
            >
              {item.badge}
            </span>
          )}
        </Link>
      </li>
    );
  }

  // ── Avatar dropdown ─────────────────────────────────────────────────────────
  const dropdownStyle: React.CSSProperties = collapsed
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
    <>
      {/* ── Sidebar ── */}
      <aside
        className="admin-sidebar"
        style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          height: '100vh',
          background: SIDEBAR_BG,
          boxShadow: '2px 0 12px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          flexShrink: 0,
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* ── Logo area (60px tall) ── */}
        <div
          style={{
            height: 60,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            flexShrink: 0,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              padding: '18px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              opacity: collapsed ? 0 : 1,
              pointerEvents: collapsed ? 'none' : 'auto',
              transform: collapsed ? 'translateX(-10px)' : 'translateX(0)',
              transition: SIDEBAR_FADE,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo/LOGO%20HORIZONTAL.svg"
              alt="Quirico Studios"
              height={28}
              style={{
                filter: 'brightness(0) invert(1)',
                opacity: 0.9,
                maxWidth: 160,
                objectFit: 'contain',
              }}
            />
            <button
              type="button"
              onClick={toggleCollapse}
              aria-label="Colapsar sidebar"
              style={{
                background: 'none',
                border: 'none',
                color: SIDEBAR_DIM,
                cursor: 'pointer',
                padding: 4,
                borderRadius: 6,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#F9F9F9')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = SIDEBAR_DIM)}
            >
              <ChevronLeft size={14} strokeWidth={1.5} />
            </button>
          </div>

          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: SIDEBAR_AMB,
              opacity: collapsed ? 1 : 0,
              transform: collapsed ? 'scale(1)' : 'scale(0.84)',
              transition: `opacity ${SIDEBAR_EASE}, transform ${SIDEBAR_EASE}`,
              pointerEvents: 'none',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 245 298" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M122.46,250.73c-25.68,0-47.66-5.14-65.95-15.44-18.29-10.29-32.28-24.83-41.97-43.6C4.84,172.91,0,150.8,0,125.36s4.84-47.54,14.54-66.32c9.69-18.77,23.68-33.31,41.97-43.6C74.79,5.15,96.78,0,122.46,0s47.6,5.15,65.77,15.44c18.17,10.3,32.1,24.83,41.79,43.6,9.69,18.78,14.54,40.88,14.54,66.32s-4.85,47.54-14.54,66.32c-9.69,18.78-23.62,33.31-41.79,43.6-18.17,10.3-40.1,15.44-65.77,15.44ZM122.46,184.23c12.59,0,22.4-1.64,29.43-4.91,7.02-3.27,11.99-9.2,14.9-17.81,2.91-8.6,4.36-20.65,4.36-36.16s-1.45-27.85-4.36-36.34c-2.91-8.48-7.88-14.35-14.9-17.62-7.03-3.27-16.84-4.91-29.43-4.91s-22.47,1.64-29.62,4.91c-7.15,3.27-12.17,9.15-15.08,17.62-2.91,8.48-4.36,20.59-4.36,36.34s1.45,27.56,4.36,36.16c2.91,8.6,7.93,14.54,15.08,17.81,7.14,3.27,17.02,4.91,29.62,4.91ZM231.83,298.33h-89.75l-59.59-102.47h71.58l77.76,102.47Z"
                fill={SIDEBAR_AMB}
              />
            </svg>
          </div>
        </div>

        {collapsed && (
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label="Expandir sidebar"
            title="Expandir sidebar"
            style={{
              background: 'none',
              border: 'none',
              color: SIDEBAR_DIM,
              cursor: 'pointer',
              padding: '4px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#F9F9F9')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = SIDEBAR_DIM)}
          >
            <ChevronRight size={14} strokeWidth={1.5} />
          </button>
        )}

        {/* ── Nav groups (scrollable) ── */}
        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: collapsed ? '4px 6px' : '4px 8px',
          }}
        >
          {navGroups.map((group) => (
            <div key={group.label} style={{ marginTop: 20 }}>
              {!collapsed ? (
                <div
                  style={{
                    animation: 'fadeInLogo 0.2s ease-out',
                    fontFamily: "'Clash Grotesk', sans-serif",
                    fontWeight: 500,
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: SIDEBAR_DIM,
                    padding: '0 10px 6px',
                  }}
                >
                  {group.label}
                </div>
              ) : (
                <div style={{ height: 6 }} />
              )}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {group.items.map((item) => (
                  <NavItemEl key={item.href} item={item} />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* ── Footer ── */}
        <div style={{ flexShrink: 0, padding: collapsed ? '8px 6px' : '8px 8px' }}>
          {/* Separator */}
          <div style={{ height: 1, background: 'rgba(249,249,249,0.06)', marginBottom: 8 }} />

          {/* ── Avatar / user menu ── */}
          <div style={{ position: 'relative' }}>
            {/* Avatar button */}
            {collapsed ? (
              <button
                type="button"
                onClick={() => setAvatarOpen((o) => !o)}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px 0',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: avatarOpen ? '#e07800' : SIDEBAR_AMB,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: "'Clash Grotesk', sans-serif",
                    fontWeight: 800,
                    fontSize: 11,
                    color: '#121212',
                    outline: avatarOpen ? '2px solid rgba(255,140,0,0.5)' : '2px solid transparent',
                    outlineOffset: 2,
                    transition: 'all 0.15s',
                  }}
                >
                  XQ
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAvatarOpen((o) => !o)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 10px',
                  borderRadius: 8,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'none')}
              >
                {/* Avatar circle */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: SIDEBAR_AMB,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: "'Clash Grotesk', sans-serif",
                    fontWeight: 800,
                    fontSize: 12,
                    color: '#121212',
                    letterSpacing: '0.02em',
                  }}
                >
                  XQ
                </div>
                {/* Name + role */}
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
                    Xavier Quirico
                  </div>
                  <div style={{ fontSize: 10, color: SIDEBAR_DIM, marginTop: 1 }}>Administrador</div>
                </div>
                <ChevronDown size={12} color={SIDEBAR_DIM} style={{ flexShrink: 0 }} />
              </button>
            )}

            {/* Dropdown (opens upward when expanded, rightward when collapsed) */}
            {avatarOpen && (
              <>
                <div
                  onClick={() => setAvatarOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 98 }}
                />
                <div style={dropdownStyle}>
                  {/* User info header */}
                  <div
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#F9F9F9' }}>Xavier Quirico</div>
                    <div style={{ fontSize: 11, color: SIDEBAR_DIM, marginTop: 2 }}>
                      hola@quiricostudios.com
                    </div>
                  </div>

                  <div style={{ padding: '4px 6px' }}>
                    {/* Configuración */}
                    <Link
                      href={toCleanHref('/admin/configuracion', useCleanRoutes)}
                      onClick={() => setAvatarOpen(false)}
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
                        color: SIDEBAR_TEXT,
                        fontFamily: "'Inter Tight', sans-serif",
                        fontSize: 12,
                        textDecoration: 'none',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.06)')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = 'none')}
                    >
                      <Settings size={14} color={SIDEBAR_DIM} />
                      Configuración
                    </Link>

                    {/* Cerrar sesión */}
                    <SignOutButton>
                      <button
                        type="button"
                        onClick={() => setAvatarOpen(false)}
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
                        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)')}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'none')}
                      >
                        <LogOut size={14} color="#F87171" />
                        Cerrar sesión
                      </button>
                    </SignOutButton>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

    </>
  );
}
