/**
 * Email destination handler with multi-provider support
 * Requirements 1.1, 10.3, 2.1, 2.5: Email delivery with SMTP and API providers
 */

import nodemailer from 'nodemailer'

import { EmailProviderFactory, EmailRateLimiter } from './email-providers.js'
import { EmailTemplateEngine } from './email-template-engine.js'

import type { SendMailOptions, Transporter } from 'nodemailer'
import type { SentMessageInfo } from 'nodemailer/lib/smtp-transport/index.js'
import type { IDestinationHandler } from '../interfaces.js'
import type {
	ConnectionTestResult,
	DeliveryFeature,
	DeliveryPayload,
	DeliveryResult,
	DestinationConfig,
	ValidationResult,
} from '../types.js'
import type { EmailAttachment, EmailTemplateContext } from './email-template-engine.js'

/**
 * Email provider types supported by the handler
 */
export type EmailProvider = 'smtp' | 'sendgrid' | 'resend' | 'ses'

// Email attachment and template context interfaces are now imported from email-template-engine.ts

/**
 * SMTP connection pool configuration
 */
interface SmtpPoolConfig {
	maxConnections: number
	maxMessages: number
	rateDelta: number // milliseconds
	rateLimit: number // messages per rateDelta
}

/**
 * Email handler implementing multi-provider email delivery
 * Requirements 1.1, 10.3, 2.1: Email delivery with authentication support
 */
export class EmailHandler implements IDestinationHandler {
	readonly type = 'email' as const

	private readonly transporterPool = new Map<string, Transporter>()
	private readonly rateLimiter = new EmailRateLimiter()
	private readonly templateEngine = new EmailTemplateEngine()
	private readonly defaultPoolConfig: SmtpPoolConfig = {
		maxConnections: 5,
		maxMessages: 100,
		rateDelta: 1000, // 1 second
		rateLimit: 10, // 10 messages per second
	}

	constructor() {
		// Initialize rate limits for all providers
		EmailProviderFactory.getAllProviders().forEach((provider) => {
			this.rateLimiter.setLimits(provider.name, provider.getRateLimits())
		})
	}

	/**
	 * Validate email configuration
	 * Requirements 10.3, 1.2, 1.3: Email configuration validation
	 */
	validateConfig(config: DestinationConfig): ValidationResult {
		const errors: string[] = []
		const warnings: string[] = []

		const emailConfig = config.email
		if (!emailConfig) {
			errors.push('Email configuration is required')
			return { isValid: false, errors, warnings }
		}

		// Validate service type
		if (!emailConfig.service) {
			errors.push('Email service type is required')
		} else {
			try {
				const provider = EmailProviderFactory.getProvider(emailConfig.service)
				// Use provider-specific validation
				const providerValidation = provider.validateConfig(emailConfig)
				errors.push(...providerValidation.errors)
				warnings.push(...providerValidation.warnings)
			} catch (error) {
				errors.push(`Unsupported email service: ${emailConfig.service}`)
			}
		}

		// Validate from address
		if (!emailConfig.from) {
			errors.push('From email address is required')
		} else if (!this.isValidEmail(emailConfig.from)) {
			errors.push('From email address is invalid')
		}

		// Validate subject
		if (!emailConfig.subject) {
			errors.push('Email subject is required')
		} else if (emailConfig.subject.length > 998) {
			// RFC 5322 line length limit
			errors.push('Email subject exceeds maximum length (998 characters)')
		}

		// Validate recipients if provided
		if (emailConfig.recipients) {
			if (!Array.isArray(emailConfig.recipients)) {
				errors.push('Recipients must be an array')
			} else {
				for (const recipient of emailConfig.recipients) {
					if (!this.isValidEmail(recipient)) {
						errors.push(`Invalid recipient email address: ${recipient}`)
					}
				}
				if (emailConfig.recipients.length > 50) {
					warnings.push('Large recipient lists may impact delivery performance')
				}
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		}
	}

	/**
	 * Test connection to email service
	 * Requirements 1.3, 10.3: Connection testing and validation
	 */
	async testConnection(config: DestinationConfig): Promise<ConnectionTestResult> {
		const validation = this.validateConfig(config)
		if (!validation.isValid) {
			return {
				success: false,
				error: `Configuration validation failed: ${validation.errors.join(', ')}`,
			}
		}

		const emailConfig = config.email!
		const startTime = Date.now()

		try {
			const transporter = await this.createTransporter(emailConfig)

			// Verify the connection
			const verified = await transporter.verify()
			const responseTime = Date.now() - startTime

			if (verified) {
				return {
					success: true,
					responseTime,
					details: {
						service: emailConfig.service,
						from: emailConfig.from,
					},
				}
			} else {
				return {
					success: false,
					responseTime,
					error: 'Email service verification failed',
				}
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
	 * Deliver payload via email
	 * Requirements 2.1, 2.5: Email delivery with template processing
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

		const emailConfig = config.email!
		const startTime = Date.now()

		// Check rate limits
		if (!this.rateLimiter.checkLimit(emailConfig.service)) {
			const resetTime = this.rateLimiter.getResetTime(emailConfig.service)
			return {
				success: false,
				responseTime: Date.now() - startTime,
				error: `Rate limit exceeded for ${emailConfig.service}. Reset in ${resetTime}ms`,
				retryable: true,
			}
		}

		try {
			const transporter = await this.createTransporter(emailConfig)

			// Process email template and prepare mail options
			const mailOptions = await this.prepareMailOptions(payload, emailConfig)

			// Send the email
			const result = await transporter.sendMail(mailOptions)
			const responseTime = Date.now() - startTime

			return {
				success: true,
				deliveredAt: new Date().toISOString(),
				responseTime,
				crossSystemReference: this.extractMessageId(result),
				retryable: false,
			}
		} catch (error) {
			const responseTime = Date.now() - startTime
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

			return {
				success: false,
				responseTime,
				error: errorMessage,
				retryable: this.isRetryableEmailError(error),
			}
		}
	}

	/**
	 * Check if handler supports a specific feature
	 * Requirements 2.1, 2.2: Feature support declaration
	 */
	supportsFeature(feature: DeliveryFeature): boolean {
		const supportedFeatures: DeliveryFeature[] = [
			'retry_with_backoff',
			'connection_pooling',
			'rate_limiting',
		]
		return supportedFeatures.includes(feature)
	}

	/**
	 * Check if a specific email provider supports a feature
	 */
	providerSupportsFeature(service: string, feature: string): boolean {
		try {
			const provider = EmailProviderFactory.getProvider(service)
			return provider.supportsFeature(feature as any)
		} catch {
			return false
		}
	}

	/**
	 * Get JSON schema for email configuration
	 */
	getConfigSchema(): Record<string, any> {
		return {
			type: 'object',
			properties: {
				email: {
					type: 'object',
					required: ['service', 'from', 'subject'],
					properties: {
						service: {
							type: 'string',
							enum: ['smtp', 'sendgrid', 'resend', 'ses'],
							description: 'Email service provider',
						},
						from: {
							type: 'string',
							format: 'email',
							description: 'From email address',
						},
						subject: {
							type: 'string',
							maxLength: 998,
							description: 'Email subject line',
						},
						bodyTemplate: {
							type: 'string',
							description: 'Email body template with placeholder support',
						},
						attachmentName: {
							type: 'string',
							description: 'Name for data attachments',
						},
						recipients: {
							type: 'array',
							items: {
								type: 'string',
								format: 'email',
							},
							maxItems: 50,
							description: 'Default recipient list',
						},
						smtpConfig: {
							type: 'object',
							properties: {
								host: {
									type: 'string',
									description: 'SMTP server hostname',
								},
								port: {
									type: 'number',
									minimum: 1,
									maximum: 65535,
									description: 'SMTP server port',
								},
								secure: {
									type: 'boolean',
									description: 'Use TLS/SSL connection',
								},
								auth: {
									type: 'object',
									required: ['user', 'pass'],
									properties: {
										user: {
											type: 'string',
											description: 'SMTP username',
										},
										pass: {
											type: 'string',
											description: 'SMTP password',
										},
									},
								},
							},
							description: 'SMTP configuration (required for smtp service)',
						},
						apiKey: {
							type: 'string',
							description: 'API key for service providers (SendGrid, Resend, etc.)',
						},
					},
				},
			},
		}
	}

	/**
	 * Create email transporter based on service configuration
	 * Requirements 1.1, 10.3: Multi-provider email support with authentication
	 */
	private async createTransporter(
		emailConfig: NonNullable<DestinationConfig['email']>
	): Promise<Transporter> {
		const cacheKey = this.getTransporterCacheKey(emailConfig)

		// Return cached transporter if available
		if (this.transporterPool.has(cacheKey)) {
			return this.transporterPool.get(cacheKey)!
		}

		// Use provider factory to create transporter
		const provider = EmailProviderFactory.getProvider(emailConfig.service)
		const transporter = await provider.createTransporter(emailConfig)

		// Cache the transporter
		this.transporterPool.set(cacheKey, transporter)
		return transporter
	}

	/**
	 * Create SMTP transporter with connection pooling
	 * Requirements 1.1, 10.3, 2.1: SMTP client with authentication and pooling
	 */
	private async createSmtpTransporter(
		emailConfig: NonNullable<DestinationConfig['email']>
	): Promise<Transporter> {
		if (!emailConfig.smtpConfig) {
			throw new Error('SMTP configuration is required for SMTP service')
		}

		const smtpConfig = emailConfig.smtpConfig

		return nodemailer.createTransport({
			host: smtpConfig.host,
			port: smtpConfig.port,
			secure: smtpConfig.secure,
			auth: {
				user: smtpConfig.auth.user,
				pass: smtpConfig.auth.pass,
			},
			pool: true,
			maxConnections: this.defaultPoolConfig.maxConnections,
			maxMessages: this.defaultPoolConfig.maxMessages,
			rateDelta: this.defaultPoolConfig.rateDelta,
			rateLimit: this.defaultPoolConfig.rateLimit,
			connectionTimeout: 30000, // 30 seconds
			greetingTimeout: 30000, // 30 seconds
			socketTimeout: 30000, // 30 seconds
		})
	}

	/**
	 * Create SendGrid transporter
	 * Requirements 1.1, 10.3, 10.4: SendGrid API integration
	 */
	private async createSendGridTransporter(
		emailConfig: NonNullable<DestinationConfig['email']>
	): Promise<Transporter> {
		if (!emailConfig.apiKey) {
			throw new Error('API key is required for SendGrid service')
		}

		return nodemailer.createTransport({
			service: 'SendGrid',
			auth: {
				user: 'apikey',
				pass: emailConfig.apiKey,
			},
		})
	}

	/**
	 * Create Resend transporter
	 * Requirements 1.1, 10.3, 10.4: Resend API integration
	 */
	private async createResendTransporter(
		emailConfig: NonNullable<DestinationConfig['email']>
	): Promise<Transporter> {
		if (!emailConfig.apiKey) {
			throw new Error('API key is required for Resend service')
		}

		// Resend uses SMTP interface
		return nodemailer.createTransport({
			host: 'smtp.resend.com',
			port: 587,
			secure: false,
			auth: {
				user: 'resend',
				pass: emailConfig.apiKey,
			},
		})
	}

	/**
	 * Create AWS SES transporter
	 * Requirements 1.1, 10.3, 10.4: AWS SES integration with IAM support
	 */
	private async createSesTransporter(
		emailConfig: NonNullable<DestinationConfig['email']>
	): Promise<Transporter> {
		// For SES, we'll use SMTP interface with SES SMTP credentials
		// This is simpler than using the AWS SDK directly
		const region = process.env.AWS_REGION || 'us-east-1'
		const sesSmtpHost = `email-smtp.${region}.amazonaws.com`

		return nodemailer.createTransport({
			host: sesSmtpHost,
			port: 587,
			secure: false, // Use STARTTLS
			auth: {
				user: process.env.AWS_SES_SMTP_USERNAME || '',
				pass: process.env.AWS_SES_SMTP_PASSWORD || '',
			},
		})
	}

	/**
	 * Prepare mail options from delivery payload
	 * Requirements 2.1, 2.2: Email composition with template processing
	 */
	private async prepareMailOptions(
		payload: DeliveryPayload,
		emailConfig: NonNullable<DestinationConfig['email']>
	): Promise<SendMailOptions> {
		// Create template context using the template engine
		const templateContext = this.templateEngine.createTemplateContext(payload)

		// Validate recipients if provided
		if (emailConfig.recipients) {
			const recipientValidation = this.templateEngine.validateRecipients(emailConfig.recipients)
			if (!recipientValidation.isValid) {
				throw new Error(`Recipient validation failed: ${recipientValidation.errors.join(', ')}`)
			}
		}

		// Process email subject with template variables
		const subject = this.templateEngine.processTemplate(emailConfig.subject, templateContext)

		// Process email body template
		let html: string
		let text: string

		if (emailConfig.bodyTemplate) {
			html = this.templateEngine.processTemplate(emailConfig.bodyTemplate, templateContext)
			text = this.stripHtml(html)
		} else {
			// Use template engine for default templates
			html = this.templateEngine.processTemplate(
				this.templateEngine.generateDefaultHtmlTemplate(templateContext),
				templateContext
			)
			text = this.templateEngine.processTemplate(
				this.templateEngine.generateDefaultTextTemplate(templateContext),
				templateContext
			)
		}

		// Process attachments using template engine
		const attachmentResult = this.templateEngine.processAttachments(
			payload,
			emailConfig.attachmentName
		)
		if (attachmentResult.errors.length > 0) {
			throw new Error(`Attachment processing failed: ${attachmentResult.errors.join(', ')}`)
		}

		// Determine recipients
		const to = emailConfig.recipients || []

		return {
			from: emailConfig.from,
			to,
			subject,
			text,
			html,
			attachments: attachmentResult.attachments,
			headers: {
				'X-Delivery-ID': payload.deliveryId,
				'X-Organization-ID': payload.organizationId,
				'X-Correlation-ID': payload.correlationId || '',
			},
		}
	}

	/**
	 * Process template with variable substitution
	 * Requirements 2.1, 2.2: Template processing for dynamic content
	 */
	private processTemplate(template: string, context: EmailTemplateContext): string {
		return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
			const value = this.getNestedValue(context, path)
			return value !== undefined ? String(value) : match
		})
	}

	/**
	 * Get nested value from object using dot notation
	 */
	private getNestedValue(obj: any, path: string): any {
		return path.split('.').reduce((current, key) => current?.[key], obj)
	}

	/**
	 * Generate default HTML email body
	 */
	private generateDefaultHtmlBody(context: EmailTemplateContext): string {
		return `
			<html>
				<body>
					<h2>Delivery Notification</h2>
					<p><strong>Delivery ID:</strong> ${context.deliveryId}</p>
					<p><strong>Organization:</strong> ${context.organizationId}</p>
					<p><strong>Timestamp:</strong> ${context.timestamp}</p>
					<p><strong>Type:</strong> ${context.data.type || 'Unknown'}</p>
					
					<h3>Data</h3>
					<pre>${JSON.stringify(context.data, null, 2)}</pre>
					
					${
						Object.keys(context.metadata).length > 0
							? `
						<h3>Metadata</h3>
						<pre>${JSON.stringify(context.metadata, null, 2)}</pre>
					`
							: ''
					}
				</body>
			</html>
		`
	}

	/**
	 * Generate default text email body
	 */
	private generateDefaultTextBody(context: EmailTemplateContext): string {
		let body = `Delivery Notification\n\n`
		body += `Delivery ID: ${context.deliveryId}\n`
		body += `Organization: ${context.organizationId}\n`
		body += `Timestamp: ${context.timestamp}\n`
		body += `Type: ${context.data.type || 'Unknown'}\n\n`
		body += `Data:\n${JSON.stringify(context.data, null, 2)}\n`

		if (Object.keys(context.metadata).length > 0) {
			body += `\nMetadata:\n${JSON.stringify(context.metadata, null, 2)}\n`
		}

		return body
	}

	/**
	 * Strip HTML tags for plain text version
	 */
	private stripHtml(html: string): string {
		return html
			.replace(/<[^>]*>/g, '')
			.replace(/&nbsp;/g, ' ')
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.trim()
	}

	/**
	 * Prepare email attachments
	 * Requirements 2.1, 2.2: Attachment handling for reports and exports
	 */
	private async prepareAttachments(
		payload: DeliveryPayload,
		emailConfig: NonNullable<DestinationConfig['email']>
	): Promise<EmailAttachment[]> {
		const attachments: EmailAttachment[] = []

		// If payload contains file data, attach it
		if (payload.data && typeof payload.data === 'object') {
			if (payload.data.content || payload.data.buffer) {
				const filename =
					emailConfig.attachmentName ||
					payload.data.filename ||
					`${payload.type}-${payload.deliveryId}.json`

				const content =
					payload.data.content || payload.data.buffer || JSON.stringify(payload.data, null, 2)
				const contentType = payload.data.contentType || this.getContentTypeFromFilename(filename)

				attachments.push({
					filename,
					content: Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'),
					contentType,
				})
			}
		}

		return attachments
	}

	/**
	 * Get content type from filename extension
	 */
	private getContentTypeFromFilename(filename: string): string {
		const ext = filename.split('.').pop()?.toLowerCase()

		const contentTypes: Record<string, string> = {
			json: 'application/json',
			csv: 'text/csv',
			pdf: 'application/pdf',
			xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			txt: 'text/plain',
			html: 'text/html',
			xml: 'application/xml',
		}

		return contentTypes[ext || ''] || 'application/octet-stream'
	}

	/**
	 * Extract message ID from send result for cross-system reference
	 * Requirements 9.1, 9.2: Cross-system reference tracking
	 */
	private extractMessageId(result: SentMessageInfo): string | undefined {
		// Different providers return message ID in different formats
		if (result.messageId) {
			return result.messageId
		}

		if (result.response && typeof result.response === 'string') {
			// Try to extract message ID from response string
			const messageIdMatch = result.response.match(/Message-ID:\s*<([^>]+)>/i)
			if (messageIdMatch) {
				return messageIdMatch[1]
			}
		}

		return undefined
	}

	/**
	 * Generate cache key for transporter pooling
	 */
	private getTransporterCacheKey(emailConfig: NonNullable<DestinationConfig['email']>): string {
		const keyParts = [emailConfig.service]

		switch (emailConfig.service) {
			case 'smtp':
				if (emailConfig.smtpConfig) {
					keyParts.push(emailConfig.smtpConfig.host, String(emailConfig.smtpConfig.port))
				}
				break
			case 'sendgrid':
			case 'resend':
				keyParts.push(emailConfig.apiKey?.substring(0, 8) || 'no-key')
				break
			case 'ses':
				keyParts.push(process.env.AWS_REGION || 'us-east-1')
				break
		}

		return keyParts.join(':')
	}

	/**
	 * Validate email address format
	 */
	private isValidEmail(email: string): boolean {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
		return emailRegex.test(email)
	}

	/**
	 * Determine if email error is retryable
	 * Requirements 3.1, 3.2: Retry logic for transient failures
	 */
	private isRetryableEmailError(error: unknown): boolean {
		if (!(error instanceof Error)) {
			return false
		}

		const retryableErrors = [
			'ETIMEDOUT',
			'ECONNRESET',
			'ECONNREFUSED',
			'ENOTFOUND',
			'Network Error',
			'Temporary failure',
			'Rate limit',
			'Service unavailable',
			'Internal server error',
		]

		return retryableErrors.some((retryableError) =>
			error.message.toLowerCase().includes(retryableError.toLowerCase())
		)
	}

	// Service-specific validation methods

	private validateSmtpConfig(
		emailConfig: NonNullable<DestinationConfig['email']>,
		errors: string[],
		warnings: string[]
	): void {
		if (!emailConfig.smtpConfig) {
			errors.push('SMTP configuration is required for SMTP service')
			return
		}

		const smtp = emailConfig.smtpConfig

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

		if (smtp.port === 25 && !smtp.secure) {
			warnings.push('Port 25 without TLS is not recommended for security reasons')
		}
	}

	private validateSendGridConfig(
		emailConfig: NonNullable<DestinationConfig['email']>,
		errors: string[],
		warnings: string[]
	): void {
		if (!emailConfig.apiKey) {
			errors.push('API key is required for SendGrid service')
		} else if (!emailConfig.apiKey.startsWith('SG.')) {
			warnings.push('SendGrid API keys typically start with "SG."')
		}
	}

	private validateResendConfig(
		emailConfig: NonNullable<DestinationConfig['email']>,
		errors: string[],
		warnings: string[]
	): void {
		if (!emailConfig.apiKey) {
			errors.push('API key is required for Resend service')
		} else if (!emailConfig.apiKey.startsWith('re_')) {
			warnings.push('Resend API keys typically start with "re_"')
		}
	}

	private validateSesConfig(
		emailConfig: NonNullable<DestinationConfig['email']>,
		errors: string[],
		warnings: string[]
	): void {
		// SES uses AWS credentials, so we mainly validate the from address domain
		if (emailConfig.from && !process.env.AWS_REGION) {
			warnings.push('AWS_REGION environment variable should be set for SES')
		}
	}
}
