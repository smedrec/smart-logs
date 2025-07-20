import {
	boolean,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core'

import { organization, user } from './auth'

export const activeOrganization = pgTable(
	'active_organization',
	{
		userId: varchar('user_id', { length: 50 })
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		organizationId: varchar('organization_id', { length: 50 })
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		role: varchar('role', { length: 20 }).notNull(),
	},
	(table) => {
		return [
			primaryKey({ columns: [table.userId, table.organizationId] }),
			uniqueIndex('active_organization_user_id_idx').on(table.userId),
		]
	}
)

export const events = pgTable('events', {
	id: uuid('id').primaryKey().defaultRandom(),
	title: varchar('title', { length: 256 }).notNull(),
	description: text('description').notNull(),
	startDate: timestamp('start_date', { withTimezone: true }).notNull(),
	endDate: timestamp('end_date', { withTimezone: true }).notNull(),
	startTime: varchar('start_time', { length: 5 }).notNull(),
	endTime: varchar('end_time', { length: 5 }).notNull(),
	isRepeating: boolean('is_repeating').notNull(),
	repeatingType: varchar('repeating_type', {
		length: 10,
		enum: ['daily', 'weekly', 'monthly'],
	}).$type<'daily' | 'weekly' | 'monthly'>(),
	location: varchar('location', { length: 256 }).notNull(),
	category: varchar('category', { length: 100 }).notNull(),
	color: varchar('color', { length: 15 }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type EventTypes = typeof events.$inferSelect
export type newEvent = typeof events.$inferInsert
