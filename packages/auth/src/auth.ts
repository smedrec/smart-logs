import { expo } from '@better-auth/expo'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, apiKey, mcp, oidcProvider, openAPI, organization } from 'better-auth/plugins'

import { SendMail } from '@repo/send-mail'

import { db } from './db/index.js'
import * as schema from './db/schema/auth.js'
import { getActiveOrganization } from './functions.js'
import { AuditSDKPlugin } from './plugins/audit.js'
import { getRedisConnection } from './redis.js'

import type { MailerSendOptions } from '@repo/send-mail'

const redis = getRedisConnection()
const email = new SendMail('mail', process.env.REDIS_URL)

export const auth: ReturnType<typeof betterAuth> = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: schema,
	}),
	trustedOrigins: [process.env.CORS_ORIGIN || ''],
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
		await AuditSDKPlugin(),
		openAPI(),
	],
})

export type Session = {
	session: (typeof auth.$Infer.Session)['session'] & {
		activeOrganizationId: string | null | undefined
		activeOrganizationRole: string | null | undefined
	}
	user: (typeof auth.$Infer.Session)['user']
}
