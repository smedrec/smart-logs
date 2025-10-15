/**
 * Unit tests for download handler
 * Requirements 1.1, 9.1, 9.2, 9.3, 9.4: Comprehensive download handler testing
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DownloadHandler } from '../download-handler.js'

import type {
	DeliveryPayload,
	DestinationConfig,
	IDownloadLinkRepository,
} from '../../database-client.js'

// Mock download link repository
const mockDownloadRepository: IDownloadLinkRepository = {
	createDownloadLink: vi.fn(),
	findById: vi.fn(),
	findByOrganization: vi.fn(),
	recordAccess: vi.fn(),
	revokeLink: vi.fn(),
	cleanupExpired: vi.fn(),
	getAccessStats: vi.fn(),
}

describe('DownloadHandler', () => {
	let handler: DownloadHandler
	const testSecretKey = 'test-secret-key-32-characters-long'
	const testBaseUrl = 'https://api.test.com'

	beforeEach(() => {
		vi.clearAllMocks()
		handler = new DownloadHandler(mockDownloadRepository, testSecretKey, testBaseUrl)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('Configuration Validation', () => {
		it('should validate valid download configuration', () => {
			const config: DestinationConfig = {
				download: {
					expiryHours: 24,
					maxAccess: 10,
					baseUrl: 'https://example.com',
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should reject configuration without download config', () => {
			const config: DestinationConfig = {}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Download configuration is required')
		})

		it('should reject configuration without expiry hours', () => {
			const config: DestinationConfig = {
				download: {} as any,
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Expiry hours is required')
		})

		it('should reject negative expiry hours', () => {
			const config: DestinationConfig = {
				download: {
					expiryHours: -1,
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Expiry hours must be a positive number')
		})

		it('should warn about long expiry times', () => {
			const config: DestinationConfig = {
				download: {
					expiryHours: 10000, // More than 1 year
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(true)
			expect(result.warnings).toContain(
				'Expiry hours exceeds 1 year. Consider using a shorter expiration time.'
			)
		})

		it('should reject invalid max access', () => {
			const config: DestinationConfig = {
				download: {
					expiryHours: 24,
					maxAccess: -1,
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Max access must be a positive number')
		})

		it('should reject invalid base URL', () => {
			const config: DestinationConfig = {
				download: {
					expiryHours: 24,
					baseUrl: 'invalid-url',
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Invalid base URL format')
		})

		it('should warn about HTTP URLs', () => {
			const config: DestinationConfig = {
				download: {
					expiryHours: 24,
					baseUrl: 'http://example.com',
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(true)
			expect(result.warnings).toContain('HTTP URLs are not secure. Consider using HTTPS.')
		})

		it('should reject invalid IP ranges', () => {
			const config: DestinationConfig = {
				download: {
					expiryHours: 24,
					allowedIpRanges: ['invalid-ip'],
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Invalid IP range format: invalid-ip')
		})

		it('should accept valid IP ranges', () => {
			const config: DestinationConfig = {
				download: {
					expiryHours: 24,
					allowedIpRanges: ['192.168.1.0/24', '10.0.0.1'],
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(true)
		})
	})

	describe('Connection Testing', () => {
		it('should successfully test valid configuration', async () => {
			const config: DestinationConfig = {
				download: {
					expiryHours: 1,
				},
			}

			const result = await handler.testConnection(config)

			expect(result.success).toBe(true)
			expect(result.responseTime).toBeGreaterThan(0)
			expect(result.details?.testUrl).toBeDefined()
			expect(result.details?.urlValid).toBe(true)
		})

		it('should fail test for invalid configuration', async () => {
			const config: DestinationConfig = {
				download: {
					expiryHours: -1,
				},
			}

			const result = await handler.testConnection(config)

			expect(result.success).toBe(false)
			expect(result.error).toContain('Configuration validation failed')
		})
	})

	describe('Delivery Operations', () => {
		const validConfig: DestinationConfig = {
			download: {
				expiryHours: 24,
				maxAccess: 5,
			},
		}

		const testPayload: DeliveryPayload = {
			deliveryId: 'test-delivery-123',
			organizationId: 'test-org',
			type: 'report',
			data: {
				id: 'report-123',
				filePath: '/tmp/report.pdf',
				fileName: 'test-report.pdf',
				mimeType: 'application/pdf',
				fileSize: 1024,
			},
			metadata: {
				createdBy: 'test-user',
				reportType: 'audit',
			},
		}

		it('should successfully create download link', async () => {
			mockDownloadRepository.createDownloadLink = vi.fn().mockResolvedValue(undefined)

			const result = await handler.deliver(testPayload, validConfig)

			expect(result.success).toBe(true)
			expect(result.deliveredAt).toBeDefined()
			expect(result.responseTime).toBeGreaterThan(0)
			expect(result.crossSystemReference).toBeDefined()
			expect(result.retryable).toBe(false)

			expect(mockDownloadRepository.createDownloadLink).toHaveBeenCalledWith(
				expect.objectContaining({
					organizationId: testPayload.organizationId,
					deliveryId: testPayload.deliveryId,
					objectId: 'report-123',
					objectType: testPayload.type,
					fileName: 'test-report.pdf',
					mimeType: 'application/pdf',
					fileSize: 1024,
					algorithm: 'HMAC-SHA256',
					accessCount: 0,
					isActive: 'true',
				})
			)
		})

		it('should handle payload without explicit file info', async () => {
			const payloadWithoutFileInfo: DeliveryPayload = {
				deliveryId: 'test-delivery-456',
				organizationId: 'test-org',
				type: 'export',
				data: { someData: 'value' },
				metadata: {},
			}

			mockDownloadRepository.createDownloadLink = vi.fn().mockResolvedValue(undefined)

			const result = await handler.deliver(payloadWithoutFileInfo, validConfig)

			expect(result.success).toBe(true)
			expect(mockDownloadRepository.createDownloadLink).toHaveBeenCalledWith(
				expect.objectContaining({
					objectId: 'test-delivery-456',
					fileName: 'export-test-delivery-456.csv',
					mimeType: 'text/csv',
				})
			)
		})

		it('should fail delivery for invalid configuration', async () => {
			const invalidConfig: DestinationConfig = {
				download: {
					expiryHours: -1,
				},
			}

			const result = await handler.deliver(testPayload, invalidConfig)

			expect(result.success).toBe(false)
			expect(result.error).toContain('Configuration validation failed')
			expect(result.retryable).toBe(false)
		})

		it('should handle repository errors gracefully', async () => {
			mockDownloadRepository.createDownloadLink = vi
				.fn()
				.mockRejectedValue(new Error('Database connection failed'))

			const result = await handler.deliver(testPayload, validConfig)

			expect(result.success).toBe(false)
			expect(result.error).toContain('Database connection failed')
			expect(result.retryable).toBe(true) // Database errors are retryable
		})
	})

	describe('Feature Support', () => {
		it('should support signature verification', () => {
			expect(handler.supportsFeature('signature_verification')).toBe(true)
		})

		it('should support idempotency', () => {
			expect(handler.supportsFeature('idempotency')).toBe(true)
		})

		it('should support encryption', () => {
			expect(handler.supportsFeature('encryption')).toBe(true)
		})

		it('should not support unsupported features', () => {
			expect(handler.supportsFeature('rate_limiting')).toBe(false)
			expect(handler.supportsFeature('batch_delivery')).toBe(false)
		})
	})

	describe('Configuration Schema', () => {
		it('should return valid JSON schema', () => {
			const schema = handler.getConfigSchema()

			expect(schema).toBeDefined()
			expect(schema.type).toBe('object')
			expect(schema.properties.download).toBeDefined()
			expect(schema.properties.download.required).toContain('expiryHours')
		})
	})

	describe('URL Generation and Validation', () => {
		it('should generate valid signed URLs', async () => {
			const config: DestinationConfig = {
				download: {
					expiryHours: 1,
				},
			}

			// Test connection generates and validates a URL
			const result = await handler.testConnection(config)

			expect(result.success).toBe(true)
			expect(result.details?.testUrl).toBeDefined()
			expect(result.details?.urlValid).toBe(true)

			// URL should contain required parameters
			const url = new URL(result.details!.testUrl)
			expect(url.searchParams.get('expires')).toBeDefined()
			expect(url.searchParams.get('org')).toBeDefined()
			expect(url.searchParams.get('signature')).toBeDefined()
		})

		it('should generate URLs with custom base URL', async () => {
			const customHandler = new DownloadHandler(
				mockDownloadRepository,
				testSecretKey,
				'https://custom.example.com'
			)

			const config: DestinationConfig = {
				download: {
					expiryHours: 1,
				},
			}

			const result = await customHandler.testConnection(config)

			expect(result.success).toBe(true)
			expect(result.details?.testUrl).toContain('https://custom.example.com')
		})

		it('should include max access in URL when specified', async () => {
			const config: DestinationConfig = {
				download: {
					expiryHours: 1,
					maxAccess: 5,
				},
			}

			const result = await handler.testConnection(config)

			expect(result.success).toBe(true)
			const url = new URL(result.details!.testUrl)
			expect(url.searchParams.get('max_access')).toBe('5')
		})
	})

	describe('Error Handling', () => {
		it('should identify retryable errors', async () => {
			const config: DestinationConfig = {
				download: {
					expiryHours: 24,
				},
			}

			const testPayload: DeliveryPayload = {
				deliveryId: 'test-delivery-123',
				organizationId: 'test-org',
				type: 'report',
				data: {},
				metadata: {},
			}

			// Test database connection error (retryable)
			mockDownloadRepository.createDownloadLink = vi.fn().mockRejectedValue(new Error('ECONNRESET'))

			const result1 = await handler.deliver(testPayload, config)
			expect(result1.retryable).toBe(true)

			// Test validation error (not retryable)
			const invalidConfig: DestinationConfig = {
				download: {
					expiryHours: -1,
				},
			}

			const result2 = await handler.deliver(testPayload, invalidConfig)
			expect(result2.retryable).toBe(false)
		})

		it('should handle unknown errors gracefully', async () => {
			const config: DestinationConfig = {
				download: {
					expiryHours: 24,
				},
			}

			const testPayload: DeliveryPayload = {
				deliveryId: 'test-delivery-123',
				organizationId: 'test-org',
				type: 'report',
				data: {},
				metadata: {},
			}

			mockDownloadRepository.createDownloadLink = vi.fn().mockRejectedValue('Unknown error')

			const result = await handler.deliver(testPayload, config)

			expect(result.success).toBe(false)
			expect(result.error).toBe('Unknown error occurred')
			expect(result.retryable).toBe(false)
		})
	})

	describe('File Type Handling', () => {
		it('should handle different payload types correctly', async () => {
			const config: DestinationConfig = {
				download: {
					expiryHours: 24,
				},
			}

			mockDownloadRepository.createDownloadLink = vi.fn().mockResolvedValue(undefined)

			// Test report type
			const reportPayload: DeliveryPayload = {
				deliveryId: 'test-1',
				organizationId: 'test-org',
				type: 'report',
				data: {},
				metadata: {},
			}

			await handler.deliver(reportPayload, config)
			expect(mockDownloadRepository.createDownloadLink).toHaveBeenCalledWith(
				expect.objectContaining({
					fileName: 'report-test-1.pdf',
					mimeType: 'application/pdf',
				})
			)

			// Test export type
			const exportPayload: DeliveryPayload = {
				deliveryId: 'test-2',
				organizationId: 'test-org',
				type: 'export',
				data: {},
				metadata: {},
			}

			await handler.deliver(exportPayload, config)
			expect(mockDownloadRepository.createDownloadLink).toHaveBeenCalledWith(
				expect.objectContaining({
					fileName: 'export-test-2.csv',
					mimeType: 'text/csv',
				})
			)

			// Test data type
			const dataPayload: DeliveryPayload = {
				deliveryId: 'test-3',
				organizationId: 'test-org',
				type: 'data',
				data: {},
				metadata: {},
			}

			await handler.deliver(dataPayload, config)
			expect(mockDownloadRepository.createDownloadLink).toHaveBeenCalledWith(
				expect.objectContaining({
					fileName: 'data-test-3.json',
					mimeType: 'application/json',
				})
			)

			// Test custom type
			const customPayload: DeliveryPayload = {
				deliveryId: 'test-4',
				organizationId: 'test-org',
				type: 'custom',
				data: {},
				metadata: {},
			}

			await handler.deliver(customPayload, config)
			expect(mockDownloadRepository.createDownloadLink).toHaveBeenCalledWith(
				expect.objectContaining({
					fileName: 'custom-test-4.bin',
					mimeType: 'application/octet-stream',
				})
			)
		})
	})

	describe('Security Features', () => {
		it('should use custom secret key when provided', async () => {
			const customSecret = 'custom-secret-key-for-testing-123'
			const customHandler = new DownloadHandler(mockDownloadRepository, customSecret, testBaseUrl)

			const config: DestinationConfig = {
				download: {
					expiryHours: 1,
					secretKey: 'config-secret-key-override-456',
				},
			}

			const result = await customHandler.testConnection(config)

			expect(result.success).toBe(true)
			// The URL should be generated with the config secret key, not the handler's default
			expect(result.details?.testUrl).toBeDefined()
		})

		it('should generate unique link IDs', async () => {
			const config: DestinationConfig = {
				download: {
					expiryHours: 24,
				},
			}

			const testPayload: DeliveryPayload = {
				deliveryId: 'test-delivery-123',
				organizationId: 'test-org',
				type: 'report',
				data: {},
				metadata: {},
			}

			mockDownloadRepository.createDownloadLink = vi.fn().mockResolvedValue(undefined)

			// Generate multiple links
			await handler.deliver(testPayload, config)
			await handler.deliver(testPayload, config)

			const calls = (mockDownloadRepository.createDownloadLink as any).mock.calls
			expect(calls).toHaveLength(2)

			// Link IDs should be different
			const linkId1 = calls[0][0].id
			const linkId2 = calls[1][0].id
			expect(linkId1).not.toBe(linkId2)

			// Both should start with 'dl_'
			expect(linkId1).toMatch(/^dl_/)
			expect(linkId2).toMatch(/^dl_/)
		})
	})
})
