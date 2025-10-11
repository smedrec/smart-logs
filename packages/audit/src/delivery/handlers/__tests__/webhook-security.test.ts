/**
 * Unit tests for webhook security manager
 * Requirements 4.1, 4.2, 4.3: Webhook security features testing
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WebhookSecurityManager, WebhookSecurityTestUtils } from '../webhook-security.js'

describe('WebhookSecurityManager', () => {
	let securityManager: WebhookSecurityManager

	beforeEach(() => {
		securityManager = new WebhookSecurityManager()
	})

	describe('Security Headers Generation', () => {
		it('should generate security headers without signature', async () => {
			const payload = { test: 'data', number: 123 }
			const organizationId = 'org-123'
			const deliveryId = 'delivery-456'

			const headers = await securityManager.generateSecurityHeaders(
				payload,
				organizationId,
				deliveryId
			)

			expect(headers).toHaveProperty('X-Webhook-Timestamp')
			expect(headers).toHaveProperty('X-Idempotency-Key')
			expect(headers).toHaveProperty('X-Delivery-Id', deliveryId)
			expect(headers).not.toHaveProperty('X-Webhook-Signature')

			// Verify timestamp is valid ISO string
			expect(new Date(headers['X-Webhook-Timestamp']).toISOString()).toBe(
				headers['X-Webhook-Timestamp']
			)

			// Verify idempotency key is 32 characters
			expect(headers['X-Idempotency-Key']).toHaveLength(32)
		})

		it('should generate security headers with signature', async () => {
			const payload = { test: 'data', number: 123 }
			const organizationId = 'org-123'
			const deliveryId = 'delivery-456'
			const secret = 'test-secret-key-with-sufficient-length'

			const headers = await securityManager.generateSecurityHeaders(
				payload,
				organizationId,
				deliveryId,
				secret
			)

			expect(headers).toHaveProperty('X-Webhook-Timestamp')
			expect(headers).toHaveProperty('X-Idempotency-Key')
			expect(headers).toHaveProperty('X-Delivery-Id', deliveryId)
			expect(headers).toHaveProperty('X-Webhook-Signature')

			// Verify signature format
			expect(headers['X-Webhook-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/)
		})
	})

	describe('Signature Generation', () => {
		it('should generate consistent signatures for same input', () => {
			const payload = { test: 'data', order: [3, 1, 2] }
			const secret = 'test-secret-key'
			const timestamp = '2023-01-01T00:00:00.000Z'

			const signature1 = securityManager.generateSignature(payload, secret, timestamp)
			const signature2 = securityManager.generateSignature(payload, secret, timestamp)

			expect(signature1).toBe(signature2)
			expect(signature1).toMatch(/^sha256=[a-f0-9]{64}$/)
		})

		it('should generate different signatures for different payloads', () => {
			const payload1 = { test: 'data1' }
			const payload2 = { test: 'data2' }
			const secret = 'test-secret-key'
			const timestamp = '2023-01-01T00:00:00.000Z'

			const signature1 = securityManager.generateSignature(payload1, secret, timestamp)
			const signature2 = securityManager.generateSignature(payload2, secret, timestamp)

			expect(signature1).not.toBe(signature2)
		})

		it('should generate different signatures for different secrets', () => {
			const payload = { test: 'data' }
			const secret1 = 'test-secret-key-1'
			const secret2 = 'test-secret-key-2'
			const timestamp = '2023-01-01T00:00:00.000Z'

			const signature1 = securityManager.generateSignature(payload, secret1, timestamp)
			const signature2 = securityManager.generateSignature(payload, secret2, timestamp)

			expect(signature1).not.toBe(signature2)
		})

		it('should generate different signatures for different timestamps', () => {
			const payload = { test: 'data' }
			const secret = 'test-secret-key'
			const timestamp1 = '2023-01-01T00:00:00.000Z'
			const timestamp2 = '2023-01-01T00:01:00.000Z'

			const signature1 = securityManager.generateSignature(payload, secret, timestamp1)
			const signature2 = securityManager.generateSignature(payload, secret, timestamp2)

			expect(signature1).not.toBe(signature2)
		})

		it('should handle complex nested objects consistently', () => {
			const payload = {
				nested: { deep: { value: 123 } },
				array: [{ b: 2 }, { a: 1 }],
				null_value: null,
				boolean: true,
			}
			const secret = 'test-secret-key'
			const timestamp = '2023-01-01T00:00:00.000Z'

			const signature1 = securityManager.generateSignature(payload, secret, timestamp)
			const signature2 = securityManager.generateSignature(payload, secret, timestamp)

			expect(signature1).toBe(signature2)
		})
	})

	describe('Signature Verification', () => {
		it('should verify valid signature', () => {
			const payload = { test: 'data', number: 123 }
			const secret = 'test-secret-key'
			const timestamp = new Date().toISOString() // Use current timestamp

			const signature = securityManager.generateSignature(payload, secret, timestamp)
			const result = securityManager.verifySignature(payload, signature, secret, timestamp)

			expect(result.isValid).toBe(true)
			expect(result.error).toBeUndefined()
			expect(result.timestamp).toBe(timestamp)
		})

		it('should reject invalid signature', () => {
			const payload = { test: 'data' }
			const secret = 'test-secret-key'
			const timestamp = new Date().toISOString() // Use current timestamp
			const invalidSignature = 'sha256=invalid-signature-hash'

			const result = securityManager.verifySignature(payload, invalidSignature, secret, timestamp)

			expect(result.isValid).toBe(false)
			expect(result.error).toContain('Signature verification failed')
		})

		it('should reject signature with wrong secret', () => {
			const payload = { test: 'data' }
			const secret = 'test-secret-key'
			const wrongSecret = 'wrong-secret-key'
			const timestamp = new Date().toISOString() // Use current timestamp

			const signature = securityManager.generateSignature(payload, secret, timestamp)
			const result = securityManager.verifySignature(payload, signature, wrongSecret, timestamp)

			expect(result.isValid).toBe(false)
			expect(result.error).toContain('Signature verification failed')
		})

		it('should reject signature with malformed format', () => {
			const payload = { test: 'data' }
			const secret = 'test-secret-key'
			const timestamp = '2023-01-01T00:00:00.000Z'
			const malformedSignature = 'invalid-format'

			const result = securityManager.verifySignature(payload, malformedSignature, secret, timestamp)

			expect(result.isValid).toBe(false)
			expect(result.error).toContain('Invalid signature format')
		})

		it('should reject timestamp that is too old', () => {
			const payload = { test: 'data' }
			const secret = 'test-secret-key'
			const oldTimestamp = new Date(Date.now() - 400000).toISOString() // 6+ minutes ago
			const toleranceMs = 300000 // 5 minutes

			const signature = securityManager.generateSignature(payload, secret, oldTimestamp)
			const result = securityManager.verifySignature(
				payload,
				signature,
				secret,
				oldTimestamp,
				toleranceMs
			)

			expect(result.isValid).toBe(false)
			expect(result.error).toContain('Timestamp too old')
		})

		it('should reject timestamp that is too far in future', () => {
			const payload = { test: 'data' }
			const secret = 'test-secret-key'
			const futureTimestamp = new Date(Date.now() + 400000).toISOString() // 6+ minutes in future
			const toleranceMs = 300000 // 5 minutes

			const signature = securityManager.generateSignature(payload, secret, futureTimestamp)
			const result = securityManager.verifySignature(
				payload,
				signature,
				secret,
				futureTimestamp,
				toleranceMs
			)

			expect(result.isValid).toBe(false)
			expect(result.error).toContain('Timestamp too far in future')
		})

		it('should accept timestamp within tolerance', () => {
			const payload = { test: 'data' }
			const secret = 'test-secret-key'
			const recentTimestamp = new Date(Date.now() - 60000).toISOString() // 1 minute ago
			const toleranceMs = 300000 // 5 minutes

			const signature = securityManager.generateSignature(payload, secret, recentTimestamp)
			const result = securityManager.verifySignature(
				payload,
				signature,
				secret,
				recentTimestamp,
				toleranceMs
			)

			expect(result.isValid).toBe(true)
			expect(result.age).toBeLessThan(toleranceMs)
		})
	})

	describe('Idempotency Key Generation', () => {
		it('should generate consistent idempotency keys', () => {
			const deliveryId = 'delivery-123'
			const timestamp = '2023-01-01T00:00:00.000Z'

			const key1 = securityManager.generateIdempotencyKey(deliveryId, timestamp)
			const key2 = securityManager.generateIdempotencyKey(deliveryId, timestamp)

			expect(key1).toBe(key2)
			expect(key1).toHaveLength(32)
			expect(key1).toMatch(/^[a-f0-9]{32}$/)
		})

		it('should generate different keys for different inputs', () => {
			const deliveryId1 = 'delivery-123'
			const deliveryId2 = 'delivery-456'
			const timestamp = '2023-01-01T00:00:00.000Z'

			const key1 = securityManager.generateIdempotencyKey(deliveryId1, timestamp)
			const key2 = securityManager.generateIdempotencyKey(deliveryId2, timestamp)

			expect(key1).not.toBe(key2)
		})
	})

	describe('Webhook Secret Generation', () => {
		it('should generate random secrets of specified length', () => {
			const secret1 = securityManager.generateWebhookSecret(32)
			const secret2 = securityManager.generateWebhookSecret(32)

			expect(secret1).toHaveLength(64) // 32 bytes = 64 hex characters
			expect(secret2).toHaveLength(64)
			expect(secret1).not.toBe(secret2)
			expect(secret1).toMatch(/^[a-f0-9]{64}$/)
		})

		it('should generate secrets of different lengths', () => {
			const secret16 = securityManager.generateWebhookSecret(16)
			const secret64 = securityManager.generateWebhookSecret(64)

			expect(secret16).toHaveLength(32) // 16 bytes = 32 hex characters
			expect(secret64).toHaveLength(128) // 64 bytes = 128 hex characters
		})
	})

	describe('Secret Format Validation', () => {
		it('should validate valid secrets', () => {
			const validSecrets = [
				'a'.repeat(32), // Minimum length
				'A'.repeat(64), // Mixed case
				'1234567890abcdef'.repeat(4), // Numbers and letters
				'test-secret-key-with-dashes-and-underscores_123456789012345',
				'test+secret/key=with+symbols+and+sufficient+length+for+validation',
			]

			validSecrets.forEach((secret) => {
				const result = securityManager.validateSecretFormat(secret)
				expect(result.isValid).toBe(true)
				expect(result.errors).toHaveLength(0)
			})
		})

		it('should reject invalid secrets', () => {
			const invalidSecrets = [
				'', // Empty
				'short', // Too short
				'a'.repeat(300), // Too long
				'secret with spaces', // Invalid characters
				'secret@with#invalid$chars', // Invalid symbols
			]

			invalidSecrets.forEach((secret) => {
				const result = securityManager.validateSecretFormat(secret)
				expect(result.isValid).toBe(false)
				expect(result.errors.length).toBeGreaterThan(0)
			})
		})
	})

	describe('Object Key Sorting', () => {
		it('should sort object keys consistently', () => {
			const payload1 = { c: 3, a: 1, b: 2 }
			const payload2 = { a: 1, b: 2, c: 3 }
			const secret = 'test-secret'
			const timestamp = '2023-01-01T00:00:00.000Z'

			const signature1 = securityManager.generateSignature(payload1, secret, timestamp)
			const signature2 = securityManager.generateSignature(payload2, secret, timestamp)

			expect(signature1).toBe(signature2)
		})

		it('should handle nested objects consistently', () => {
			const payload1 = { outer: { c: 3, a: 1, b: 2 } }
			const payload2 = { outer: { a: 1, b: 2, c: 3 } }
			const secret = 'test-secret'
			const timestamp = '2023-01-01T00:00:00.000Z'

			const signature1 = securityManager.generateSignature(payload1, secret, timestamp)
			const signature2 = securityManager.generateSignature(payload2, secret, timestamp)

			expect(signature1).toBe(signature2)
		})
	})
})

describe('WebhookSecurityTestUtils', () => {
	let testUtils: WebhookSecurityTestUtils

	beforeEach(() => {
		testUtils = new WebhookSecurityTestUtils()
	})

	describe('Test Webhook Request Creation', () => {
		it('should create valid test webhook request', async () => {
			const payload = { test: 'data' }
			const secret = 'test-secret-key-with-sufficient-length'

			const testRequest = await testUtils.createTestWebhookRequest(payload, secret)

			expect(testRequest.payload).toEqual(payload)
			expect(testRequest.headers).toHaveProperty('X-Webhook-Timestamp')
			expect(testRequest.headers).toHaveProperty('X-Idempotency-Key')
			expect(testRequest.headers).toHaveProperty('X-Delivery-Id')
			expect(testRequest.headers).toHaveProperty('X-Webhook-Signature')
			expect(testRequest.signature).toBe(testRequest.headers['X-Webhook-Signature'])
		})
	})

	describe('Test Webhook Request Verification', () => {
		it('should verify valid test webhook request', async () => {
			const payload = { test: 'data' }
			const secret = 'test-secret-key-with-sufficient-length'

			const testRequest = await testUtils.createTestWebhookRequest(payload, secret)
			const result = testUtils.verifyTestWebhookRequest(
				testRequest.payload,
				testRequest.signature,
				secret,
				testRequest.headers['X-Webhook-Timestamp']
			)

			expect(result.isValid).toBe(true)
		})

		it('should reject invalid test webhook request', async () => {
			const payload = { test: 'data' }
			const secret = 'test-secret-key-with-sufficient-length'
			const wrongSecret = 'wrong-secret-key-with-sufficient-length'

			const testRequest = await testUtils.createTestWebhookRequest(payload, secret)
			const result = testUtils.verifyTestWebhookRequest(
				testRequest.payload,
				testRequest.signature,
				wrongSecret,
				testRequest.headers['X-Webhook-Timestamp']
			)

			expect(result.isValid).toBe(false)
		})
	})

	describe('Test Secret Generation', () => {
		it('should generate test secrets', () => {
			const secret1 = testUtils.generateTestSecret()
			const secret2 = testUtils.generateTestSecret(64)

			expect(secret1).toHaveLength(64) // 32 bytes = 64 hex characters
			expect(secret2).toHaveLength(128) // 64 bytes = 128 hex characters
			expect(secret1).not.toBe(secret2)
		})
	})
})
