import { describe, it, expect } from 'vitest';
import { isPortalNavItemActive } from '@/lib/portal/nav';
import type { NavItem } from '@/lib/portal/nav';

const navItem = (id: string, href: string): NavItem => ({
  id,
  icon: 'dashboard',
  label: id,
  href,
});

describe('isPortalNavItemActive — active states correctos', () => {
  it('inicio activo solo en /dashboard', () => {
    const item = navItem('inicio', '/dashboard');
    expect(isPortalNavItemActive(item, '/dashboard')).toBe(true);
    expect(isPortalNavItemActive(item, '/dashboard/')).toBe(false);
    expect(isPortalNavItemActive(item, '/dashboard/otro')).toBe(false);
  });

  it('proyecto activo en cualquier /proyecto/* path', () => {
    const item = navItem('proyecto', '/proyecto/p1');
    expect(isPortalNavItemActive(item, '/proyecto/p1')).toBe(true);
    expect(isPortalNavItemActive(item, '/proyecto/p1/staging')).toBe(true);
    expect(isPortalNavItemActive(item, '/proyecto/p1/assets')).toBe(true);
    expect(isPortalNavItemActive(item, '/proyecto/p1/solicitudes')).toBe(true);
    expect(isPortalNavItemActive(item, '/dashboard')).toBe(false);
  });

  it('incidencias activo en /incidencias y /proyecto/{id}/incidencias', () => {
    const item = navItem('incidencias', '/incidencias');
    expect(isPortalNavItemActive(item, '/incidencias')).toBe(true);
    expect(isPortalNavItemActive(item, '/incidencias/123')).toBe(true);
    expect(isPortalNavItemActive(item, '/proyecto/p1/incidencias')).toBe(true);
    expect(isPortalNavItemActive(item, '/proyecto/p1/incidencias/456')).toBe(true);
    expect(isPortalNavItemActive(item, '/dashboard')).toBe(false);
  });

  it('facturacion activo en /facturacion pero no en /facturacion-algo', () => {
    const item = navItem('facturacion', '/facturacion');
    expect(isPortalNavItemActive(item, '/facturacion')).toBe(true);
    expect(isPortalNavItemActive(item, '/facturacion/')).toBe(true);
    expect(isPortalNavItemActive(item, '/facturacion-algo')).toBe(false);
    expect(isPortalNavItemActive(item, '/facturacionx')).toBe(false);
  });

  it('configuracion activo en /configuracion pero no en /configuracion-extra', () => {
    const item = navItem('configuracion', '/configuracion');
    expect(isPortalNavItemActive(item, '/configuracion')).toBe(true);
    expect(isPortalNavItemActive(item, '/configuracion/')).toBe(true);
    expect(isPortalNavItemActive(item, '/configuracion-extra')).toBe(false);
  });

  it('soporte activo en /soporte pero no en /soporte-extra', () => {
    const item = navItem('soporte', '/soporte');
    expect(isPortalNavItemActive(item, '/soporte')).toBe(true);
    expect(isPortalNavItemActive(item, '/soporte/')).toBe(true);
    expect(isPortalNavItemActive(item, '/soporte-extra')).toBe(false);
    expect(isPortalNavItemActive(item, '/soporteX')).toBe(false);
  });
});
