import { pgTable, primaryKey, uniqueIndex, varchar } from "drizzle-orm/pg-core"

import { organization, user } from "./auth"

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