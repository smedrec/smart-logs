// ============================================================================
// Rate Limiting Middleware Plugin
// ============================================================================

import type { ValidationResult } from '@/types/shared-schemas'
import type {
	MiddlewareNext,
	MiddlewarePlugin,
	MiddlewareRequest,
	PluginContext,
} from '../../../plugins'

export interface RateLimitingConfig {
	maxRequests?: number
	windowMs?: number
}

/**
 * Request rate limiting middleware plugin
 */
export class RateLimitingPlugin implements MiddlewarePlugin {
	readonly name = 'rate-limiting'
	readonly version = '1.0.0'
	readonly description = 'Client-side rate limiting for API requests'
	readonly type = 'middleware' as const

	private config: RateLimitingConfig = {}
	private requestCounts = new Map<string, { count: number; resetTime: number }>()

	async initialize(config: RateLimitingConfig, context: PluginContext): Promise<void> {
		this.config = { ...this.defaultConfig(), ...config }
	}

	async processRequest(
		request: MiddlewareRequest,
		next: MiddlewareNext
	): Promise<MiddlewareRequest> {
		const key = this.getRateLimitKey(request)
		const now = Date.now()
		const windowMs = this.config.windowMs!

		let bucket = this.requestCounts.get(key)
		if (!bucket || now >= bucket.resetTime) {
			bucket = { count: 0, resetTime: now + windowMs }
			this.requestCounts.set(key, bucket)
		}

		if (bucket.count >= this.config.maxRequests!) {
			const waitTime = bucket.resetTime - now
			throw new Error(`Rate limit exceeded. Try again in ${waitTime}ms`)
		}

		bucket.count++
		return request
	}

	validateConfig(config: RateLimitingConfig): ValidationResult {
		const errors: string[] = []

		if (config.maxRequests && config.maxRequests <= 0) {
			errors.push('maxRequests must be greater than 0')
		}

		if (config.windowMs && config.windowMs <= 0) {
			errors.push('windowMs must be greater than 0')
		}

		const result: ValidationResult = {
			isValid: errors.length === 0,
		}

		if (errors.length > 0) {
			result.errors = errors
		}

		return result
	}

	private getRateLimitKey(request: MiddlewareRequest): string {
		// Simple key based on method and base URL
		const url = new URL(request.url)
		return `${request.method}:${url.origin}`
	}

	private defaultConfig(): RateLimitingConfig {
		return {
			maxRequests: 100,
			windowMs: 60000, // 1 minute
		}
	}
}
