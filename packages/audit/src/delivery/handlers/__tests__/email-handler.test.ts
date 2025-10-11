/**
 * Unit tests for EmailHandler
 * Requirements 1.1, 10.3, 2.1: Email delivery functionality testing
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EmailHandler } from '../email-handler.js'

import type { DeliveryPayload, DestinationConfig } from '../../types.js'

// Mock nodemailer
vi.mock('nodemailer', () => {
	const mockTransporter = {
		verify: vi.fn(),
		sendMail: vi.fn(),
	}

	const mockCreateTransport = vi.fn(() => mockTransporter)

	return {
		default: {
			createTransport: mockCreateTransport,
		},
	}
})

describe('EmailHandler', () => {
	let emailHandler: EmailHandler
	let mockPayload: DeliveryPayload
	let mockConfig: DestinationConfig
	let mockTransporter: any
	let mockCreateTransport: any

	beforeEach(async () => {
		// Get references to mocked functions
		const nodemailer = await import('nodemailer')
		mockCreateTransport = vi.mocked(nodemailer.default.createTransport)
		mockTransporter = mockCreateTransport()

		emailHandler = new EmailHandler()

		mockPayload = {
			deliveryId: 'test-delivery-123',
			organizationId: 'org-456',
			type: 'report',
			data: {
				reportId: 'report-789',
				title: 'Test Report',
				content: 'This is test report content',
			},
			metadata: {
				source: 'test',
				version: '1.0',
			},
			correlationId: 'corr-123',
			idempotencyKey: 'idem-456',
		}

		mockConfig = {
			email: {
				service: 'smtp',
				from: 'test@example.com',
				subject: 'Test Email: {{data.title}}',
				bodyTemplate: 'Report: {{data.title}}\nContent: {{data.content}}',
				smtpConfig: {
					host: 'smtp.example.com',
					port: 587,
					secure: false,
					auth: {
						user: 'testuser',
						pass: 'testpass',
					},
				},
				recipients: ['recipient@example.com'],
			},
		}

		// Reset mocks
		vi.clearAllMocks()
	})

	describe('validateConfig', () => {
		it('should validate valid SMTP configuration', () => {
			const result = emailHandler.validateConfig(mockConfig)

			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should reject missing email configuration', () => {
			const config = { email: undefined } as any
			const result = emailHandler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Email configuration is required')
		})

		it('should reject invalid email service', () => {
			const config = {
				email: {
					...mockConfig.email!,
					service: 'invalid-service',
				},
			}
			const result = emailHandler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((error) => error.includes('Unsupported email service'))).toBe(true)
		})

		it('should reject missing from address', () => {
			const config = {
				email: {
					...mockConfig.email!,
					from: '',
				},
			}
			const result = emailHandler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('From email address is required')
		})

		it('should reject invalid from address', () => {
			const config = {
				email: {
					...mockConfig.email!,
					from: 'invalid-email',
				},
			}
			const result = emailHandler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('From email address is invalid')
		})

		it('should reject missing subject', () => {
			const config = {
				email: {
					...mockConfig.email!,
					subject: '',
				},
			}
			const result = emailHandler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Email subject is required')
		})
	})

	describe('testConnection', () => {
		it('should test SMTP connection successfully', async () => {
			mockTransporter.verify.mockResolvedValue(true)

			const result = await emailHandler.testConnection(mockConfig)

			expect(result.success).toBe(true)
			expect(result.responseTime).toBeGreaterThan(0)
			expect(mockTransporter.verify).toHaveBeenCalled()
		})

		it('should handle connection test failure', async () => {
			mockTransporter.verify.mockResolvedValue(false)

			const result = await emailHandler.testConnection(mockConfig)

			expect(result.success).toBe(false)
			expect(result.error).toBe('Email service verification failed')
		})

		it('should handle connection test error', async () => {
			const error = new Error('Connection failed')
			mockTransporter.verify.mockRejectedValue(error)

			const result = await emailHandler.testConnection(mockConfig)

			expect(result.success).toBe(false)
			expect(result.error).toBe('Connection failed')
		})
	})

	describe('deliver', () => {
		it('should deliver email successfully', async () => {
			mockTransporter.verify.mockResolvedValue(true)
			mockTransporter.sendMail.mockResolvedValue({
				messageId: 'test-message-id',
				response: '250 OK',
			})

			const result = await emailHandler.deliver(mockPayload, mockConfig)

			expect(result.success).toBe(true)
			expect(result.deliveredAt).toBeDefined()
			expect(result.responseTime).toBeGreaterThan(0)
			expect(result.crossSystemReference).toBe('test-message-id')
			expect(mockTransporter.sendMail).toHaveBeenCalled()
		})

		it('should handle delivery failure', async () => {
			const error = new Error('SMTP Error: Connection refused')
			mockTransporter.sendMail.mockRejectedValue(error)

			const result = await emailHandler.deliver(mockPayload, mockConfig)

			expect(result.success).toBe(false)
			expect(result.error).toBe('SMTP Error: Connection refused')
			expect(result.retryable).toBe(true) // Connection errors are retryable
		})

		it('should reject invalid configuration', async () => {
			const invalidConfig = { email: undefined } as any

			const result = await emailHandler.deliver(mockPayload, invalidConfig)

			expect(result.success).toBe(false)
			expect(result.error).toContain('Configuration validation failed')
			expect(result.retryable).toBe(false)
		})

		it('should process email templates correctly', async () => {
			mockTransporter.sendMail.mockResolvedValue({
				messageId: 'test-message-id',
			})

			await emailHandler.deliver(mockPayload, mockConfig)

			const sendMailCall = mockTransporter.sendMail.mock.calls[0][0]

			// Check that template variables were processed
			expect(sendMailCall.subject).toBe('Test Email: Test Report')
		})

		it('should include delivery headers', async () => {
			mockTransporter.sendMail.mockResolvedValue({
				messageId: 'test-message-id',
			})

			await emailHandler.deliver(mockPayload, mockConfig)

			const sendMailCall = mockTransporter.sendMail.mock.calls[0][0]

			expect(sendMailCall.headers).toEqual({
				'X-Delivery-ID': 'test-delivery-123',
				'X-Organization-ID': 'org-456',
				'X-Correlation-ID': 'corr-123',
			})
		})
	})

	describe('supportsFeature', () => {
		it('should support expected features', () => {
			expect(emailHandler.supportsFeature('retry_with_backoff')).toBe(true)
			expect(emailHandler.supportsFeature('connection_pooling')).toBe(true)
			expect(emailHandler.supportsFeature('rate_limiting')).toBe(true)
		})

		it('should not support unsupported features', () => {
			expect(emailHandler.supportsFeature('signature_verification' as any)).toBe(false)
		})
	})

	describe('getConfigSchema', () => {
		it('should return valid JSON schema', () => {
			const schema = emailHandler.getConfigSchema()

			expect(schema).toBeDefined()
			expect(schema.type).toBe('object')
			expect(schema.properties.email).toBeDefined()
			expect(schema.properties.email.required).toContain('service')
			expect(schema.properties.email.required).toContain('from')
			expect(schema.properties.email.required).toContain('subject')
		})
	})
})
