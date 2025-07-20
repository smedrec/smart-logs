import { db } from '@/db'
import * as schema from '@/db/schema/auth'
import { expo } from '@better-auth/expo'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, apiKey, mcp, oidcProvider, openAPI, organization } from 'better-auth/plugins'
import Redis from 'ioredis'

import { getActiveOrganization } from './functions'

import type { RedisOptions } from 'ioredis'

const defaultOptions: RedisOptions = { maxRetriesPerRequest: null }
const redis = new Redis(process.env.BETTER_AUTH_REDIS_URL!, {
	...defaultOptions,
	// enableReadyCheck: false, // May be needed depending on Redis setup/version
})

redis.on('connect', () => {
	console.info('🟢 Connected to Redis for Better Auth service.')
})

redis.on('error', (err) => {
	console.error('🔴 Redis connection error for Better Auth service:', err)
	// Depending on the error, you might want to exit or implement a retry mechanism for the worker itself.
	// For now, this will prevent the worker from starting or stop it if the connection is lost later.
})

export const auth: ReturnType<typeof betterAuth> = betterAuth({
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
	databaseHooks: {
		session: {
			create: {
				before: async (session) => {
					const activeOrganization = await getActiveOrganization(session.userId)
					if (!activeOrganization) {
						return {
							data: {
								...session,
								activeOrganizationId: null,
								activeOrganizationRole: null,
							},
						}
					}
					return {
						data: {
							...session,
							activeOrganizationId: activeOrganization.organizationId,
							activeOrganizationRole: activeOrganization.role,
						},
					}
				},
			},
		},
	},
	secondaryStorage: {
		get: async (key) => {
			const value = await redis.get(key)
			return value ? value : null
		},
		set: async (key, value, ttl) => {
			if (ttl) await redis.set(key, value, 'EX', ttl)
			else await redis.set(key, value)
		},
		delete: async (key) => {
			await redis.del(key)
		},
	},
	rateLimit: {
		enabled: true,
		storage: 'secondary-storage',
	},
	plugins: [
		admin({
			defaultRole: 'user',
		}),
		expo(),
		organization({
			teams: {
				enabled: true,
				maximumTeams: 10, // Optional: limit teams per organization
				allowRemovingAllTeams: false, // Optional: prevent removing the last team
			},
		}),
		oidcProvider({
			allowDynamicClientRegistration: true,
			loginPage: `${process.env.APP_PUBLIC_URL}/auth/sign-in`,
			metadata: {
				issuer: `${process.env.APP_PUBLIC_URL}`,
				authorization_endpoint: '/auth/oauth2/authorize',
				token_endpoint: '/auth/oauth2/token',
				// ...other custom metadata
			},
		}),
		mcp({
			loginPage: `${process.env.APP_PUBLIC_URL}/auth/sign-in`,
		}),
		apiKey({
			rateLimit: {
				enabled: true,
				timeWindow: 1000 * 60 * 60 * 24, // 1 day
				maxRequests: 10, // 10 requests per day
			},
			enableMetadata: true,
		}),
		openAPI(),
	],
})

export type Session = typeof auth.$Infer.Session
