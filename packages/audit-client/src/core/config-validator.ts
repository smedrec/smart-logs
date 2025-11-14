import { z } from 'zod'

import type { AuthenticationConfig, PartialAuditClientConfig } from './config'

/**
 * Validation result for configuration
 */
export interface ValidationResult {
	isValid: boolean
	errors: ValidationError[]
	warnings: ValidationWarning[]
}

/**
 * Validation error with details
 */
export interface ValidationError {
	field: string
	message: string
	code: string
	severity: 'error'
}

/**
 * Validation warning for non-critical issues
 */
export interface ValidationWarning {
	field: string
	message: string
	code: string
	severity: 'warning'
}

/**
 * ConfigValidator utility for validating audit client configuration
 * Provides comprehensive validation with detailed error messages
 */
export class ConfigValidator {
	/**
	 * Validates the entire configuration and returns detailed results
	 */
	static validate(config: PartialAuditClientConfig): ValidationResult {
		const errors: ValidationError[] = []
		const warnings: ValidationWarning[] = []

		// Validate baseUrl
		this.validateBaseUrl(config, errors)

		// Validate authentication
		this.validateAuthentication(config, errors, warnings)

		// Validate retry configuration
		this.validateRetryConfig(config, errors, warnings)

		// Validate cache configuration
		this.validateCacheConfig(config, errors, warnings)

		// Validate timeout
		this.validateTimeout(config, errors, warnings)

		// Validate performance configuration
		this.validatePerformanceConfig(config, errors, warnings)

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		}
	}

	/**
	 * Validates baseUrl is provided and is a valid URL
	 */
	private static validateBaseUrl(
		config: PartialAuditClientConfig,
		errors: ValidationError[]
	): void {
		if (!config.baseUrl) {
			errors.push({
				field: 'baseUrl',
				message: 'baseUrl is required',
				code: 'REQUIRED_FIELD',
				severity: 'error',
			})
			return
		}

		try {
			const url = new URL(config.baseUrl)

			// Validate protocol
			if (!['http:', 'https:'].includes(url.protocol)) {
				errors.push({
					field: 'baseUrl',
					message: `Invalid protocol "${url.protocol}". Only http: and https: are allowed`,
					code: 'INVALID_PROTOCOL',
					severity: 'error',
				})
			}

			// Validate hostname
			if (!url.hostname) {
				errors.push({
					field: 'baseUrl',
					message: 'baseUrl must include a valid hostname',
					code: 'INVALID_HOSTNAME',
					severity: 'error',
				})
			}
		} catch (error) {
			errors.push({
				field: 'baseUrl',
				message: `baseUrl must be a valid URL. Received: "${config.baseUrl}"`,
				code: 'INVALID_URL',
				severity: 'error',
			})
		}
	}

	/**
	 * Validates authentication configuration based on type
	 */
	private static validateAuthentication(
		config: PartialAuditClientConfig,
		errors: ValidationError[],
		warnings: ValidationWarning[]
	): void {
		if (!config.authentication) {
			errors.push({
				field: 'authentication',
				message: 'authentication configuration is required',
				code: 'REQUIRED_FIELD',
				severity: 'error',
			})
			return
		}

		const auth = config.authentication as any

		if (!auth.type) {
			errors.push({
				field: 'authentication.type',
				message: 'authentication.type is required',
				code: 'REQUIRED_FIELD',
				severity: 'error',
			})
			return
		}

		// Validate type-specific requirements
		switch (auth.type) {
			case 'apiKey':
				this.validateApiKeyAuth(auth, errors, warnings)
				break
			case 'session':
				this.validateSessionAuth(auth, errors, warnings)
				break
			case 'bearer':
				this.validateBearerAuth(auth, errors, warnings)
				break
			case 'cookie':
				this.validateCookieAuth(auth, errors, warnings)
				break
			case 'custom':
				this.validateCustomAuth(auth, errors, warnings)
				break
			default:
				errors.push({
					field: 'authentication.type',
					message: `Invalid authentication type "${auth.type}". Must be one of: apiKey, session, bearer, cookie, custom`,
					code: 'INVALID_AUTH_TYPE',
					severity: 'error',
				})
		}

		// Validate refresh configuration if autoRefresh is enabled
		if (auth.autoRefresh && !auth.refreshEndpoint) {
			warnings.push({
				field: 'authentication.refreshEndpoint',
				message: 'autoRefresh is enabled but refreshEndpoint is not configured',
				code: 'MISSING_REFRESH_ENDPOINT',
				severity: 'warning',
			})
		}
	}

	/**
	 * Validates API key authentication
	 */
	private static validateApiKeyAuth(
		auth: any,
		errors: ValidationError[],
		warnings: ValidationWarning[]
	): void {
		if (!auth.apiKey) {
			errors.push({
				field: 'authentication.apiKey',
				message: 'apiKey is required when authentication type is "apiKey"',
				code: 'REQUIRED_AUTH_FIELD',
				severity: 'error',
			})
		} else if (auth.apiKey.length < 10) {
			warnings.push({
				field: 'authentication.apiKey',
				message: 'apiKey appears to be too short (less than 10 characters)',
				code: 'WEAK_API_KEY',
				severity: 'warning',
			})
		}
	}

	/**
	 * Validates session authentication
	 */
	private static validateSessionAuth(
		auth: any,
		errors: ValidationError[],
		warnings: ValidationWarning[]
	): void {
		if (!auth.sessionToken) {
			errors.push({
				field: 'authentication.sessionToken',
				message: 'sessionToken is required when authentication type is "session"',
				code: 'REQUIRED_AUTH_FIELD',
				severity: 'error',
			})
		}
	}

	/**
	 * Validates bearer token authentication
	 */
	private static validateBearerAuth(
		auth: any,
		errors: ValidationError[],
		warnings: ValidationWarning[]
	): void {
		if (!auth.bearerToken) {
			errors.push({
				field: 'authentication.bearerToken',
				message: 'bearerToken is required when authentication type is "bearer"',
				code: 'REQUIRED_AUTH_FIELD',
				severity: 'error',
			})
		}
	}

	/**
	 * Validates cookie authentication
	 */
	private static validateCookieAuth(
		auth: any,
		errors: ValidationError[],
		warnings: ValidationWarning[]
	): void {
		if (!auth.cookies && !auth.includeBrowserCookies) {
			warnings.push({
				field: 'authentication.cookies',
				message:
					'Cookie authentication is configured but no cookies are provided and includeBrowserCookies is false',
				code: 'NO_COOKIES_CONFIGURED',
				severity: 'warning',
			})
		}
	}

	/**
	 * Validates custom authentication
	 */
	private static validateCustomAuth(
		auth: any,
		errors: ValidationError[],
		warnings: ValidationWarning[]
	): void {
		if (!auth.customHeaders || Object.keys(auth.customHeaders).length === 0) {
			warnings.push({
				field: 'authentication.customHeaders',
				message: 'Custom authentication is configured but no custom headers are provided',
				code: 'NO_CUSTOM_HEADERS',
				severity: 'warning',
			})
		}
	}

	/**
	 * Validates retry configuration
	 */
	private static validateRetryConfig(
		config: PartialAuditClientConfig,
		errors: ValidationError[],
		warnings: ValidationWarning[]
	): void {
		const retry = config.retry
		if (!retry) return

		// Validate maxAttempts
		if (retry.maxAttempts !== undefined) {
			if (retry.maxAttempts < 1) {
				errors.push({
					field: 'retry.maxAttempts',
					message: `maxAttempts must be at least 1. Received: ${retry.maxAttempts}`,
					code: 'VALUE_OUT_OF_RANGE',
					severity: 'error',
				})
			} else if (retry.maxAttempts > 10) {
				errors.push({
					field: 'retry.maxAttempts',
					message: `maxAttempts must not exceed 10. Received: ${retry.maxAttempts}`,
					code: 'VALUE_OUT_OF_RANGE',
					severity: 'error',
				})
			} else if (retry.maxAttempts > 5) {
				warnings.push({
					field: 'retry.maxAttempts',
					message: `maxAttempts is set to ${retry.maxAttempts}, which may cause long delays on failures`,
					code: 'HIGH_RETRY_COUNT',
					severity: 'warning',
				})
			}
		}

		// Validate initialDelayMs
		if (retry.initialDelayMs !== undefined) {
			if (retry.initialDelayMs < 100) {
				errors.push({
					field: 'retry.initialDelayMs',
					message: `initialDelayMs must be at least 100ms. Received: ${retry.initialDelayMs}`,
					code: 'VALUE_OUT_OF_RANGE',
					severity: 'error',
				})
			} else if (retry.initialDelayMs > 10000) {
				errors.push({
					field: 'retry.initialDelayMs',
					message: `initialDelayMs must not exceed 10000ms. Received: ${retry.initialDelayMs}`,
					code: 'VALUE_OUT_OF_RANGE',
					severity: 'error',
				})
			}
		}

		// Validate maxDelayMs
		if (retry.maxDelayMs !== undefined) {
			if (retry.maxDelayMs < 1000) {
				errors.push({
					field: 'retry.maxDelayMs',
					message: `maxDelayMs must be at least 1000ms. Received: ${retry.maxDelayMs}`,
					code: 'VALUE_OUT_OF_RANGE',
					severity: 'error',
				})
			} else if (retry.maxDelayMs > 60000) {
				errors.push({
					field: 'retry.maxDelayMs',
					message: `maxDelayMs must not exceed 60000ms. Received: ${retry.maxDelayMs}`,
					code: 'VALUE_OUT_OF_RANGE',
					severity: 'error',
				})
			}
		}

		// Validate backoffMultiplier
		if (retry.backoffMultiplier !== undefined) {
			if (retry.backoffMultiplier < 1) {
				errors.push({
					field: 'retry.backoffMultiplier',
					message: `backoffMultiplier must be at least 1. Received: ${retry.backoffMultiplier}`,
					code: 'VALUE_OUT_OF_RANGE',
					severity: 'error',
				})
			} else if (retry.backoffMultiplier > 5) {
				errors.push({
					field: 'retry.backoffMultiplier',
					message: `backoffMultiplier must not exceed 5. Received: ${retry.backoffMultiplier}`,
					code: 'VALUE_OUT_OF_RANGE',
					severity: 'error',
				})
			}
		}

		// Validate relationship between initialDelayMs and maxDelayMs
		if (
			retry.initialDelayMs !== undefined &&
			retry.maxDelayMs !== undefined &&
			retry.initialDelayMs > retry.maxDelayMs
		) {
			errors.push({
				field: 'retry',
				message: `initialDelayMs (${retry.initialDelayMs}) must not exceed maxDelayMs (${retry.maxDelayMs})`,
				code: 'INVALID_DELAY_RANGE',
				severity: 'error',
			})
		}
	}

	/**
	 * Validates cache configuration
	 */
	private static validateCacheConfig(
		config: PartialAuditClientConfig,
		errors: ValidationError[],
		warnings: ValidationWarning[]
	): void {
		const cache = config.cache
		if (!cache) return

		// Validate defaultTtlMs
		if (cache.defaultTtlMs !== undefined) {
			if (cache.defaultTtlMs < 1000) {
				errors.push({
					field: 'cache.defaultTtlMs',
					message: `defaultTtlMs must be at least 1000ms. Received: ${cache.defaultTtlMs}`,
					code: 'VALUE_OUT_OF_RANGE',
					severity: 'error',
				})
			} else if (cache.defaultTtlMs > 86400000) {
				errors.push({
					field: 'cache.defaultTtlMs',
					message: `defaultTtlMs must not exceed 86400000ms (24 hours). Received: ${cache.defaultTtlMs}`,
					code: 'VALUE_OUT_OF_RANGE',
					severity: 'error',
				})
			}
		}

		// Validate maxSize
		if (cache.maxSize !== undefined) {
			if (cache.maxSize < 10) {
				errors.push({
					field: 'cache.maxSize',
					message: `maxSize must be at least 10. Received: ${cache.maxSize}`,
					code: 'VALUE_OUT_OF_RANGE',
					severity: 'error',
				})
			} else if (cache.maxSize > 10000) {
				errors.push({
					field: 'cache.maxSize',
					message: `maxSize must not exceed 10000. Received: ${cache.maxSize}`,
					code: 'VALUE_OUT_OF_RANGE',
					severity: 'error',
				})
			} else if (cache.maxSize > 5000) {
				warnings.push({
					field: 'cache.maxSize',
					message: `maxSize is set to ${cache.maxSize}, which may consume significant memory`,
					code: 'HIGH_CACHE_SIZE',
					severity: 'warning',
				})
			}
		}

		// Validate storage type
		if (
			cache.storage &&
			!['memory', 'localStorage', 'sessionStorage', 'custom'].includes(cache.storage)
		) {
			errors.push({
				field: 'cache.storage',
				message: `Invalid storage type "${cache.storage}". Must be one of: memory, localStorage, sessionStorage, custom`,
				code: 'INVALID_STORAGE_TYPE',
				severity: 'error',
			})
		}

		// Validate custom storage
		if (cache.storage === 'custom' && !cache.customStorage) {
			errors.push({
				field: 'cache.customStorage',
				message: 'customStorage is required when storage type is "custom"',
				code: 'REQUIRED_FIELD',
				severity: 'error',
			})
		}
	}

	/**
	 * Validates timeout configuration
	 */
	private static validateTimeout(
		config: PartialAuditClientConfig,
		errors: ValidationError[],
		warnings: ValidationWarning[]
	): void {
		if (config.timeout === undefined) return

		if (config.timeout < 1000) {
			errors.push({
				field: 'timeout',
				message: `timeout must be at least 1000ms. Received: ${config.timeout}`,
				code: 'VALUE_OUT_OF_RANGE',
				severity: 'error',
			})
		} else if (config.timeout > 300000) {
			errors.push({
				field: 'timeout',
				message: `timeout must not exceed 300000ms (5 minutes). Received: ${config.timeout}`,
				code: 'VALUE_OUT_OF_RANGE',
				severity: 'error',
			})
		} else if (config.timeout < 5000) {
			warnings.push({
				field: 'timeout',
				message: `timeout is set to ${config.timeout}ms, which may be too short for some operations`,
				code: 'LOW_TIMEOUT',
				severity: 'warning',
			})
		} else if (config.timeout > 120000) {
			warnings.push({
				field: 'timeout',
				message: `timeout is set to ${config.timeout}ms, which may cause long waits on failures`,
				code: 'HIGH_TIMEOUT',
				severity: 'warning',
			})
		}
	}

	/**
	 * Validates performance configuration
	 */
	private static validatePerformanceConfig(
		config: PartialAuditClientConfig,
		errors: ValidationError[],
		warnings: ValidationWarning[]
	): void {
		const performance = config.performance
		if (!performance) return

		// Validate maxConcurrentRequests
		if (performance.maxConcurrentRequests !== undefined) {
			if (performance.maxConcurrentRequests < 1) {
				errors.push({
					field: 'performance.maxConcurrentRequests',
					message: `maxConcurrentRequests must be at least 1. Received: ${performance.maxConcurrentRequests}`,
					code: 'VALUE_OUT_OF_RANGE',
					severity: 'error',
				})
			} else if (performance.maxConcurrentRequests > 100) {
				errors.push({
					field: 'performance.maxConcurrentRequests',
					message: `maxConcurrentRequests must not exceed 100. Received: ${performance.maxConcurrentRequests}`,
					code: 'VALUE_OUT_OF_RANGE',
					severity: 'error',
				})
			} else if (performance.maxConcurrentRequests > 50) {
				warnings.push({
					field: 'performance.maxConcurrentRequests',
					message: `maxConcurrentRequests is set to ${performance.maxConcurrentRequests}, which may overwhelm the server`,
					code: 'HIGH_CONCURRENCY',
					severity: 'warning',
				})
			}
		}

		// Validate metricsBufferSize
		if (performance.metricsBufferSize !== undefined) {
			if (performance.metricsBufferSize < 10) {
				errors.push({
					field: 'performance.metricsBufferSize',
					message: `metricsBufferSize must be at least 10. Received: ${performance.metricsBufferSize}`,
					code: 'VALUE_OUT_OF_RANGE',
					severity: 'error',
				})
			} else if (performance.metricsBufferSize > 10000) {
				errors.push({
					field: 'performance.metricsBufferSize',
					message: `metricsBufferSize must not exceed 10000. Received: ${performance.metricsBufferSize}`,
					code: 'VALUE_OUT_OF_RANGE',
					severity: 'error',
				})
			}
		}

		// Validate compressionThreshold
		if (performance.compressionThreshold !== undefined) {
			if (performance.compressionThreshold < 100) {
				errors.push({
					field: 'performance.compressionThreshold',
					message: `compressionThreshold must be at least 100 bytes. Received: ${performance.compressionThreshold}`,
					code: 'VALUE_OUT_OF_RANGE',
					severity: 'error',
				})
			} else if (performance.compressionThreshold > 100000) {
				errors.push({
					field: 'performance.compressionThreshold',
					message: `compressionThreshold must not exceed 100000 bytes. Received: ${performance.compressionThreshold}`,
					code: 'VALUE_OUT_OF_RANGE',
					severity: 'error',
				})
			}
		}

		// Validate streamingThreshold
		if (performance.streamingThreshold !== undefined) {
			if (performance.streamingThreshold < 1000) {
				errors.push({
					field: 'performance.streamingThreshold',
					message: `streamingThreshold must be at least 1000 bytes. Received: ${performance.streamingThreshold}`,
					code: 'VALUE_OUT_OF_RANGE',
					severity: 'error',
				})
			} else if (performance.streamingThreshold > 1000000) {
				errors.push({
					field: 'performance.streamingThreshold',
					message: `streamingThreshold must not exceed 1000000 bytes. Received: ${performance.streamingThreshold}`,
					code: 'VALUE_OUT_OF_RANGE',
					severity: 'error',
				})
			}
		}
	}

	/**
	 * Formats validation result into a human-readable error message
	 */
	static formatValidationResult(result: ValidationResult): string {
		if (result.isValid && result.warnings.length === 0) {
			return 'Configuration is valid'
		}

		const messages: string[] = []

		if (result.errors.length > 0) {
			messages.push('Configuration Errors:')
			result.errors.forEach((error) => {
				messages.push(`  - ${error.field}: ${error.message}`)
			})
		}

		if (result.warnings.length > 0) {
			if (messages.length > 0) messages.push('')
			messages.push('Configuration Warnings:')
			result.warnings.forEach((warning) => {
				messages.push(`  - ${warning.field}: ${warning.message}`)
			})
		}

		return messages.join('\n')
	}
}
