import { defineConfig } from 'drizzle-kit'

export default defineConfig({
	schema: ['./src/db/schema/auth.ts', './src/db/schema/aux.ts'],
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.DATABASE_URL || '',
	},
	migrations: {
		table: '_journal',
		schema: 'drizzle',
	},
})
