// ============================================================
// Calculadora Interna WaaS — Tipos TypeScript
// ============================================================

export type ProjectType = 'subscription' | 'legacy';

export type Niche =
  | 'salud'
  | 'legal'
  | 'fitness'
  | 'gastronomia'
  | 'inmobiliaria'
  | 'educacion'
  | 'marca_personal'
  | 'otro';

export type ComplexityLevel = 'standard' | 'premium' | 'ultra_premium';

export type ComplexityMultiplier = 1.0 | 1.3 | 1.5;

export type SubscriptionPlan = 'basic' | 'pro' | 'business';

export type PaymentStructure = 'full' | 'installments';

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export type ProjectFlag = 'standard' | 'requires_review' | 'enterprise';

export type ExceptionDiscountLevel = 'none' | 'solidario' | 'arranque' | 'favor';

export type ContractDuration = 'monthly' | 'annual';

/** Estado del dominio en proyectos LEGACY */
export type DomainStatus = 'client_has_domain' | 'client_will_buy' | 'none';

// ─── Componente del catálogo ───────────────────────────────
export interface CatalogComponent {
  id: string;
  section: number;
  sectionName: string;
  name: string;
  price: number | 'included' | 'quote';
  notes?: string;
  requiresParent?: string[]; // IDs de componentes que deben estar seleccionados primero
}

// ─── Input del formulario (Paso 1) ────────────────────────
export interface ClientContextInput {
  // Datos del cliente
  clientName: string;
  businessName: string;
  niche: Niche;
  domainTarget?: string;

  // Tipo de proyecto
  projectType: ProjectType;

  // Solo para LEGACY
  numPages?: number;
  complexityLevel: ComplexityLevel;

  // Solo para suscripción
  subscriptionPlan?: SubscriptionPlan;
  includeSetupFee?: boolean;

  // Estado del contenido
  contentStatus: 'ready' | 'partial' | 'none';

  // Funcionalidades críticas (checkboxes rápidos)
  needsBooking: boolean;
  needsCatalog: boolean;
  needsCheckout: boolean;
  needsBlog: boolean;
  needsMembership: boolean;

  // Brief
  freeformBrief: string;
  inspirationLinks?: string;

  // Contacto del cliente (opcionales)
  clientEmail?: string;
  clientPhone?: string;

  // Estado del dominio en Paso 1 (para pre-seleccionar en Paso 3)
  hasDomain?: boolean;

  // Modo de entrada
  inputMode: 'form' | 'prompt';
}

// ─── Componente seleccionado (con flag de origen IA) ──────
export interface SelectedComponent {
  componentId: string;
  aiSuggested: boolean;
  aiReason?: string;
  quantity?: number; // Para ítems con precio por unidad (ej: páginas adicionales)
  priceOverride?: number; // Precio manual que reemplaza el del catálogo
  /** nombre del componente del catálogo vivo, embebido en selección para snapshot. */
  name?: string;
  /** nombre de la sección del catálogo vivo, embebido en selección para snapshot. */
  sectionName?: string;
}

// ─── Input del Paso 3 (Ajustes) ──────────────────────────
export interface AdjustmentsInput {
  selectedComponents: SelectedComponent[];
  exceptionDiscountLevel: ExceptionDiscountLevel;
  exceptionDiscountPercent: number; // 0–50
  exceptionDiscountReason?: string;

  // Descuento en monto fijo USD (alternativa al porcentaje)
  discountFixedAmount?: number;

  // Duración de contrato — solo aplica a suscripción
  contractDuration: ContractDuration;

  // Estructura de pago — solo aplica a LEGACY
  paymentStructure: PaymentStructure;

  // PayPal fee toggle — si false, no se aplica gross-up (pago por transferencia/efectivo)
  includePaypalFee: boolean;

  // Solo LEGACY — dominio
  domainStatus?: DomainStatus; // default: 'none'

  // Solo LEGACY — mantenimiento mensual post-entrega
  includeMaintenanceFee?: boolean;
  maintenanceMonthlyAmount?: number; // USD/mes

  // Solo LEGACY — servidor dedicado (si el proyecto lo requiere)
  includeDedicatedServer?: boolean;
  dedicatedServerMonthlyCost?: number; // USD/mes

  proposalValidityDays: number; // default: 7
  startDate?: Date;
  stagingDate?: Date; // Fecha manual de entrega en staging (override del cálculo automático)
  deliveryDate?: Date; // Fecha manual de entrega final (override del cálculo automático)
  internalNotes?: string; // Notas internas — no aparecen en la propuesta del cliente
}

// ─── Resultado del análisis IA (Paso 2) ──────────────────
export interface AIAnalysisResult {
  suggestedComponents: Array<{
    componentId: string;
    reason: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
  suggestedComplexity: ComplexityLevel;
  complexityScore: number; // 1–10
  projectFlag: ProjectFlag;
  enterpriseReason?: string;
  executiveSummary: string; // Párrafo para la propuesta
  entryPointEstimate?: string; // Para LEGACY, punto de entrada orientativo
  detectedFlags?: Array<{
    type: 'warning' | 'ok' | 'info';
    message: string;
  }>;
  suggestedPlan?: 'basic' | 'pro' | 'business'; // Recomendación de plan para suscripción sin plan elegido
}

// ─── Cálculo determinístico (Paso 4) ─────────────────────
export interface CalculationResult {
  // Desglose de componentes
  components: Array<{
    id: string;
    name: string;
    price: number;
    section: string;
  }>;

  // Subtotales
  basePrice: number;
  additionalPagesPrice: number;
  complexityMultiplier: ComplexityMultiplier;
  componentsTotal: number;
  grossSubtotal: number; // antes de descuentos

  // Descuentos
  volumeDiscountPercent: number; // 0, 5, 8, 10
  volumeDiscountAmount: number;
  exceptionDiscountPercent: number;
  exceptionDiscountAmount: number;
  finalDiscountPercent: number;
  finalDiscountAmount: number;

  // Descuento por duración de contrato (solo suscripción)
  durationDiscountPercent: number; // 0, 0.05, 0.10
  durationDiscountAmount: number;

  // Post-descuento
  netSubtotal: number;

  // Setup fee separado del pipeline de descuentos (solo suscripción)
  setupFeeAmount: number;

  // Servicios recurrentes LEGACY (no aplican a suscripción)
  maintenanceMonthlyAmount: number;   // 0 si no aplica
  dedicatedServerMonthlyCost: number; // 0 si no aplica
  domainStatus: DomainStatus;         // para mostrar nota en desglose
  domainPrice?: number;               // precio USD del dominio cuando client_will_buy (solo informativo)
  domainTarget?: string;              // nombre del dominio cuando client_will_buy

  // PayPal gross-up (puede estar desactivado)
  paypalFeeIncluded: boolean;         // refleja el toggle del admin
  paypalFeeAmount: number;            // 0 si no se aplica
  finalClientPrice: number;           // precio a cobrar al cliente
  finalClientPriceRounded: number;    // redondeado a $50 más cercano

  // Neto para el admin (en suscripción = mensualidad_neta + setupFeeAmount)
  providerNetAmount: number;

  // Descuento por volumen de add-ons (3+ add-ons = 10%)
  addOnDiscountPercent: number;
  addOnDiscountAmount: number;
  netAddOnsTotal: number;

  // Métricas internas de suscripción (solo para el admin)
  mrrNeto?: number;              // Ingreso mensual neto después de fee PayPal
  primerCobroClienteTotal?: number; // Total primer cobro al cliente
  primerCobroNeto?: number;      // Primer cobro neto para el admin (después de PayPal)

  // Cuotas (si aplica)
  installments?: {
    installment1: number; // 50% — redondeado a $25
    installment2: number; // 25% — redondeado a $25
    installment3: number; // 25% — redondeado a $25
    totalClientPays: number;
    providerTotalReceived: number;
    paypalFeeI1: number; // fee por cuota 1 (0 si PayPal desactivado)
    paypalFeeI2: number; // fee por cuota 2 (0 si PayPal desactivado)
    paypalFeeI3: number; // fee por cuota 3 (0 si PayPal desactivado)
  };

  // Totales anuales (solo suscripción con contractDuration 'annual')
  planAnnualBase?: number;          // precio base × 12 meses sin descuento
  planAnnualAfterDiscount?: number; // precio base × 12 meses con -10% anual

  // Alertas
  alerts: string[];
}

// ─── Propuesta completa (output final) ───────────────────
export interface ProposalData {
  // Metadata
  clientName: string;
  businessName: string;
  niche: Niche;
  projectType: ProjectType;
  createdAt: Date;
  validUntil: Date;

  // Contenido
  executiveSummary: string;
  calculation: CalculationResult;
  paymentStructure: PaymentStructure;
  startDateEstimate: string;
  stagingDeadline: string;
  finalDeliveryEstimate: string;

  // Plan de suscripción (si aplica)
  subscriptionPlan?: SubscriptionPlan;

  // El enlace de pago no se genera aquí: se crea desde PayPal al confirmar el proyecto.

  // Estado
  status: QuoteStatus;
  internalNotes?: string; // Notas internas del admin, no se muestran al cliente
  catalogSnapshot?: import('@/lib/catalog/types').ProposalCatalogSnapshot;
}

// ─── Schema del historial (alineado con Drizzle) ─────────
export interface QuoteRecord {
  id: string;
  clientName: string;
  businessName: string;
  projectType: ProjectType;
  niche: Niche;
  status: QuoteStatus;
  totalAmount: number;
  providerNetAmount: number;
  discountApplied: number;
  discountReason: string | null;
  componentsSnapshot: SelectedComponent[];
  calculationSnapshot: CalculationResult;
  proposalHtml: string;
  createdAt: Date;
  validUntil: Date;
  sentAt: Date | null;
  updatedAt: Date;
}
