import { createAuthMiddleware } from 'better-auth/plugins'

import AuditSDK from '@repo/audit-sdk'

import type { BetterAuthPlugin } from 'better-auth'

// Initialize the SDK
const auditSDK = new AuditSDK({
	queueName: 'audit',
	redis: {
		url: process.env.REDIS_URL,
	},
	databaseUrl: process.env.AUDIT_DB_URL,
	defaults: {
		dataClassification: 'INTERNAL',
		generateHash: true,
		generateSignature: true,
	},
	crypto: {
		secretKey: process.env.AUDIT_CRYPTO_SECRET,
		enableSignatures: true,
	},
	compliance: {
		hipaa: {
			enabled: true,
			retentionYears: 6,
		},
		gdpr: {
			enabled: true,
			defaultLegalBasis: 'legitimate_interest',
			retentionDays: 365,
		},
	},
})

export const AuditSDKPlugin = () => {
	return {
		id: 'audit-sdk-plugin',
		hooks: {
			before: [
				{
					matcher: (context) => {
						return context.path === '/sign-out'
					},
					handler: createAuthMiddleware(async (ctx) => {
						const session = ctx.context.session
						console.log('BEFORE LOGOUT - BEFORE SESSION')
						// FIXME: session is undefined
						if (session) {
							const details = {
								principalId: session.session.userId,
								organizationId: session.session.activeOrganizationId as string,
								action: 'logout' as
									| 'login'
									| 'logout'
									| 'password_change'
									| 'mfa_enable'
									| 'mfa_disable',
								status: 'success' as 'success' | 'attempt' | 'failure',
								sessionContext: {
									sessionId: session.user.id,
									ipAddress:
										session.session.ipAddress && session.session.ipAddress.length > 0
											? session.session.ipAddress
											: '0.0.0.0',
									userAgent:
										session.session.userAgent && session.session.userAgent.length > 0
											? session.session.userAgent
											: 'unknown',
								},
							}
							await auditSDK.logAuth(details)
							console.log('BEFORE LOGOUT - AFTER SESSION')
						}
					}),
				},
			],
			after: [
				{
					matcher: (context) => {
						return context.path === '/sign-in/email'
					},
					handler: createAuthMiddleware(async (ctx) => {
						const newSession = ctx.context.newSession
						if (newSession) {
							const details = {
								principalId: newSession.session.userId,
								organizationId: newSession.session.activeOrganizationId as string,
								action: 'login' as
									| 'login'
									| 'logout'
									| 'password_change'
									| 'mfa_enable'
									| 'mfa_disable',
								status: 'success' as 'success' | 'attempt' | 'failure',
								sessionContext: {
									sessionId: newSession.user.id,
									ipAddress:
										newSession.session.ipAddress && newSession.session.ipAddress.length > 0
											? newSession.session.ipAddress
											: '0.0.0.0',
									userAgent:
										newSession.session.userAgent && newSession.session.userAgent.length > 0
											? newSession.session.userAgent
											: 'unknown',
								},
							}
							await auditSDK.logAuth(details)
						}
					}),
				},
			],
		},
	} satisfies BetterAuthPlugin
}
