import type { ProjectType } from './project-type';

export interface NavItem {
  id: string;
  icon: string;
  label: string;
  href: string;
}

/**
 * Single source of truth for portal navigation.
 * Used by PortalSidebar (desktop) and PortalHamburgerMenu (mobile).
 *
 * PORTFOLIO deliberately omits Facturación — showing it would imply
 * a recurring subscription that doesn't exist for portfolio projects.
 */
export function getPortalNavItems({
  projectType,
  projectId,
}: {
  projectType: ProjectType;
  projectId: string | null;
}): NavItem[] {
  const projectHref = projectId ? `/proyecto/${projectId}` : '/dashboard';

  const base: NavItem[] = [
    { id: 'inicio', icon: 'dashboard', label: 'Inicio', href: '/dashboard' },
    { id: 'proyecto', icon: 'folder', label: 'Proyecto', href: projectHref },
    { id: 'misitio', icon: 'globe', label: 'Mi sitio', href: '/mi-sitio' },
  ];

  if (projectType === 'SUBSCRIPTION') {
    base.push(
      { id: 'cambios', icon: 'ticket', label: 'Cambios y mejoras', href: '/cambios-y-mejoras' },
      { id: 'incidencias', icon: 'alert', label: 'Incidencias', href: '/incidencias' },
      { id: 'facturacion', icon: 'creditcard', label: 'Facturación', href: '/facturacion' },
    );
  } else if (projectType === 'LEGACY') {
    base.push(
      { id: 'cambios', icon: 'ticket', label: 'Cambios y mejoras', href: '/cambios-y-mejoras' },
      { id: 'incidencias', icon: 'alert', label: 'Incidencias', href: '/incidencias' },
      { id: 'facturacion', icon: 'creditcard', label: 'Facturación', href: '/facturacion' },
      { id: 'mantenimiento', icon: 'wrench', label: 'Mantenimiento', href: '/mantenimiento' },
    );
  }
  // PORTFOLIO: no Facturación — avoids ambiguous recurring-billing copy

  base.push(
    { id: 'soporte', icon: 'lifebuoy', label: 'Soporte', href: '/soporte' },
    { id: 'configuracion', icon: 'settings', label: 'Configuración', href: '/configuracion' },
  );
  return base;
}

export function getLimitedPortalNavItems(): NavItem[] {
  return [{ id: 'soporte', icon: 'lifebuoy', label: 'Soporte', href: '/soporte' }];
}

/**
 * Single entry point for shell nav: returns limited nav when client has no project,
 * or full nav based on projectType when client has a project.
 */
export function getPortalShellNavItems({
  hasProject,
  projectType,
  projectId,
}: {
  hasProject: boolean;
  projectType: ProjectType;
  projectId: string | null;
}): NavItem[] {
  if (!hasProject) return getLimitedPortalNavItems();
  return getPortalNavItems({ projectType, projectId });
}

/**
 * Returns true when a nav item should be considered active for the given pathname.
 *
 * Rules:
 * - inicio: exact match on /dashboard only
 * - proyecto: any /proyecto/* path (regardless of item href)
 * - incidencias: /incidencias, /incidencias/*, or /proyecto/{id}/incidencias/*
 * - others: exact match or sub-path with trailing slash (prevents /facturacion-algo false positive)
 */
export function isPortalNavItemActive(item: NavItem, pathname: string): boolean {
  const { id, href } = item;

  if (id === 'inicio') return pathname === '/dashboard';

  if (id === 'proyecto') return pathname.startsWith('/proyecto/');

  if (id === 'incidencias') {
    if (pathname === href || pathname.startsWith(href + '/')) return true;
    return /^\/proyecto\/[^/]+\/incidencias(\/|$)/.test(pathname);
  }

  return pathname === href || pathname.startsWith(href + '/');
}
