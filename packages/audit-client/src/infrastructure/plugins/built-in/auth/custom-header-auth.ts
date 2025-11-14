// ============================================================================
// Custom Header Authentication Plugin
// ============================================================================

import type { ValidationResult } from '@/types/shared-schemas'
import type { AuthContext, AuthPlugin, PluginContext } from '../../../plugins'

export interface CustomHeaderAuthConfig {
	headers: Record<string, string | ((context: AuthContext) => Promise<string> | string)>
}

/**
 * Custom header authentication plugin
 */
export class CustomHeaderAuthPlugin implements AuthPlugin {
	readonly name = 'custom-header-auth'
	readonly version = '1.0.0'
	readonly description = 'Custom header-based authentication'
	readonly type = 'auth' as const

	async initialize(config: CustomHeaderAuthConfig, context: PluginContext): Promise<void> {
		// No initialization needed
	}

	async getAuthHeaders(
		config: CustomHeaderAuthConfig,
		context: AuthContext
	): Promise<Record<string, string>> {
		const headers: Record<string, string> = {}

		for (const [headerName, headerValue] of Object.entries(config.headers)) {
			if (typeof headerValue === 'function') {
				headers[headerName] = await headerValue(context)
			} else {
				headers[headerName] = headerValue
			}
		}

		return headers
	}

	validateAuthConfig(config: CustomHeaderAuthConfig): ValidationResult {
		const errors: string[] = []

		if (!config.headers || Object.keys(config.headers).length === 0) {
			errors.push('At least one header must be provided')
		}

		const result: ValidationResult = {
			isValid: errors.length === 0,
		}

		if (errors.length > 0) {
			result.errors = errors
		}

		return result
	}
}
