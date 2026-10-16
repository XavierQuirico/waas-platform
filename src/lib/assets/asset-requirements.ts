// ============================================================
// Asset Requirements — WaaS
// Define qué materiales necesita cada plan (Módulo 3)
// ============================================================

// ─── Tipos ────────────────────────────────────────────────

export type AssetType = 'file' | 'text' | 'textarea';

export interface AssetRequirement {
  key: string; // AssetKey value
  label: string;
  required: boolean;
  type?: AssetType;             // 'file' por defecto si no se especifica
  formats?: string[];           // Formatos aceptados para file uploads
  acceptsUrl?: boolean;         // true = también acepta link (Google Docs, Canva, etc.)
  minCount?: number;            // Para assets multi-archivo (fotos)
  helpText?: string;            // Texto de ayuda para el cliente
}

type SubscriptionPlan = 'BASIC' | 'PRO' | 'BUSINESS';

// ─── Requisitos por plan ──────────────────────────────────
// Reglas clave:
// - brief: REQUERIDO para todos los planes
// - hex_colors: OPCIONAL para todos
// - copy_doc: REQUERIDO (sitio necesita textos), acepta Google Docs link
// - fotos: mínimo 3 para todos los planes

const BASIC_REQUIREMENTS: AssetRequirement[] = [
  {
    key: 'logo',
    label: 'Logo',
    required: true,
    formats: ['SVG', 'PNG', 'AI', 'PDF'],
    helpText: 'SVG o PNG con fondo transparente es ideal. Si no lo tienes así, envíalo como sea.',
  },
  {
    key: 'photos',
    label: 'Fotos del negocio',
    required: true,
    formats: ['JPG', 'PNG', 'WEBP'],
    minCount: 3,
    helpText: 'Mínimo 3 fotos. Pueden ser del teléfono, mientras sean claras.',
  },
  {
    key: 'copy_doc',
    label: 'Textos del sitio',
    required: true,
    formats: ['DOCX', 'TXT', 'PDF'],
    acceptsUrl: true,
    helpText: 'El contenido que irá en tu sitio. Puede ser un documento Word, PDF o un link a Google Docs.',
  },
  {
    key: 'brief',
    label: 'Brief libre',
    required: true,
    type: 'textarea',
    helpText: 'Cuéntanos sobre tu negocio, lo que ofreces y cómo te gustaría que se vea tu sitio.',
  },
  {
    key: 'hex_colors',
    label: 'Colores de marca',
    required: false,
    type: 'text',
    helpText: 'Si conoces los colores exactos de tu marca (códigos HEX), escríbelos aquí. Ej: #1A2B3C',
  },
  {
    key: 'social_links',
    label: 'Redes sociales activas',
    required: false,
    type: 'text',
    helpText: 'Links a tus perfiles activos (Instagram, Facebook, LinkedIn, etc.)',
  },
  {
    key: 'special_instructions',
    label: 'Instrucciones especiales',
    required: false,
    type: 'textarea',
    helpText: 'Cualquier detalle adicional que deba saber Xavier antes de empezar.',
  },
];

const PRO_REQUIREMENTS: AssetRequirement[] = [
  ...BASIC_REQUIREMENTS,
  {
    key: 'brand_guide',
    label: 'Manual de marca / Brand guide',
    required: false,
    formats: ['PDF', 'AI'],
    acceptsUrl: true,
    helpText: 'Si tienes un manual de marca, compártelo aquí. Puede ser un PDF o un link a Canva.',
  },
];

const BUSINESS_REQUIREMENTS: AssetRequirement[] = [
  ...PRO_REQUIREMENTS,
  {
    key: 'product_data',
    label: 'Catálogo / Menú / Inventario',
    required: true,
    formats: ['XLSX', 'CSV', 'DOCX', 'PDF'],
    helpText: 'Lista de tus productos o servicios con nombre, descripción y precio.',
  },
];

export const ASSET_REQUIREMENTS: Record<SubscriptionPlan, AssetRequirement[]> = {
  BASIC: BASIC_REQUIREMENTS,
  PRO: PRO_REQUIREMENTS,
  BUSINESS: BUSINESS_REQUIREMENTS,
};

// ─── Helper: validar si se puede enviar para revisión ─────

interface AssetRecord {
  assetKey: string;
  status: string; // 'pending' | 'uploaded' | 'under_review' | 'approved' | 'rejected'
}

// Únicos statuses que cuentan como "completo" para submit/requisitos.
// rejected, pending y cualquier status desconocido NO cuentan.
export const SUBMITTABLE_ASSET_STATUSES = new Set(['uploaded', 'under_review', 'approved']);

/**
 * Determina si el cliente puede enviar sus assets para revisión.
 * Valida minCount para assets multi-archivo (fotos).
 * rejected y pending NO cuentan como completos.
 */
export function canSubmitForReview(
  plan: SubscriptionPlan,
  assets: AssetRecord[]
): boolean {
  const requirements = ASSET_REQUIREMENTS[plan];

  return requirements
    .filter((req) => req.required)
    .every((req) => {
      if (req.minCount !== undefined) {
        // Multi-archivo: solo cuentan los statuses submittable
        const uploadedCount = assets.filter(
          (a) => a.assetKey === req.key && SUBMITTABLE_ASSET_STATUSES.has(a.status)
        ).length;
        return uploadedCount >= req.minCount;
      }

      // Asset único: completo si existe cualquier versión con status submittable
      return assets.some(
        (a) => a.assetKey === req.key && SUBMITTABLE_ASSET_STATUSES.has(a.status),
      );
    });
}

/**
 * Retorna los assets requeridos que faltan (para mostrar al cliente).
 * rejected y pending aparecen como faltantes.
 */
export function getMissingRequiredAssets(
  plan: SubscriptionPlan,
  assets: AssetRecord[]
): AssetRequirement[] {
  const requirements = ASSET_REQUIREMENTS[plan];

  return requirements.filter((req) => {
    if (!req.required) return false;

    if (req.minCount !== undefined) {
      const uploadedCount = assets.filter(
        (a) => a.assetKey === req.key && SUBMITTABLE_ASSET_STATUSES.has(a.status)
      ).length;
      return uploadedCount < req.minCount;
    }

    return !assets.some(
      (a) => a.assetKey === req.key && SUBMITTABLE_ASSET_STATUSES.has(a.status),
    );
  });
}
