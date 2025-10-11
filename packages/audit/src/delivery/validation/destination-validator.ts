/**
 * Destination Validator - Validates destination configurations for all types
 * Requirements 1.2, 1.3, 1.4, 10.1, 10.2, 10.3, 10.4, 10.5: Configuration validation
 */

import type { DestinationConfig, DestinationType, ValidationResult } from '../types.js'

/**
 * Validation rules for different destination types
 */
interface ValidationRule {
	field: string
	required: boolean
	type: 'string' | 'number' | 'boolean' | 'object' | 'array'
	minLength?: number
	maxLength?: number
	pattern?: RegExp
	validator?: (value: any) => boolean
	message?: string
}

/**
 * Destination configuration validator
 */
export class DestinationValidator {
	private readonly validationRules: Record<DestinationType, ValidationRule[]> = {
		webhook: [
			{
				field: 'url',
				required: true,
				type: 'string',
				minLength: 1,
				pattern: /^https?:\/\/.+/,
				message: 'URL must be a valid HTTP or HTTPS URL',
			},
			{
				field: 'method',
				required: true,
				type: 'string',
				validator: (value) => ['POST', 'PUT'].includes(value),
				message: 'Method must be POST or PUT',
			},
			{
				field: 'headers',
				required: false,
				type: 'object',
				message: 'Headers must be an object',
			},
			{
				field: 'timeout',
				required: true,
				type: 'number',
				validator: (value) => value > 0 && value <= 300000, // Max 5 minutes
				message: 'Timeout must be between 1 and 300000 milliseconds',
			},
			{
				field: 'retryConfig',
				required: true,
				type: 'object',
				message: 'Retry configuration is required',
			},
		],
		email: [
			{
				field: 'service',
				required: true,
				type: 'string',
				validator: (value) => ['smtp', 'gmail', 'sendgrid', 'resend', 'ses'].includes(value),
				message: 'Service must be one of: smtp, gmail, sendgrid, resend, ses',
			},
			{
				field: 'from',
				required: true,
				type: 'string',
				pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
				message: 'From must be a valid email address',
			},
			{
				field: 'subject',
				required: true,
				type: 'string',
				minLength: 1,
				maxLength: 200,
				message: 'Subject must be between 1 and 200 characters',
			},
		],
		storage: [
			{
				field: 'provider',
				required: true,
				type: 'string',
				validator: (value) => ['local', 's3', 'azure', 'gcp'].includes(value),
				message: 'Provider must be one of: local, s3, azure, gcp',
			},
			{
				field: 'config',
				required: true,
				type: 'object',
				message: 'Storage configuration is required',
			},
			{
				field: 'path',
				required: true,
				type: 'string',
				minLength: 1,
				message: 'Path is required and cannot be empty',
			},
		],
		sftp: [
			{
				field: 'host',
				required: true,
				type: 'string',
				minLength: 1,
				message: 'Host is required and cannot be empty',
			},
			{
				field: 'port',
				required: true,
				type: 'number',
				validator: (value) => value > 0 && value <= 65535,
				message: 'Port must be between 1 and 65535',
			},
			{
				field: 'path',
				required: true,
				type: 'string',
				minLength: 1,
				message: 'Path is required and cannot be empty',
			},
		],
		download: [
			{
				field: 'expiryHours',
				required: true,
				type: 'number',
				validator: (value) => value > 0 && value <= 8760, // Max 1 year
				message: 'Expiry hours must be between 1 and 8760 (1 year)',
			},
		],
	}

	/**
	 * Validate destination configuration for a specific type
	 * Requirements 1.2, 1.3, 1.4: Configuration validation for each destination type
	 */
	async validateDestinationConfig(
		type: DestinationType,
		config: DestinationConfig
	): Promise<ValidationResult> {
		const errors: string[] = []
		const warnings: string[] = []

		try {
			// Get the configuration for the specific destination type
			const typeConfig = this.getTypeConfig(type, config)
			if (!typeConfig) {
				errors.push(`Configuration for ${type} destination is missing`)
				return { isValid: false, errors, warnings }
			}

			// Get validation rules for this type
			const rules = this.validationRules[type]
			if (!rules) {
				errors.push(`No validation rules defined for destination type: ${type}`)
				return { isValid: false, errors, warnings }
			}

			// Validate each rule
			for (const rule of rules) {
				const fieldValue = typeConfig[rule.field]
				const validationResult = this.validateField(rule, fieldValue, type)

				if (validationResult.error) {
					errors.push(validationResult.error)
				}
				if (validationResult.warning) {
					warnings.push(validationResult.warning)
				}
			}

			// Type-specific validation
			const typeValidation = await this.validateTypeSpecific(type, typeConfig)
			errors.push(...typeValidation.errors)
			warnings.push(...typeValidation.warnings)

			return {
				isValid: errors.length === 0,
				errors,
				warnings,
			}
		} catch (error) {
			errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`)
			return { isValid: false, errors, warnings }
		}
	}

	/**
	 * Get type-specific configuration from the main config object
	 */
	private getTypeConfig(type: DestinationType, config: DestinationConfig): any {
		switch (type) {
			case 'webhook':
				return config.webhook
			case 'email':
				return config.email
			case 'storage':
				return config.storage
			case 'sftp':
				return config.sftp
			case 'download':
				return config.download
			default:
				return null
		}
	}

	/**
	 * Validate a single field against its rule
	 */
	private validateField(
		rule: ValidationRule,
		value: any,
		type: DestinationType
	): { error?: string; warning?: string } {
		// Check if required field is missing
		if (rule.required && (value === undefined || value === null || value === '')) {
			return { error: `${rule.field} is required for ${type} destinations` }
		}

		// Skip validation if field is not provided and not required
		if (!rule.required && (value === undefined || value === null)) {
			return {}
		}

		// Type validation
		if (!this.validateType(value, rule.type)) {
			return {
				error: `${rule.field} must be of type ${rule.type} for ${type} destinations`,
			}
		}

		// String-specific validations
		if (rule.type === 'string' && typeof value === 'string') {
			if (rule.minLength && value.length < rule.minLength) {
				return {
					error: `${rule.field} must be at least ${rule.minLength} characters long`,
				}
			}
			if (rule.maxLength && value.length > rule.maxLength) {
				return {
					error: `${rule.field} must be no more than ${rule.maxLength} characters long`,
				}
			}
			if (rule.pattern && !rule.pattern.test(value)) {
				return {
					error: rule.message || `${rule.field} format is invalid`,
				}
			}
		}

		// Custom validator
		if (rule.validator && !rule.validator(value)) {
			return {
				error: rule.message || `${rule.field} validation failed`,
			}
		}

		return {}
	}

	/**
	 * Validate the type of a value
	 */
	private validateType(value: any, expectedType: string): boolean {
		switch (expectedType) {
			case 'string':
				return typeof value === 'string'
			case 'number':
				return typeof value === 'number' && !isNaN(value)
			case 'boolean':
				return typeof value === 'boolean'
			case 'object':
				return typeof value === 'object' && value !== null && !Array.isArray(value)
			case 'array':
				return Array.isArray(value)
			default:
				return false
		}
	}

	/**
	 * Type-specific validation logic
	 * Requirements 10.1, 10.2, 10.3, 10.4, 10.5: Authentication and credential validation
	 */
	private async validateTypeSpecific(
		type: DestinationType,
		config: any
	): Promise<{ errors: string[]; warnings: string[] }> {
		const errors: string[] = []
		const warnings: string[] = []

		switch (type) {
			case 'webhook':
				return this.validateWebhookConfig(config)
			case 'email':
				return this.validateEmailConfig(config)
			case 'storage':
				return this.validateStorageConfig(config)
			case 'sftp':
				return this.validateSftpConfig(config)
			case 'download':
				return this.validateDownloadConfig(config)
			default:
				errors.push(`Unknown destination type: ${type}`)
		}

		return { errors, warnings }
	}

	/**
	 * Validate webhook-specific configuration
	 * Requirements 4.1, 4.2, 4.3: Webhook validation and security
	 */
	private validateWebhookConfig(config: any): { errors: string[]; warnings: string[] } {
		const errors: string[] = []
		const warnings: string[] = []

		// Validate retry configuration
		if (config.retryConfig) {
			const retryConfig = config.retryConfig
			if (typeof retryConfig.maxRetries !== 'number' || retryConfig.maxRetries < 0) {
				errors.push('retryConfig.maxRetries must be a non-negative number')
			}
			if (typeof retryConfig.backoffMultiplier !== 'number' || retryConfig.backoffMultiplier < 1) {
				errors.push('retryConfig.backoffMultiplier must be a number >= 1')
			}
			if (typeof retryConfig.maxBackoffDelay !== 'number' || retryConfig.maxBackoffDelay < 1000) {
				errors.push('retryConfig.maxBackoffDelay must be at least 1000ms')
			}
		}

		// Validate headers
		if (config.headers) {
			for (const [key, value] of Object.entries(config.headers)) {
				if (typeof key !== 'string' || typeof value !== 'string') {
					errors.push('All headers must be string key-value pairs')
					break
				}
			}
		}

		// Security warnings
		if (config.url && config.url.startsWith('http://')) {
			warnings.push('Using HTTP instead of HTTPS may expose data in transit')
		}

		return { errors, warnings }
	}

	/**
	 * Validate email-specific configuration
	 * Requirements 10.3: Email authentication and configuration validation
	 */
	private validateEmailConfig(config: any): { errors: string[]; warnings: string[] } {
		const errors: string[] = []
		const warnings: string[] = []

		// Service-specific validation
		switch (config.service) {
			case 'smtp':
				if (!config.smtpConfig) {
					errors.push('SMTP configuration is required for SMTP service')
				} else {
					const smtp = config.smtpConfig
					if (!smtp.host || typeof smtp.host !== 'string') {
						errors.push('SMTP host is required')
					}
					if (typeof smtp.port !== 'number' || smtp.port < 1 || smtp.port > 65535) {
						errors.push('SMTP port must be between 1 and 65535')
					}
					if (typeof smtp.secure !== 'boolean') {
						errors.push('SMTP secure must be a boolean')
					}
					if (!smtp.auth || !smtp.auth.user || !smtp.auth.pass) {
						errors.push('SMTP authentication (user and pass) is required')
					}
				}
				break

			case 'sendgrid':
			case 'resend':
			case 'ses':
				if (!config.apiKey || typeof config.apiKey !== 'string') {
					errors.push(`API key is required for ${config.service} service`)
				}
				break

			case 'gmail':
				// Gmail requires either OAuth2 or app password
				if (!config.apiKey && !config.smtpConfig) {
					errors.push('Gmail requires either API key (OAuth2) or SMTP configuration')
				}
				break
		}

		// Validate recipients if provided
		if (config.recipients && Array.isArray(config.recipients)) {
			const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
			for (const recipient of config.recipients) {
				if (typeof recipient !== 'string' || !emailPattern.test(recipient)) {
					errors.push(`Invalid recipient email address: ${recipient}`)
				}
			}
		}

		return { errors, warnings }
	}

	/**
	 * Validate storage-specific configuration
	 * Requirements 10.2, 10.4: Cloud storage authentication and configuration
	 */
	private validateStorageConfig(config: any): { errors: string[]; warnings: string[] } {
		const errors: string[] = []
		const warnings: string[] = []

		// Provider-specific validation
		switch (config.provider) {
			case 's3':
				if (!config.config.region) {
					errors.push('AWS region is required for S3 storage')
				}
				if (!config.config.bucket) {
					errors.push('S3 bucket name is required')
				}
				// Check for credentials (either access keys or IAM role)
				if (!config.config.accessKeyId && !config.config.useIAMRole) {
					warnings.push('No explicit credentials found - ensure IAM role is configured')
				}
				break

			case 'azure':
				if (!config.config.accountName) {
					errors.push('Azure storage account name is required')
				}
				if (!config.config.containerName) {
					errors.push('Azure container name is required')
				}
				if (!config.config.accountKey && !config.config.sasToken) {
					errors.push('Azure storage requires either account key or SAS token')
				}
				break

			case 'gcp':
				if (!config.config.projectId) {
					errors.push('GCP project ID is required')
				}
				if (!config.config.bucketName) {
					errors.push('GCP bucket name is required')
				}
				if (!config.config.keyFilePath && !config.config.useDefaultCredentials) {
					warnings.push('No explicit credentials found - ensure default credentials are configured')
				}
				break

			case 'local':
				// Validate local path
				if (!config.path || typeof config.path !== 'string') {
					errors.push('Local storage path is required')
				}
				warnings.push('Local storage is not recommended for production use')
				break
		}

		// Validate retention policy if provided
		if (config.retention) {
			if (typeof config.retention.days !== 'number' || config.retention.days < 1) {
				errors.push('Retention days must be a positive number')
			}
			if (typeof config.retention.autoCleanup !== 'boolean') {
				errors.push('Retention autoCleanup must be a boolean')
			}
		}

		return { errors, warnings }
	}

	/**
	 * Validate SFTP-specific configuration
	 * Requirements 10.4: SFTP authentication and configuration
	 */
	private validateSftpConfig(config: any): { errors: string[]; warnings: string[] } {
		const errors: string[] = []
		const warnings: string[] = []

		// Authentication validation
		const hasPassword = config.password && typeof config.password === 'string'
		const hasPrivateKey = config.privateKey && typeof config.privateKey === 'string'

		if (!hasPassword && !hasPrivateKey) {
			errors.push('SFTP requires either password or private key authentication')
		}

		if (hasPassword && hasPrivateKey) {
			warnings.push('Both password and private key provided - private key will be preferred')
		}

		// Username validation
		if (!config.username || typeof config.username !== 'string') {
			errors.push('SFTP username is required')
		}

		// Path validation
		if (config.path && !config.path.startsWith('/')) {
			warnings.push('SFTP path should be absolute (start with /)')
		}

		// Filename validation
		if (config.filename && typeof config.filename !== 'string') {
			errors.push('SFTP filename must be a string')
		}

		return { errors, warnings }
	}

	/**
	 * Validate download-specific configuration
	 * Requirements 9.1, 9.2: Download link validation
	 */
	private validateDownloadConfig(config: any): { errors: string[]; warnings: string[] } {
		const errors: string[] = []
		const warnings: string[] = []

		// Expiry validation is already handled by the general rules
		// Add any additional download-specific validation here

		if (config.expiryHours > 168) {
			// More than 1 week
			warnings.push('Download links with expiry > 1 week may pose security risks')
		}

		return { errors, warnings }
	}
}
