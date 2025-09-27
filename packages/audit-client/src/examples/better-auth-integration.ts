import { AuditClient } from '../index'

import type { PartialAuditClientConfig } from '../core/config'

/**
 * Better Auth Integration Examples
 *
 * This file demonstrates how to integrate the audit client with Better Auth,
 * a popular authentication library that uses cookies by default.
 */

// Example 1: Basic Better Auth integration for React/Next.js apps
export function createBetterAuthAuditClient(apiBaseUrl: string) {
	const config: PartialAuditClientConfig = {
		baseUrl: apiBaseUrl,
		authentication: {
			type: 'cookie',
			includeBrowserCookies: true, // This will include Better Auth cookies automatically
		},
		// Optional: Enable logging for debugging authentication issues
		logging: {
			enabled: process.env.NODE_ENV === 'development',
			level: 'debug',
		},
	}

	return new AuditClient(config)
}

// Example 2: Server-side Better Auth integration (API routes, middleware)
export function createServerSideAuditClient(apiBaseUrl: string, request: Request) {
	// Extract cookies from the request
	const cookieHeader = request.headers.get('cookie') || ''
	const cookies: Record<string, string> = {}

	// Parse cookies from the Cookie header
	if (cookieHeader) {
		cookieHeader.split(';').forEach((cookie) => {
			const [name, value] = cookie.trim().split('=')
			if (name && value) {
				cookies[name] = decodeURIComponent(value)
			}
		})
	}

	const config: PartialAuditClientConfig = {
		baseUrl: apiBaseUrl,
		authentication: {
			type: 'cookie',
			cookies,
			includeBrowserCookies: false, // Not available on server-side
		},
	}

	return new AuditClient(config)
}

// Example 3: Next.js API route integration
export function createNextJsAuditClient(apiBaseUrl: string, req: any) {
	const config: PartialAuditClientConfig = {
		baseUrl: apiBaseUrl,
		authentication: {
			type: 'cookie',
			cookies: req.cookies || {}, // Next.js parses cookies for us
			includeBrowserCookies: false,
		},
	}

	return new AuditClient(config)
}

// Example 4: Express.js middleware integration
export function createExpressAuditMiddleware(apiBaseUrl: string) {
	return (req: any, res: any, next: any) => {
		try {
			const config: PartialAuditClientConfig = {
				baseUrl: apiBaseUrl,
				authentication: {
					type: 'cookie',
					cookies: req.cookies || {}, // Requires cookie-parser middleware
					includeBrowserCookies: false,
				},
			}

			// Attach audit client to request object
			req.auditClient = new AuditClient(config)
			next()
		} catch (error) {
			console.error('Failed to create audit client:', error)
			res.status(500).json({ error: 'Internal server error' })
		}
	}
}

// Example 5: React hook for Better Auth + Audit Client
export function useAuditClientWithBetterAuth(apiBaseUrl: string) {
	// This would typically be used in a React component
	const client = createBetterAuthAuditClient(apiBaseUrl)

	const logAuditEvent = async (eventData: any) => {
		try {
			return await client.events.create(eventData)
		} catch (error) {
			console.error('Failed to log audit event:', error)
			throw error
		}
	}

	const testAuthentication = async () => {
		try {
			await client.health.check()
			return true
		} catch (error) {
			console.error('Authentication test failed:', error)
			return false
		}
	}

	return {
		client,
		logAuditEvent,
		testAuthentication,
	}
}

// Example 6: Dynamic cookie management for session changes
export class BetterAuthAuditManager {
	private client: AuditClient
	private apiBaseUrl: string

	constructor(apiBaseUrl: string) {
		this.apiBaseUrl = apiBaseUrl
		this.client = createBetterAuthAuditClient(apiBaseUrl)
	}

	/**
	 * Refresh the client when authentication state changes
	 * Call this when user logs in/out or session is refreshed
	 */
	refreshClient() {
		this.client = createBetterAuthAuditClient(this.apiBaseUrl)
	}

	/**
	 * Log an audit event with automatic retry on auth failure
	 */
	async logEvent(eventData: any, retryOnAuthFailure = true) {
		try {
			return await this.client.events.create(eventData)
		} catch (error: any) {
			// If authentication failed and retry is enabled, refresh client and try again
			if (retryOnAuthFailure && error?.statusCode === 401) {
				this.refreshClient()
				return await this.client.events.create(eventData)
			}
			throw error
		}
	}

	/**
	 * Get the current client instance
	 */
	getClient() {
		return this.client
	}
}

// Example 7: Better Auth session validation with audit logging
export async function validateSessionAndLog(apiBaseUrl: string, request: Request, eventData?: any) {
	const client = createServerSideAuditClient(apiBaseUrl, request)

	try {
		// Test if the session is valid by making a simple request
		await client.health.check()

		// If validation succeeds and we have event data, log it
		if (eventData) {
			await client.events.create({
				...eventData,
				metadata: {
					...eventData.metadata,
					sessionValidated: true,
					timestamp: new Date().toISOString(),
				},
			})
		}

		return { valid: true, client }
	} catch (error) {
		console.error('Session validation failed:', error)
		return { valid: false, error }
	}
}

// Example 8: Better Auth logout with audit trail
export async function logoutWithAudit(
	apiBaseUrl: string,
	request: Request,
	organizationId: string
) {
	const client = createServerSideAuditClient(apiBaseUrl, request)

	try {
		// Log the logout event before the session becomes invalid
		await client.events.create({
			action: 'user.logout',
			organizationId,
			sessionContext: {
				userAgent: request.headers.get('user-agent') || 'unknown',
				requestIp: request.headers.get('x-forwarded-for') || 'unknown',
			},
		})

		return { success: true }
	} catch (error) {
		console.error('Failed to log logout event:', error)
		return { success: false, error }
	}
}
