/**
 * Unit tests for Email Providers
 * Requirements 1.1, 10.3, 10.4: Email service provider integrations testing
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	EmailProviderFactory,
	EmailRateLimiter,
	ResendProvider,
	SendGridProvider,
	SESProvider,
	SMTPProvider,
} from '../email-providers.js'

// Mock nodemailer
const mockTransporter = {
	verify: vi.fn(),
	sendMail: vi.fn(),
}

const mockCreateTransport = vi.fn(() => mockTransporter)

vi.mock('nodemailer', () => ({
	default: {
		createTransport: mockCreateTransport,
	},
}))

describe('EmailProviderFactory', () => {
	it('should return correct providers', () => {
		expect(EmailProviderFactory.getProvider('smtp')).toBeInstanceOf(SMTPProvider)
		expect(EmailProviderFactory.getProvider('sendgrid')).toBeInstanceOf(SendGridProvider)
		expect(EmailProviderFactory.getProvider('resend')).toBeInstanceOf(ResendProvider)
		expect(EmailProviderFactory.getProvider('ses')).toBeInstanceOf(SESProvider)
	})

	it('should throw error for unsupported provider', () => {
		expect(() => EmailProviderFactory.getProvider('unsupported')).toThrow(
			'Unsupported email service: unsupported'
		)
	})

	it('should return all providers', () => {
		const providers = EmailProviderFactory.getAllProviders()
		expect(providers).toHaveLength(4)
		expect(providers.map((p) => p.name)).toEqual(['smtp', 'sendgrid', 'resend', 'ses'])
	})

	it('should allow registering custom providers', () => {
		const customProvider = {
			name: 'custom',
			createTransporter: vi.fn(),
			validateConfig: vi.fn(),
			supportsFeature: vi.fn(),
			getRateLimits: vi.fn(),
		}

		EmailProviderFactory.registerProvider(customProvider)
		expect(EmailProviderFactory.getProvider('custom')).toBe(customProvider)
	})
})

describe('SMTPProvider', () => {
	let provider: SMTPProvider
	let mockConfig: any

	beforeEach(() => {
		provider = new SMTPProvider()
		mockConfig = {
			service: 'smtp',
			from: 'test@example.com',
			subject: 'Test',
			smtpConfig: {
				host: 'smtp.example.com',
				port: 587,
				secure: false,
				auth: {
					user: 'testuser',
					pass: 'testpass',
				},
			},
		}
		vi.clearAllMocks()
	})

	describe('validateConfig', () => {
		it('should validate valid SMTP config', () => {
			const result = provider.validateConfig(mockConfig)
			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should reject missing SMTP config', () => {
			const config = { ...mockConfig, smtpConfig: undefined }
			const result = provider.validateConfig(config)
			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('SMTP configuration is required for SMTP service')
		})

		it('should reject missing host', () => {
			const config = {
				...mockConfig,
				smtpConfig: { ...mockConfig.smtpConfig, host: '' },
			}
			const result = provider.validateConfig(config)
			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('SMTP host is required')
		})

		it('should reject invalid port', () => {
			const config = {
				...mockConfig,
				smtpConfig: { ...mockConfig.smtpConfig, port: 70000 },
			}
			const result = provider.validateConfig(config)
			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('SMTP port must be between 1 and 65535')
		})

		it('should warn about insecure port 25', () => {
			const config = {
				...mockConfig,
				smtpConfig: { ...mockConfig.smtpConfig, port: 25, secure: false },
			}
			const result = provider.validateConfig(config)
			expect(result.isValid).toBe(true)
			expect(result.warnings).toContain(
				'Port 25 without TLS is not recommended for security reasons'
			)
		})
	})

	describe('createTransporter', () => {
		it('should create SMTP transporter with correct config', async () => {
			await provider.createTransporter(mockConfig)

			expect(mockCreateTransport).toHaveBeenCalledWith({
				host: 'smtp.example.com',
				port: 587,
				secure: false,
				auth: {
					user: 'testuser',
					pass: 'testpass',
				},
				pool: true,
				maxConnections: 5,
				maxMessages: 100,
				rateDelta: 1000,
				rateLimit: 5,
				connectionTimeout: 30000,
				greetingTimeout: 30000,
				socketTimeout: 30000,
			})
		})
	})

	describe('supportsFeature', () => {
		it('should support attachments only', () => {
			expect(provider.supportsFeature('attachments')).toBe(true)
			expect(provider.supportsFeature('templates')).toBe(false)
			expect(provider.supportsFeature('tracking')).toBe(false)
		})
	})

	describe('getRateLimits', () => {
		it('should return conservative rate limits', () => {
			const limits = provider.getRateLimits()
			expect(limits.requestsPerSecond).toBe(5)
			expect(limits.requestsPerMinute).toBe(300)
			expect(limits.requestsPerHour).toBe(18000)
			expect(limits.burstLimit).toBe(10)
		})
	})
})

describe('SendGridProvider', () => {
	let provider: SendGridProvider
	let mockConfig: any

	beforeEach(() => {
		provider = new SendGridProvider()
		mockConfig = {
			service: 'sendgrid',
			from: 'test@example.com',
			subject: 'Test',
			apiKey: 'SG.test-api-key',
		}
		vi.clearAllMocks()
	})

	describe('validateConfig', () => {
		it('should validate valid SendGrid config', () => {
			const result = provider.validateConfig(mockConfig)
			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should reject missing API key', () => {
			const config = { ...mockConfig, apiKey: undefined }
			const result = provider.validateConfig(config)
			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('API key is required for SendGrid service')
		})

		it('should warn about non-standard API key format', () => {
			const config = { ...mockConfig, apiKey: 'invalid-key-format' }
			const result = provider.validateConfig(config)
			expect(result.isValid).toBe(true)
			expect(result.warnings).toContain('SendGrid API keys typically start with "SG."')
		})

		it('should warn about Gmail domain', () => {
			const config = { ...mockConfig, from: 'test@gmail.com' }
			const result = provider.validateConfig(config)
			expect(result.isValid).toBe(true)
			expect(result.warnings).toContain(
				'Using Gmail addresses with SendGrid may require domain verification'
			)
		})
	})

	describe('createTransporter', () => {
		it('should create SendGrid transporter', async () => {
			await provider.createTransporter(mockConfig)

			expect(mockCreateTransport).toHaveBeenCalledWith({
				service: 'SendGrid',
				auth: {
					user: 'apikey',
					pass: 'SG.test-api-key',
				},
				pool: true,
				maxConnections: 5,
				maxMessages: 100,
				rateDelta: 1000,
				rateLimit: 10,
			})
		})

		it('should throw error without API key', async () => {
			const config = { ...mockConfig, apiKey: undefined }
			await expect(provider.createTransporter(config)).rejects.toThrow(
				'API key is required for SendGrid service'
			)
		})
	})

	describe('supportsFeature', () => {
		it('should support all advanced features', () => {
			expect(provider.supportsFeature('templates')).toBe(true)
			expect(provider.supportsFeature('attachments')).toBe(true)
			expect(provider.supportsFeature('tracking')).toBe(true)
			expect(provider.supportsFeature('analytics')).toBe(true)
			expect(provider.supportsFeature('webhooks')).toBe(true)
			expect(provider.supportsFeature('batch_sending')).toBe(true)
		})
	})

	describe('getRateLimits', () => {
		it('should return SendGrid rate limits', () => {
			const limits = provider.getRateLimits()
			expect(limits.requestsPerSecond).toBe(10)
			expect(limits.requestsPerMinute).toBe(600)
			expect(limits.requestsPerHour).toBe(36000)
			expect(limits.burstLimit).toBe(20)
		})
	})
})

describe('ResendProvider', () => {
	let provider: ResendProvider
	let mockConfig: any

	beforeEach(() => {
		provider = new ResendProvider()
		mockConfig = {
			service: 'resend',
			from: 'test@example.com',
			subject: 'Test',
			apiKey: 're_test-api-key',
		}
		vi.clearAllMocks()
	})

	describe('validateConfig', () => {
		it('should validate valid Resend config', () => {
			const result = provider.validateConfig(mockConfig)
			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should reject missing API key', () => {
			const config = { ...mockConfig, apiKey: undefined }
			const result = provider.validateConfig(config)
			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('API key is required for Resend service')
		})

		it('should warn about non-standard API key format', () => {
			const config = { ...mockConfig, apiKey: 'invalid-key-format' }
			const result = provider.validateConfig(config)
			expect(result.isValid).toBe(true)
			expect(result.warnings).toContain('Resend API keys typically start with "re_"')
		})
	})

	describe('createTransporter', () => {
		it('should create Resend transporter', async () => {
			await provider.createTransporter(mockConfig)

			expect(mockCreateTransport).toHaveBeenCalledWith({
				host: 'smtp.resend.com',
				port: 587,
				secure: false,
				auth: {
					user: 'resend',
					pass: 're_test-api-key',
				},
				pool: true,
				maxConnections: 3,
				maxMessages: 50,
				rateDelta: 1000,
				rateLimit: 5,
			})
		})
	})

	describe('supportsFeature', () => {
		it('should support most features except analytics and batch sending', () => {
			expect(provider.supportsFeature('templates')).toBe(true)
			expect(provider.supportsFeature('attachments')).toBe(true)
			expect(provider.supportsFeature('tracking')).toBe(true)
			expect(provider.supportsFeature('webhooks')).toBe(true)
			expect(provider.supportsFeature('analytics')).toBe(false)
			expect(provider.supportsFeature('batch_sending')).toBe(false)
		})
	})
})

describe('SESProvider', () => {
	let provider: SESProvider
	let mockConfig: any

	beforeEach(() => {
		provider = new SESProvider()
		mockConfig = {
			service: 'ses',
			from: 'test@example.com',
			subject: 'Test',
		}

		// Set up environment variables
		process.env.AWS_REGION = 'us-east-1'
		process.env.AWS_SES_SMTP_USERNAME = 'ses-username'
		process.env.AWS_SES_SMTP_PASSWORD = 'ses-password'

		vi.clearAllMocks()
	})

	afterEach(() => {
		// Clean up environment variables
		delete process.env.AWS_REGION
		delete process.env.AWS_SES_SMTP_USERNAME
		delete process.env.AWS_SES_SMTP_PASSWORD
	})

	describe('validateConfig', () => {
		it('should validate valid SES config', () => {
			const result = provider.validateConfig(mockConfig)
			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should reject missing SMTP username', () => {
			delete process.env.AWS_SES_SMTP_USERNAME
			const result = provider.validateConfig(mockConfig)
			expect(result.isValid).toBe(false)
			expect(result.errors).toContain(
				'AWS SES SMTP username is required (set AWS_SES_SMTP_USERNAME or provide apiKey)'
			)
		})

		it('should reject missing SMTP password', () => {
			delete process.env.AWS_SES_SMTP_PASSWORD
			const result = provider.validateConfig(mockConfig)
			expect(result.isValid).toBe(false)
			expect(result.errors).toContain(
				'AWS SES SMTP password is required (set AWS_SES_SMTP_PASSWORD)'
			)
		})

		it('should warn about missing AWS region', () => {
			delete process.env.AWS_REGION
			const result = provider.validateConfig(mockConfig)
			expect(result.isValid).toBe(true)
			expect(result.warnings).toContain('AWS_REGION environment variable should be set for SES')
		})
	})

	describe('createTransporter', () => {
		it('should create SES transporter', async () => {
			await provider.createTransporter(mockConfig)

			expect(mockCreateTransport).toHaveBeenCalledWith({
				host: 'email-smtp.us-east-1.amazonaws.com',
				port: 587,
				secure: false,
				auth: {
					user: 'ses-username',
					pass: 'ses-password',
				},
				pool: true,
				maxConnections: 10,
				maxMessages: 200,
				rateDelta: 1000,
				rateLimit: 14,
			})
		})

		it('should use different region', async () => {
			process.env.AWS_REGION = 'eu-west-1'

			await provider.createTransporter(mockConfig)

			expect(mockCreateTransport).toHaveBeenCalledWith(
				expect.objectContaining({
					host: 'email-smtp.eu-west-1.amazonaws.com',
				})
			)
		})
	})

	describe('supportsFeature', () => {
		it('should support SES features', () => {
			expect(provider.supportsFeature('templates')).toBe(true)
			expect(provider.supportsFeature('attachments')).toBe(true)
			expect(provider.supportsFeature('tracking')).toBe(true)
			expect(provider.supportsFeature('analytics')).toBe(true)
			expect(provider.supportsFeature('batch_sending')).toBe(true)
			expect(provider.supportsFeature('webhooks')).toBe(false)
		})
	})

	describe('getRateLimits', () => {
		it('should return SES rate limits', () => {
			const limits = provider.getRateLimits()
			expect(limits.requestsPerSecond).toBe(14)
			expect(limits.requestsPerMinute).toBe(840)
			expect(limits.requestsPerHour).toBe(50400)
			expect(limits.burstLimit).toBe(28)
		})
	})
})

describe('EmailRateLimiter', () => {
	let rateLimiter: EmailRateLimiter

	beforeEach(() => {
		rateLimiter = new EmailRateLimiter()
		rateLimiter.setLimits('test-provider', {
			requestsPerSecond: 2,
			requestsPerMinute: 60,
			requestsPerHour: 3600,
			burstLimit: 5,
		})
	})

	describe('checkLimit', () => {
		it('should allow requests within limits', () => {
			expect(rateLimiter.checkLimit('test-provider', 'second')).toBe(true)
			expect(rateLimiter.checkLimit('test-provider', 'second')).toBe(true)
		})

		it('should reject requests exceeding limits', () => {
			// Use up the limit
			expect(rateLimiter.checkLimit('test-provider', 'second')).toBe(true)
			expect(rateLimiter.checkLimit('test-provider', 'second')).toBe(true)

			// This should be rejected
			expect(rateLimiter.checkLimit('test-provider', 'second')).toBe(false)
		})

		it('should allow requests for unknown providers', () => {
			expect(rateLimiter.checkLimit('unknown-provider', 'second')).toBe(true)
		})

		it('should handle different time windows', () => {
			expect(rateLimiter.checkLimit('test-provider', 'minute')).toBe(true)
			expect(rateLimiter.checkLimit('test-provider', 'hour')).toBe(true)
		})
	})

	describe('getResetTime', () => {
		it('should return reset time for active limits', () => {
			rateLimiter.checkLimit('test-provider', 'second')
			const resetTime = rateLimiter.getResetTime('test-provider', 'second')
			expect(resetTime).toBeGreaterThan(0)
			expect(resetTime).toBeLessThanOrEqual(1000) // Should be within 1 second
		})

		it('should return 0 for inactive limits', () => {
			const resetTime = rateLimiter.getResetTime('test-provider', 'second')
			expect(resetTime).toBe(0)
		})
	})
})
