import { expo } from '@better-auth/expo'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, apiKey, mcp, oidcProvider, openAPI, organization } from 'better-auth/plugins'

import { SendMail } from '@repo/send-mail'

import { initDrizzle } from './db/index.js'
import * as schema from './db/schema/auth.js'
import { getActiveOrganization } from './functions.js'
import { AuditSDKPlugin } from './plugins/audit.js'
import { getRedisConnection } from './redis.js'

import type { MailerSendOptions } from '@repo/send-mail'

interface EnvConfig {
	sessionSecret: string
	sessionMaxAge: number
	trustedOrigins: string[]
	betterAuthUrl: string
	redisUrl?: string
	dbUrl?: string
	poolSize?: number
}

const email = new SendMail('mail', process.env.REDIS_URL)

class Auth {
	private auth: ReturnType<typeof betterAuth>
	/**
	 * Constructs an Better Auth instance
	 * @param config The environment config. If not provided, it attempts to use
	 *                    the process.env environment variables.
	 * @throws Error if the config not provided and cannot be found in environment variables.
	 */
	constructor(config: any) {
		/**const effectiveConfig = config || getEnvConfig()

		if (!effectiveConfig) {
			throw new Error('Auth: Better auth environment variables not found.')
		}*/

		const redis = getRedisConnection(config.auth.redisUrl)

		// Using environment variable AUTH_DB_URL
		const { db } = initDrizzle(config.auth.dbUrl, config.auth.poolSize)

		// TODO - see who to fix the async question
		//if (await authDbService.checkAuthDbConnection()) {
		console.info('🟢 Connected to Postgres for Better Auth service.')
		//} else {
		//	console.error('🔴 Postgres connection error for Better Auth service')
		//}

		const email = new SendMail('mail', config.redis.url)

		//const audit = new Audit('audit', effectiveConfig.AUDIT_REDIS_URL)

		this.auth = betterAuth({
			database: drizzleAdapter(db, {
				provider: 'pg',
				schema: schema,
			}),
			trustedOrigins: config.auth.trustedOrigins,
			emailAndPassword: {
				enabled: true,
				minPasswordLength: 8,
				maxPasswordLength: 128,
				requireEmailVerification: true,
				sendResetPassword: async ({ user, url }) => {
					const org = await getActiveOrganization(user.id)
					// TODO - return a error to user
					if (!org) return
					const emailDetails: MailerSendOptions = {
						from: 'no-reply@smedrec.com',
						to: user.email,
						subject: 'Reset your password',
						html: `
					<p>Hi ${user.name},</p>
					<p>Click the link below to reset your password:</p>
					<p><a href="${url}">${url}</a></p>
				`,
					}
					await email.send({
						principalId: user.id,
						organizationId: org.organizationId,
						service: 'smart-logs',
						action: 'sendResetPassword',
						emailDetails,
					})
				},
			},
			emailVerification: {
				sendOnSignUp: true,
				autoSignInAfterVerification: true,
				sendVerificationEmail: async ({ user, url }) => {
					// TODO: redirect to APP
					const emailDetails: MailerSendOptions = {
						from: 'SMEDREC <no-reply@smedrec.com>',
						to: user.email,
						subject: 'Verify your email address',
						html: `
					<p>Hi ${user.name},</p>
					<p>Click the link below to verify your email address:</p>
					<p><a href="${url}">${url}</a></p>
				`,
					}
					await email.send({
						principalId: user.id,
						organizationId: '',
						service: 'smart-logs',
						action: 'sendVerificationEmail',
						emailDetails,
					})
				},
			},
			secret: config.auth.sessionSecret,
			baseURL: config.auth.betterAuthUrl,
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
					schema: {
						organization: {
							additionalFields: {
								retentionDays: {
									type: 'number',
									input: true,
									defaultValue: 90,
									required: false,
								},
							},
						},
					},
					async sendInvitationEmail(data) {
						const inviteLink = `${process.env.APP_PUBLIC_URL}/accept-invitation/${data.id}`
						const emailDetails: MailerSendOptions = {
							from: 'no-reply@smedrec.com',
							to: data.email,
							subject: `Invite to join to the ${data.organization.name} team!`,
							html: `
						<p>Hi,</p>
						<p>${data.inviter.user.name} sen you a invite to join the ${data.organization.name} team!
						<p>Click the link below to accept:</p>
						<p><a href="${inviteLink}">${inviteLink}</a></p>
						<p>If you have any doubt please send a email to: ${data.inviter.user.email}.</p>
					`,
						}
						await email.send({
							principalId: data.inviter.user.id,
							organizationId: data.organization.id,
							service: 'smart-logs',
							action: 'sendInvitationEmail',
							emailDetails,
						})
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
				//await AuditSDKPlugin(),
				openAPI(),
			],
		})
	}

	/**
	 * Provides access to the Auth instance for auth operations.
	 * @returns The auth instance typed with the ReturnType<typeof betterAuth> schema.
	 */
	public getAuthInstance(): ReturnType<typeof betterAuth> {
		return this.auth
	}
}

export { Auth }

export type Session = {
	session: {
		id: string
		token: string
		userId: string
		expiresAt: Date
		createdAt: Date
		updatedAt: Date
		ipAddress?: string | null | undefined
		userAgent?: string | null | undefined
		activeOrganizationId?: string | null | undefined
		activeOrganizationRole?: string | null | undefined
	}
	user: {
		id: string
		name: string
		emailVerified: boolean
		email: string
		createdAt: Date
		updatedAt: Date
		image?: string | null | undefined
		role: 'user' | 'admin'
		banned: boolean
		banReason?: string | null | undefined
		banExpires?: Date | null
	}
}
