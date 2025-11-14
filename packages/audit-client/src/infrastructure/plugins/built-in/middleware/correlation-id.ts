// ============================================================================
// Correlation ID Middleware Plugin
// ============================================================================

import type { ValidationResult } from '@/types/shared-schemas'
import type {
	MiddlewareNext,
	MiddlewarePlugin,
	MiddlewareRequest,
	PluginContext,
} from '../../../plugins'

export interface CorrelationIdConfig {
	headerName?: string
	idLength?: number
}

/**
 * Request correlation ID middleware plugin
 */
export class CorrelationIdPlugin implements MiddlewarePlugin {
	readonly name = 'correlation-id'
	readonly version = '1.0.0'
	readonly description = 'Adds correlation IDs to requests for tracing'
	readonly type = 'middleware' as const

	private config: CorrelationIdConfig = {}

	async initialize(config: CorrelationIdConfig, context: PluginContext): Promise<void> {
		this.config = { ...this.defaultConfig(), ...config }
	}

	async processRequest(
		request: MiddlewareRequest,
		next: MiddlewareNext
	): Promise<MiddlewareRequest> {
		const correlationId = this.generateCorrelationId()
		request.headers[this.config.headerName!] = correlationId
		request.metadata.correlationId = correlationId
		return request
	}

	validateConfig(config: CorrelationIdConfig): ValidationResult {
		const errors: string[] = []

		if (config.headerName && typeof config.headerName !== 'string') {
			errors.push('headerName must be a string')
		}

		if (config.idLength && (config.idLength < 8 || config.idLength > 64)) {
			errors.push('idLength must be between 8 and 64')
		}

		const result: ValidationResult = {
			isValid: errors.length === 0,
		}

		if (errors.length > 0) {
			result.errors = errors
		}

		return result
	}

	private generateCorrelationId(): string {
		const length = this.config.idLength || 16
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
		let result = ''
		for (let i = 0; i < length; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length))
		}
		return result
	}

	private defaultConfig(): CorrelationIdConfig {
		return {
			headerName: 'X-Correlation-ID',
			idLength: 16,
		}
	}
}
