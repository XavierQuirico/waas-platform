// Configuración del portal cliente — modelo de vista puro + validadores.
//
// Reglas:
//   - Sin DB, sin React. Helpers puros, reutilizados por la página (server),
//     el server action y los tests.
//   - JAMÁS exponer identificadores internos (clientId, projectId, UUID, hash)
//     ni tokens técnicos (STAGING_REVIEW, context=portal, etc.). El modelo de
//     vista sólo produce etiquetas humanas.
//   - Sólo los campos con persistencia real en `clients` son editables. El
//     resto se muestra como lectura / "Gestionado por el admin".
//   - Allowlist estricta por sección: el server action nunca confía en el
//     cliente para decidir qué columnas tocar.

import type { ProjectStatus } from '@/lib/projects/state-machine';
import { getProjectTypeLabel, getProjectStatusBadge } from './dashboard-state';
import { getPortalProjectHostLabel } from './project-display';
import { toExternalUrl } from './url';

// ─── Etiquetas de industria (nicheEnum) ──────────────────────────────────────
// El enum es la fuente de verdad; aquí sólo lo humanizamos para mostrarlo.
const INDUSTRY_LABELS: Record<string, string> = {
  salud: 'Salud',
  legal: 'Legal',
  fitness: 'Fitness',
  gastronomia: 'Gastronomía',
  inmobiliaria: 'Inmobiliaria',
  educacion: 'Educación',
  marca_personal: 'Marca personal',
  otro: 'Otro',
};

export function getIndustryLabel(industry: string | null | undefined): string | null {
  if (!industry) return null;
  return INDUSTRY_LABELS[industry] ?? null;
}

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Formato humano e independiente del locale del entorno: "junio de 2026". */
export function formatMemberSince(date: Date | null | undefined): string | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
}

const EMPTY_DISPLAY = 'No especificado';

// ─── Tipos del modelo de vista ────────────────────────────────────────────────

export type ConfigEditableFieldType = 'text' | 'tel' | 'url';

export interface ConfigDisplayRow {
  id: string;
  label: string;
  value: string; // siempre humano, nunca vacío/undefined/null
  managed?: boolean; // muestra badge "Gestionado"
  hint?: string;
}

export interface ConfigEditableField {
  name: ConfigEditableFieldName;
  label: string;
  type: ConfigEditableFieldType;
  value: string; // valor actual editable ('' si null)
  required: boolean;
  maxLength: number;
  placeholder?: string;
  hint?: string;
}

export interface ConfigEditableSection {
  kind: 'editable';
  id: ConfigSectionId;
  title: string;
  description: string;
  fields: ConfigEditableField[];
  readonlyRows: ConfigDisplayRow[];
}

export interface ConfigReadonlySection {
  kind: 'readonly';
  id: string;
  title: string;
  description: string;
  rows: ConfigDisplayRow[];
}

export interface ConfigManagedSection {
  kind: 'managed';
  id: 'gestionado';
  title: string;
  description: string;
  rows: ConfigDisplayRow[];
  cta: { label: string; href: string; external: boolean };
}

export type ConfigurationSection =
  | ConfigEditableSection
  | ConfigReadonlySection
  | ConfigManagedSection;

export interface ConfigurationViewModel {
  sections: ConfigurationSection[];
}

// ─── Allowlist de campos editables por sección ────────────────────────────────

export const CONFIG_SECTION_FIELDS = {
  cuenta: ['fullName'],
  contacto: ['whatsapp', 'location'],
  negocio: ['businessName', 'currentUrl'],
} as const;

export type ConfigSectionId = keyof typeof CONFIG_SECTION_FIELDS;
export type ConfigEditableFieldName =
  | 'fullName'
  | 'businessName'
  | 'whatsapp'
  | 'location'
  | 'currentUrl';

export function isConfigSectionId(value: unknown): value is ConfigSectionId {
  return value === 'cuenta' || value === 'contacto' || value === 'negocio';
}

// ─── Validadores puros (cliente + servidor comparten contrato) ────────────────

type FieldOk = { ok: true; value: string | null };
type FieldErr = { ok: false; error: string };
type FieldResult = FieldOk | FieldErr;

export function normalizeRequiredText(
  raw: unknown,
  opts: { max: number; emptyError: string; longError: string },
): FieldResult {
  const t = String(raw ?? '').trim();
  if (!t) return { ok: false, error: opts.emptyError };
  if (t.length > opts.max) return { ok: false, error: opts.longError };
  return { ok: true, value: t };
}

export function normalizeOptionalText(
  raw: unknown,
  opts: { max: number; longError: string },
): FieldResult {
  const t = String(raw ?? '').trim();
  if (!t) return { ok: true, value: null };
  if (t.length > opts.max) return { ok: false, error: opts.longError };
  return { ok: true, value: t };
}

/** Teléfono / WhatsApp: opcional. Si viene, requiere ≥7 dígitos y sólo caracteres telefónicos. */
export function normalizeWhatsapp(raw: unknown): FieldResult {
  const t = String(raw ?? '').trim();
  if (!t) return { ok: true, value: null };
  if (t.length > 50) return { ok: false, error: 'El teléfono es demasiado largo.' };
  const digits = t.replace(/\D/g, '');
  if (!/^\+?[\d\s().-]+$/.test(t) || digits.length < 7 || digits.length > 15) {
    return { ok: false, error: 'Introduce un teléfono válido.' };
  }
  return { ok: true, value: t };
}

/** Sitio web: opcional. Normaliza a https:// y exige un host con punto. */
export function normalizeWebsite(raw: unknown): FieldResult {
  const t = String(raw ?? '').trim();
  if (!t) return { ok: true, value: null };
  if (t.length > 500) return { ok: false, error: 'La URL es demasiado larga.' };
  const ext = toExternalUrl(t);
  if (!ext) return { ok: false, error: 'Introduce una URL válida (ej. tudominio.com).' };
  try {
    const u = new URL(ext);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { ok: false, error: 'Introduce una URL válida (ej. tudominio.com).' };
    }
    if (!u.hostname.includes('.')) {
      return { ok: false, error: 'Introduce una URL válida (ej. tudominio.com).' };
    }
    return { ok: true, value: ext };
  } catch {
    return { ok: false, error: 'Introduce una URL válida (ej. tudominio.com).' };
  }
}

export type ConfigValidationResult =
  | { ok: true; data: Partial<Record<ConfigEditableFieldName, string | null>> }
  | { ok: false; field: ConfigEditableFieldName; error: string };

export function validateConfigField(field: ConfigEditableFieldName, raw: Record<string, unknown>): FieldResult {
  switch (field) {
    case 'fullName':
      return normalizeRequiredText(raw.fullName, {
        max: 200,
        emptyError: 'El nombre es requerido.',
        longError: 'El nombre es demasiado largo.',
      });
    case 'businessName':
      return normalizeRequiredText(raw.businessName, {
        max: 200,
        emptyError: 'El nombre del negocio es requerido.',
        longError: 'El nombre del negocio es demasiado largo.',
      });
    case 'whatsapp':
      return normalizeWhatsapp(raw.whatsapp);
    case 'location':
      return normalizeOptionalText(raw.location, {
        max: 200,
        longError: 'La ubicación es demasiado larga.',
      });
    case 'currentUrl':
      return normalizeWebsite(raw.currentUrl);
  }
}

/**
 * Valida y normaliza SÓLO los campos de la sección indicada. Cualquier otra
 * clave del payload (p. ej. clientId inyectado) se ignora por completo: la
 * autoridad sobre qué columnas tocar vive aquí, no en el navegador.
 */
export function validateConfigSection(
  section: ConfigSectionId,
  raw: Record<string, unknown>,
): ConfigValidationResult {
  const data: Partial<Record<ConfigEditableFieldName, string | null>> = {};

  for (const field of CONFIG_SECTION_FIELDS[section]) {
    const result = validateConfigField(field, raw);
    // `in`-narrowing es robusto bajo strict:false (no depende del discriminante booleano).
    if ('error' in result) {
      return { ok: false, field, error: result.error };
    }
    data[field] = result.value;
  }

  return { ok: true, data };
}

// ─── Construcción del modelo de vista ─────────────────────────────────────────

export interface ConfigurationClientInput {
  fullName: string;
  businessName: string;
  email: string;
  whatsapp: string | null;
  location: string | null;
  currentUrl: string | null;
  industry: string;
  createdAt: Date | null;
}

export interface ConfigurationProjectInput {
  plan: 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY';
  portfolioFlag: boolean;
  status: ProjectStatus;
  stagingUrl: string | null;
  productionUrl: string | null;
}

export interface BuildConfigurationViewModelInput {
  client: ConfigurationClientInput;
  project: ConfigurationProjectInput | null;
}

export function buildConfigurationViewModel(
  input: BuildConfigurationViewModelInput,
): ConfigurationViewModel {
  const { client, project } = input;
  const sections: ConfigurationSection[] = [];

  // 1 ── Cuenta (nombre editable + correo gestionado + miembro desde) ──────────
  const memberSince = formatMemberSince(client.createdAt);
  sections.push({
    kind: 'editable',
    id: 'cuenta',
    title: 'Cuenta',
    description: 'Tu identidad dentro del portal y el correo con el que accedes.',
    fields: [
      {
        name: 'fullName',
        label: 'Nombre completo',
        type: 'text',
        value: client.fullName ?? '',
        required: true,
        maxLength: 200,
        placeholder: 'Tu nombre y apellido',
      },
    ],
    readonlyRows: [
      {
        id: 'email',
        label: 'Correo de acceso',
        value: client.email,
        managed: true,
        hint: 'Se gestiona de forma segura con tu cuenta. No puede editarse aquí.',
      },
      ...(memberSince
        ? [{ id: 'memberSince', label: 'Cliente desde', value: memberSince }]
        : []),
    ],
  });

  // 2 ── Contacto (teléfono + ubicación) ───────────────────────────────────────
  sections.push({
    kind: 'editable',
    id: 'contacto',
    title: 'Contacto',
    description: 'Cómo podemos comunicarnos contigo sobre tu proyecto.',
    fields: [
      {
        name: 'whatsapp',
        label: 'Teléfono / WhatsApp',
        type: 'tel',
        value: client.whatsapp ?? '',
        required: false,
        maxLength: 50,
        placeholder: '+1 (809) 000-0000',
      },
      {
        name: 'location',
        label: 'Ubicación',
        type: 'text',
        value: client.location ?? '',
        required: false,
        maxLength: 200,
        placeholder: 'Santo Domingo, RD',
      },
    ],
    readonlyRows: [],
  });

  // 3 ── Negocio (nombre comercial editable + sitio actual + industria) ─────────
  const industryLabel = getIndustryLabel(client.industry);
  sections.push({
    kind: 'editable',
    id: 'negocio',
    title: 'Negocio',
    description: 'Los datos de tu negocio que usamos en tu sitio y comunicaciones.',
    fields: [
      {
        name: 'businessName',
        label: 'Negocio o empresa',
        type: 'text',
        value: client.businessName ?? '',
        required: true,
        maxLength: 200,
        placeholder: 'Nombre de tu negocio',
      },
      {
        name: 'currentUrl',
        label: 'Sitio web actual',
        type: 'url',
        value: client.currentUrl ?? '',
        required: false,
        maxLength: 500,
        placeholder: 'tudominio.com',
        hint: 'Si ya tienes un sitio, déjanos su dirección.',
      },
    ],
    readonlyRows: industryLabel
      ? [
          {
            id: 'industry',
            label: 'Industria',
            value: industryLabel,
            managed: true,
            hint: 'Definida al inicio de tu proyecto. Escríbele a Xavier si cambió.',
          },
        ]
      : [],
  });

  // 4 ── Proyecto / sitio (sólo lectura) ───────────────────────────────────────
  if (project) {
    const planLabel = getProjectTypeLabel(project.plan, project.portfolioFlag);
    const statusLabel = getProjectStatusBadge(project.status).label;
    const host =
      getPortalProjectHostLabel(project.productionUrl) ??
      getPortalProjectHostLabel(project.stagingUrl);

    const rows: ConfigDisplayRow[] = [
      { id: 'plan', label: 'Plan actual', value: planLabel, managed: true },
      { id: 'status', label: 'Estado del proyecto', value: statusLabel },
    ];
    if (host) {
      rows.push({ id: 'site', label: 'Sitio', value: host });
    }

    sections.push({
      kind: 'readonly',
      id: 'proyecto',
      title: 'Proyecto y sitio',
      description: 'Resumen de tu proyecto activo. Estos datos los gestiona Xavier.',
      rows,
    });
  }

  // 5 ── Gestionado por el admin ─────────────────────────────────────────────────
  const managedRows: ConfigDisplayRow[] = [
    { id: 'm-email', label: 'Correo de acceso', value: client.email },
  ];
  if (industryLabel) {
    managedRows.push({ id: 'm-industry', label: 'Industria', value: industryLabel });
  }
  if (project) {
    managedRows.push({
      id: 'm-plan',
      label: 'Plan y facturación',
      value: getProjectTypeLabel(project.plan, project.portfolioFlag),
    });
  }

  sections.push({
    kind: 'managed',
    id: 'gestionado',
    title: 'Gestionado por Xavier',
    description:
      'Estos datos se mantienen protegidos para evitar cambios accidentales. Si necesitas actualizarlos, solicítalo y los cambiamos por ti.',
    rows: managedRows,
    cta: { label: 'Solicitar un cambio', href: '/soporte', external: false },
  });

  return { sections };
}

/** Fallback humano para valores vacíos en filas de sólo lectura. */
export function configDisplayOrEmpty(value: string | null | undefined): string {
  const t = (value ?? '').trim();
  return t || EMPTY_DISPLAY;
}
