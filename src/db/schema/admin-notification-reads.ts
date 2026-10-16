import { pgTable, timestamp, uniqueIndex, uuid, text } from 'drizzle-orm/pg-core';
import { admins } from './admins';

export const adminNotificationReads = pgTable(
  'admin_notification_reads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: uuid('admin_id').notNull().references(() => admins.id, { onDelete: 'cascade' }),
    notificationKey: text('notification_key').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    adminNotificationKeyIdx: uniqueIndex('admin_notification_reads_admin_key_idx').on(table.adminId, table.notificationKey),
  }),
);

export type AdminNotificationRead = typeof adminNotificationReads.$inferSelect;
