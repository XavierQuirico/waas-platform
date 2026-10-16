/**
 * scripts/seed-demo.ts
 *
 * Crea datos de demostración para el panel de admin y portal de cliente.
 * Inserta 4 proyectos en distintos estados, 2 incidencias abiertas y 1 cotización.
 *
 * Uso:
 *   npx tsx scripts/seed-demo.ts
 *   npx tsx scripts/seed-demo.ts --clean  (elimina datos seed anteriores primero)
 */

import dotenv from 'dotenv';

// Same resolution order as the app: .env.local first, then .env.
dotenv.config({ path: '.env.local' });
dotenv.config();

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, inArray } from 'drizzle-orm';
import * as schema from '../src/db/schema';

// ─── DB ───────────────────────────────────────────────────
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

// ─── Args ─────────────────────────────────────────────────
const CLEAN = process.argv.includes('--clean');

// ─── Seed IDs (fijos para idempotencia) ───────────────────
const SEED_CLERK_PREFIX = 'seed_demo_user_';

const DEMO_CLIENTS = [
  {
    clerkUserId: `${SEED_CLERK_PREFIX}01`,
    fullName: 'Laura Medina',
    email: 'laura.demo@waas-seed.test',
    whatsapp: '+18095550001',
    businessName: 'Clínica Medina',
    industry: 'salud' as const,
    location: 'Santo Domingo',
    materialStatus: 'tiene_todo' as const,
  },
  {
    clerkUserId: `${SEED_CLERK_PREFIX}02`,
    fullName: 'Carlos Jiménez',
    email: 'carlos.demo@waas-seed.test',
    whatsapp: '+18095550002',
    businessName: 'FitLife RD',
    industry: 'fitness' as const,
    location: 'Santiago',
    materialStatus: 'tiene_logo_no_fotos' as const,
  },
  {
    clerkUserId: `${SEED_CLERK_PREFIX}03`,
    fullName: 'Ana Rodríguez',
    email: 'ana.demo@waas-seed.test',
    whatsapp: '+18095550003',
    businessName: 'Estudio Legal Rodríguez',
    industry: 'legal' as const,
    location: 'Santo Domingo Este',
    materialStatus: 'tiene_todo' as const,
  },
  {
    clerkUserId: `${SEED_CLERK_PREFIX}04`,
    fullName: 'Miguel Torres',
    email: 'miguel.demo@waas-seed.test',
    whatsapp: '+18095550004',
    businessName: 'Sabores Dominicanos',
    industry: 'gastronomia' as const,
    location: 'La Romana',
    materialStatus: 'no_tiene_nada' as const,
  },
];

const NOW = new Date();
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

// ─── Main ─────────────────────────────────────────────────
async function main() {
  console.log('🌱  WaaS seed-demo iniciado...\n');

  // ── 0. Clean anteriores si se pide ────────────────────
  if (CLEAN) {
    console.log('🧹  Limpiando datos seed anteriores...');
    const existingClients = await db
      .select({ id: schema.clients.id })
      .from(schema.clients)
      .where(
        inArray(
          schema.clients.clerkUserId,
          DEMO_CLIENTS.map((c) => c.clerkUserId),
        ),
      );
    const clientIds = existingClients.map((c) => c.id);

    if (clientIds.length > 0) {
      const existingProjects = await db
        .select({ id: schema.projects.id })
        .from(schema.projects)
        .where(inArray(schema.projects.clientId, clientIds));
      const projectIds = existingProjects.map((p) => p.id);

      if (projectIds.length > 0) {
        await db
          .delete(schema.incidents)
          .where(inArray(schema.incidents.projectId, projectIds));
        await db
          .delete(schema.projectEvents)
          .where(inArray(schema.projectEvents.projectId, projectIds));
        await db
          .delete(schema.projectAssets)
          .where(inArray(schema.projectAssets.projectId, projectIds));
        await db
          .delete(schema.projects)
          .where(inArray(schema.projects.id, projectIds));
      }
      await db
        .delete(schema.clients)
        .where(inArray(schema.clients.id, clientIds));
    }

    // Limpiar cotizaciones seed
    const seedQuotes = await db
      .select({ id: schema.quotes.id })
      .from(schema.quotes)
      .where(eq(schema.quotes.clientName, 'Persona Demo (seed)'));
    if (seedQuotes.length > 0) {
      await db
        .delete(schema.quotes)
        .where(
          inArray(
            schema.quotes.id,
            seedQuotes.map((q) => q.id),
          ),
        );
    }

    console.log('   ✓ Limpieza completada\n');
  }

  // ── 1. Insertar clientes ───────────────────────────────
  console.log('👥  Insertando clientes...');
  const insertedClients = await db
    .insert(schema.clients)
    .values(DEMO_CLIENTS)
    .onConflictDoNothing()
    .returning();

  // Si ya existían (onConflictDoNothing), buscarlos
  let clientRows = insertedClients;
  if (insertedClients.length < DEMO_CLIENTS.length) {
    clientRows = await db
      .select()
      .from(schema.clients)
      .where(
        inArray(
          schema.clients.clerkUserId,
          DEMO_CLIENTS.map((c) => c.clerkUserId),
        ),
      );
  }

  const byEmail = Object.fromEntries(clientRows.map((c) => [c.email, c]));
  console.log(`   ✓ ${clientRows.length} clientes\n`);

  // ── 2. Insertar proyectos ──────────────────────────────
  console.log('📁  Insertando proyectos...');

  const projectDefs = [
    // Proyecto 1: AWAITING_ASSETS — cliente pagó, esperando assets
    {
      clientId: byEmail['laura.demo@waas-seed.test'].id,
      plan: 'BASIC' as const,
      monthlyPriceCents: 4900,
      setupFeeCents: 5000,
      status: 'AWAITING_ASSETS' as const,
      paypalOrderId: 'DEMO-ORDER-001',
      paypalSubscriptionId: 'DEMO-SUB-001',
      intakeSnapshot: {
        step1: {
          fullName: 'Laura Medina',
          email: 'laura.demo@waas-seed.test',
          whatsapp: '+18095550001',
          businessName: 'Clínica Medina',
          industry: 'salud',
          location: 'Santo Domingo',
        },
        step2: { features: ['booking'], materialStatus: 'tiene_todo' },
        step3: { wantsOwnership: false },
      } as schema.NewProject['intakeSnapshot'],
      createdAt: daysAgo(5),
      updatedAt: daysAgo(4),
    },
    // Proyecto 2: ASSETS_UNDER_REVIEW — El admin revisando assets
    {
      clientId: byEmail['carlos.demo@waas-seed.test'].id,
      plan: 'PRO' as const,
      monthlyPriceCents: 8900,
      setupFeeCents: 5000,
      status: 'ASSETS_UNDER_REVIEW' as const,
      paypalOrderId: 'DEMO-ORDER-002',
      paypalSubscriptionId: 'DEMO-SUB-002',
      intakeSnapshot: {
        step1: {
          fullName: 'Carlos Jiménez',
          email: 'carlos.demo@waas-seed.test',
          whatsapp: '+18095550002',
          businessName: 'FitLife RD',
          industry: 'fitness',
          location: 'Santiago',
        },
        step2: { features: ['booking', 'checkout'], materialStatus: 'tiene_logo_no_fotos' },
        step3: { wantsOwnership: false },
      } as schema.NewProject['intakeSnapshot'],
      createdAt: daysAgo(10),
      updatedAt: daysAgo(2),
    },
    // Proyecto 3: STAGING_REVIEW — sitio en staging, cliente revisando
    {
      clientId: byEmail['ana.demo@waas-seed.test'].id,
      plan: 'BUSINESS' as const,
      monthlyPriceCents: 13900,
      setupFeeCents: 5000,
      status: 'STAGING_REVIEW' as const,
      paypalOrderId: 'DEMO-ORDER-003',
      paypalSubscriptionId: 'DEMO-SUB-003',
      stagingUrl: 'https://ana-rodriguez-legal-demo.vercel.app',
      stagingDeployedAt: daysAgo(1),
      stagingReviewDeadlineAt: daysFromNow(2),
      productionStartedAt: daysAgo(4),
      productionDeadlineAt: daysAgo(1),
      intakeSnapshot: {
        step1: {
          fullName: 'Ana Rodríguez',
          email: 'ana.demo@waas-seed.test',
          whatsapp: '+18095550003',
          businessName: 'Estudio Legal Rodríguez',
          industry: 'legal',
          location: 'Santo Domingo Este',
        },
        step2: { features: ['booking', 'checkout', 'catalog'], materialStatus: 'tiene_todo' },
        step3: { wantsOwnership: false },
      } as schema.NewProject['intakeSnapshot'],
      createdAt: daysAgo(20),
      updatedAt: daysAgo(1),
    },
    // Proyecto 4: REQUIRES_REVIEW — LEGACY, esperando llamada con el admin
    {
      clientId: byEmail['miguel.demo@waas-seed.test'].id,
      plan: 'LEGACY' as const,
      monthlyPriceCents: 0,
      setupFeeCents: 5000,
      status: 'REQUIRES_REVIEW' as const,
      intakeSnapshot: {
        step1: {
          fullName: 'Miguel Torres',
          email: 'miguel.demo@waas-seed.test',
          whatsapp: '+18095550004',
          businessName: 'Sabores Dominicanos',
          industry: 'gastronomia',
          location: 'La Romana',
        },
        step2: { features: ['checkout', 'catalog'], materialStatus: 'no_tiene_nada' },
        step3: { wantsOwnership: true },
      } as schema.NewProject['intakeSnapshot'],
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
  ];

  const insertedProjects = await db
    .insert(schema.projects)
    .values(projectDefs)
    .returning();

  console.log(`   ✓ ${insertedProjects.length} proyectos\n`);

  // ── 3. Insertar project events ─────────────────────────
  console.log('📋  Insertando event logs...');

  const events: schema.NewProjectEvent[] = [];

  const p1 = insertedProjects[0]; // AWAITING_ASSETS
  const p2 = insertedProjects[1]; // ASSETS_UNDER_REVIEW
  const p3 = insertedProjects[2]; // STAGING_REVIEW
  const p4 = insertedProjects[3]; // REQUIRES_REVIEW

  // Proyecto 1 events
  events.push(
    { projectId: p1.id, eventType: 'status_changed', actorType: 'system', fromStatus: 'DRAFT', toStatus: 'PAYMENT_RECEIVED', createdAt: daysAgo(5) },
    { projectId: p1.id, eventType: 'payment_received', actorType: 'system', metadata: { paypalOrderId: 'DEMO-ORDER-001' }, createdAt: daysAgo(5) },
    { projectId: p1.id, eventType: 'status_changed', actorType: 'system', fromStatus: 'PAYMENT_RECEIVED', toStatus: 'AWAITING_ASSETS', createdAt: daysAgo(4) },
    { projectId: p1.id, eventType: 'email_sent', actorType: 'system', metadata: { template: 'E03 Bienvenida + acceso portal' }, createdAt: daysAgo(4) },
  );

  // Proyecto 2 events
  events.push(
    { projectId: p2.id, eventType: 'status_changed', actorType: 'system', fromStatus: 'DRAFT', toStatus: 'PAYMENT_RECEIVED', createdAt: daysAgo(10) },
    { projectId: p2.id, eventType: 'payment_received', actorType: 'system', metadata: { paypalOrderId: 'DEMO-ORDER-002' }, createdAt: daysAgo(10) },
    { projectId: p2.id, eventType: 'status_changed', actorType: 'system', fromStatus: 'PAYMENT_RECEIVED', toStatus: 'AWAITING_ASSETS', createdAt: daysAgo(9) },
    { projectId: p2.id, eventType: 'asset_uploaded', actorType: 'client', assetKey: 'logo', createdAt: daysAgo(7) },
    { projectId: p2.id, eventType: 'asset_uploaded', actorType: 'client', assetKey: 'brief', createdAt: daysAgo(6) },
    { projectId: p2.id, eventType: 'assets_submitted_for_review', actorType: 'client', fromStatus: 'AWAITING_ASSETS', toStatus: 'ASSETS_SUBMITTED', createdAt: daysAgo(5) },
    { projectId: p2.id, eventType: 'status_changed', actorType: 'admin', fromStatus: 'ASSETS_SUBMITTED', toStatus: 'ASSETS_UNDER_REVIEW', createdAt: daysAgo(2) },
  );

  // Proyecto 3 events
  events.push(
    { projectId: p3.id, eventType: 'status_changed', actorType: 'system', fromStatus: 'DRAFT', toStatus: 'PAYMENT_RECEIVED', createdAt: daysAgo(20) },
    { projectId: p3.id, eventType: 'payment_received', actorType: 'system', metadata: { paypalOrderId: 'DEMO-ORDER-003' }, createdAt: daysAgo(20) },
    { projectId: p3.id, eventType: 'status_changed', actorType: 'system', fromStatus: 'PAYMENT_RECEIVED', toStatus: 'AWAITING_ASSETS', createdAt: daysAgo(19) },
    { projectId: p3.id, eventType: 'asset_uploaded', actorType: 'client', assetKey: 'logo', createdAt: daysAgo(17) },
    { projectId: p3.id, eventType: 'asset_uploaded', actorType: 'client', assetKey: 'photos', createdAt: daysAgo(17) },
    { projectId: p3.id, eventType: 'asset_uploaded', actorType: 'client', assetKey: 'brief', createdAt: daysAgo(16) },
    { projectId: p3.id, eventType: 'asset_uploaded', actorType: 'client', assetKey: 'product_data', createdAt: daysAgo(16) },
    { projectId: p3.id, eventType: 'assets_submitted_for_review', actorType: 'client', fromStatus: 'AWAITING_ASSETS', toStatus: 'ASSETS_SUBMITTED', createdAt: daysAgo(15) },
    { projectId: p3.id, eventType: 'status_changed', actorType: 'admin', fromStatus: 'ASSETS_SUBMITTED', toStatus: 'ASSETS_UNDER_REVIEW', createdAt: daysAgo(14) },
    { projectId: p3.id, eventType: 'status_changed', actorType: 'admin', fromStatus: 'ASSETS_UNDER_REVIEW', toStatus: 'PRODUCTION_STARTED', createdAt: daysAgo(10) },
    { projectId: p3.id, eventType: 'production_started', actorType: 'admin', createdAt: daysAgo(10) },
    { projectId: p3.id, eventType: 'staging_deployed', actorType: 'admin', metadata: { stagingUrl: 'https://ana-rodriguez-legal-demo.vercel.app' }, createdAt: daysAgo(1) },
    { projectId: p3.id, eventType: 'status_changed', actorType: 'admin', fromStatus: 'PRODUCTION_STARTED', toStatus: 'STAGING_REVIEW', createdAt: daysAgo(1) },
  );

  // Proyecto 4 events
  events.push(
    { projectId: p4.id, eventType: 'status_changed', actorType: 'system', fromStatus: 'DRAFT', toStatus: 'REQUIRES_REVIEW', createdAt: daysAgo(3) },
    { projectId: p4.id, eventType: 'email_sent', actorType: 'system', metadata: { template: 'E02 Consulta LEGACY recibida' }, createdAt: daysAgo(3) },
  );

  await db.insert(schema.projectEvents).values(events);
  console.log(`   ✓ ${events.length} eventos\n`);

  // ── 4. Insertar incidencias ────────────────────────────
  console.log('🚨  Insertando incidencias...');

  const incidentDefs: schema.NewIncident[] = [
    {
      projectId: p3.id, // Ana en staging — incidencia abierta por cliente
      title: 'El formulario de contacto no envía',
      description: 'Al hacer clic en "Enviar" en el formulario de la página de inicio, no recibo el email de confirmación. He probado con Gmail y Hotmail.',
      status: 'OPEN',
      reportedBy: 'CLIENT',
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      projectId: p1.id, // Laura en awaiting assets — incidencia de sistema
      title: 'Acceso al portal bloqueado',
      description: 'El sistema detectó que el enlace mágico de Clerk expiró sin que el cliente completara el registro. Requiere reenvío manual.',
      status: 'IN_PROGRESS',
      reportedBy: 'SYSTEM',
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
    },
  ];

  const insertedIncidents = await db
    .insert(schema.incidents)
    .values(incidentDefs)
    .returning();
  console.log(`   ✓ ${insertedIncidents.length} incidencias\n`);

  // ── 5. Insertar cotización LEGACY ──────────────────────
  console.log('💰  Insertando cotización demo...');

  const thirtyDaysFromNow = daysFromNow(30);
  const quoteComponents = [
    { name: 'Diseño web a medida (LEGACY)', unitPrice: 1500, quantity: 1, subtotal: 1500 },
    { name: 'Tienda online + pasarela de pago', unitPrice: 400, quantity: 1, subtotal: 400 },
    { name: 'Catálogo de productos (hasta 50)', unitPrice: 200, quantity: 1, subtotal: 200 },
    { name: 'Dominio .com (1 año)', unitPrice: 15, quantity: 1, subtotal: 15 },
    { name: 'Hosting Premium (1 año)', unitPrice: 120, quantity: 1, subtotal: 120 },
  ];

  const totalClient = quoteComponents.reduce((sum, c) => sum + c.subtotal, 0); // $2235
  const totalProvider = totalClient * 0.72; // ~$1609 neto

  const insertedQuote = await db
    .insert(schema.quotes)
    .values({
      clientName: 'Persona Demo (seed)',
      businessName: 'Sabores Dominicanos',
      projectType: 'legacy',
      niche: 'gastronomia',
      domainTarget: 'saboresdominicanosrd.com',
      status: 'draft',
      totalAmountClient: totalClient,
      totalAmountProvider: totalProvider,
      discountPercent: 0,
      componentsSnapshot: quoteComponents,
      calculationSnapshot: {
        subtotal: totalClient,
        discountAmount: 0,
        total: totalClient,
        providerNet: totalProvider,
        marginPercent: 28,
      },
      proposalHtml: `<h1>Propuesta WaaS LEGACY</h1><p>Sitio web completo para <strong>Sabores Dominicanos</strong> en La Romana. Incluye tienda online, catálogo de productos y dominio premium.</p>`,
      executiveSummary: 'Solución web completa para restaurante con e-commerce y catálogo de 50 productos. Entrega en 30 días hábiles.',
      subscriptionPlan: null,
      internalNotes: 'Cliente sin materiales — cotizar Add-on C01 Copywriting + banco de imágenes.',
      validUntil: thirtyDaysFromNow,
    })
    .returning();

  console.log(`   ✓ 1 cotización (ID: ${insertedQuote[0].id})\n`);

  // ── Resumen ────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅  Seed completado:\n');
  console.log(`   Clientes:     ${clientRows.length}`);
  console.log(`   Proyectos:    ${insertedProjects.length}`);
  console.log('     • Laura Medina    → AWAITING_ASSETS  (BASIC $49/mo)');
  console.log('     • Carlos Jiménez  → ASSETS_UNDER_REVIEW (PRO $89/mo)');
  console.log('     • Ana Rodríguez   → STAGING_REVIEW   (BUSINESS $139/mo)');
  console.log('     • Miguel Torres   → REQUIRES_REVIEW  (LEGACY custom)');
  console.log(`   Eventos:      ${events.length}`);
  console.log(`   Incidencias:  ${insertedIncidents.length}`);
  console.log(`   Cotizaciones: 1`);
  console.log('\n   🔗 Admin: http://localhost:3000/admin/proyectos');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((err) => {
  console.error('❌  Seed falló:', err);
  process.exit(1);
});
