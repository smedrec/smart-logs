import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema/index.js'

const MAX_CONNECTIONS = 10

const client = postgres(process.env.DATABASE_URL || '', {
	max: MAX_CONNECTIONS,
})

export const db = drizzle(client, { schema })

export const initDrizzle = (dbUrl?: string, maxConnections: number = MAX_CONNECTIONS) => {
	const effectiveDbUrl = dbUrl || process.env.DATABASE_URL!

	const client = postgres(effectiveDbUrl, {
		max: maxConnections,
	})

	const db = drizzle(client, {
		schema,
		// logger: process.env.NODE_ENV === "development",
	})

	return { db, client }
}

export type DrizzleDb = ReturnType<typeof initDrizzle>['db']
