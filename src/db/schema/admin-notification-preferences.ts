import { boolean, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { admins } from './admins';

export const adminNotificationPreferences = pgTable(
  'admin_notification_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: uuid('admin_id').notNull().references(() => admins.id, { onDelete: 'cascade' }),
    preferenceKey: text('preference_key').notNull(),
    emailEnabled: boolean('email_enabled').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    adminPreferenceKeyIdx: uniqueIndex('admin_notification_preferences_admin_key_idx').on(table.adminId, table.preferenceKey),
  }),
);

export type AdminNotificationPreference = typeof adminNotificationPreferences.$inferSelect;
