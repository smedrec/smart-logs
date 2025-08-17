import type { ServerConfig } from './schema.js'

/**
 * Configuration validation utilities
 */

export interface ValidationResult {
	isValid: boolean
	errors: string[]
	warnings: string[]
}

export class ConfigValidator {
	/**
	 * Validate configuration for production readiness
	 */
	static validateForProduction(config: ServerConfig): ValidationResult {
		const errors: string[] = []
		const warnings: string[] = []

		// Check required production settings
		if (config.server.environment !== 'production') {
			warnings.push('Server environment is not set to production')
		}

		// Database validation
		if (!config.database.url) {
			errors.push('Database URL is required')
		} else {
			if (!config.database.url.startsWith('postgresql://')) {
				warnings.push('Database URL should use postgresql:// protocol for production')
			}
			if (config.database.url.includes('localhost')) {
				warnings.push('Database URL should not use localhost in production')
			}
		}

		// Redis validation
		if (!config.redis.url) {
			errors.push('Redis URL is required')
		} else {
			if (config.redis.url.includes('localhost')) {
				warnings.push('Redis URL should not use localhost in production')
			}
		}

		// Security validation
		if (!config.security.encryptionKey || config.security.encryptionKey.length < 32) {
			errors.push('Encryption key must be at least 32 characters long')
		}

		if (!config.auth.sessionSecret || config.auth.sessionSecret.length < 32) {
			errors.push('Session secret must be at least 32 characters long')
		}

		// CORS validation for production
		if (config.server.environment === 'production') {
			if (Array.isArray(config.cors.origin) && config.cors.origin.includes('*')) {
				errors.push('CORS origin should not include wildcard (*) in production')
			} else if (config.cors.origin === '*') {
				errors.push('CORS origin should not be wildcard (*) in production')
			}
		}

		// SSL validation for production
		if (config.server.environment === 'production' && !config.database.ssl) {
			warnings.push('Database SSL should be enabled in production')
		}

		// Rate limiting validation
		if (config.rateLimit.maxRequests > 10000) {
			warnings.push('Rate limit max requests is very high, consider lowering for production')
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		}
	}

	/**
	 * Validate configuration for development
	 */
	static validateForDevelopment(config: ServerConfig): ValidationResult {
		const errors: string[] = []
		const warnings: string[] = []

		// Check development-specific settings
		if (config.server.environment !== 'development') {
			warnings.push('Server environment is not set to development')
		}

		// Basic validation
		if (!config.database.url) {
			errors.push('Database URL is required')
		}

		if (!config.redis.url) {
			errors.push('Redis URL is required')
		}

		// Security validation (less strict for development)
		if (!config.security.encryptionKey) {
			warnings.push('Encryption key should be set even in development')
		}

		if (!config.auth.sessionSecret) {
			warnings.push('Session secret should be set even in development')
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		}
	}

	/**
	 * Validate configuration for test environment
	 */
	static validateForTest(config: ServerConfig): ValidationResult {
		const errors: string[] = []
		const warnings: string[] = []

		// Check test-specific settings
		if (config.server.environment !== 'test') {
			warnings.push('Server environment is not set to test')
		}

		// Test database should be separate
		if (config.database.url && !config.database.url.includes('test')) {
			warnings.push('Test database URL should include "test" to avoid conflicts')
		}

		// Test Redis should use different database
		if (config.redis.url && !config.redis.url.includes('/15')) {
			warnings.push('Test Redis should use a different database (e.g., /15)')
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		}
	}

	/**
	 * Validate configuration based on environment
	 */
	static validate(config: ServerConfig): ValidationResult {
		switch (config.server.environment) {
			case 'production':
				return this.validateForProduction(config)
			case 'development':
				return this.validateForDevelopment(config)
			case 'test':
				return this.validateForTest(config)
			default:
				return {
					isValid: false,
					errors: [`Unknown environment: ${config.server.environment}`],
					warnings: [],
				}
		}
	}

	/**
	 * Print validation results to console
	 */
	static printValidationResults(result: ValidationResult, environment: string): void {
		console.log(`\n🔍 Configuration validation for ${environment}:`)

		if (result.isValid) {
			console.log('✅ Configuration is valid')
		} else {
			console.log('❌ Configuration validation failed')
		}

		if (result.errors.length > 0) {
			console.log('\n🚨 Errors:')
			result.errors.forEach((error) => console.log(`  - ${error}`))
		}

		if (result.warnings.length > 0) {
			console.log('\n⚠️  Warnings:')
			result.warnings.forEach((warning) => console.log(`  - ${warning}`))
		}

		console.log('')
	}
}
