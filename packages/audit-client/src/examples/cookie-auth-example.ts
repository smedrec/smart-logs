import { AuditClient } from '../index'

import type { PartialAuditClientConfig } from '../core/config'

/**
 * Example demonstrating cookie-based authentication with Better Auth
 * This example shows how to configure the audit client to use cookies
 * for authentication, which is the default method used by Better Auth.
 */

// Example 1: Using browser cookies (most common for Better Auth)
export async function createClientWithBrowserCookies() {
	const config: PartialAuditClientConfig = {
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'cookie',
			includeBrowserCookies: true, // This will include all browser cookies
		},
	}

	const client = new AuditClient(config)
	return client
}

// Example 2: Using explicit cookies
export async function createClientWithExplicitCookies() {
	const config: PartialAuditClientConfig = {
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'cookie',
			cookies: {
				'better-auth.session_token': 'your-session-token-here',
				'better-auth.csrf_token': 'your-csrf-token-here',
			},
		},
	}

	const client = new AuditClient(config)
	return client
}

// Example 3: Combining browser cookies with additional explicit cookies
export async function createClientWithMixedCookies() {
	const config: PartialAuditClientConfig = {
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'cookie',
			includeBrowserCookies: true, // Include all browser cookies
			cookies: {
				// Add additional explicit cookies if needed
				'custom-header': 'custom-value',
			},
		},
	}

	const client = new AuditClient(config)
	return client
}

// Example 4: Using cookie authentication with Better Auth in a React app
export async function betterAuthIntegrationExample() {
	// In a typical Better Auth setup, cookies are automatically managed
	// by the browser, so you just need to enable includeBrowserCookies
	const config: PartialAuditClientConfig = {
		baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
		authentication: {
			type: 'cookie',
			includeBrowserCookies: true,
		},
		// Optional: Enable logging for debugging
		logging: {
			enabled: true,
			level: 'debug',
		},
	}

	const client = new AuditClient(config)

	try {
		// Test the authentication by making a request
		const events = await client.events.query({ limit: 10 })
		console.log('Successfully authenticated with cookies:', events)
		return client
	} catch (error) {
		console.error('Cookie authentication failed:', error)
		throw error
	}
}

// Example 5: Dynamic cookie management
export class CookieAuthManager {
	private client: AuditClient

	constructor(baseUrl: string) {
		const config: PartialAuditClientConfig = {
			baseUrl,
			authentication: {
				type: 'cookie',
				includeBrowserCookies: true,
			},
		}

		this.client = new AuditClient(config)
	}

	/**
	 * Update cookies dynamically (useful when session changes)
	 */
	updateCookies(newCookies: Record<string, string>) {
		this.client.updateConfig({
			authentication: {
				type: 'cookie',
				includeBrowserCookies: true,
				cookies: newCookies,
				autoRefresh: false,
			},
		})
	}

	/**
	 * Test if current cookies are valid
	 */
	async testAuthentication(): Promise<boolean> {
		try {
			await this.client.health.check()
			return true
		} catch (error) {
			console.error('Authentication test failed:', error)
			return false
		}
	}

	/**
	 * Get the client instance
	 */
	getClient(): AuditClient {
		return this.client
	}
}

// Example 6: Server-side cookie authentication (Node.js)
export async function serverSideCookieAuth(cookieHeader: string) {
	// Parse cookies from the Cookie header
	const cookies: Record<string, string> = {}

	if (cookieHeader) {
		cookieHeader.split(';').forEach((cookie) => {
			const [name, value] = cookie.trim().split('=')
			if (name && value) {
				cookies[name] = value
			}
		})
	}

	const config: PartialAuditClientConfig = {
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'cookie',
			cookies,
			// Don't include browser cookies on server-side
			includeBrowserCookies: false,
		},
	}

	const client = new AuditClient(config)
	return client
}

// Example usage in an Express.js middleware
export function createAuditMiddleware() {
	return async (req: any, res: any, next: any) => {
		try {
			// Create audit client with cookies from the request
			const client = await serverSideCookieAuth(req.headers.cookie || '')

			// Attach client to request for use in route handlers
			req.auditClient = client

			next()
		} catch (error) {
			console.error('Failed to create audit client:', error)
			res.status(401).json({ error: 'Authentication required' })
		}
	}
}
