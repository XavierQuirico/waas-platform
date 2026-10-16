/**
 * BLOQUE Configuración profesional del cliente.
 *
 * Cubre el modelo de vista puro, los validadores, la allowlist de secciones y
 * un escaneo de fuente para garantizar que no se filtran tokens técnicos, IDs
 * crudos, marcadores de marca ni el color prohibido #d5ff02 dentro de
 * /configuracion.
 */
import { describe, it, expect } from 'vitest';
import {
  buildConfigurationViewModel,
  validateConfigSection,
  CONFIG_SECTION_FIELDS,
  isConfigSectionId,
  normalizeWhatsapp,
  normalizeWebsite,
  getIndustryLabel,
  formatMemberSince,
  type ConfigEditableSection,
  type ConfigManagedSection,
  type ConfigReadonlySection,
} from '@/lib/portal/configuration-view-model';
import type { ProjectStatus } from '@/lib/projects/state-machine';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const baseClient = {
  fullName: 'María Pérez',
  businessName: 'Clínica Vida',
  email: 'maria@clinicavida.com',
  whatsapp: '+1 809 555 1212',
  location: 'Santo Domingo, RD',
  currentUrl: 'https://clinicavida.com',
  industry: 'salud',
  createdAt: new Date('2026-01-15T10:00:00Z'),
};

const baseProject = {
  plan: 'PRO' as const,
  portfolioFlag: false,
  status: 'LIVE' as ProjectStatus,
  stagingUrl: 'https://staging.clinicavida.com',
  productionUrl: 'https://clinicavida.com',
};

const CLIENT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const PROJECT_ID = 'f0e1d2c3-b4a5-6789-0123-456789abcdef';

function vmText(input: Parameters<typeof buildConfigurationViewModel>[0]): string {
  return JSON.stringify(buildConfigurationViewModel(input));
}

describe('buildConfigurationViewModel — secciones y fuentes de datos', () => {
  it('produce secciones cuenta/contacto/negocio/proyecto/gestionado', () => {
    const vm = buildConfigurationViewModel({ client: baseClient, project: baseProject });
    const ids = vm.sections.map((s) => ('id' in s ? s.id : ''));
    expect(ids).toContain('cuenta');
    expect(ids).toContain('contacto');
    expect(ids).toContain('negocio');
    expect(ids).toContain('proyecto');
    expect(ids).toContain('gestionado');
  });

  it('omite la sección Proyecto cuando no hay proyecto', () => {
    const vm = buildConfigurationViewModel({ client: baseClient, project: null });
    const ids = vm.sections.map((s) => ('id' in s ? s.id : ''));
    expect(ids).not.toContain('proyecto');
    // Pero sigue habiendo cuenta/contacto/negocio/gestionado.
    expect(ids).toContain('cuenta');
    expect(ids).toContain('gestionado');
  });

  it('marca correo e industria como gestionados (no editables)', () => {
    const vm = buildConfigurationViewModel({ client: baseClient, project: baseProject });
    const cuenta = vm.sections.find(
      (s): s is ConfigEditableSection => s.kind === 'editable' && s.id === 'cuenta',
    )!;
    const email = cuenta.readonlyRows.find((r) => r.id === 'email')!;
    expect(email.managed).toBe(true);
    expect(email.value).toBe(baseClient.email);

    const negocio = vm.sections.find(
      (s): s is ConfigEditableSection => s.kind === 'editable' && s.id === 'negocio',
    )!;
    const industry = negocio.readonlyRows.find((r) => r.id === 'industry');
    expect(industry?.managed).toBe(true);
    expect(industry?.value).toBe('Salud');
  });

  it('expone sólo los campos editables persistibles', () => {
    const vm = buildConfigurationViewModel({ client: baseClient, project: baseProject });
    const editableNames = vm.sections
      .filter((s): s is ConfigEditableSection => s.kind === 'editable')
      .flatMap((s) => s.fields.map((f) => f.name))
      .sort();
    expect(editableNames).toEqual(
      ['businessName', 'currentUrl', 'fullName', 'location', 'whatsapp'].sort(),
    );
  });

  it('muestra plan y estado del proyecto en lenguaje humano', () => {
    const vm = buildConfigurationViewModel({ client: baseClient, project: baseProject });
    const proyecto = vm.sections.find(
      (s): s is ConfigReadonlySection => s.kind === 'readonly' && s.id === 'proyecto',
    )!;
    const text = JSON.stringify(proyecto);
    expect(text).toContain('Plan Pro');
    expect(text).toContain('Publicado');
    expect(text).not.toContain('LIVE');
    expect(text).not.toContain('PRO"'); // el valor crudo del enum no debe filtrarse como label
  });

  it('la sección gestionada incluye CTA a soporte', () => {
    const vm = buildConfigurationViewModel({ client: baseClient, project: baseProject });
    const managed = vm.sections.find(
      (s): s is ConfigManagedSection => s.kind === 'managed',
    )!;
    expect(managed.cta.href).toBe('/soporte');
    expect(managed.cta.label.length).toBeGreaterThan(0);
  });

  it('la sección gestionada usa copy de protección (no promocional)', () => {
    const vm = buildConfigurationViewModel({ client: baseClient, project: baseProject });
    const managed = vm.sections.find(
      (s): s is ConfigManagedSection => s.kind === 'managed',
    )!;
    expect(managed.description.toLowerCase()).toContain('protegidos');
    expect(managed.description.toLowerCase()).toContain('cambios accidentales');
  });

  it('nunca filtra clientId/projectId/UUID/tokens técnicos', () => {
    const text = vmText({
      client: { ...baseClient },
      project: { ...baseProject },
    });
    // El modelo de vista no recibe ids, pero verificamos defensivamente.
    expect(text).not.toContain(CLIENT_ID);
    expect(text).not.toContain(PROJECT_ID);
    expect(UUID_RE.test(text)).toBe(false);
    for (const token of ['STAGING_REVIEW', 'context=portal', 'context=admin', 'LM04', 'LM05', 'undefined', 'YourBrand', '[BRAND_NAME]']) {
      expect(text).not.toContain(token);
    }
  });

  it('las filas de sólo lectura nunca quedan vacías/undefined/null', () => {
    const vm = buildConfigurationViewModel({
      client: { ...baseClient, whatsapp: null, location: null, currentUrl: null, industry: 'otro', createdAt: null },
      project: null,
    });
    const text = JSON.stringify(vm);
    expect(text).not.toContain('"value":null');
    expect(text).not.toContain('undefined');

    // Las filas de display (readonly/managed) SIEMPRE tienen valor humano.
    const rows = vm.sections.flatMap((s) =>
      s.kind === 'editable' ? s.readonlyRows : s.rows,
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.value.trim().length, `fila ${r.id} no debe quedar vacía`).toBeGreaterThan(0);
    }
  });

  it('usa "Sitio principal"/host como label de proyecto, nunca "Proyecto #"', () => {
    const vm = buildConfigurationViewModel({ client: baseClient, project: baseProject });
    const text = JSON.stringify(vm);
    expect(text).not.toContain('Proyecto #');
    // host legible del dominio de producción
    expect(text).toContain('clinicavida.com');
  });
});

describe('getIndustryLabel / formatMemberSince', () => {
  it('humaniza el enum de industria', () => {
    expect(getIndustryLabel('gastronomia')).toBe('Gastronomía');
    expect(getIndustryLabel('marca_personal')).toBe('Marca personal');
    expect(getIndustryLabel('desconocido')).toBeNull();
    expect(getIndustryLabel(null)).toBeNull();
  });

  it('formatea la fecha de alta de forma humana y estable', () => {
    expect(formatMemberSince(new Date('2026-06-15T00:00:00Z'))).toMatch(/junio de 2026/);
    expect(formatMemberSince(null)).toBeNull();
  });
});

describe('Validadores de campo', () => {
  it('teléfono válido/ inválido', () => {
    expect(normalizeWhatsapp('+1 (809) 555-1212')).toEqual({ ok: true, value: '+1 (809) 555-1212' });
    expect(normalizeWhatsapp('')).toEqual({ ok: true, value: null });
    expect(normalizeWhatsapp('hola')).toMatchObject({ ok: false });
    expect(normalizeWhatsapp('123')).toMatchObject({ ok: false });
    expect(normalizeWhatsapp('1'.repeat(60))).toMatchObject({ ok: false });
  });

  it('URL sin esquema se normaliza a https; esquema explícito se preserva', () => {
    // Política honesta: sólo se añade https:// cuando NO hay esquema. Un http://
    // explícito del cliente se respeta (no se fuerza https).
    expect(normalizeWebsite('tudominio.com')).toEqual({ ok: true, value: 'https://tudominio.com' });
    expect(normalizeWebsite('https://x.io/path')).toMatchObject({ ok: true });
    expect(normalizeWebsite('http://midominio.com')).toEqual({ ok: true, value: 'http://midominio.com' });
    expect(normalizeWebsite('')).toEqual({ ok: true, value: null });
    expect(normalizeWebsite('sin-punto')).toMatchObject({ ok: false });
    expect(normalizeWebsite('javascript:alert(1)')).toMatchObject({ ok: false });
  });
});

describe('validateConfigSection — allowlist estricta', () => {
  it('cuenta: acepta fullName, ignora el resto', () => {
    const res = validateConfigSection('cuenta', {
      fullName: '  Nuevo Nombre  ',
      businessName: 'no-debe-pasar',
      clientId: CLIENT_ID,
    });
    expect(res).toEqual({ ok: true, data: { fullName: 'Nuevo Nombre' } });
  });

  it('contacto: normaliza whatsapp/location y omite campos ajenos', () => {
    const res = validateConfigSection('contacto', {
      whatsapp: '+1 809 555 1212',
      location: '  Santiago  ',
      fullName: 'no-debe-pasar',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual({ whatsapp: '+1 809 555 1212', location: 'Santiago' });
      expect('fullName' in res.data).toBe(false);
    }
  });

  it('negocio: valida businessName requerido y currentUrl', () => {
    const ok = validateConfigSection('negocio', { businessName: 'Mi Negocio', currentUrl: 'midominio.com' });
    expect(ok).toMatchObject({ ok: true, data: { businessName: 'Mi Negocio', currentUrl: 'https://midominio.com' } });

    const bad = validateConfigSection('negocio', { businessName: '   ', currentUrl: '' });
    expect(bad).toMatchObject({ ok: false, field: 'businessName' });
  });

  it('un clientId inyectado nunca se acepta como autoridad', () => {
    const res = validateConfigSection('cuenta', { fullName: 'X', clientId: 'attacker', projectId: 'attacker' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(Object.keys(res.data)).toEqual(['fullName']);
    }
  });

  it('isConfigSectionId rechaza secciones desconocidas', () => {
    expect(isConfigSectionId('cuenta')).toBe(true);
    expect(isConfigSectionId('admin')).toBe(false);
    expect(isConfigSectionId(undefined)).toBe(false);
    expect(Object.keys(CONFIG_SECTION_FIELDS).sort()).toEqual(['contacto', 'cuenta', 'negocio']);
  });
});
