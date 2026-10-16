import 'dotenv/config';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { and, eq } from 'drizzle-orm';
import catalogDefaults from '../src/db/seeds/catalog-defaults.json';
import * as schema from '../src/db/schema';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.test.local', override: true });

// IDs de los usuarios de prueba creados en tu instancia de Clerk (ver .env.example).
const QA_ADMIN_CLERK_USER_ID = process.env.QA_ADMIN_CLERK_USER_ID ?? '';
const QA_CLIENT_CLERK_USER_ID = process.env.QA_CLIENT_CLERK_USER_ID ?? '';
const QA_CLIENT_EMAIL = 'qa-client+clerk_test@example.com';
const QA_SECONDARY_CLIENT_EMAIL = 'qa-secondary-client+clerk_test@example.com';

const QA_PROJECT_DOMAIN = 'qa-catalog-project.test';
const QA_ASSETS_DOMAIN = 'qa-assets-project.test';
const QA_INCOMPLETE_DOMAIN = 'qa-assets-incomplete.test';
const QA_STAGING_DOMAIN = 'qa-staging-review.test';
const QA_LIVE_INCIDENTS_DOMAIN = 'qa-live-incidents.test';
const QA_OTHER_CLIENT_DOMAIN = 'qa-other-client-project.test';

const QA_CATEGORY_ID = 'qa_catalog_e2e';
const QA_ITEM_CODES = ['QA01', 'QA02', 'QA03'] as const;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to seed E2E auth fixtures.');
}
if (!QA_ADMIN_CLERK_USER_ID || !QA_CLIENT_CLERK_USER_ID) {
  throw new Error('QA_ADMIN_CLERK_USER_ID and QA_CLIENT_CLERK_USER_ID are required (Clerk user ids of the QA users).');
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });

async function ensureDbCompatibility() {
  const requiredTables = [
    'portal_categories',
    'addon_catalog',
    'addon_catalog_plan_rules',
    'project_capability_usage',
    'project_assets',
    'incidents',
  ];
  const missingTables: string[] = [];

  for (const table of requiredTables) {
    const [row] = await sql<{ exists: boolean }[]>`
      select to_regclass(${table}) is not null as exists
    `;
    if (!row?.exists) missingTables.push(table);
  }

  const [warrantyColumn] = await sql<{ exists: boolean }[]>`
    select exists (
      select 1
      from information_schema.columns
      where table_name = 'projects'
        and column_name = 'post_launch_warranty_ends_at'
    ) as exists
  `;

  const missingColumns = warrantyColumn?.exists ? [] : ['projects.post_launch_warranty_ends_at'];

  if (missingTables.length > 0 || missingColumns.length > 0) {
    throw new Error(
      [
        'La DB no tiene aplicado el schema V3 del catalogo requerido para E2E auth.',
        missingTables.length ? `Tablas faltantes: ${missingTables.join(', ')}` : null,
        missingColumns.length ? `Columnas faltantes: ${missingColumns.join(', ')}` : null,
        'Aplica la migracion/schema push con aprobacion explicita antes de sembrar fixtures QA.',
      ].filter(Boolean).join(' '),
    );
  }
}

async function upsertAdmin() {
  const [admin] = await db
    .insert(schema.admins)
    .values({ clerkUserId: QA_ADMIN_CLERK_USER_ID })
    .onConflictDoUpdate({
      target: schema.admins.clerkUserId,
      set: { clerkUserId: QA_ADMIN_CLERK_USER_ID },
    })
    .returning({ id: schema.admins.id });

  return admin;
}

async function upsertClient() {
  const values: schema.NewClient = {
    clerkUserId: QA_CLIENT_CLERK_USER_ID,
    email: QA_CLIENT_EMAIL,
    fullName: 'QA Client',
    whatsapp: '+18095550099',
    businessName: 'QA Catalog Project',
    industry: 'gastronomia',
    location: 'Santo Domingo, RD',
    materialStatus: 'tiene_todo',
    updatedAt: new Date(),
  };

  const [client] = await db
    .insert(schema.clients)
    .values(values)
    .onConflictDoUpdate({
      target: schema.clients.email,
      set: values,
    })
    .returning({ id: schema.clients.id });

  return client;
}

async function upsertSecondaryClient() {
  const values: schema.NewClient = {
    clerkUserId: null,
    email: QA_SECONDARY_CLIENT_EMAIL,
    fullName: 'QA Secondary Client',
    whatsapp: '+18095550088',
    businessName: 'QA Secondary Business',
    industry: 'gastronomia',
    location: 'Santiago, RD',
    materialStatus: 'tiene_todo',
    updatedAt: new Date(),
  };

  const [client] = await db
    .insert(schema.clients)
    .values(values)
    .onConflictDoUpdate({
      target: schema.clients.email,
      set: values,
    })
    .returning({ id: schema.clients.id });

  return client;
}

async function upsertAssetsProject(clientId: string) {
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  const [existing] = await sql<{ id: string }[]>`
    select id from projects
    where client_id = ${clientId} and domain_target = ${QA_ASSETS_DOMAIN}
    limit 1
  `;

  if (existing) {
    const [project] = await sql<{ id: string }[]>`
      update projects
      set plan = ${'BASIC'}, monthly_price_cents = ${4900}, setup_fee_cents = ${0},
          status = ${'AWAITING_ASSETS'}, updated_at = ${now}
      where id = ${existing.id}
      returning id
    `;
    return project;
  }

  const [project] = await sql<{ id: string }[]>`
    insert into projects (
      client_id, plan, monthly_price_cents, setup_fee_cents, status,
      domain_target, internal_notes, updated_at, created_at
    ) values (
      ${clientId}, ${'BASIC'}, ${4900}, ${0}, ${'AWAITING_ASSETS'},
      ${QA_ASSETS_DOMAIN},
      ${'QA E2E assets fixture - safe to reuse, do not delete automatically.'},
      ${now}, ${twoDaysAgo}
    )
    returning id
  `;

  return project;
}

async function upsertIncompleteProject(clientId: string) {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

  const [existing] = await sql<{ id: string }[]>`
    select id from projects
    where client_id = ${clientId} and domain_target = ${QA_INCOMPLETE_DOMAIN}
    limit 1
  `;

  if (existing) {
    const [project] = await sql<{ id: string }[]>`
      update projects
      set plan = ${'BASIC'}, monthly_price_cents = ${4900}, setup_fee_cents = ${0},
          status = ${'ASSETS_INCOMPLETE'}, updated_at = ${now}
      where id = ${existing.id}
      returning id
    `;
    return project;
  }

  const [project] = await sql<{ id: string }[]>`
    insert into projects (
      client_id, plan, monthly_price_cents, setup_fee_cents, status,
      domain_target, internal_notes, updated_at, created_at
    ) values (
      ${clientId}, ${'BASIC'}, ${4900}, ${0}, ${'ASSETS_INCOMPLETE'},
      ${QA_INCOMPLETE_DOMAIN},
      ${'QA E2E ASSETS_INCOMPLETE fixture - has mixed asset states for re-upload testing.'},
      ${now}, ${oneDayAgo}
    )
    returning id
  `;

  return project;
}

async function upsertProjectAssetsForIncomplete(projectId: string) {
  const now = new Date();

  // logo: approved (upload must be blocked)
  await sql`
    insert into project_assets (
      id, project_id, asset_key, status, file_index,
      r2_key, original_name, reviewed_at, uploaded_at, created_at, updated_at
    ) values (
      gen_random_uuid(), ${projectId}, ${'logo'}, ${'approved'}, 0,
      ${'qa-fixtures/qa-logo.png'}, ${'qa-logo.png'}, ${now}, ${now}, ${now}, ${now}
    )
    on conflict (project_id, asset_key, file_index) do update set
      status = ${'approved'},
      r2_key = ${'qa-fixtures/qa-logo.png'},
      original_name = ${'qa-logo.png'},
      rejection_comment = null,
      reviewed_at = ${now},
      uploaded_at = ${now},
      updated_at = ${now}
  `;

  // photos[0]: rejected with comment (upload must be allowed)
  await sql`
    insert into project_assets (
      id, project_id, asset_key, status, file_index,
      r2_key, original_name, rejection_comment, reviewed_at, uploaded_at, created_at, updated_at
    ) values (
      gen_random_uuid(), ${projectId}, ${'photos'}, ${'rejected'}, 0,
      ${'qa-fixtures/qa-photo1.jpg'}, ${'qa-photo1.jpg'},
      ${'Las fotos son demasiado oscuras, por favor sube fotos más iluminadas.'},
      ${now}, ${now}, ${now}, ${now}
    )
    on conflict (project_id, asset_key, file_index) do update set
      status = ${'rejected'},
      r2_key = ${'qa-fixtures/qa-photo1.jpg'},
      original_name = ${'qa-photo1.jpg'},
      rejection_comment = ${'Las fotos son demasiado oscuras, por favor sube fotos más iluminadas.'},
      reviewed_at = ${now},
      uploaded_at = ${now},
      updated_at = ${now}
  `;

  // copy_doc[0]: uploaded (upload must be blocked in ASSETS_INCOMPLETE)
  await sql`
    insert into project_assets (
      id, project_id, asset_key, status, file_index,
      r2_key, original_name, uploaded_at, created_at, updated_at
    ) values (
      gen_random_uuid(), ${projectId}, ${'copy_doc'}, ${'uploaded'}, 0,
      ${'qa-fixtures/qa-copy.docx'}, ${'qa-copy.docx'},
      ${now}, ${now}, ${now}
    )
    on conflict (project_id, asset_key, file_index) do update set
      status = ${'uploaded'},
      r2_key = ${'qa-fixtures/qa-copy.docx'},
      original_name = ${'qa-copy.docx'},
      rejection_comment = null,
      uploaded_at = ${now},
      updated_at = ${now}
  `;
  // brief: no record → defaults to 'pending' in AssetRow
}

async function upsertStagingProject(clientId: string) {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [existing] = await sql<{ id: string }[]>`
    select id from projects
    where client_id = ${clientId} and domain_target = ${QA_STAGING_DOMAIN}
    limit 1
  `;

  if (existing) {
    const [project] = await sql<{ id: string }[]>`
      update projects
      set plan = ${'BASIC'}, monthly_price_cents = ${4900}, setup_fee_cents = ${0},
          status = ${'STAGING_REVIEW'},
          staging_url = ${'https://qa-staging-review.example.com'},
          staging_review_deadline_at = ${threeDaysFromNow},
          updated_at = ${now}
      where id = ${existing.id}
      returning id
    `;
    return project;
  }

  const [project] = await sql<{ id: string }[]>`
    insert into projects (
      client_id, plan, monthly_price_cents, setup_fee_cents, status,
      domain_target, staging_url, staging_review_deadline_at, internal_notes, updated_at, created_at
    ) values (
      ${clientId}, ${'BASIC'}, ${4900}, ${0}, ${'STAGING_REVIEW'},
      ${QA_STAGING_DOMAIN},
      ${'https://qa-staging-review.example.com'},
      ${threeDaysFromNow},
      ${'QA E2E STAGING_REVIEW fixture - for staging review flow testing.'},
      ${now}, ${now}
    )
    returning id
  `;

  return project;
}

async function upsertLiveIncidentsProject(clientId: string) {
  const now = new Date();

  const [existing] = await sql<{ id: string }[]>`
    select id from projects
    where client_id = ${clientId} and domain_target = ${QA_LIVE_INCIDENTS_DOMAIN}
    limit 1
  `;

  if (existing) {
    const [project] = await sql<{ id: string }[]>`
      update projects
      set plan = ${'BASIC'}, monthly_price_cents = ${4900}, setup_fee_cents = ${0},
          status = ${'LIVE'},
          production_url = ${'https://qa-live-incidents.example.com'},
          live_at = ${now},
          updated_at = ${now}
      where id = ${existing.id}
      returning id
    `;
    return project;
  }

  const [project] = await sql<{ id: string }[]>`
    insert into projects (
      client_id, plan, monthly_price_cents, setup_fee_cents, status,
      domain_target, production_url, live_at, internal_notes, updated_at, created_at
    ) values (
      ${clientId}, ${'BASIC'}, ${4900}, ${0}, ${'LIVE'},
      ${QA_LIVE_INCIDENTS_DOMAIN},
      ${'https://qa-live-incidents.example.com'},
      ${now},
      ${'QA E2E LIVE+incidents fixture - for incidencias flow testing.'},
      ${now}, ${now}
    )
    returning id
  `;

  return project;
}

async function upsertIncidentForProject(projectId: string) {
  // Check if QA incident already exists
  const [existing] = await sql<{ id: string }[]>`
    select id from incidents
    where project_id = ${projectId}
      and title = ${'QA Test Incident E2E'}
    limit 1
  `;

  if (existing) return existing;

  const [incident] = await sql<{ id: string }[]>`
    insert into incidents (
      id, project_id, title, description, status, severity, reported_by,
      notify_client_on_resolve, created_at, updated_at
    ) values (
      gen_random_uuid(), ${projectId},
      ${'QA Test Incident E2E'},
      ${'Incidencia de prueba generada por el seed E2E. Seguro ignorar.'},
      ${'OPEN'}, ${'P3'}, ${'CLIENT'},
      true, now(), now()
    )
    returning id
  `;

  return incident;
}

async function upsertOtherClientProject(secondaryClientId: string) {
  const now = new Date();

  const [existing] = await sql<{ id: string }[]>`
    select id from projects
    where client_id = ${secondaryClientId} and domain_target = ${QA_OTHER_CLIENT_DOMAIN}
    limit 1
  `;

  if (existing) {
    const [project] = await sql<{ id: string }[]>`
      update projects
      set plan = ${'BASIC'}, monthly_price_cents = ${4900}, setup_fee_cents = ${0},
          status = ${'LIVE'},
          production_url = ${'https://qa-other-client.example.com'},
          live_at = ${now},
          updated_at = ${now}
      where id = ${existing.id}
      returning id
    `;
    return project;
  }

  const [project] = await sql<{ id: string }[]>`
    insert into projects (
      client_id, plan, monthly_price_cents, setup_fee_cents, status,
      domain_target, production_url, live_at, internal_notes, updated_at, created_at
    ) values (
      ${secondaryClientId}, ${'BASIC'}, ${4900}, ${0}, ${'LIVE'},
      ${QA_OTHER_CLIENT_DOMAIN},
      ${'https://qa-other-client.example.com'},
      ${now},
      ${'QA E2E security-isolation fixture - belongs to secondary client, never QA primary.'},
      ${now}, ${now}
    )
    returning id
  `;

  return project;
}

async function upsertProject(clientId: string) {
  const now = new Date();
  const intakeSnapshot = {
    fullName: 'QA Client',
    email: QA_CLIENT_EMAIL,
    whatsapp: '+18095550099',
    businessName: 'QA Catalog Project',
    industry: 'gastronomia',
    location: 'Santo Domingo, RD',
    materialStatus: 'tiene_todo',
    features: {
      needsBooking: false,
      needsCatalog: true,
      needsCheckout: true,
      needsBlog: false,
      wantsOwnership: false,
      needsCrmIntegration: false,
      needsMultiEmployeeCalendar: false,
    },
  };
  const [existing] = await sql<{ id: string }[]>`
    select id from projects
    where client_id = ${clientId} and domain_target = ${QA_PROJECT_DOMAIN}
    limit 1
  `;

  if (existing) {
    const [project] = await sql<{ id: string }[]>`
      update projects
      set
        plan = ${'BUSINESS'},
        monthly_price_cents = ${13900},
        setup_fee_cents = ${5000},
        suggested_add_ons = null,
        status = ${'LIVE'},
        intake_snapshot = ${JSON.stringify(intakeSnapshot)}::jsonb,
        domain_target = ${QA_PROJECT_DOMAIN},
        production_url = ${'https://qa-catalog-project.example.com'},
        live_at = ${now},
        terms_accepted_at = ${now},
        terms_version = ${'1.0'},
        internal_notes = ${'QA E2E auth fixture - safe to reuse, do not delete automatically.'},
        updated_at = ${now}
      where id = ${existing.id}
      returning id
    `;
    return project;
  }

  const [project] = await sql<{ id: string }[]>`
    insert into projects (
      client_id, plan, monthly_price_cents, setup_fee_cents, suggested_add_ons,
      status, intake_snapshot, domain_target, production_url, live_at,
      terms_accepted_at, terms_version, internal_notes, updated_at
    ) values (
      ${clientId}, ${'BUSINESS'}, ${13900}, ${5000}, null,
      ${'LIVE'},
      ${JSON.stringify(intakeSnapshot)}::jsonb,
      ${QA_PROJECT_DOMAIN},
      ${'https://qa-catalog-project.example.com'},
      ${now}, ${now}, ${'1.0'},
      ${'QA E2E auth fixture - safe to reuse, do not delete automatically.'},
      ${now}
    )
    returning id
  `;

  return project;
}

async function upsertQaCatalog() {
  await db
    .insert(schema.portalCategories)
    .values({
      id: QA_CATEGORY_ID,
      name: 'qa_catalog_e2e',
      publicName: 'QA Catalog E2E',
      description: 'Capacidades de prueba para validar E2E autenticado.',
      icon: 'check-circle',
      sortOrder: 999,
      active: true,
      visibilityRule: 'always',
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.portalCategories.id,
      set: {
        publicName: 'QA Catalog E2E',
        description: 'Capacidades de prueba para validar E2E autenticado.',
        icon: 'check-circle',
        sortOrder: 999,
        active: true,
        visibilityRule: 'always',
        updatedAt: new Date(),
      },
    });

  const itemDefs: schema.NewAddonCatalogItem[] = [
    {
      code: 'QA01',
      name: 'QA E2E Included Change',
      description: 'Fixture incluido para pruebas E2E.',
      publicName: 'QA cambio incluido',
      publicDescription: 'Cambio incluido para validar preview del portal.',
      priceCents: 0,
      listPriceCents: 2500,
      pricingMode: 'included',
      category: 'revision',
      source: 'manual',
      active: true,
      visibleInCalculator: true,
      visibleInTickets: true,
      visibleInProposals: true,
      visibleInPortal: true,
      portalCategoryId: QA_CATEGORY_ID,
      sortOrder: 1,
      adminNotes: 'QA E2E auth fixture.',
      dependencies: [],
      conflicts: [],
      updatedAt: new Date(),
    },
    {
      code: 'QA02',
      name: 'QA E2E Paid Add-on',
      description: 'Fixture pagado para pruebas E2E.',
      publicName: 'QA add-on pagado',
      publicDescription: 'Add-on pagado para validar catalogo comercial.',
      priceCents: 4900,
      listPriceCents: 4900,
      pricingMode: 'fixed',
      category: 'design',
      source: 'manual',
      active: true,
      visibleInCalculator: true,
      visibleInTickets: true,
      visibleInProposals: true,
      visibleInPortal: true,
      portalCategoryId: QA_CATEGORY_ID,
      sortOrder: 2,
      adminNotes: 'QA E2E auth fixture.',
      dependencies: [],
      conflicts: [],
      updatedAt: new Date(),
    },
    {
      code: 'QA03',
      name: 'QA E2E Quote Add-on',
      description: 'Fixture cotizable para pruebas E2E.',
      publicName: 'QA cotizacion',
      publicDescription: 'Capacidad cotizable para validar decision de catalogo.',
      priceCents: 0,
      listPriceCents: 9900,
      pricingMode: 'quote',
      category: 'integration',
      source: 'manual',
      active: true,
      visibleInCalculator: true,
      visibleInTickets: true,
      visibleInProposals: true,
      visibleInPortal: true,
      portalCategoryId: QA_CATEGORY_ID,
      sortOrder: 3,
      adminNotes: 'QA E2E auth fixture.',
      dependencies: [],
      conflicts: [],
      updatedAt: new Date(),
    },
  ];

  const itemIds: Record<string, string> = {};
  for (const item of itemDefs) {
    const [row] = await db
      .insert(schema.addonCatalog)
      .values(item)
      .onConflictDoUpdate({
        target: schema.addonCatalog.code,
        set: item,
      })
      .returning({ id: schema.addonCatalog.id, code: schema.addonCatalog.code });
    itemIds[row.code] = row.id;
  }

  for (const code of QA_ITEM_CODES) {
    const addonCatalogId = itemIds[code];
    const availability = code === 'QA01' ? 'included' : code === 'QA02' ? 'paid' : 'quote';
    const inclusionScope = code === 'QA01' ? 'recurring_allowance' : null;
    const recurringIncludedQty = code === 'QA01' ? 3 : 0;

    for (const plan of ['PRO', 'BUSINESS'] as const) {
      await db
        .insert(schema.addonCatalogPlanRules)
        .values({
          addonCatalogId,
          plan,
          availability,
          inclusionScope,
          initialIncludedQty: 0,
          recurringIncludedQty,
          recurringPeriod: code === 'QA01' ? 'calendar_month' : null,
          overageMode: code === 'QA01' ? 'paid' : 'unavailable',
          overageAddonCode: null,
          allowedRequestKinds: ['change', 'expansion', 'maintenance'],
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            schema.addonCatalogPlanRules.addonCatalogId,
            schema.addonCatalogPlanRules.plan,
          ],
          set: {
            availability,
            inclusionScope,
            initialIncludedQty: 0,
            recurringIncludedQty,
            recurringPeriod: code === 'QA01' ? 'calendar_month' : null,
            overageMode: code === 'QA01' ? 'paid' : 'unavailable',
            overageAddonCode: null,
            allowedRequestKinds: ['change', 'expansion', 'maintenance'],
            updatedAt: new Date(),
          },
        });
    }
  }
}

async function main() {
  await ensureDbCompatibility();
  const admin = await upsertAdmin();
  const client = await upsertClient();
  const secondaryClient = await upsertSecondaryClient();

  const assetsProject = await upsertAssetsProject(client.id);
  const incompleteProject = await upsertIncompleteProject(client.id);
  await upsertProjectAssetsForIncomplete(incompleteProject.id);

  const stagingProject = await upsertStagingProject(client.id);
  const liveIncidentsProject = await upsertLiveIncidentsProject(client.id);
  const incident = await upsertIncidentForProject(liveIncidentsProject.id);
  const otherProject = await upsertOtherClientProject(secondaryClient.id);
  const project = await upsertProject(client.id);

  await upsertQaCatalog();

  const visibleCategories = await db
    .select({ id: schema.portalCategories.id })
    .from(schema.portalCategories)
    .where(eq(schema.portalCategories.active, true));

  const visibleItems = await db
    .select({ id: schema.addonCatalog.id })
    .from(schema.addonCatalog)
    .where(
      and(
        eq(schema.addonCatalog.active, true),
        eq(schema.addonCatalog.visibleInPortal, true),
        eq(schema.addonCatalog.portalCategoryId, QA_CATEGORY_ID),
      ),
    );

  // Write fixture IDs to JSON for E2E helpers
  const fixtures = {
    catalogProjectId: project.id,
    assetsProjectId: assetsProject.id,
    incompleteProjectId: incompleteProject.id,
    stagingProjectId: stagingProject.id,
    liveIncidentsProjectId: liveIncidentsProject.id,
    otherProjectId: otherProject.id,
  };

  const fixturesPath = path.join(__dirname, '../tests/e2e/.fixtures.json');
  fs.writeFileSync(fixturesPath, JSON.stringify(fixtures, null, 2));

  console.log('E2E auth fixture ready');
  console.log(`adminId: ${admin.id}`);
  console.log(`clientId: ${client.id}`);
  console.log(`secondaryClientId: ${secondaryClient.id}`);
  console.log(`catalogProjectId: ${project.id}`);
  console.log(`assetsProjectId: ${assetsProject.id}`);
  console.log(`incompleteProjectId: ${incompleteProject.id}`);
  console.log(`stagingProjectId: ${stagingProject.id}`);
  console.log(`liveIncidentsProjectId: ${liveIncidentsProject.id}`);
  console.log(`incidentId: ${incident.id}`);
  console.log(`otherProjectId: ${otherProject.id}`);
  console.log(`visibleCategories: ${visibleCategories.length}`);
  console.log(`visibleItems: ${visibleItems.length}`);
  console.log(`catalogDefaultsVersion: ${catalogDefaults.seedVersion}`);
  console.log(`fixtures written to: ${fixturesPath}`);
}

main().catch((error: unknown) => {
  const err = error as {
    code?: string;
    detail?: string;
    constraint?: string;
    cause?: { code?: string; message?: string; detail?: string; constraint?: string };
  };
  console.error('E2E auth fixture seed failed');
  if (err.code || err.cause?.code) console.error(`code: ${err.code ?? err.cause?.code}`);
  if (err.constraint || err.cause?.constraint) console.error(`constraint: ${err.constraint ?? err.cause?.constraint}`);
  if (err.detail || err.cause?.detail) console.error(`detail: ${err.detail ?? err.cause?.detail}`);
  if (error instanceof Error) console.error(`message: ${error.message}`);
  if (err.cause?.message && err.cause.message !== (error instanceof Error ? error.message : '')) {
    console.error(`cause: ${err.cause.message}`);
  }
  process.exit(1);
});
