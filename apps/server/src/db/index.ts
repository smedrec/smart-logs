import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

const maxConnections = 10
const client = postgres(process.env.DATABASE_URL || '', {
	max: maxConnections,
})

export const db = drizzle(client, { schema })
