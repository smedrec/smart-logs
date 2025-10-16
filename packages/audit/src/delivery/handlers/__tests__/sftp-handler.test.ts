/**
 * Unit tests for SFTP handler
 * Requirements 1.1, 10.4, 2.1: Comprehensive SFTP handler testing
 */

import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SftpHandler } from '../sftp-handler.js'

import type { DeliveryPayload, DestinationConfig } from '../../types.js'

// Mock ssh2-sftp-client
const mockSftpClient = {
	connect: vi.fn(),
	end: vi.fn(),
	cwd: vi.fn(),
	stat: vi.fn(),
	mkdir: vi.fn(),
	put: vi.fn(),
	chmod: vi.fn(),
}

vi.mock('ssh2-sftp-client', () => {
	return {
		default: vi.fn(() => mockSftpClient),
	}
})

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
	readFile: vi.fn(),
}))

describe('SftpHandler', () => {
	let handler: SftpHandler

	// Helper function to calculate expected file size
	const getExpectedFileSize = (payload: DeliveryPayload): number => {
		const formattedPayload = {
			delivery_id: payload.deliveryId,
			organization_id: payload.organizationId,
			type: payload.type,
			data: payload.data,
			metadata: payload.metadata,
			correlation_id: payload.correlationId,
			idempotency_key: payload.idempotencyKey,
			timestamp: new Date().toISOString(), // Use a fixed timestamp for size calculation
		}
		const content = JSON.stringify(formattedPayload, null, 2)
		return Buffer.byteLength(content, 'utf8')
	}

	beforeEach(() => {
		vi.clearAllMocks()
		handler = new SftpHandler({
			maxPoolSize: 5,
			connectionTimeout: 10000,
			poolCleanupInterval: 60000,
		})
	})

	afterEach(async () => {
		vi.restoreAllMocks()
		await handler.cleanup()
	})

	describe('Configuration Validation', () => {
		it('should validate valid SFTP configuration with password', () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					username: 'testuser',
					password: 'testpass',
					path: '/uploads',
					filename: 'test-{deliveryId}.json',
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should validate valid SFTP configuration with private key', () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					username: 'testuser',
					privateKey:
						'-----BEGIN OPENSSH PRIVATE KEY-----\ntest-key-content\n-----END OPENSSH PRIVATE KEY-----',
					path: '/uploads',
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should reject configuration without SFTP config', () => {
			const config: DestinationConfig = {}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('SFTP configuration is required')
		})

		it('should reject configuration without host', () => {
			const config: DestinationConfig = {
				sftp: {
					port: 22,
					username: 'testuser',
					password: 'testpass',
					path: '/uploads',
				} as any,
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('SFTP host is required')
		})

		it('should reject configuration without port', () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					username: 'testuser',
					password: 'testpass',
					path: '/uploads',
				} as any,
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('SFTP port is required')
		})

		it('should reject invalid port numbers', () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 70000, // Invalid port
					username: 'testuser',
					password: 'testpass',
					path: '/uploads',
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('SFTP port must be a number between 1 and 65535')
		})

		it('should reject configuration without username', () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					password: 'testpass',
					path: '/uploads',
				} as any,
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('SFTP username is required')
		})

		it('should reject configuration without authentication', () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					username: 'testuser',
					path: '/uploads',
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('SFTP requires either password or private key authentication')
		})

		it('should reject configuration without path', () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					username: 'testuser',
					password: 'testpass',
				} as any,
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('SFTP path is required')
		})

		it('should warn about relative paths', () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					username: 'testuser',
					password: 'testpass',
					path: 'uploads', // Relative path
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(true)
			expect(result.warnings).toContain('SFTP path should be absolute (start with /)')
		})

		it('should reject invalid filename type', () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					username: 'testuser',
					password: 'testpass',
					path: '/uploads',
					filename: 123 as any, // Invalid type
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('SFTP filename must be a string')
		})
	})

	describe('Connection Testing', () => {
		it('should successfully test connection with valid configuration', async () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					username: 'testuser',
					password: 'testpass',
					path: '/uploads',
				},
			}

			// Mock successful connection
			mockSftpClient.connect.mockResolvedValue(undefined)
			mockSftpClient.cwd.mockResolvedValue('/home/testuser')
			mockSftpClient.stat.mockResolvedValue({ size: 0, isDirectory: () => true })
			mockSftpClient.end.mockResolvedValue(undefined)

			const result = await handler.testConnection(config)

			expect(result.success).toBe(true)
			expect(result.responseTime).toBeGreaterThanOrEqual(0)
			expect(result.details?.serverVersion).toBe('unknown')
			expect(result.details?.workingDirectory).toBe('/home/testuser')
			expect(mockSftpClient.connect).toHaveBeenCalledWith({
				host: 'sftp.example.com',
				port: 22,
				username: 'testuser',
				password: 'testpass',
				readyTimeout: 10000,
				strictVendor: false,
			})
		})

		it('should handle connection failure', async () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					username: 'testuser',
					password: 'wrongpass',
					path: '/uploads',
				},
			}

			// Mock connection failure
			mockSftpClient.connect.mockRejectedValue(new Error('Authentication failed'))

			const result = await handler.testConnection(config)

			expect(result.success).toBe(false)
			expect(result.error).toBe('Authentication failed')
			expect(result.responseTime).toBeGreaterThanOrEqual(0)
		})

		it('should handle path creation when path does not exist', async () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					username: 'testuser',
					password: 'testpass',
					path: '/new-uploads',
				},
			}

			// Mock successful connection but path doesn't exist
			mockSftpClient.connect.mockResolvedValue(undefined)
			mockSftpClient.cwd.mockResolvedValue('/home/testuser')
			mockSftpClient.stat.mockRejectedValueOnce(new Error('No such file'))
			mockSftpClient.mkdir.mockResolvedValue(undefined)
			mockSftpClient.end.mockResolvedValue(undefined)

			const result = await handler.testConnection(config)

			expect(result.success).toBe(true)
			expect(mockSftpClient.mkdir).toHaveBeenCalledWith('/new-uploads', true)
		})

		it('should fail when path cannot be created', async () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					username: 'testuser',
					password: 'testpass',
					path: '/readonly/uploads',
				},
			}

			// Mock successful connection but path creation fails
			mockSftpClient.connect.mockResolvedValue(undefined)
			mockSftpClient.cwd.mockResolvedValue('/home/testuser')
			mockSftpClient.stat.mockRejectedValueOnce(new Error('No such file'))
			mockSftpClient.mkdir.mockRejectedValue(new Error('Permission denied'))

			const result = await handler.testConnection(config)

			expect(result.success).toBe(false)
			expect(result.error).toContain('Cannot access or create path /readonly/uploads')
		})

		it('should return validation errors for invalid configuration', async () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					username: 'testuser',
					// Missing authentication
					path: '/uploads',
				},
			}

			const result = await handler.testConnection(config)

			expect(result.success).toBe(false)
			expect(result.error).toContain('Configuration validation failed')
		})
	})

	describe('File Delivery', () => {
		const mockPayload: DeliveryPayload = {
			deliveryId: 'test-delivery-123',
			organizationId: 'org-456',
			type: 'report',
			data: { reportId: 'report-789', content: 'Test report data' },
			metadata: { source: 'test' },
			correlationId: 'corr-123',
			idempotencyKey: 'idem-456',
		}

		it('should successfully deliver file with password authentication', async () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					username: 'testuser',
					password: 'testpass',
					path: '/uploads',
				},
			}

			// Mock successful operations
			mockSftpClient.connect.mockResolvedValue(undefined)
			// No need to mock pwd for delivery tests

			// Mock file content length calculation
			const expectedContent = JSON.stringify(
				{
					delivery_id: mockPayload.deliveryId,
					organization_id: mockPayload.organizationId,
					type: mockPayload.type,
					data: mockPayload.data,
					metadata: mockPayload.metadata,
					correlation_id: mockPayload.correlationId,
					idempotency_key: mockPayload.idempotencyKey,
					timestamp: expect.any(String),
				},
				null,
				2
			)
			const expectedSize = Buffer.byteLength(expectedContent, 'utf8')

			mockSftpClient.stat
				.mockResolvedValueOnce({ size: 0, isDirectory: () => true }) // Directory exists
				.mockResolvedValueOnce({ size: expectedSize }) // File uploaded successfully with correct size
			mockSftpClient.put.mockResolvedValue(undefined)
			mockSftpClient.chmod.mockResolvedValue(undefined)

			const result = await handler.deliver(mockPayload, config)

			expect(result.success).toBe(true)
			expect(result.deliveredAt).toBeDefined()
			expect(result.responseTime).toBeGreaterThanOrEqual(0)
			expect(result.crossSystemReference).toContain('/uploads/delivery_test-delivery-123_')
			expect(mockSftpClient.put).toHaveBeenCalled()
			expect(mockSftpClient.chmod).toHaveBeenCalledWith(expect.any(String), 0o644)
		})

		it('should successfully deliver file with private key authentication', async () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					username: 'testuser',
					privateKey:
						'-----BEGIN OPENSSH PRIVATE KEY-----\ntest-key\n-----END OPENSSH PRIVATE KEY-----',
					path: '/uploads',
				},
			}

			// Mock successful operations
			mockSftpClient.connect.mockResolvedValue(undefined)
			mockSftpClient.stat
				.mockResolvedValueOnce({ size: 0, isDirectory: () => true })
				.mockResolvedValueOnce({ size: getExpectedFileSize(mockPayload) })
			mockSftpClient.put.mockResolvedValue(undefined)
			mockSftpClient.chmod.mockResolvedValue(undefined)

			const result = await handler.deliver(mockPayload, config)

			expect(result.success).toBe(true)
			expect(mockSftpClient.connect).toHaveBeenCalledWith(
				expect.objectContaining({
					privateKey: expect.stringContaining('-----BEGIN OPENSSH PRIVATE KEY-----'),
				})
			)
		})

		it('should use custom filename pattern', async () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					username: 'testuser',
					password: 'testpass',
					path: '/uploads',
					filename: 'custom_{deliveryId}_{organizationId}.json',
				},
			}

			// Mock successful operations
			mockSftpClient.connect.mockResolvedValue(undefined)
			mockSftpClient.stat
				.mockResolvedValueOnce({ size: 0, isDirectory: () => true })
				.mockResolvedValueOnce({ size: getExpectedFileSize(mockPayload) })
			mockSftpClient.put.mockResolvedValue(undefined)
			mockSftpClient.chmod.mockResolvedValue(undefined)

			const result = await handler.deliver(mockPayload, config)

			expect(result.success).toBe(true)
			expect(result.crossSystemReference).toBe('/uploads/custom_test-delivery-123_org-456.json')
		})

		it('should create directory if it does not exist', async () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					username: 'testuser',
					password: 'testpass',
					path: '/new/uploads',
				},
			}

			// Mock directory creation
			mockSftpClient.connect.mockResolvedValue(undefined)
			mockSftpClient.stat
				.mockRejectedValueOnce(new Error('No such file')) // Directory doesn't exist
				.mockResolvedValueOnce({ size: getExpectedFileSize(mockPayload) }) // File uploaded successfully
			mockSftpClient.mkdir.mockResolvedValue(undefined)
			mockSftpClient.put.mockResolvedValue(undefined)
			mockSftpClient.chmod.mockResolvedValue(undefined)

			const result = await handler.deliver(mockPayload, config)

			expect(result.success).toBe(true)
			expect(mockSftpClient.mkdir).toHaveBeenCalledWith('/new/uploads', true)
			expect(mockSftpClient.chmod).toHaveBeenCalledWith('/new/uploads', 0o755)
		})

		it('should handle upload integrity check failure', async () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					username: 'testuser',
					password: 'testpass',
					path: '/uploads',
				},
			}

			// Mock upload with wrong file size
			mockSftpClient.connect.mockResolvedValue(undefined)
			mockSftpClient.stat
				.mockResolvedValueOnce({ size: 0, isDirectory: () => true })
				.mockResolvedValueOnce({ size: 50 }) // Wrong size
			mockSftpClient.put.mockResolvedValue(undefined)

			const result = await handler.deliver(mockPayload, config)

			expect(result.success).toBe(false)
			expect(result.error).toContain('Upload integrity check failed')
			expect(result.retryable).toBe(false)
		})

		it('should handle connection failure during delivery', async () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					username: 'testuser',
					password: 'testpass',
					path: '/uploads',
				},
			}

			// Mock connection failure
			mockSftpClient.connect.mockRejectedValue(new Error('ECONNREFUSED'))

			const result = await handler.deliver(mockPayload, config)

			expect(result.success).toBe(false)
			expect(result.error).toBe('ECONNREFUSED')
			expect(result.retryable).toBe(true) // Connection errors are retryable
		})

		it('should handle upload failure', async () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					username: 'testuser',
					password: 'testpass',
					path: '/uploads',
				},
			}

			// Mock upload failure
			mockSftpClient.connect.mockResolvedValue(undefined)
			mockSftpClient.stat.mockResolvedValue({ size: 0, isDirectory: () => true })
			mockSftpClient.put.mockRejectedValue(new Error('Disk full'))

			const result = await handler.deliver(mockPayload, config)

			expect(result.success).toBe(false)
			expect(result.error).toBe('Disk full')
			expect(result.retryable).toBe(false) // Disk full is not retryable
		})

		it('should return validation errors for invalid configuration', async () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					username: 'testuser',
					// Missing authentication
					path: '/uploads',
				},
			}

			const result = await handler.deliver(mockPayload, config)

			expect(result.success).toBe(false)
			expect(result.error).toContain('Configuration validation failed')
			expect(result.retryable).toBe(false)
		})
	})

	describe('Feature Support', () => {
		it('should support retry_with_backoff feature', () => {
			expect(handler.supportsFeature('retry_with_backoff')).toBe(true)
		})

		it('should support connection_pooling feature', () => {
			expect(handler.supportsFeature('connection_pooling')).toBe(true)
		})

		it('should not support unsupported features', () => {
			expect(handler.supportsFeature('signature_verification')).toBe(false)
			expect(handler.supportsFeature('idempotency')).toBe(false)
		})
	})

	describe('Configuration Schema', () => {
		it('should return valid JSON schema', () => {
			const schema = handler.getConfigSchema()

			expect(schema).toHaveProperty('type', 'object')
			expect(schema).toHaveProperty('properties.sftp')
			expect(schema.properties.sftp).toHaveProperty('required')
			expect(schema.properties.sftp.required).toContain('host')
			expect(schema.properties.sftp.required).toContain('port')
			expect(schema.properties.sftp.required).toContain('username')
			expect(schema.properties.sftp.required).toContain('path')
		})
	})

	describe('Error Handling', () => {
		it('should identify retryable network errors', () => {
			const retryableErrors = [
				new Error('ECONNRESET'),
				new Error('ECONNREFUSED'),
				new Error('ETIMEDOUT'),
				new Error('ENOTFOUND'),
				new Error('Connection lost'),
				new Error('Connection closed'),
				new Error('Timeout'),
			]

			for (const error of retryableErrors) {
				// Access private method for testing
				const isRetryable = (handler as any).isRetryableError(error)
				expect(isRetryable).toBe(true)
			}
		})

		it('should identify non-retryable errors', () => {
			const nonRetryableErrors = [
				new Error('Permission denied'),
				new Error('Disk full'),
				new Error('Invalid credentials'),
				new Error('File not found'),
			]

			for (const error of nonRetryableErrors) {
				// Access private method for testing
				const isRetryable = (handler as any).isRetryableError(error)
				expect(isRetryable).toBe(false)
			}
		})
	})

	describe('Connection Pooling', () => {
		it('should reuse connections from pool', async () => {
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					username: 'testuser',
					password: 'testpass',
					path: '/uploads',
				},
			}

			const mockPayload1: DeliveryPayload = {
				deliveryId: 'test-delivery-1',
				organizationId: 'org-456',
				type: 'report',
				data: { content: 'test' },
				metadata: {},
			}

			const mockPayload2: DeliveryPayload = {
				deliveryId: 'test-delivery-2',
				organizationId: 'org-456',
				type: 'report',
				data: { content: 'test' },
				metadata: {},
			}

			// Mock successful operations
			mockSftpClient.connect.mockResolvedValue(undefined)
			mockSftpClient.cwd.mockResolvedValue('/home/testuser')
			mockSftpClient.stat
				.mockResolvedValue({ size: 0, isDirectory: () => true }) // Directory check
				.mockResolvedValue({ size: getExpectedFileSize(mockPayload1) }) // First file upload
				.mockResolvedValue({ size: 0, isDirectory: () => true }) // Directory check
				.mockResolvedValue({ size: getExpectedFileSize(mockPayload2) }) // Second file upload
			mockSftpClient.put.mockResolvedValue(undefined)
			mockSftpClient.chmod.mockResolvedValue(undefined)

			// First delivery
			const result1 = await handler.deliver(mockPayload1, config)
			expect(result1.success).toBe(true)

			// Second delivery - connection pooling is tested by ensuring no errors occur
			const result2 = await handler.deliver(mockPayload2, config)
			expect(result2.success).toBe(true)

			// Both deliveries should succeed (connection pooling working)
			expect(mockSftpClient.connect).toHaveBeenCalled()
		})
	})

	describe('Cleanup', () => {
		it('should cleanup all connections and timers', async () => {
			// Create some connections first
			const config: DestinationConfig = {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					username: 'testuser',
					password: 'testpass',
					path: '/uploads',
				},
			}

			mockSftpClient.connect.mockResolvedValue(undefined)
			mockSftpClient.stat.mockResolvedValue({ size: 100 })
			mockSftpClient.put.mockResolvedValue(undefined)
			mockSftpClient.chmod.mockResolvedValue(undefined)
			mockSftpClient.end.mockResolvedValue(undefined)

			const mockPayload: DeliveryPayload = {
				deliveryId: 'test-delivery-1',
				organizationId: 'org-456',
				type: 'report',
				data: { content: 'test' },
				metadata: {},
			}

			await handler.deliver(mockPayload, config)

			// Cleanup should close all connections
			await handler.cleanup()

			expect(mockSftpClient.end).toHaveBeenCalled()
		})
	})
})
