'use client';

import { usePathname } from 'next/navigation';
import { RouteVisitMarker } from '@/components/ui/RouteSkeletonGate';

interface AdminShellProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

const FLOATING_SAFE_ROUTES = [
  '/admin/proyectos',
  '/admin/tickets',
  '/admin/incidencias',
  '/admin/calculadora',
  '/admin/cotizaciones',
  '/admin/facturacion',
  '/admin/notificaciones',
];

export function AdminShell({ sidebar, children }: AdminShellProps) {
  const pathname = usePathname();
  const needsFloatingSafeTop = FLOATING_SAFE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <RouteVisitMarker />
      {sidebar}
      <main
        className="flex-1 min-w-0 overflow-y-auto"
        style={{
          background: 'var(--bg)',
          paddingTop: needsFloatingSafeTop ? 44 : 0,
        }}
      >
        {children}
      </main>
    </div>
  );
}
