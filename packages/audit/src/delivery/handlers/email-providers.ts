/**
 * Email service provider integrations with API support
 * Requirements 1.1, 10.3, 10.4: Multi-provider email support with rate limiting
 */

import type { Transporter } from 'nodemailer'
import type { DestinationConfig } from '../types.js'

/**
 * Email provider interface for consistent provider implementations
 */
export interface EmailProvider {
	readonly name: string
	createTransporter(config: NonNullable<DestinationConfig['email']>): Promise<Transporter>
	validateConfig(config: NonNullable<DestinationConfig['email']>): {
		isValid: boolean
		errors: string[]
		warnings: string[]
	}
	supportsFeature(feature: EmailProviderFeature): boolean
	getRateLimits(): RateLimitConfig
}

/**
 * Email provider features
 */
export type EmailProviderFeature =
	| 'templates'
	| 'attachments'
	| 'tracking'
	| 'analytics'
	| 'webhooks'
	| 'batch_sending'

/**
 * Rate limiting configuration for providers
 */
export interface RateLimitConfig {
	requestsPerSecond: number
	requestsPerMinute: number
	requestsPerHour: number
	burstLimit: number
}

/**
 * SendGrid email provider implementation
 * Requirements 1.1, 10.3, 10.4: SendGrid API integration with rate limiting
 */
export class SendGridProvider implements EmailProvider {
	readonly name = 'sendgrid'

	async createTransporter(config: NonNullable<DestinationConfig['email']>): Promise<Transporter> {
		const nodemailer = await import('nodemailer')

		if (!config.apiKey) {
			throw new Error('API key is required for SendGrid service')
		}

		return nodemailer.default.createTransport({
			service: 'SendGrid',
			auth: {
				user: 'apikey',
				pass: config.apiKey,
			},
			// SendGrid-specific options
			pool: true,
			maxConnections: 5,
			maxMessages: 100,
			rateDelta: 1000, // 1 second
			rateLimit: 10, // 10 emails per second (within SendGrid limits)
		})
	}

	validateConfig(config: NonNullable<DestinationConfig['email']>): {
		isValid: boolean
		errors: string[]
		warnings: string[]
	} {
		const errors: string[] = []
		const warnings: string[] = []

		if (!config.apiKey) {
			errors.push('API key is required for SendGrid service')
		} else if (!config.apiKey.startsWith('SG.')) {
			warnings.push('SendGrid API keys typically start with "SG."')
		}

		// Validate from address domain for SendGrid
		if (config.from) {
			const domain = config.from.split('@')[1]
			if (domain && domain.includes('gmail.com')) {
				warnings.push('Using Gmail addresses with SendGrid may require domain verification')
			}
		}

		return { isValid: errors.length === 0, errors, warnings }
	}

	supportsFeature(feature: EmailProviderFeature): boolean {
		const supportedFeatures: EmailProviderFeature[] = [
			'templates',
			'attachments',
			'tracking',
			'analytics',
			'webhooks',
			'batch_sending',
		]
		return supportedFeatures.includes(feature)
	}

	getRateLimits(): RateLimitConfig {
		// SendGrid rate limits (varies by plan, these are conservative defaults)
		return {
			requestsPerSecond: 10,
			requestsPerMinute: 600,
			requestsPerHour: 36000,
			burstLimit: 20,
		}
	}
}

/**
 * Resend email provider implementation
 * Requirements 1.1, 10.3, 10.4: Resend API integration with template support
 */
export class ResendProvider implements EmailProvider {
	readonly name = 'resend'

	async createTransporter(config: NonNullable<DestinationConfig['email']>): Promise<Transporter> {
		const nodemailer = await import('nodemailer')

		if (!config.apiKey) {
			throw new Error('API key is required for Resend service')
		}

		// Resend uses SMTP interface
		return nodemailer.default.createTransport({
			host: 'smtp.resend.com',
			port: 587,
			secure: false, // Use STARTTLS
			auth: {
				user: 'resend',
				pass: config.apiKey,
			},
			// Resend-specific options
			pool: true,
			maxConnections: 3,
			maxMessages: 50,
			rateDelta: 1000, // 1 second
			rateLimit: 5, // 5 emails per second (conservative for Resend)
		})
	}

	validateConfig(config: NonNullable<DestinationConfig['email']>): {
		isValid: boolean
		errors: string[]
		warnings: string[]
	} {
		const errors: string[] = []
		const warnings: string[] = []

		if (!config.apiKey) {
			errors.push('API key is required for Resend service')
		} else if (!config.apiKey.startsWith('re_')) {
			warnings.push('Resend API keys typically start with "re_"')
		}

		// Validate from address domain for Resend
		if (config.from) {
			const domain = config.from.split('@')[1]
			if (domain && (domain.includes('gmail.com') || domain.includes('yahoo.com'))) {
				warnings.push('Resend requires domain verification for custom domains')
			}
		}

		return { isValid: errors.length === 0, errors, warnings }
	}

	supportsFeature(feature: EmailProviderFeature): boolean {
		const supportedFeatures: EmailProviderFeature[] = [
			'templates',
			'attachments',
			'tracking',
			'webhooks',
		]
		return supportedFeatures.includes(feature)
	}

	getRateLimits(): RateLimitConfig {
		// Resend rate limits (based on their documentation)
		return {
			requestsPerSecond: 5,
			requestsPerMinute: 300,
			requestsPerHour: 18000,
			burstLimit: 10,
		}
	}
}

/**
 * AWS SES email provider implementation
 * Requirements 1.1, 10.3, 10.4: AWS SES integration with IAM role support
 */
export class SESProvider implements EmailProvider {
	readonly name = 'ses'

	async createTransporter(config: NonNullable<DestinationConfig['email']>): Promise<Transporter> {
		const nodemailer = await import('nodemailer')

		// Use SES SMTP interface for simplicity
		const region = process.env.AWS_REGION || 'us-east-1'
		const sesSmtpHost = `email-smtp.${region}.amazonaws.com`

		return nodemailer.default.createTransport({
			host: sesSmtpHost,
			port: 587,
			secure: false, // Use STARTTLS
			auth: {
				user: process.env.AWS_SES_SMTP_USERNAME || config.apiKey || '',
				pass: process.env.AWS_SES_SMTP_PASSWORD || '',
			},
			// SES-specific options
			pool: true,
			maxConnections: 10,
			maxMessages: 200,
			rateDelta: 1000, // 1 second
			rateLimit: 14, // 14 emails per second (SES default limit)
		})
	}

	validateConfig(config: NonNullable<DestinationConfig['email']>): {
		isValid: boolean
		errors: string[]
		warnings: string[]
	} {
		const errors: string[] = []
		const warnings: string[] = []

		// Check for AWS credentials
		if (!process.env.AWS_SES_SMTP_USERNAME && !config.apiKey) {
			errors.push('AWS SES SMTP username is required (set AWS_SES_SMTP_USERNAME or provide apiKey)')
		}

		if (!process.env.AWS_SES_SMTP_PASSWORD) {
			errors.push('AWS SES SMTP password is required (set AWS_SES_SMTP_PASSWORD)')
		}

		if (!process.env.AWS_REGION) {
			warnings.push('AWS_REGION environment variable should be set for SES')
		}

		// Validate from address for SES (must be verified)
		if (config.from) {
			const domain = config.from.split('@')[1]
			if (domain && (domain.includes('gmail.com') || domain.includes('yahoo.com'))) {
				warnings.push('SES requires email address or domain verification before sending')
			}
		}

		return { isValid: errors.length === 0, errors, warnings }
	}

	supportsFeature(feature: EmailProviderFeature): boolean {
		const supportedFeatures: EmailProviderFeature[] = [
			'templates',
			'attachments',
			'tracking',
			'analytics',
			'batch_sending',
		]
		return supportedFeatures.includes(feature)
	}

	getRateLimits(): RateLimitConfig {
		// AWS SES rate limits (default for new accounts)
		return {
			requestsPerSecond: 14,
			requestsPerMinute: 840,
			requestsPerHour: 50400,
			burstLimit: 28,
		}
	}
}

/**
 * SMTP email provider implementation
 * Requirements 1.1, 10.3: Generic SMTP support with connection pooling
 */
export class SMTPProvider implements EmailProvider {
	readonly name = 'smtp'

	async createTransporter(config: NonNullable<DestinationConfig['email']>): Promise<Transporter> {
		const nodemailer = await import('nodemailer')

		if (!config.smtpConfig) {
			throw new Error('SMTP configuration is required for SMTP service')
		}

		const smtpConfig = config.smtpConfig

		return nodemailer.default.createTransport({
			host: smtpConfig.host,
			port: smtpConfig.port,
			secure: smtpConfig.secure,
			auth: {
				user: smtpConfig.auth.user,
				pass: smtpConfig.auth.pass,
			},
			// Generic SMTP options with conservative pooling
			pool: true,
			maxConnections: 5,
			maxMessages: 100,
			rateDelta: 1000, // 1 second
			rateLimit: 5, // Conservative rate limit for generic SMTP
			connectionTimeout: 30000, // 30 seconds
			greetingTimeout: 30000, // 30 seconds
			socketTimeout: 30000, // 30 seconds
		})
	}

	validateConfig(config: NonNullable<DestinationConfig['email']>): {
		isValid: boolean
		errors: string[]
		warnings: string[]
	} {
		const errors: string[] = []
		const warnings: string[] = []

		if (!config.smtpConfig) {
			errors.push('SMTP configuration is required for SMTP service')
			return { isValid: false, errors, warnings }
		}

		const smtp = config.smtpConfig

		if (!smtp.host) {
			errors.push('SMTP host is required')
		}

		if (!smtp.port) {
			errors.push('SMTP port is required')
		} else if (smtp.port < 1 || smtp.port > 65535) {
			errors.push('SMTP port must be between 1 and 65535')
		}

		if (!smtp.auth || !smtp.auth.user || !smtp.auth.pass) {
			errors.push('SMTP authentication credentials are required')
		}

		// Security warnings
		if (smtp.port === 25 && !smtp.secure) {
			warnings.push('Port 25 without TLS is not recommended for security reasons')
		}

		if (!smtp.secure && smtp.port !== 587) {
			warnings.push('Consider using port 587 with STARTTLS for better security')
		}

		return { isValid: errors.length === 0, errors, warnings }
	}

	supportsFeature(feature: EmailProviderFeature): boolean {
		const supportedFeatures: EmailProviderFeature[] = ['attachments']
		return supportedFeatures.includes(feature)
	}

	getRateLimits(): RateLimitConfig {
		// Conservative rate limits for generic SMTP
		return {
			requestsPerSecond: 5,
			requestsPerMinute: 300,
			requestsPerHour: 18000,
			burstLimit: 10,
		}
	}
}

/**
 * Email provider factory for creating provider instances
 */
export class EmailProviderFactory {
	private static providers = new Map<string, EmailProvider>([
		['smtp', new SMTPProvider()],
		['sendgrid', new SendGridProvider()],
		['resend', new ResendProvider()],
		['ses', new SESProvider()],
	])

	/**
	 * Get email provider by service name
	 */
	static getProvider(service: string): EmailProvider {
		const provider = this.providers.get(service.toLowerCase())
		if (!provider) {
			throw new Error(`Unsupported email service: ${service}`)
		}
		return provider
	}

	/**
	 * Get all available providers
	 */
	static getAllProviders(): EmailProvider[] {
		return Array.from(this.providers.values())
	}

	/**
	 * Register a custom email provider
	 */
	static registerProvider(provider: EmailProvider): void {
		this.providers.set(provider.name.toLowerCase(), provider)
	}
}

/**
 * Rate limiter for email providers
 */
export class EmailRateLimiter {
	private readonly limits = new Map<string, RateLimitConfig>()
	private readonly counters = new Map<string, { count: number; resetTime: number }>()

	/**
	 * Set rate limits for a provider
	 */
	setLimits(providerId: string, limits: RateLimitConfig): void {
		this.limits.set(providerId, limits)
	}

	/**
	 * Check if request is within rate limits
	 */
	checkLimit(providerId: string, window: 'second' | 'minute' | 'hour' = 'second'): boolean {
		const limits = this.limits.get(providerId)
		if (!limits) {
			return true // No limits configured
		}

		const now = Date.now()
		const key = `${providerId}:${window}`
		const counter = this.counters.get(key)

		let windowMs: number
		let maxRequests: number

		switch (window) {
			case 'second':
				windowMs = 1000
				maxRequests = limits.requestsPerSecond
				break
			case 'minute':
				windowMs = 60000
				maxRequests = limits.requestsPerMinute
				break
			case 'hour':
				windowMs = 3600000
				maxRequests = limits.requestsPerHour
				break
		}

		if (!counter || now >= counter.resetTime) {
			// Reset counter
			this.counters.set(key, { count: 1, resetTime: now + windowMs })
			return true
		}

		if (counter.count >= maxRequests) {
			return false // Rate limit exceeded
		}

		counter.count++
		return true
	}

	/**
	 * Get time until rate limit resets
	 */
	getResetTime(providerId: string, window: 'second' | 'minute' | 'hour' = 'second'): number {
		const key = `${providerId}:${window}`
		const counter = this.counters.get(key)

		if (!counter) {
			return 0
		}

		return Math.max(0, counter.resetTime - Date.now())
	}
}
