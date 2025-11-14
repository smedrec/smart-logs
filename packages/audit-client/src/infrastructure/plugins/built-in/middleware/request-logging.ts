// ============================================================================
// Request Logging Middleware Plugin
// ============================================================================

import type { ValidationResult } from '@/types/shared-schemas'
import type {
	MiddlewareNext,
	MiddlewarePlugin,
	MiddlewareRequest,
	MiddlewareResponse,
	PluginContext,
} from '../../../plugins'

export interface RequestLoggingConfig {
	logRequests?: boolean
	logResponses?: boolean
	logHeaders?: boolean
	logBodies?: boolean
	logLevel?: 'debug' | 'info' | 'warn' | 'error'
}

/**
 * Request logging middleware plugin
 */
export class RequestLoggingPlugin implements MiddlewarePlugin {
	readonly name = 'request-logging'
	readonly version = '1.0.0'
	readonly description = 'Logs all HTTP requests and responses'
	readonly type = 'middleware' as const

	private config: RequestLoggingConfig = {}
	private logger?: any

	async initialize(config: RequestLoggingConfig, context: PluginContext): Promise<void> {
		this.config = { ...this.defaultConfig(), ...config }
		this.logger = context.logger
	}

	async processRequest(
		request: MiddlewareRequest,
		next: MiddlewareNext
	): Promise<MiddlewareRequest> {
		if (this.config.logRequests) {
			const logData = {
				method: request.method,
				url: request.url,
				headers: this.config.logHeaders ? request.headers : undefined,
				body: this.config.logBodies ? request.body : undefined,
			}
			this.logger?.info('Outgoing request', logData)
		}

		const startTime = Date.now()
		request.metadata.startTime = startTime

		return request
	}

	async processResponse(
		response: MiddlewareResponse,
		next: MiddlewareNext
	): Promise<MiddlewareResponse> {
		if (this.config.logResponses) {
			const duration = response.metadata.startTime
				? Date.now() - response.metadata.startTime
				: undefined
			const logData = {
				status: response.status,
				statusText: response.statusText,
				duration,
				headers: this.config.logHeaders ? response.headers : undefined,
				body: this.config.logBodies ? response.body : undefined,
			}
			this.logger?.info('Incoming response', logData)
		}

		return response
	}

	validateConfig(config: RequestLoggingConfig): ValidationResult {
		const errors: string[] = []

		if (config.logLevel && !['debug', 'info', 'warn', 'error'].includes(config.logLevel)) {
			errors.push('logLevel must be one of: debug, info, warn, error')
		}

		const result: ValidationResult = {
			isValid: errors.length === 0,
		}

		if (errors.length > 0) {
			result.errors = errors
		}

		return result
	}

	private defaultConfig(): RequestLoggingConfig {
		return {
			logRequests: true,
			logResponses: true,
			logHeaders: false,
			logBodies: false,
			logLevel: 'info',
		}
	}
}
