import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core'

import { organization, user } from './auth'
import { DeliveryConfig, ExportConfig } from './types'

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

export const reportConfig = pgTable(
	'report_config',
	{
		organizationId: varchar('organization_id', { length: 50 })
			.primaryKey()
			.references(() => organization.id, { onDelete: 'cascade' }),
		deliveryMethod: varchar('delivery_method', {
			length: 10,
			enum: ['email', 'webhook', 'storage'],
		}).$type<'email' | 'webhook' | 'storage'>(),
		deliveryConfig: jsonb('delivery_config').$type<DeliveryConfig>(),
		exportConfig: jsonb('export_config').$type<ExportConfig>(),
	},
	(table) => {
		return [index('report_config_delivery_method_idx').on(table.deliveryMethod)]
	}
)

export type ReportConfigTypes = typeof reportConfig.$inferSelect
export type newReportConfig = typeof reportConfig.$inferInsert

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

type MailProvider = 'smtp' | 'resend' | 'sendgrid'

export const emailProvider = pgTable('email_provider', {
	organizationId: varchar('organization_id', { length: 50 })
		.primaryKey()
		.references(() => organization.id, { onDelete: 'cascade' }),
	provider: varchar('provider', { length: 50 })
		.$type<MailProvider>() // Enforces the type against MailProvider
		.notNull()
		.default('smtp'), // e.g., 'smtp', 'resend', 'sendgrid'
	host: varchar('smtp_host', { length: 100 }),
	port: integer('smtp_port').default(465),
	secure: boolean('smtp_secure').default(true),
	user: varchar('smtp_user', { length: 50 }),
	password: text('smtp_pass'),
	apiKey: text('api_key'),
	fromName: varchar('from_name', { length: 50 }),
	fromEmail: varchar('from_email', { length: 50 }),
})
