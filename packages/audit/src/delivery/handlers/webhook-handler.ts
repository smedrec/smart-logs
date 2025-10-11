/**
 * Webhook destination handler with HTTP client and security features
 * Requirements 4.1, 4.2, 4.3: Webhook delivery with signatures and headers
 */

import { WebhookSecretManager } from './webhook-secret-manager.js'
import { WebhookSecurityManager } from './webhook-security.js'

import type { IWebhookSecretRepository } from '../database-client.js'
import type { IDestinationHandler } from '../interfaces.js'
import type {
	ConnectionTestResult,
	DeliveryFeature,
	DeliveryPayload,
	DeliveryResult,
	DestinationConfig,
	ValidationResult,
} from '../types.js'

/**
 * HTTP client configuration for webhook requests
 */
interface HttpClientConfig {
	timeout: number
	maxRedirects: number
	userAgent: string
}

/**
 * Webhook request configuration
 */
interface WebhookRequestConfig {
	url: string
	method: 'POST' | 'PUT'
	headers: Record<string, string>
	timeout: number
	retryConfig: {
		maxRetries: number
		backoffMultiplier: number
		maxBackoffDelay: number
	}
}

/**
 * HTTP response interface
 */
interface HttpResponse {
	status: number
	statusText: string
	headers: Record<string, string>
	body: any
	responseTime: number
}

/**
 * Webhook handler implementing HTTP delivery with security features
 * Requirements 4.1, 2.1, 2.5: HTTP client with configurable options
 */
export class WebhookHandler implements IDestinationHandler {
	readonly type = 'webhook' as const

	private readonly httpClient: HttpClientConfig
	private readonly securityManager: WebhookSecurityManager
	private readonly secretManager?: WebhookSecretManager

	constructor(
		httpClientConfig?: Partial<HttpClientConfig>,
		securityManager?: WebhookSecurityManager,
		secretRepository?: IWebhookSecretRepository
	) {
		this.httpClient = {
			timeout: 30000, // 30 seconds default
			maxRedirects: 5,
			userAgent: 'AuditDeliveryService/1.0',
			...httpClientConfig,
		}

		this.securityManager = securityManager || new WebhookSecurityManager()
		this.secretManager = secretRepository ? new WebhookSecretManager(secretRepository) : undefined
	}

	/**
	 * Validate webhook configuration
	 * Requirements 4.1, 10.1, 10.2: Configuration validation
	 */
	validateConfig(config: DestinationConfig): ValidationResult {
		const errors: string[] = []
		const warnings: string[] = []

		const webhookConfig = config.webhook
		if (!webhookConfig) {
			errors.push('Webhook configuration is required')
			return { isValid: false, errors, warnings }
		}

		// Validate URL
		if (!webhookConfig.url) {
			errors.push('Webhook URL is required')
		} else {
			try {
				const url = new URL(webhookConfig.url)
				if (!['http:', 'https:'].includes(url.protocol)) {
					errors.push('Webhook URL must use HTTP or HTTPS protocol')
				}
				if (url.protocol === 'http:') {
					warnings.push('HTTP URLs are not secure. Consider using HTTPS.')
				}
			} catch (error) {
				errors.push('Invalid webhook URL format')
			}
		}

		// Validate HTTP method
		if (!webhookConfig.method) {
			errors.push('HTTP method is required')
		} else if (!['POST', 'PUT'].includes(webhookConfig.method)) {
			errors.push('HTTP method must be POST or PUT')
		}

		// Validate timeout
		if (webhookConfig.timeout !== undefined) {
			if (typeof webhookConfig.timeout !== 'number' || webhookConfig.timeout <= 0) {
				errors.push('Timeout must be a positive number')
			} else if (webhookConfig.timeout > 300000) {
				warnings.push('Timeout exceeds 5 minutes. Consider using a shorter timeout.')
			}
		}

		// Validate headers
		if (webhookConfig.headers) {
			if (typeof webhookConfig.headers !== 'object') {
				errors.push('Headers must be an object')
			} else {
				for (const [key, value] of Object.entries(webhookConfig.headers)) {
					if (typeof key !== 'string' || typeof value !== 'string') {
						errors.push('Header keys and values must be strings')
						break
					}
				}
			}
		}

		// Validate retry configuration
		if (webhookConfig.retryConfig) {
			const retryConfig = webhookConfig.retryConfig
			if (typeof retryConfig.maxRetries !== 'number' || retryConfig.maxRetries < 0) {
				errors.push('maxRetries must be a non-negative number')
			}
			if (typeof retryConfig.backoffMultiplier !== 'number' || retryConfig.backoffMultiplier <= 0) {
				errors.push('backoffMultiplier must be a positive number')
			}
			if (typeof retryConfig.maxBackoffDelay !== 'number' || retryConfig.maxBackoffDelay <= 0) {
				errors.push('maxBackoffDelay must be a positive number')
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		}
	}

	/**
	 * Test connection to webhook endpoint
	 * Requirements 4.1, 1.3: Connection testing and validation
	 */
	async testConnection(config: DestinationConfig): Promise<ConnectionTestResult> {
		const validation = this.validateConfig(config)
		if (!validation.isValid) {
			return {
				success: false,
				error: `Configuration validation failed: ${validation.errors.join(', ')}`,
			}
		}

		const webhookConfig = config.webhook!
		const startTime = Date.now()

		try {
			// Create a test payload
			const testPayload = {
				test: true,
				timestamp: new Date().toISOString(),
				message: 'Connection test from Audit Delivery Service',
			}

			const response = await this.makeHttpRequest({
				url: webhookConfig.url,
				method: webhookConfig.method,
				headers: {
					'Content-Type': 'application/json',
					'User-Agent': this.httpClient.userAgent,
					...webhookConfig.headers,
				},
				body: JSON.stringify(testPayload),
				timeout: webhookConfig.timeout || this.httpClient.timeout,
			})

			const responseTime = Date.now() - startTime

			return {
				success: response.status >= 200 && response.status < 300,
				responseTime,
				statusCode: response.status,
				details: {
					statusText: response.statusText,
					headers: response.headers,
				},
			}
		} catch (error) {
			const responseTime = Date.now() - startTime
			return {
				success: false,
				responseTime,
				error: error instanceof Error ? error.message : 'Unknown error occurred',
				details: {
					errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
				},
			}
		}
	}

	/**
	 * Deliver payload to webhook endpoint
	 * Requirements 4.1, 2.1, 2.5: HTTP delivery with payload formatting
	 */
	async deliver(payload: DeliveryPayload, config: DestinationConfig): Promise<DeliveryResult> {
		const validation = this.validateConfig(config)
		if (!validation.isValid) {
			return {
				success: false,
				responseTime: 0,
				error: `Configuration validation failed: ${validation.errors.join(', ')}`,
				retryable: false,
			}
		}

		const webhookConfig = config.webhook!
		const startTime = Date.now()

		try {
			// Format the payload for webhook delivery
			const webhookPayload = this.formatPayload(payload)

			// Get webhook secret for signing (if secret manager is available)
			let webhookSecret: string | undefined
			if (this.secretManager && webhookConfig.url) {
				// Extract destination ID from config or payload
				// This is a simplified approach - in practice, you'd pass the destination ID
				const destinationId = this.extractDestinationId(config)
				if (destinationId) {
					const primarySecret = await this.secretManager.getPrimarySecret(destinationId)
					webhookSecret = primarySecret?.secretKey
				}
			}

			// Generate security headers
			const securityHeaders = await this.securityManager.generateSecurityHeaders(
				webhookPayload,
				payload.organizationId,
				payload.deliveryId,
				webhookSecret
			)

			// Prepare request headers
			const headers = {
				'Content-Type': 'application/json',
				'User-Agent': this.httpClient.userAgent,
				...webhookConfig.headers,
				...securityHeaders,
			}

			// Make the HTTP request
			const response = await this.makeHttpRequest({
				url: webhookConfig.url,
				method: webhookConfig.method,
				headers,
				body: JSON.stringify(webhookPayload),
				timeout: webhookConfig.timeout || this.httpClient.timeout,
			})

			const responseTime = Date.now() - startTime
			const success = response.status >= 200 && response.status < 300

			return {
				success,
				deliveredAt: success ? new Date().toISOString() : undefined,
				responseTime,
				statusCode: response.status,
				responseHeaders: response.headers,
				responseBody: response.body,
				crossSystemReference: this.extractCrossSystemReference(response),
				error: success ? undefined : `HTTP ${response.status}: ${response.statusText}`,
				retryable: this.isRetryableError(response.status),
			}
		} catch (error) {
			const responseTime = Date.now() - startTime
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

			return {
				success: false,
				responseTime,
				error: errorMessage,
				retryable: this.isRetryableNetworkError(error),
			}
		}
	}

	/**
	 * Check if handler supports a specific feature
	 * Requirements 4.1, 4.2, 4.3: Feature support declaration
	 */
	supportsFeature(feature: DeliveryFeature): boolean {
		const supportedFeatures: DeliveryFeature[] = [
			'signature_verification',
			'idempotency',
			'retry_with_backoff',
		]
		return supportedFeatures.includes(feature)
	}

	/**
	 * Get JSON schema for webhook configuration
	 */
	getConfigSchema(): Record<string, any> {
		return {
			type: 'object',
			properties: {
				webhook: {
					type: 'object',
					required: ['url', 'method'],
					properties: {
						url: {
							type: 'string',
							format: 'uri',
							pattern: '^https?://',
							description: 'Webhook endpoint URL',
						},
						method: {
							type: 'string',
							enum: ['POST', 'PUT'],
							description: 'HTTP method for webhook requests',
						},
						headers: {
							type: 'object',
							additionalProperties: {
								type: 'string',
							},
							description: 'Additional HTTP headers to include',
						},
						timeout: {
							type: 'number',
							minimum: 1000,
							maximum: 300000,
							description: 'Request timeout in milliseconds',
						},
						retryConfig: {
							type: 'object',
							properties: {
								maxRetries: {
									type: 'number',
									minimum: 0,
									maximum: 10,
								},
								backoffMultiplier: {
									type: 'number',
									minimum: 1,
									maximum: 10,
								},
								maxBackoffDelay: {
									type: 'number',
									minimum: 1000,
									maximum: 3600000,
								},
							},
						},
					},
				},
			},
		}
	}

	/**
	 * Format delivery payload for webhook transmission
	 * Requirements 4.1, 2.1: Payload formatting and content-type handling
	 */
	private formatPayload(payload: DeliveryPayload): Record<string, any> {
		return {
			delivery_id: payload.deliveryId,
			organization_id: payload.organizationId,
			type: payload.type,
			data: payload.data,
			metadata: payload.metadata,
			correlation_id: payload.correlationId,
			idempotency_key: payload.idempotencyKey,
			timestamp: new Date().toISOString(),
		}
	}

	/**
	 * Make HTTP request with error handling
	 * Requirements 4.1, 2.5: HTTP client with timeout and error handling
	 */
	private async makeHttpRequest(options: {
		url: string
		method: string
		headers: Record<string, string>
		body: string
		timeout: number
	}): Promise<HttpResponse> {
		const startTime = Date.now()

		// Create AbortController for timeout handling
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), options.timeout)

		try {
			const response = await fetch(options.url, {
				method: options.method,
				headers: options.headers,
				body: options.body,
				signal: controller.signal,
			})

			clearTimeout(timeoutId)

			// Parse response body
			let body: any
			const contentType = response.headers.get('content-type') || ''

			try {
				if (contentType.includes('application/json')) {
					body = await response.json()
				} else {
					body = await response.text()
				}
			} catch {
				// If body parsing fails, set to null
				body = null
			}

			// Convert Headers to plain object
			const headers: Record<string, string> = {}
			response.headers.forEach((value, key) => {
				headers[key] = value
			})

			return {
				status: response.status,
				statusText: response.statusText,
				headers,
				body,
				responseTime: Date.now() - startTime,
			}
		} catch (error) {
			clearTimeout(timeoutId)

			if (error instanceof Error && error.name === 'AbortError') {
				throw new Error(`Request timeout after ${options.timeout}ms`)
			}

			throw error
		}
	}

	/**
	 * Extract cross-system reference from response
	 * Requirements 9.1, 9.2: Cross-system reference tracking
	 */
	private extractCrossSystemReference(response: HttpResponse): string | undefined {
		// Look for common tracking headers
		const trackingHeaders = [
			'x-request-id',
			'x-correlation-id',
			'x-trace-id',
			'request-id',
			'correlation-id',
			'trace-id',
		]

		for (const header of trackingHeaders) {
			const value = response.headers[header] || response.headers[header.toLowerCase()]
			if (value) {
				return value
			}
		}

		// Try to extract from response body if it's JSON
		if (response.body && typeof response.body === 'object') {
			const referenceFields = ['id', 'requestId', 'correlationId', 'traceId', 'reference']
			for (const field of referenceFields) {
				if (response.body[field]) {
					return String(response.body[field])
				}
			}
		}

		return undefined
	}

	/**
	 * Determine if HTTP status code indicates a retryable error
	 * Requirements 3.1, 3.2: Retry logic for transient failures
	 */
	private isRetryableError(statusCode: number): boolean {
		// Retryable status codes (server errors and rate limiting)
		const retryableStatusCodes = [
			408, // Request Timeout
			429, // Too Many Requests
			500, // Internal Server Error
			502, // Bad Gateway
			503, // Service Unavailable
			504, // Gateway Timeout
		]

		return retryableStatusCodes.includes(statusCode)
	}

	/**
	 * Determine if network error is retryable
	 * Requirements 3.1, 3.2: Network error retry logic
	 */
	private isRetryableNetworkError(error: unknown): boolean {
		if (!(error instanceof Error)) {
			return false
		}

		const retryableErrors = [
			'ECONNRESET',
			'ECONNREFUSED',
			'ETIMEDOUT',
			'ENOTFOUND',
			'EAI_AGAIN',
			'Request timeout',
		]

		return retryableErrors.some((retryableError) => error.message.includes(retryableError))
	}

	/**
	 * Extract destination ID from config or metadata
	 * This is a helper method for secret management integration
	 */
	private extractDestinationId(config: DestinationConfig): number | undefined {
		// In practice, the destination ID would be passed through the delivery context
		// For now, we'll look for it in the webhook config metadata
		if (config.webhook && typeof config.webhook === 'object') {
			const webhookConfig = config.webhook as any
			if (webhookConfig.destinationId) {
				return parseInt(webhookConfig.destinationId)
			}
		}
		return undefined
	}
}
