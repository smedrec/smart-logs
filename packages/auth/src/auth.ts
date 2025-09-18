import { expo } from '@better-auth/expo'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, apiKey, mcp, oidcProvider, openAPI, organization } from 'better-auth/plugins'
import { Inngest } from 'inngest'

import { initDrizzle } from './db/index.js'
import * as schema from './db/schema/auth.js'
import { generateSessionId, getActiveOrganization } from './functions.js'
import { getRedisConnection } from './redis.js'

import type { Redis as RedisInstanceType } from 'ioredis'
import type { Audit, AuditConfig } from '@repo/audit'
import type { MailerSendOptions } from '@repo/mailer'
import type { AuthDrizzleDb } from './db/index.js'

class Auth {
	private auth: ReturnType<typeof betterAuth>
	private db: AuthDrizzleDb
	private redis: RedisInstanceType
	private audit: Audit | undefined = undefined
	/**
	 * Constructs an Better Auth instance
	 * @param config The environment config. If not provided, it attempts to use
	 *                    the process.env environment variables.
	 * @throws Error if the config not provided and cannot be found in environment variables.
	 */
	constructor(config: AuditConfig, inngest: Inngest, audit?: Audit) {
		const redis = getRedisConnection(config.server.auth.redisUrl)
		this.redis = redis

		// Using environment variable AUTH_DB_URL
		const { db } = initDrizzle(config.server.auth.dbUrl, config.server.auth.poolSize)
		this.db = db

		if (audit) {
			this.audit = audit
		}

		this.auth = betterAuth({
			database: drizzleAdapter(db, {
				provider: 'pg',
				schema: schema,
			}),
			trustedOrigins: config.server.auth.trustedOrigins,
			emailAndPassword: {
				enabled: true,
				minPasswordLength: 8,
				maxPasswordLength: 128,
				requireEmailVerification: true,
				sendResetPassword: async ({ user, url }) => {
					const org = await getActiveOrganization(user.id, db)
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
					await inngest.send({
						name: 'email/send',
						data: {
							principalId: user.id,
							organizationId: org.organizationId,
							service: 'smart-logs',
							action: 'sendResetPassword',
							emailDetails,
						},
						user: {
							id: user.id,
							organizationId: org.organizationId,
						},
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
					await inngest.send({
						name: 'email/send',
						data: {
							principalId: user.id,
							organizationId: '',
							service: 'smart-logs',
							action: 'sendVerificationEmail',
							emailDetails,
						},
						user: {
							id: user.id,
						},
					})
				},
			},
			secret: config.server.auth.sessionSecret,
			baseURL: config.server.auth.betterAuthUrl,
			databaseHooks: {
				session: {
					create: {
						before: async (session) => {
							const sessionId = generateSessionId()
							const activeOrganization = await getActiveOrganization(session.userId, db)
							if (!activeOrganization) {
								return {
									data: {
										...session,
										id: sessionId,
										ipAddress:
											session.ipAddress && session.ipAddress.length > 0
												? session.ipAddress
												: '127.0.0.1',
										userAgent:
											session.userAgent && session.userAgent.length > 0
												? session.userAgent
												: 'unknown',
										activeOrganizationId: null,
										activeOrganizationRole: null,
									},
								}
							}
							if (this.audit) {
								const details = {
									principalId: session.userId,
									organizationId: activeOrganization.organizationId,
									action: 'login' as const,
									status: 'success' as 'success' | 'attempt' | 'failure',
									sessionContext: {
										sessionId: session.id || sessionId,
										ipAddress:
											session.ipAddress && session.ipAddress.length > 0
												? session.ipAddress
												: '127.0.0.1',
										userAgent:
											session.userAgent && session.userAgent.length > 0
												? session.userAgent
												: 'unknown',
									},
								}
								this.audit.logAuth(details)
							}
							return {
								data: {
									...session,
									id: sessionId,
									ipAddress:
										session.ipAddress && session.ipAddress.length > 0
											? session.ipAddress
											: '127.0.0.1',
									userAgent:
										session.userAgent && session.userAgent.length > 0
											? session.userAgent
											: 'unknown',
									activeOrganizationId: activeOrganization.organizationId,
									activeOrganizationRole: activeOrganization.role,
								},
							}
						},
						after: async (session, ctx) => {
							const user = await this.db.query.user.findFirst({
								where: (user, { eq }) => eq(user.id, session.userId),
							})
							if (!user) return
							const emailDetails: MailerSendOptions = {
								from: 'SMEDREC <no-reply@smedrec.com>',
								to: user.email,
								subject: 'Successful login from new device',
								html: `
							<p>Hi ${user.name},</p>\r
							<p>We're verifying a recent login for ${user.email}</p>
							<p>Time: ${new Date().toISOString()}</p>
							<p>IP Address: ${session.ipAddress}</p>
							<p>User Agent: ${session.userAgent}</p>
							<p>If you believe that this login is suspicious, please contact your administrator or reset your password immediately.</p>
						`,
							}
							await inngest.send({
								name: 'email/send',
								data: {
									principalId: session.userId,
									organizationId: session.activeOrganizationId,
									service: 'smart-logs',
									action: 'sendSuccessfulLoginEmail',
									emailDetails,
								},
								user: {
									id: session.userId,
									organizationId: session.activeOrganizationId,
								},
							})
						},
					},
				},
			},
			secondaryStorage: {
				get: async (key) => {
					const value = await redis.get(`auth:${key}`)
					return value ? value : null
				},
				set: async (key, value, ttl) => {
					if (ttl) await redis.set(`auth:${key}`, value, 'EX', ttl)
					else await redis.set(`auth:${key}`, value)
				},
				delete: async (key) => {
					await redis.del(`auth:${key}`)
				},
			},
			//rateLimit: {
			//	enabled: true,
			//	storage: 'secondary-storage',
			//},
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
						await inngest.send({
							name: 'email/send',
							data: {
								principalId: data.inviter.user.id,
								organizationId: data.organization.id,
								service: 'smart-logs',
								action: 'sendInvitationEmail',
								emailDetails,
							},
							user: {
								id: data.inviter.user.id,
								organizationId: data.organization.id,
							},
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
						maxRequests: 10000, // 10000 requests per day
					},
					enableMetadata: true,
				}),
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

	/**
	 * Provides access to the database instance for database operations.
	 * @returns The database instance typed with the ReturnType<typeof initDrizzle>['db'] schema.
	 */
	public getDrizzleInstance(): AuthDrizzleDb {
		return this.db
	}

	/**
	 * Provides access to the Redis instance for secondary storage operations.
	 * @returns The Redis instance typed with the RedisInstanceType schema.
	 */
	public getRedisInstance(): RedisInstanceType {
		return this.redis
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
