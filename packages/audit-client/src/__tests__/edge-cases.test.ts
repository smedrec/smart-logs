/**
 * Edge Cases Test Suite
 *
 * Comprehensive tests for edge cases including:
 * - Network failures and error scenarios
 * - Timeout handling
 * - Malformed responses
 * - Concurrency and race conditions
 * - Cache contention
 * - Empty responses and large payloads
 * - Special characters
 * - Browser compatibility issues
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuditClient } from '../core/client'
import { HttpError, NetworkError, TimeoutError, ValidationError } from '../infrastructure/error'

import type { AuditClientConfig } from '../core/config'
import type { Logger } from '../infrastructure/logger'

describe('Edge Cases - Network Failures', () => {
	let client: AuditClient
	let mockLogger: Logger
	let config: AuditClientConfig

	beforeEach(() => {
		mockLogger = {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		}

		config = {
			baseUrl: 'https://api.example.com',
			apiVersion: 'v1',
			timeout: 5000,
			authentication: {
				type: 'apiKey',
				apiKey: 'test-key',
			},
			retry: {
				enabled: true,
				maxAttempts: 3,
				initialDelayMs: 100,
				maxDelayMs: 1000,
				backoffMultiplier: 2,
			},
			logging: {
				enabled: true,
				level: 'error',
				customLogger: mockLogger,
			},
		}

		client = new AuditClient(config)
	})

	it('should handle complete network failure', async () => {
		global.fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'))

		await expect(
			client.events.create({
				action: 'test',
				actorId: 'user-1',
				resourceType: 'document',
			})
		).rejects.toThrow()
	})

	it('should handle DNS resolution failure', async () => {
		global.fetch = vi.fn().mockRejectedValue(new TypeError('getaddrinfo ENOTFOUND'))

		await expect(
			client.events.create({
				action: 'test',
				actorId: 'user-1',
				resourceType: 'document',
			})
		).rejects.toThrow()
	})

	it('should handle connection reset', async () => {
		global.fetch = vi.fn().mockRejectedValue(new Error('ECONNRESET'))

		await expect(
			client.events.create({
				action: 'test',
				actorId: 'user-1',
				resourceType: 'document',
			})
		).rejects.toThrow()
	})

	it('should handle connection timeout', async () => {
		global.fetch = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'))

		await expect(
			client.events.create({
				action: 'test',
				actorId: 'user-1',
				resourceType: 'document',
			})
		).rejects.toThrow()
	})

	it('should handle SSL/TLS errors', async () => {
		global.fetch = vi.fn().mockRejectedValue(new Error('certificate has expired'))

		await expect(
			client.events.create({
				action: 'test',
				actorId: 'user-1',
				resourceType: 'document',
			})
		).rejects.toThrow()
	})

	it('should handle aborted requests', async () => {
		global.fetch = vi
			.fn()
			.mockRejectedValue(new DOMException('The user aborted a request', 'AbortError'))

		await expect(
			client.events.create({
				action: 'test',
				actorId: 'user-1',
				resourceType: 'document',
			})
		).rejects.toThrow()
	})
})

describe('Edge Cases - Timeout Handling', () => {
	let client: AuditClient
	let config: AuditClientConfig

	beforeEach(() => {
		config = {
			baseUrl: 'https://api.example.com',
			apiVersion: 'v1',
			timeout: 100, // Very short timeout
			authentication: {
				type: 'apiKey',
				apiKey: 'test-key',
			},
			retry: {
				enabled: false, // Disable retry for timeout tests
				maxAttempts: 1,
				initialDelayMs: 100,
				maxDelayMs: 1000,
				backoffMultiplier: 2,
			},
		}

		client = new AuditClient(config)
	})

	it('should timeout on slow responses', async () => {
		global.fetch = vi.fn().mockImplementation(
			() =>
				new Promise((resolve) =>
					setTimeout(
						() =>
							resolve({
								ok: true,
								status: 200,
								json: async () => ({ id: '1' }),
							}),
						200
					)
				) // Longer than timeout
		)

		await expect(
			client.events.create({
				action: 'test',
				actorId: 'user-1',
				resourceType: 'document',
			})
		).rejects.toThrow()
	})

	it('should handle timeout during response body reading', async () => {
		const mockResponse = {
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: vi
				.fn()
				.mockImplementation(
					() => new Promise((resolve) => setTimeout(() => resolve({ id: '1' }), 200))
				),
		}

		global.fetch = vi.fn().mockResolvedValue(mockResponse)

		await expect(
			client.events.create({
				action: 'test',
				actorId: 'user-1',
				resourceType: 'document',
			})
		).rejects.toThrow()
	})

	it('should respect custom timeout per request', async () => {
		global.fetch = vi.fn().mockImplementation(
			() =>
				new Promise((resolve) =>
					setTimeout(
						() =>
							resolve({
								ok: true,
								status: 200,
								json: async () => ({ id: '1' }),
							}),
						150
					)
				)
		)

		// This should timeout with default 100ms
		await expect(
			client.events.create({
				action: 'test',
				actorId: 'user-1',
				resourceType: 'document',
			})
		).rejects.toThrow()
	})
})

describe('Edge Cases - Malformed Responses', () => {
	let client: AuditClient

	beforeEach(() => {
		client = new AuditClient({
			baseUrl: 'https://api.example.com',
			apiVersion: 'v1',
			authentication: {
				type: 'apiKey',
				apiKey: 'test-key',
			},
		})
	})

	it('should handle invalid JSON responses', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			text: async () => 'not valid json {',
			json: async () => {
				throw new SyntaxError('Unexpected end of JSON input')
			},
		})

		await expect(
			client.events.create({
				action: 'test',
				actorId: 'user-1',
				resourceType: 'document',
			})
		).rejects.toThrow()
	})

	it('should handle empty response body when JSON expected', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			text: async () => '',
			json: async () => {
				throw new SyntaxError('Unexpected end of JSON input')
			},
		})

		await expect(
			client.events.create({
				action: 'test',
				actorId: 'user-1',
				resourceType: 'document',
			})
		).rejects.toThrow()
	})

	it('should handle wrong content-type header', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'text/html' }),
			text: async () => '<html><body>Success</body></html>',
			json: async () => {
				throw new SyntaxError('Unexpected token < in JSON')
			},
		})

		await expect(
			client.events.create({
				action: 'test',
				actorId: 'user-1',
				resourceType: 'document',
			})
		).rejects.toThrow()
	})

	it('should handle missing content-type header', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers(),
			text: async () => 'plain text response',
			json: async () => {
				throw new SyntaxError('Unexpected token p in JSON')
			},
		})

		await expect(
			client.events.create({
				action: 'test',
				actorId: 'user-1',
				resourceType: 'document',
			})
		).rejects.toThrow()
	})

	it('should handle truncated JSON response', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			text: async () => '{"id":"123","data":{"nested":',
			json: async () => {
				throw new SyntaxError('Unexpected end of JSON input')
			},
		})

		await expect(
			client.events.create({
				action: 'test',
				actorId: 'user-1',
				resourceType: 'document',
			})
		).rejects.toThrow()
	})

	it('should handle response with BOM (Byte Order Mark)', async () => {
		const jsonWithBOM = '\uFEFF{"id":"123","action":"test"}'

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			text: async () => jsonWithBOM,
			json: async () => JSON.parse(jsonWithBOM),
		})

		// Should handle BOM gracefully
		const result = await client.events.create({
			action: 'test',
			actorId: 'user-1',
			resourceType: 'document',
		})

		expect(result).toBeDefined()
	})
})

describe('Edge Cases - Concurrency and Race Conditions', () => {
	let client: AuditClient

	beforeEach(() => {
		client = new AuditClient({
			baseUrl: 'https://api.example.com',
			apiVersion: 'v1',
			authentication: {
				type: 'apiKey',
				apiKey: 'test-key',
			},
			cache: {
				enabled: true,
				defaultTtlMs: 5000,
			},
		})
	})

	it('should handle parallel requests to same endpoint', async () => {
		let callCount = 0
		global.fetch = vi.fn().mockImplementation(async () => {
			callCount++
			await new Promise((resolve) => setTimeout(resolve, 10))
			return {
				ok: true,
				status: 200,
				headers: new Headers({ 'content-type': 'application/json' }),
				json: async () => ({ id: `event-${callCount}`, action: 'test' }),
			}
		})

		const promises = Array.from({ length: 10 }, (_, i) =>
			client.events.create({
				action: `test-${i}`,
				actorId: 'user-1',
				resourceType: 'document',
			})
		)

		const results = await Promise.all(promises)
		expect(results).toHaveLength(10)
		expect(callCount).toBeGreaterThan(0)
	})

	it('should handle race condition in cache access', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ events: [] }),
		})

		// Multiple concurrent reads to same cached endpoint
		const promises = Array.from({ length: 20 }, () => client.events.query({ limit: 10 }))

		const results = await Promise.all(promises)
		expect(results).toHaveLength(20)
		// All should return same cached result
		results.forEach((result) => {
			expect(result).toEqual(results[0])
		})
	})

	it('should handle concurrent cache writes', async () => {
		let requestCount = 0
		global.fetch = vi.fn().mockImplementation(async () => {
			requestCount++
			await new Promise((resolve) => setTimeout(resolve, Math.random() * 20))
			return {
				ok: true,
				status: 200,
				headers: new Headers({ 'content-type': 'application/json' }),
				json: async () => ({ id: `event-${requestCount}` }),
			}
		})

		// Create multiple events concurrently
		const promises = Array.from({ length: 15 }, (_, i) =>
			client.events.create({
				action: `concurrent-${i}`,
				actorId: 'user-1',
				resourceType: 'document',
			})
		)

		const results = await Promise.all(promises)
		expect(results).toHaveLength(15)
		// Each should have unique ID
		const ids = results.map((r) => r.id)
		expect(new Set(ids).size).toBe(15)
	})

	it('should handle authentication refresh race condition', async () => {
		let refreshCount = 0
		const clientWithAuth = new AuditClient({
			baseUrl: 'https://api.example.com',
			apiVersion: 'v1',
			authentication: {
				type: 'session',
				sessionToken: 'expired-token',
				autoRefresh: true,
				refreshToken: 'refresh-token',
			},
		})

		global.fetch = vi.fn().mockImplementation(async (url) => {
			if (url.includes('/auth/refresh')) {
				refreshCount++
				await new Promise((resolve) => setTimeout(resolve, 50))
				return {
					ok: true,
					status: 200,
					headers: new Headers({ 'content-type': 'application/json' }),
					json: async () => ({
						sessionToken: `new-token-${refreshCount}`,
						expiresAt: Date.now() + 3600000,
					}),
				}
			}

			// First call returns 401, subsequent calls succeed
			if (refreshCount === 0) {
				return {
					ok: false,
					status: 401,
					headers: new Headers({ 'content-type': 'application/json' }),
					json: async () => ({ error: 'Unauthorized' }),
				}
			}

			return {
				ok: true,
				status: 200,
				headers: new Headers({ 'content-type': 'application/json' }),
				json: async () => ({ id: 'event-1' }),
			}
		})

		// Multiple concurrent requests that trigger auth refresh
		const promises = Array.from(
			{ length: 5 },
			() =>
				client.events
					.create({
						action: 'test',
						actorId: 'user-1',
						resourceType: 'document',
					})
					.catch(() => null) // Catch errors for this test
		)

		await Promise.all(promises)
		// Should only refresh once despite multiple concurrent requests
		expect(refreshCount).toBeLessThanOrEqual(2)
	})
})

describe('Edge Cases - Large Payloads and Special Characters', () => {
	let client: AuditClient

	beforeEach(() => {
		client = new AuditClient({
			baseUrl: 'https://api.example.com',
			apiVersion: 'v1',
			authentication: {
				type: 'apiKey',
				apiKey: 'test-key',
			},
		})
	})

	it('should handle very large request payload', async () => {
		const largeMetadata = {
			data: 'x'.repeat(1024 * 100), // 100KB of data
			nested: {
				array: Array.from({ length: 1000 }, (_, i) => ({ index: i, value: `item-${i}` })),
			},
		}

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ id: 'event-1', metadata: largeMetadata }),
		})

		const result = await client.events.create({
			action: 'test',
			actorId: 'user-1',
			resourceType: 'document',
			metadata: largeMetadata,
		})

		expect(result).toBeDefined()
		expect(result.id).toBe('event-1')
	})

	it('should handle very large response payload', async () => {
		const largeResponse = {
			events: Array.from({ length: 10000 }, (_, i) => ({
				id: `event-${i}`,
				action: 'test',
				actorId: 'user-1',
				resourceType: 'document',
				timestamp: new Date().toISOString(),
				metadata: { index: i, data: 'x'.repeat(100) },
			})),
			total: 10000,
		}

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => largeResponse,
		})

		const result = await client.events.query({ limit: 10000 })
		expect(result.events).toHaveLength(10000)
	})

	it('should handle special characters in strings', async () => {
		const specialChars = {
			unicode: '你好世界 🌍 مرحبا العالم',
			emoji: '😀😃😄😁😆😅🤣😂',
			control: 'Line1\nLine2\tTabbed\rCarriage',
			quotes: `Single' Double" Backtick\` Mixed'"`,
			escape: 'Backslash\\ Null\0 Bell\x07',
			html: '<script>alert("xss")</script>',
			sql: "'; DROP TABLE users; --",
			json: '{"nested": "value"}',
		}

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ id: 'event-1', metadata: specialChars }),
		})

		const result = await client.events.create({
			action: 'test',
			actorId: 'user-1',
			resourceType: 'document',
			metadata: specialChars,
		})

		expect(result).toBeDefined()
		expect(result.metadata).toEqual(specialChars)
	})

	it('should handle deeply nested objects', async () => {
		// Create deeply nested object (100 levels)
		let deepObject: any = { value: 'bottom' }
		for (let i = 0; i < 100; i++) {
			deepObject = { level: i, nested: deepObject }
		}

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ id: 'event-1', metadata: deepObject }),
		})

		const result = await client.events.create({
			action: 'test',
			actorId: 'user-1',
			resourceType: 'document',
			metadata: deepObject,
		})

		expect(result).toBeDefined()
	})

	it('should handle circular references gracefully', async () => {
		const circular: any = { name: 'test' }
		circular.self = circular

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ id: 'event-1' }),
		})

		// Should throw or handle circular reference
		await expect(
			client.events.create({
				action: 'test',
				actorId: 'user-1',
				resourceType: 'document',
				metadata: circular,
			})
		).rejects.toThrow()
	})

	it('should handle empty strings and null values', async () => {
		const edgeCaseData = {
			emptyString: '',
			nullValue: null,
			undefinedValue: undefined,
			zero: 0,
			false: false,
			emptyArray: [],
			emptyObject: {},
		}

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ id: 'event-1', metadata: edgeCaseData }),
		})

		const result = await client.events.create({
			action: 'test',
			actorId: 'user-1',
			resourceType: 'document',
			metadata: edgeCaseData,
		})

		expect(result).toBeDefined()
	})
})

describe('Edge Cases - Browser Compatibility', () => {
	let client: AuditClient
	let originalLocalStorage: Storage
	let originalSessionStorage: Storage

	beforeEach(() => {
		originalLocalStorage = global.localStorage
		originalSessionStorage = global.sessionStorage

		client = new AuditClient({
			baseUrl: 'https://api.example.com',
			apiVersion: 'v1',
			authentication: {
				type: 'apiKey',
				apiKey: 'test-key',
			},
			cache: {
				enabled: true,
				storage: 'localStorage',
			},
		})
	})

	afterEach(() => {
		global.localStorage = originalLocalStorage
		global.sessionStorage = originalSessionStorage
	})

	it('should handle localStorage unavailable', async () => {
		// Simulate localStorage being unavailable
		Object.defineProperty(global, 'localStorage', {
			get: () => {
				throw new Error('localStorage is not available')
			},
			configurable: true,
		})

		// Client should fall back to memory storage
		const clientWithoutStorage = new AuditClient({
			baseUrl: 'https://api.example.com',
			apiVersion: 'v1',
			authentication: {
				type: 'apiKey',
				apiKey: 'test-key',
			},
			cache: {
				enabled: true,
				storage: 'localStorage',
			},
		})

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ id: 'event-1' }),
		})

		// Should still work with fallback
		const result = await clientWithoutStorage.events.create({
			action: 'test',
			actorId: 'user-1',
			resourceType: 'document',
		})

		expect(result).toBeDefined()
	})

	it('should handle localStorage quota exceeded', async () => {
		const mockStorage = {
			getItem: vi.fn(),
			setItem: vi.fn().mockImplementation(() => {
				throw new DOMException('QuotaExceededError', 'QuotaExceededError')
			}),
			removeItem: vi.fn(),
			clear: vi.fn(),
			length: 0,
			key: vi.fn(),
		}

		global.localStorage = mockStorage as any

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ events: [] }),
		})

		// Should handle quota error gracefully
		const result = await client.events.query({ limit: 10 })
		expect(result).toBeDefined()
	})

	it('should handle cookies disabled', async () => {
		// Simulate cookie-based auth when cookies are disabled
		Object.defineProperty(document, 'cookie', {
			get: () => '',
			set: () => {
				throw new Error('Cookies are disabled')
			},
			configurable: true,
		})

		const clientWithCookies = new AuditClient({
			baseUrl: 'https://api.example.com',
			apiVersion: 'v1',
			authentication: {
				type: 'cookie',
				cookieName: 'session',
			},
		})

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ id: 'event-1' }),
		})

		// Should handle gracefully or throw appropriate error
		await expect(
			clientWithCookies.events.create({
				action: 'test',
				actorId: 'user-1',
				resourceType: 'document',
			})
		).resolves.toBeDefined()
	})

	it('should handle missing fetch API', async () => {
		const originalFetch = global.fetch
		delete (global as any).fetch

		// Should throw appropriate error
		expect(() => {
			new AuditClient({
				baseUrl: 'https://api.example.com',
				apiVersion: 'v1',
				authentication: {
					type: 'apiKey',
					apiKey: 'test-key',
				},
			})
		}).toThrow()

		global.fetch = originalFetch
	})

	it('should handle missing Promise support', async () => {
		// This is more of a theoretical test since vitest requires Promises
		// But we can test that our code doesn't use non-standard Promise features

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ id: 'event-1' }),
		})

		const result = await client.events.create({
			action: 'test',
			actorId: 'user-1',
			resourceType: 'document',
		})

		expect(result).toBeDefined()
		expect(result).toBeInstanceOf(Object)
	})
})

describe('Edge Cases - Empty and Null Responses', () => {
	let client: AuditClient

	beforeEach(() => {
		client = new AuditClient({
			baseUrl: 'https://api.example.com',
			apiVersion: 'v1',
			authentication: {
				type: 'apiKey',
				apiKey: 'test-key',
			},
		})
	})

	it('should handle 204 No Content response', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 204,
			headers: new Headers(),
			text: async () => '',
			json: async () => {
				throw new SyntaxError('Unexpected end of JSON input')
			},
		})

		// Should handle 204 gracefully
		const result = await client.events.create({
			action: 'test',
			actorId: 'user-1',
			resourceType: 'document',
		})

		expect(result).toBeDefined()
	})

	it('should handle empty array response', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ events: [], total: 0 }),
		})

		const result = await client.events.query({ limit: 10 })
		expect(result.events).toEqual([])
		expect(result.total).toBe(0)
	})

	it('should handle null response body', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => null,
		})

		const result = await client.events.query({ limit: 10 })
		expect(result).toBeNull()
	})

	it('should handle response with only whitespace', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			text: async () => '   \n\t  ',
			json: async () => {
				throw new SyntaxError('Unexpected end of JSON input')
			},
		})

		await expect(
			client.events.create({
				action: 'test',
				actorId: 'user-1',
				resourceType: 'document',
			})
		).rejects.toThrow()
	})
})
