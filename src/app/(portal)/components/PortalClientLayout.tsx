'use client';

import * as React from 'react';
import { PortalShell } from './PortalShell';
import { RouteVisitMarker } from '@/components/ui/RouteSkeletonGate';
import type { ProjectType } from '@/lib/portal/project-type';

interface PortalClientLayoutProps {
  children: React.ReactNode;
  clientFirstName: string | null;
  clientFullName: string;
  isPreviewMode: boolean;
  theme: 'dark' | 'light';
  hasProject: boolean;
  projectType: ProjectType;
  projectId: string | null;
}

export function PortalClientLayout({
  children,
  clientFullName,
  isPreviewMode,
  theme,
  hasProject,
  projectType,
  projectId,
}: PortalClientLayoutProps) {
  const [activeTheme, setActiveTheme] = React.useState<'dark' | 'light'>(theme);

  function toggleTheme() {
    const next = activeTheme === 'dark' ? 'light' : 'dark';
    setActiveTheme(next);
    document.cookie = `qs-portal-theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
  }

  return (
    // Wrapper div carries the theme class so CSS vars apply to the whole portal
    <div
      className={`theme-${activeTheme}`}
      suppressHydrationWarning
    >
      <RouteVisitMarker />
      <PortalShell
        clientFullName={clientFullName}
        isPreviewMode={isPreviewMode}
        hasProject={hasProject}
        projectType={projectType}
        projectId={projectId}
        activeTheme={activeTheme}
        toggleTheme={toggleTheme}
        notifications={[]}
      >
        {children}
      </PortalShell>
    </div>
  );
}
