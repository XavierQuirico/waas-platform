'use client';

import * as React from 'react';
import { PortalSidebar } from './PortalSidebar';
import { PortalTopBar, PORTAL_MOBILE_NOTIF_ID } from './PortalTopBar';
import { PortalHamburgerMenu } from './PortalHamburgerMenu';
import { FloatingActions } from './FloatingActions';
import { NotifPanel } from './NotifPanel';
import type { ProjectType } from '@/lib/portal/project-type';
import type { PortalNotification } from './NotifPanel';

interface PortalShellProps {
  children: React.ReactNode;
  clientFullName: string;
  isPreviewMode: boolean;
  hasProject: boolean;
  projectType: ProjectType;
  projectId: string | null;
  activeTheme: 'dark' | 'light';
  toggleTheme: () => void;
  notifications?: PortalNotification[];
}

export function PortalShell({
  children,
  clientFullName,
  isPreviewMode,
  hasProject,
  projectType,
  projectId,
  activeTheme,
  toggleTheme,
  notifications = [],
}: PortalShellProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [hamburgerOpen, setHamburgerOpen] = React.useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = React.useState(false);
  const unread = notifications.filter((n) => !n.read).length;
  // Preview banner height estimate — keeps notification panel below the banner on mobile
  const PREVIEW_BANNER_HEIGHT = 34;
  const notifPanelTop = isPreviewMode ? 56 + PREVIEW_BANNER_HEIGHT : 56;

  React.useEffect(() => {
    if (localStorage.getItem('qs-portal-collapsed') === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  return (
    <div
      className="flex min-h-screen"
      style={{ background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Inter Tight', system-ui, sans-serif" }}
    >
      {/* Desktop sidebar — hidden on mobile, shown on md+ */}
      <div className="hidden md:flex md:flex-shrink-0">
        <PortalSidebar
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          hasProject={hasProject}
          projectType={projectType}
          projectId={projectId}
          clientName={clientFullName}
        />
      </div>

      {/* Main content column */}
      <div className="flex flex-col flex-1 min-w-0">
        {isPreviewMode && (
          <div
            style={{
              background: 'rgba(255,140,0,0.08)',
              borderBottom: '1px solid rgba(255,140,0,0.2)',
              padding: '8px 16px',
              textAlign: 'center',
              fontSize: 11,
              color: '#FFB347',
              fontFamily: "'Inter Tight', sans-serif",
            }}
          >
            Modo preview — sesión de desarrollo. No representa una sesión real de cliente.
          </div>
        )}

        {/* Mobile top bar — visible only on mobile */}
        <div className="md:hidden" style={{ position: 'relative' }}>
          <PortalTopBar
            onHamburgerOpen={() => setHamburgerOpen(true)}
            unreadCount={unread}
            onBellClick={() => setNotifPanelOpen((o) => !o)}
            isMenuOpen={hamburgerOpen}
            isBellOpen={notifPanelOpen}
          />

          {/* Mobile notification panel — positioned below topbar */}
          {notifPanelOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 49 }}
                onClick={() => setNotifPanelOpen(false)}
                aria-hidden="true"
              />
              <div id={PORTAL_MOBILE_NOTIF_ID} style={{ position: 'fixed', top: notifPanelTop, right: 0, zIndex: 50 }}>
                <NotifPanel
                  notifications={notifications}
                  onClose={() => setNotifPanelOpen(false)}
                />
              </div>
            </>
          )}
        </div>

        {/* Page content */}
        <main className="flex-1 p-5 md:p-8">
          <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            {children}
          </div>
        </main>
      </div>

      {/* Desktop floating actions — hidden on mobile */}
      <div className="hidden md:block">
        <FloatingActions
          activeTheme={activeTheme}
          toggleTheme={toggleTheme}
          notifications={notifications}
        />
      </div>

      {/* Mobile hamburger menu overlay */}
      <div className="md:hidden">
        <PortalHamburgerMenu
          isOpen={hamburgerOpen}
          onClose={() => setHamburgerOpen(false)}
          hasProject={hasProject}
          projectType={projectType}
          projectId={projectId}
          clientName={clientFullName}
          activeTheme={activeTheme}
          toggleTheme={toggleTheme}
        />
      </div>
    </div>
  );
}
