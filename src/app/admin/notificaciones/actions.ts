'use server';

import { auth } from '@clerk/nextjs/server';
import { and, desc, eq, inArray, lt, ne, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import {
  adminNotificationPreferences,
  adminNotificationReads,
  adminReminders,
  admins,
  clients,
  incidents,
  projectEvents,
  projects,
  tickets,
} from '@/db/schema';

export type AdminNotificationType = 'sla' | 'p1' | 'assets' | 'ticket' | 'payment' | 'staging' | 'proposal';

export type AdminNotification = {
  key: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  time: string;
  href: string;
  read: boolean;
};

type ReminderPriority = 'alta' | 'media' | 'baja';
type ReminderRecurrence = 'none' | 'weekly' | 'monthly';

export type AdminReminderRow = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: ReminderPriority;
  client: string;
  recurrence: ReminderRecurrence;
  done: boolean;
};

export type NotificationPreferenceRow = {
  key: string;
  emailEnabled: boolean;
};

async function assertAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error('No autorizado.');

  const [admin] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(eq(admins.clerkUserId, userId))
    .limit(1);

  if (!admin) throw new Error('No autorizado.');
  return admin;
}

async function assertAdminUser() {
  const { userId } = await auth();
  if (!userId) throw new Error('No autorizado.');
  if (userId === process.env.ADMIN_CLERK_USER_ID) return;

  const [admin] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(eq(admins.clerkUserId, userId))
    .limit(1);

  if (!admin) throw new Error('No autorizado.');
}

export async function getAdminNavMetrics() {
  await assertAdminUser();

  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const [queueRows, liveRows, urgentRows, pendingTicketRows] = await Promise.all([
    db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(projects)
      .where(inArray(projects.status, ['ASSETS_SUBMITTED', 'ASSETS_UNDER_REVIEW'])),
    db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(projects)
      .where(eq(projects.status, 'LIVE' as const)),
    db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(incidents)
      .where(and(ne(incidents.status, 'RESOLVED'), lt(incidents.createdAt, fourHoursAgo)))
      .catch(() => [{ count: 0 }]),
    db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(tickets)
      .where(eq(tickets.status, 'PENDING_APPROVAL' as const))
      .catch(() => [{ count: 0 }]),
  ]);

  return {
    queueCount: queueRows[0]?.count ?? 0,
    liveClientsCount: liveRows[0]?.count ?? 0,
    urgentIncidents: urgentRows[0]?.count ?? 0,
    pendingTicketsCount: pendingTicketRows[0]?.count ?? 0,
    unreadNotifications: 0,
  };
}

async function buildNotifications(adminId: string): Promise<AdminNotification[]> {
  const now = new Date();
  const twelveHoursFromNow = new Date(now.getTime() + 12 * 60 * 60 * 1000);

  const [readRows, incidentRows, ticketRows, slaRows, assetRows, paymentRows] = await Promise.all([
    db
      .select({ notificationKey: adminNotificationReads.notificationKey })
      .from(adminNotificationReads)
      .where(eq(adminNotificationReads.adminId, adminId)),

    db
      .select({
        id: incidents.id,
        title: incidents.title,
        severity: incidents.severity,
        status: incidents.status,
        createdAt: incidents.createdAt,
        projectId: incidents.projectId,
        businessName: clients.businessName,
        clientName: clients.fullName,
      })
      .from(incidents)
      .innerJoin(projects, eq(incidents.projectId, projects.id))
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(ne(incidents.status, 'RESOLVED'))
      .orderBy(desc(incidents.createdAt))
      .limit(25),

    db
      .select({
        id: tickets.id,
        title: tickets.title,
        createdAt: tickets.createdAt,
        projectId: tickets.projectId,
        businessName: clients.businessName,
        clientName: clients.fullName,
      })
      .from(tickets)
      .innerJoin(projects, eq(tickets.projectId, projects.id))
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(eq(tickets.status, 'PENDING_APPROVAL'))
      .orderBy(desc(tickets.createdAt))
      .limit(25),

    db
      .select({
        id: projects.id,
        status: projects.status,
        deadline: projects.productionDeadlineAt,
        businessName: clients.businessName,
        clientName: clients.fullName,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(
        and(
          inArray(projects.status, ['PRODUCTION_STARTED', 'STAGING_REVIEW', 'REVISIONS', 'REVISIONS_DONE']),
          lt(projects.productionDeadlineAt, twelveHoursFromNow),
        ),
      )
      .limit(25),

    db
      .select({
        id: projects.id,
        updatedAt: projects.updatedAt,
        businessName: clients.businessName,
        clientName: clients.fullName,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(eq(projects.status, 'ASSETS_SUBMITTED' as const))
      .orderBy(desc(projects.updatedAt))
      .limit(25),

    db
      .select({
        id: projectEvents.id,
        projectId: projectEvents.projectId,
        createdAt: projectEvents.createdAt,
        metadata: projectEvents.metadata,
        businessName: clients.businessName,
        clientName: clients.fullName,
      })
      .from(projectEvents)
      .innerJoin(projects, eq(projectEvents.projectId, projects.id))
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(eq(projectEvents.eventType, 'payment_received'))
      .orderBy(desc(projectEvents.createdAt))
      .limit(15),
  ]);

  const readKeys = new Set(readRows.map((row) => row.notificationKey));
  const notifications: Omit<AdminNotification, 'read'>[] = [
    ...incidentRows.map((incident) => ({
      key: `incident:${incident.id}`,
      type: incident.severity === 'P1' ? 'p1' as const : 'sla' as const,
      title: `${incident.severity} abierta — ${incident.businessName}`,
      message: `${incident.title} · ${incident.clientName}`,
      time: incident.createdAt.toISOString(),
      href: '/admin/incidencias',
    })),
    ...ticketRows.map((ticket) => ({
      key: `ticket:${ticket.id}`,
      type: 'ticket' as const,
      title: `Ticket pendiente — ${ticket.businessName}`,
      message: `${ticket.title} · ${ticket.clientName}`,
      time: ticket.createdAt.toISOString(),
      href: '/admin/tickets',
    })),
    ...slaRows.map((project) => ({
      key: `sla:${project.id}`,
      type: 'sla' as const,
      title: `SLA crítico — ${project.businessName}`,
      message: `Deadline de producción próximo · ${project.clientName}`,
      time: (project.deadline ?? now).toISOString(),
      href: `/admin/proyectos/${project.id}`,
    })),
    ...assetRows.map((project) => ({
      key: `assets:${project.id}`,
      type: 'assets' as const,
      title: `Assets listos — ${project.businessName}`,
      message: `${project.clientName} envió materiales para revisión.`,
      time: project.updatedAt.toISOString(),
      href: `/admin/proyectos/${project.id}`,
    })),
    ...paymentRows.map((event) => {
      const metadata = event.metadata && typeof event.metadata === 'object' ? event.metadata as Record<string, unknown> : {};
      const amount = typeof metadata.netAmount === 'number' ? metadata.netAmount : typeof metadata.amount === 'number' ? metadata.amount : null;
      return {
        key: `payment:${event.id}`,
        type: 'payment' as const,
        title: `Pago recibido — ${event.businessName}`,
        message: `${event.clientName}${amount ? ` · $${Math.round(amount).toLocaleString('en-US')}` : ''}`,
        time: event.createdAt.toISOString(),
        href: '/admin/facturacion?tab=cobros',
      };
    }),
  ];

  return notifications
    .map((notification) => ({ ...notification, read: readKeys.has(notification.key) }))
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

export async function getAdminNotifications() {
  const admin = await assertAdmin();
  return buildNotifications(admin.id);
}

export async function getAdminReminders() {
  const admin = await assertAdmin();

  const rows = await db
    .select()
    .from(adminReminders)
    .where(eq(adminReminders.adminId, admin.id))
    .orderBy(adminReminders.done, adminReminders.dueDate);

  return rows.map((row): AdminReminderRow => ({
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    dueDate: row.dueDate.toISOString().slice(0, 10),
    priority: row.priority,
    client: row.clientLabel ?? 'General',
    recurrence: row.recurrence,
    done: row.done,
  }));
}

export async function createAdminReminder(input: {
  title: string;
  description?: string;
  dueDate: string;
  priority: ReminderPriority;
  client?: string;
  recurrence: ReminderRecurrence;
}) {
  const admin = await assertAdmin();
  const title = input.title.trim();

  if (title.length < 3 || title.length > 140) {
    throw new Error('El título debe tener entre 3 y 140 caracteres.');
  }

  const dueDate = new Date(`${input.dueDate}T12:00:00.000Z`);
  if (Number.isNaN(dueDate.getTime())) {
    throw new Error('Fecha inválida.');
  }

  const [reminder] = await db
    .insert(adminReminders)
    .values({
      adminId: admin.id,
      title,
      description: input.description?.trim() || null,
      dueDate,
      priority: input.priority,
      clientLabel: input.client?.trim() || null,
      recurrence: input.recurrence,
    })
    .returning();

  revalidatePath('/admin/notificaciones');
  return { reminderId: reminder.id };
}

export async function completeAdminReminder(reminderId: string) {
  const admin = await assertAdmin();

  await db
    .update(adminReminders)
    .set({ done: true, completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(adminReminders.id, reminderId), eq(adminReminders.adminId, admin.id)));

  revalidatePath('/admin/notificaciones');
}

export async function postponeAdminReminder(reminderId: string, days = 2) {
  const admin = await assertAdmin();
  const [row] = await db
    .select({ dueDate: adminReminders.dueDate })
    .from(adminReminders)
    .where(and(eq(adminReminders.id, reminderId), eq(adminReminders.adminId, admin.id)))
    .limit(1);

  if (!row) return;

  const next = new Date(row.dueDate);
  next.setDate(next.getDate() + days);

  await db
    .update(adminReminders)
    .set({ dueDate: next, updatedAt: new Date() })
    .where(and(eq(adminReminders.id, reminderId), eq(adminReminders.adminId, admin.id)));

  revalidatePath('/admin/notificaciones');
}

export async function getNotificationPreferences(defaults: NotificationPreferenceRow[]) {
  const admin = await assertAdmin();
  const rows = await db
    .select({ preferenceKey: adminNotificationPreferences.preferenceKey, emailEnabled: adminNotificationPreferences.emailEnabled })
    .from(adminNotificationPreferences)
    .where(eq(adminNotificationPreferences.adminId, admin.id));

  const stored = new Map(rows.map((row) => [row.preferenceKey, row.emailEnabled]));
  return defaults.map((item) => ({
    key: item.key,
    emailEnabled: stored.get(item.key) ?? item.emailEnabled,
  }));
}

export async function setNotificationPreference(preferenceKey: string, emailEnabled: boolean) {
  const admin = await assertAdmin();

  await db
    .insert(adminNotificationPreferences)
    .values({ adminId: admin.id, preferenceKey, emailEnabled, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [adminNotificationPreferences.adminId, adminNotificationPreferences.preferenceKey],
      set: { emailEnabled, updatedAt: new Date() },
    });

  revalidatePath('/admin/notificaciones');
}

export async function getUnreadNotificationCount() {
  const admin = await assertAdmin();
  const notifications = await buildNotifications(admin.id);
  return notifications.filter((notification) => !notification.read).length;
}

export async function markNotificationRead(notificationKey: string) {
  const admin = await assertAdmin();

  await db
    .insert(adminNotificationReads)
    .values({ adminId: admin.id, notificationKey })
    .onConflictDoNothing();

  revalidatePath('/admin');
  revalidatePath('/admin/notificaciones');
}

export async function markAllNotificationsRead(notificationKeys: string[]) {
  const admin = await assertAdmin();
  const keys = Array.from(new Set(notificationKeys.filter(Boolean)));

  if (keys.length > 0) {
    await db
      .insert(adminNotificationReads)
      .values(keys.map((notificationKey) => ({ adminId: admin.id, notificationKey })))
      .onConflictDoNothing();
  }

  revalidatePath('/admin');
  revalidatePath('/admin/notificaciones');
}
