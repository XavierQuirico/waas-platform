import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadOrigins() {
  vi.resetModules();
  return import('@/lib/routing/origins');
}

describe('orígenes por superficie', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('no redirige entre dominios fuera de producción', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const origins = await loadOrigins();
    expect(origins.PORTAL_ORIGIN).toBeNull();
    expect(origins.ADMIN_ORIGIN).toBeNull();
    expect(origins.PUBLIC_ORIGIN).toBeNull();
  });

  it('en producción usa los subdominios por defecto', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const origins = await loadOrigins();
    expect(origins.PORTAL_ORIGIN).toBe('https://portal.quiricostudios.com');
    expect(origins.ADMIN_ORIGIN).toBe('https://admin.quiricostudios.com');
    expect(origins.PUBLIC_ORIGIN).toBe('https://quiricostudios.com');
  });

  it('en producción permite sobreescribir cada origen', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PORTAL_ORIGIN', 'https://app.example.com');
    vi.stubEnv('ADMIN_ORIGIN', 'https://ops.example.com');
    const origins = await loadOrigins();
    expect(origins.PORTAL_ORIGIN).toBe('https://app.example.com');
    expect(origins.ADMIN_ORIGIN).toBe('https://ops.example.com');
    expect(origins.PUBLIC_ORIGIN).toBe('https://quiricostudios.com');
  });

  it('con NEXT_PUBLIC_SINGLE_HOST=true no redirige a ningún otro dominio, ni siquiera en producción', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SINGLE_HOST', 'true');
    vi.stubEnv('ADMIN_ORIGIN', 'https://ops.example.com');
    const origins = await loadOrigins();
    expect(origins.PORTAL_ORIGIN).toBeNull();
    expect(origins.ADMIN_ORIGIN).toBeNull();
    expect(origins.PUBLIC_ORIGIN).toBeNull();
  });
});
