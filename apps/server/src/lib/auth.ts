import { expo } from '@better-auth/expo'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization } from 'better-auth/plugins'

import { db } from '../db'
import * as schema from '../db/schema/auth'

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: schema,
	}),
	trustedOrigins: [process.env.CORS_ORIGIN || '', 'my-better-t-app://'],
	emailAndPassword: {
		enabled: true,
	},
	secret: process.env.BETTER_AUTH_SECRET,
	baseURL: process.env.BETTER_AUTH_URL,
	plugins: [expo(), organization()],
})

export type Session = typeof auth.$Infer.Session
