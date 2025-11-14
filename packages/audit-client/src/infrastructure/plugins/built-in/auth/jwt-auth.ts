// ============================================================================
// JWT Authentication Plugin
// ============================================================================

import type { ValidationResult } from '@/types/shared-schemas'
import type { AuthContext, AuthPlugin, PluginContext } from '../../../plugins'

export interface JWTAuthConfig {
	token?: string
	tokenProvider?: () => Promise<string> | string
	refreshToken?: string
	refreshEndpoint?: string
}

/**
 * JWT authentication plugin
 */
export class JWTAuthPlugin implements AuthPlugin {
	readonly name = 'jwt-auth'
	readonly version = '1.0.0'
	readonly description = 'JWT-based authentication'
	readonly type = 'auth' as const

	private config: JWTAuthConfig = {}

	async initialize(config: JWTAuthConfig, context: PluginContext): Promise<void> {
		this.config = config
	}

	async getAuthHeaders(
		config: JWTAuthConfig,
		context: AuthContext
	): Promise<Record<string, string>> {
		const token = await this.getToken(config)
		if (!token) {
			throw new Error('No JWT token available')
		}

		return {
			Authorization: `Bearer ${token}`,
		}
	}

	async refreshToken(config: JWTAuthConfig, context: AuthContext): Promise<string | null> {
		if (!config.refreshToken || !config.refreshEndpoint) {
			return null
		}

		try {
			const response = await fetch(config.refreshEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					refreshToken: config.refreshToken,
				}),
			})

			if (!response.ok) {
				throw new Error(`Token refresh failed: ${response.statusText}`)
			}

			const data = await response.json()
			return data.accessToken || data.token
		} catch (error) {
			console.error('Token refresh failed:', error)
			return null
		}
	}

	validateAuthConfig(config: JWTAuthConfig): ValidationResult {
		const errors: string[] = []

		if (!config.token && !config.tokenProvider) {
			errors.push('Either token or tokenProvider must be provided')
		}

		if (config.refreshEndpoint && !config.refreshToken) {
			errors.push('refreshToken is required when refreshEndpoint is provided')
		}

		const result: ValidationResult = {
			isValid: errors.length === 0,
		}

		if (errors.length > 0) {
			result.errors = errors
		}

		return result
	}

	private async getToken(config: JWTAuthConfig): Promise<string | null> {
		if (config.token) {
			return config.token
		}

		if (config.tokenProvider) {
			return config.tokenProvider()
		}

		return null
	}
}
