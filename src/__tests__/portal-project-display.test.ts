import { describe, it, expect } from 'vitest';
import {
  getPortalProjectDisplayName,
  getPortalProjectHostLabel,
} from '@/lib/portal/project-display';

const UUID = 'd382a4f0-1234-4abc-9def-0123456789ab';
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

describe('getPortalProjectHostLabel', () => {
  it('quita protocolo https y www y slash final', () => {
    expect(getPortalProjectHostLabel('https://www.qa-live-incidents.example.com/')).toBe(
      'qa-live-incidents.example.com',
    );
  });

  it('quita protocolo http', () => {
    expect(getPortalProjectHostLabel('http://midominio.com')).toBe('midominio.com');
  });

  it('acepta dominio sin protocolo', () => {
    expect(getPortalProjectHostLabel('mi-negocio.com')).toBe('mi-negocio.com');
  });

  it('quita path, query y hash', () => {
    expect(getPortalProjectHostLabel('https://ejemplo.com/ruta?x=1#top')).toBe('ejemplo.com');
  });

  it('quita puerto y credenciales', () => {
    expect(getPortalProjectHostLabel('https://user:pass@host.com:8080/x')).toBe('host.com');
  });

  it('devuelve null para null/undefined/vacío', () => {
    expect(getPortalProjectHostLabel(null)).toBeNull();
    expect(getPortalProjectHostLabel(undefined)).toBeNull();
    expect(getPortalProjectHostLabel('   ')).toBeNull();
  });

  it('no lanza con strings inválidos', () => {
    expect(() => getPortalProjectHostLabel('::::')).not.toThrow();
    expect(() => getPortalProjectHostLabel('https://')).not.toThrow();
  });
});

describe('getPortalProjectDisplayName', () => {
  it('un solo proyecto → "Sitio principal"', () => {
    expect(getPortalProjectDisplayName({ index: 0, total: 1, productionUrl: 'https://x.com' })).toBe(
      'Sitio principal',
    );
  });

  it('total 0 → "Sitio principal" (defensivo)', () => {
    expect(getPortalProjectDisplayName({ index: 0, total: 0 })).toBe('Sitio principal');
  });

  it('múltiples con productionUrl → hostname limpio', () => {
    expect(
      getPortalProjectDisplayName({
        index: 0,
        total: 2,
        productionUrl: 'https://www.qa-live-incidents.example.com',
      }),
    ).toBe('qa-live-incidents.example.com');
  });

  it('múltiples sin productionUrl pero con domainTarget → domainTarget limpio', () => {
    expect(
      getPortalProjectDisplayName({
        index: 1,
        total: 2,
        productionUrl: null,
        domainTarget: 'www.midominio.com',
      }),
    ).toBe('midominio.com');
  });

  it('múltiples sin production/domain pero con stagingUrl → hostname staging limpio', () => {
    expect(
      getPortalProjectDisplayName({
        index: 1,
        total: 2,
        productionUrl: null,
        domainTarget: null,
        stagingUrl: 'https://staging.midominio.com/',
      }),
    ).toBe('staging.midominio.com');
  });

  it('múltiples sin ninguna URL → "Sitio N" (1-based)', () => {
    expect(getPortalProjectDisplayName({ index: 0, total: 3 })).toBe('Sitio 1');
    expect(getPortalProjectDisplayName({ index: 1, total: 3 })).toBe('Sitio 2');
    expect(getPortalProjectDisplayName({ index: 2, total: 3 })).toBe('Sitio 3');
  });

  it('prioriza productionUrl sobre domainTarget y stagingUrl', () => {
    expect(
      getPortalProjectDisplayName({
        index: 0,
        total: 2,
        productionUrl: 'https://prod.com',
        domainTarget: 'domain.com',
        stagingUrl: 'https://staging.com',
      }),
    ).toBe('prod.com');
  });

  it('NUNCA devuelve "Proyecto #" ni el UUID del proyecto como label', () => {
    // El helper jamás recibe projectId; aunque alguien intente "colarlo" vía
    // un campo de URL nulo/vacío, el fallback humano es "Sitio N", nunca el UUID.
    const labels = [
      getPortalProjectDisplayName({ index: 0, total: 1, productionUrl: UUID }),
      getPortalProjectDisplayName({ index: 0, total: 4 }),
      getPortalProjectDisplayName({ index: 3, total: 4, productionUrl: null, domainTarget: '' }),
    ];
    for (const label of labels) {
      expect(label).not.toContain('Proyecto #');
      expect(label).not.toMatch(UUID_RE);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('blindaje: productionUrl = UUID completo → fallback Sitio 1 (nunca el UUID)', () => {
    const label = getPortalProjectDisplayName({ index: 0, total: 4, productionUrl: UUID });
    expect(label).toBe('Sitio 1');
    expect(label).not.toMatch(UUID_RE);
  });

  it('blindaje: domainTarget = UUID completo → fallback Sitio 2', () => {
    const label = getPortalProjectDisplayName({
      index: 1,
      total: 4,
      productionUrl: null,
      domainTarget: UUID,
    });
    expect(label).toBe('Sitio 2');
    expect(label).not.toMatch(UUID_RE);
  });

  it('blindaje: stagingUrl = fragmento hex-only "d382a4" → fallback Sitio 3', () => {
    const label = getPortalProjectDisplayName({
      index: 2,
      total: 4,
      productionUrl: null,
      domainTarget: null,
      stagingUrl: 'd382a4',
    });
    expect(label).toBe('Sitio 3');
  });

  it('blindaje: ninguno de estos labels expone id interno ni queda vacío', () => {
    const labels = [
      getPortalProjectDisplayName({ index: 0, total: 4, productionUrl: UUID }),
      getPortalProjectDisplayName({ index: 1, total: 4, domainTarget: UUID }),
      getPortalProjectDisplayName({ index: 2, total: 4, stagingUrl: 'd382a4' }),
      getPortalProjectDisplayName({ index: 3, total: 4, productionUrl: 'https://AABBCC' }),
    ];
    for (const label of labels) {
      expect(label).not.toMatch(UUID_RE);
      expect(label).not.toContain('Proyecto #');
      expect(label).not.toContain('#');
      expect(label).not.toContain('projectId');
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('blindaje no rompe dominios reales con punto', () => {
    expect(
      getPortalProjectHostLabel('https://qa-live-incidents.example.com'),
    ).toBe('qa-live-incidents.example.com');
    // host hex pero CON punto (caso patológico improbable) sigue siendo dominio válido
    expect(getPortalProjectHostLabel('abc123.com')).toBe('abc123.com');
  });

  it('no lanza con índice/total no finitos', () => {
    expect(() => getPortalProjectDisplayName({ index: NaN, total: 3 })).not.toThrow();
    expect(getPortalProjectDisplayName({ index: NaN, total: 3 })).toBe('Sitio 1');
    expect(getPortalProjectDisplayName({ index: -5, total: 3 })).toBe('Sitio 1');
  });
});
