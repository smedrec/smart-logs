import { db } from '@/db'
import * as schema from '@/db/schema/auth'
import { expo } from '@better-auth/expo'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, apiKey, mcp, oidcProvider, organization } from 'better-auth/plugins'

import { getActiveOrganization } from './functions'

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
	],
})

export type Session = typeof auth.$Infer.Session
