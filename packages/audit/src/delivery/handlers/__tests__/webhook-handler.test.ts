/**
 * Unit tests for webhook handler
 * Requirements 4.1, 4.2, 4.3, 4.4, 4.5: Comprehensive webhook handler testing
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { WebhookHandler } from '../webhook-handler.js'
import { WebhookSecretManager } from '../webhook-secret-manager.js'
import { WebhookSecurityManager } from '../webhook-security.js'

import type {
	DeliveryPayload,
	DestinationConfig,
	IWebhookSecretRepository,
} from '../../database-client.js'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock secret repository
const mockSecretRepository: IWebhookSecretRepository = {
	create: vi.fn(),
	findByDestinationId: vi.fn(),
	findActiveByDestinationId: vi.fn(),
	rotate: vi.fn(),
	markInactive: vi.fn(),
	cleanup: vi.fn(),
}

describe('WebhookHandler', () => {
	let handler: WebhookHandler
	let securityManager: WebhookSecurityManager

	beforeEach(() => {
		vi.clearAllMocks()
		securityManager = new WebhookSecurityManager()
		handler = new WebhookHandler({ timeout: 5000 }, securityManager, mockSecretRepository)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('Configuration Validation', () => {
		it('should validate valid webhook configuration', () => {
			const config: DestinationConfig = {
				webhook: {
					url: 'https://example.com/webhook',
					method: 'POST',
					headers: { Authorization: 'Bearer token' },
					timeout: 30000,
					retryConfig: {
						maxRetries: 3,
						backoffMultiplier: 2,
						maxBackoffDelay: 60000,
					},
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should reject configuration without webhook config', () => {
			const config: DestinationConfig = {}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Webhook configuration is required')
		})

		it('should reject invalid URL', () => {
			const config: DestinationConfig = {
				webhook: {
					url: 'invalid-url',
					method: 'POST',
					headers: {},
					timeout: 30000,
					retryConfig: {
						maxRetries: 3,
						backoffMultiplier: 2,
						maxBackoffDelay: 60000,
					},
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Invalid webhook URL format')
		})

		it('should warn about HTTP URLs', () => {
			const config: DestinationConfig = {
				webhook: {
					url: 'http://example.com/webhook',
					method: 'POST',
					headers: {},
					timeout: 30000,
					retryConfig: {
						maxRetries: 3,
						backoffMultiplier: 2,
						maxBackoffDelay: 60000,
					},
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(true)
			expect(result.warnings).toContain('HTTP URLs are not secure. Consider using HTTPS.')
		})

		it('should reject invalid HTTP method', () => {
			const config: DestinationConfig = {
				webhook: {
					url: 'https://example.com/webhook',
					method: 'GET' as any,
					headers: {},
					timeout: 30000,
					retryConfig: {
						maxRetries: 3,
						backoffMultiplier: 2,
						maxBackoffDelay: 60000,
					},
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('HTTP method must be POST or PUT')
		})

		it('should reject invalid timeout', () => {
			const config: DestinationConfig = {
				webhook: {
					url: 'https://example.com/webhook',
					method: 'POST',
					headers: {},
					timeout: -1000,
					retryConfig: {
						maxRetries: 3,
						backoffMultiplier: 2,
						maxBackoffDelay: 60000,
					},
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Timeout must be a positive number')
		})
	})

	describe('Connection Testing', () => {
		it('should successfully test connection to valid endpoint', async () => {
			const config: DestinationConfig = {
				webhook: {
					url: 'https://example.com/webhook',
					method: 'POST',
					headers: { Authorization: 'Bearer token' },
					timeout: 5000,
					retryConfig: {
						maxRetries: 3,
						backoffMultiplier: 2,
						maxBackoffDelay: 60000,
					},
				},
			}

			// Mock successful response
			mockFetch.mockResolvedValueOnce({
				status: 200,
				statusText: 'OK',
				headers: new Map([['content-type', 'application/json']]),
				json: async () => ({ success: true }),
			})

			const result = await handler.testConnection(config)

			expect(result.success).toBe(true)
			expect(result.statusCode).toBe(200)
			expect(result.responseTime).toBeGreaterThanOrEqual(0)
		})

		it('should handle connection test failure', async () => {
			const config: DestinationConfig = {
				webhook: {
					url: 'https://example.com/webhook',
					method: 'POST',
					headers: {},
					timeout: 5000,
					retryConfig: {
						maxRetries: 3,
						backoffMultiplier: 2,
						maxBackoffDelay: 60000,
					},
				},
			}

			// Mock network error
			mockFetch.mockRejectedValueOnce(new Error('Network error'))

			const result = await handler.testConnection(config)

			expect(result.success).toBe(false)
			expect(result.error).toContain('Network error')
		})

		it('should handle HTTP error status codes', async () => {
			const config: DestinationConfig = {
				webhook: {
					url: 'https://example.com/webhook',
					method: 'POST',
					headers: {},
					timeout: 5000,
					retryConfig: {
						maxRetries: 3,
						backoffMultiplier: 2,
						maxBackoffDelay: 60000,
					},
				},
			}

			// Mock 404 response
			mockFetch.mockResolvedValueOnce({
				status: 404,
				statusText: 'Not Found',
				headers: new Map(),
				text: async () => 'Not Found',
			})

			const result = await handler.testConnection(config)

			expect(result.success).toBe(false)
			expect(result.statusCode).toBe(404)
		})
	})

	describe('Payload Delivery', () => {
		const validConfig: DestinationConfig = {
			webhook: {
				url: 'https://example.com/webhook',
				method: 'POST',
				headers: { Authorization: 'Bearer token' },
				timeout: 5000,
				retryConfig: {
					maxRetries: 3,
					backoffMultiplier: 2,
					maxBackoffDelay: 60000,
				},
			},
		}

		const testPayload: DeliveryPayload = {
			deliveryId: 'test-delivery-123',
			organizationId: 'org-123',
			type: 'report',
			data: { reportId: 'report-456', content: 'test data' },
			metadata: { source: 'test' },
			correlationId: 'corr-789',
			idempotencyKey: 'idem-abc',
		}

		it('should successfully deliver payload', async () => {
			// Mock successful response
			mockFetch.mockResolvedValueOnce({
				status: 200,
				statusText: 'OK',
				headers: new Map([
					['content-type', 'application/json'],
					['x-request-id', 'req-123'],
				]),
				json: async () => ({ received: true, id: 'webhook-response-123' }),
			})

			const result = await handler.deliver(testPayload, validConfig)

			expect(result.success).toBe(true)
			expect(result.statusCode).toBe(200)
			expect(result.crossSystemReference).toBe('req-123')
			expect(result.deliveredAt).toBeDefined()
			expect(result.responseTime).toBeGreaterThan(0)
		})

		it('should handle delivery failure with retryable error', async () => {
			// Mock 503 Service Unavailable
			mockFetch.mockResolvedValueOnce({
				status: 503,
				statusText: 'Service Unavailable',
				headers: new Map(),
				text: async () => 'Service temporarily unavailable',
			})

			const result = await handler.deliver(testPayload, validConfig)

			expect(result.success).toBe(false)
			expect(result.statusCode).toBe(503)
			expect(result.retryable).toBe(true)
			expect(result.error).toContain('HTTP 503')
		})

		it('should handle delivery failure with non-retryable error', async () => {
			// Mock 400 Bad Request
			mockFetch.mockResolvedValueOnce({
				status: 400,
				statusText: 'Bad Request',
				headers: new Map(),
				text: async () => 'Invalid payload format',
			})

			const result = await handler.deliver(testPayload, validConfig)

			expect(result.success).toBe(false)
			expect(result.statusCode).toBe(400)
			expect(result.retryable).toBe(false)
			expect(result.error).toContain('HTTP 400')
		})

		it('should handle network errors', async () => {
			// Mock network timeout
			mockFetch.mockRejectedValueOnce(new Error('Request timeout after 5000ms'))

			const result = await handler.deliver(testPayload, validConfig)

			expect(result.success).toBe(false)
			expect(result.retryable).toBe(true)
			expect(result.error).toContain('Request timeout')
		})

		it('should include security headers in request', async () => {
			// Mock successful response
			mockFetch.mockResolvedValueOnce({
				status: 200,
				statusText: 'OK',
				headers: new Map(),
				text: async () => 'OK',
			})

			await handler.deliver(testPayload, validConfig)

			// Verify fetch was called with security headers
			expect(mockFetch).toHaveBeenCalledWith(
				'https://example.com/webhook',
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						'Content-Type': 'application/json',
						'X-Webhook-Timestamp': expect.any(String),
						'X-Idempotency-Key': expect.any(String),
						'X-Delivery-Id': 'test-delivery-123',
						Authorization: 'Bearer token',
					}),
					body: expect.any(String),
				})
			)
		})
	})

	describe('Feature Support', () => {
		it('should support signature verification', () => {
			expect(handler.supportsFeature('signature_verification')).toBe(true)
		})

		it('should support idempotency', () => {
			expect(handler.supportsFeature('idempotency')).toBe(true)
		})

		it('should support retry with backoff', () => {
			expect(handler.supportsFeature('retry_with_backoff')).toBe(true)
		})

		it('should not support unsupported features', () => {
			expect(handler.supportsFeature('compression')).toBe(false)
			expect(handler.supportsFeature('encryption')).toBe(false)
		})
	})

	describe('Configuration Schema', () => {
		it('should return valid JSON schema', () => {
			const schema = handler.getConfigSchema()

			expect(schema).toHaveProperty('type', 'object')
			expect(schema).toHaveProperty('properties.webhook')
			expect(schema.properties.webhook).toHaveProperty('required', ['url', 'method'])
		})
	})

	describe('Error Classification', () => {
		it('should classify retryable HTTP status codes correctly', () => {
			const retryableCodes = [408, 429, 500, 502, 503, 504]
			const nonRetryableCodes = [400, 401, 403, 404, 422]

			// Access private method for testing
			const isRetryableError = (handler as any).isRetryableError.bind(handler)

			retryableCodes.forEach((code) => {
				expect(isRetryableError(code)).toBe(true)
			})

			nonRetryableCodes.forEach((code) => {
				expect(isRetryableError(code)).toBe(false)
			})
		})

		it('should classify retryable network errors correctly', () => {
			const retryableErrors = [
				new Error('ECONNRESET'),
				new Error('ECONNREFUSED'),
				new Error('ETIMEDOUT'),
				new Error('Request timeout after 5000ms'),
			]

			const nonRetryableErrors = [
				new Error('Invalid URL'),
				new Error('Permission denied'),
				'Not an Error object',
			]

			// Access private method for testing
			const isRetryableNetworkError = (handler as any).isRetryableNetworkError.bind(handler)

			retryableErrors.forEach((error) => {
				expect(isRetryableNetworkError(error)).toBe(true)
			})

			nonRetryableErrors.forEach((error) => {
				expect(isRetryableNetworkError(error)).toBe(false)
			})
		})
	})

	describe('Cross-System Reference Extraction', () => {
		it('should extract reference from response headers', () => {
			const response = {
				status: 200,
				statusText: 'OK',
				headers: {
					'x-request-id': 'req-123',
					'content-type': 'application/json',
				},
				body: null,
				responseTime: 100,
			}

			// Access private method for testing
			const extractCrossSystemReference = (handler as any).extractCrossSystemReference.bind(handler)
			const reference = extractCrossSystemReference(response)

			expect(reference).toBe('req-123')
		})

		it('should extract reference from response body', () => {
			const response = {
				status: 200,
				statusText: 'OK',
				headers: {},
				body: { id: 'body-ref-456', success: true },
				responseTime: 100,
			}

			// Access private method for testing
			const extractCrossSystemReference = (handler as any).extractCrossSystemReference.bind(handler)
			const reference = extractCrossSystemReference(response)

			expect(reference).toBe('body-ref-456')
		})

		it('should return undefined when no reference found', () => {
			const response = {
				status: 200,
				statusText: 'OK',
				headers: {},
				body: { success: true },
				responseTime: 100,
			}

			// Access private method for testing
			const extractCrossSystemReference = (handler as any).extractCrossSystemReference.bind(handler)
			const reference = extractCrossSystemReference(response)

			expect(reference).toBeUndefined()
		})
	})

	describe('Payload Formatting', () => {
		it('should format payload correctly for webhook transmission', () => {
			const payload: DeliveryPayload = {
				deliveryId: 'test-delivery-123',
				organizationId: 'org-123',
				type: 'report',
				data: { reportId: 'report-456' },
				metadata: { source: 'test' },
				correlationId: 'corr-789',
				idempotencyKey: 'idem-abc',
			}

			// Access private method for testing
			const formatPayload = (handler as any).formatPayload.bind(handler)
			const formatted = formatPayload(payload)

			expect(formatted).toEqual({
				delivery_id: 'test-delivery-123',
				organization_id: 'org-123',
				type: 'report',
				data: { reportId: 'report-456' },
				metadata: { source: 'test' },
				correlation_id: 'corr-789',
				idempotency_key: 'idem-abc',
				timestamp: expect.any(String),
			})

			// Verify timestamp is valid ISO string
			expect(new Date(formatted.timestamp).toISOString()).toBe(formatted.timestamp)
		})
	})
})
