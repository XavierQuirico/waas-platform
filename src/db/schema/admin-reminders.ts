import { boolean, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { admins } from './admins';

export const adminReminderPriorityEnum = pgEnum('admin_reminder_priority', ['alta', 'media', 'baja']);
export const adminReminderRecurrenceEnum = pgEnum('admin_reminder_recurrence', ['none', 'weekly', 'monthly']);

export const adminReminders = pgTable('admin_reminders', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminId: uuid('admin_id').notNull().references(() => admins.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  clientLabel: text('client_label'),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  priority: adminReminderPriorityEnum('priority').notNull().default('media'),
  recurrence: adminReminderRecurrenceEnum('recurrence').notNull().default('none'),
  done: boolean('done').notNull().default(false),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type AdminReminder = typeof adminReminders.$inferSelect;
