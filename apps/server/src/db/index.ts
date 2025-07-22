import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

const maxConnections = 10
const client = postgres(process.env.DATABASE_URL || '', {
	max: maxConnections,
})

export const db = drizzle(client, { schema })

export const initDrizzle = (params?: { maxConnections?: number }) => {
	let maxConnections = params?.maxConnections || 10
	const client = postgres(process.env.DATABASE_URL!, {
		max: maxConnections,
	})

	const db = drizzle(client, {
		schema,
		// logger: process.env.NODE_ENV === "development",
	})

	return { db, client }
}

export type DrizzleCli = ReturnType<typeof initDrizzle>['db']
