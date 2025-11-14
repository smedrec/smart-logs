import { ValidationError } from './validation'

/**
 * InputSanitizer - Utility for sanitizing user input to prevent injection attacks
 *
 * This utility provides methods to:
 * - Remove HTML tags and JavaScript event handlers from strings
 * - Recursively sanitize objects
 * - Validate and sanitize URLs to allow only safe protocols
 * - Preserve legitimate special characters needed for business logic
 *
 * Requirements:
 * - 7.1: Remove HTML tags and JavaScript event handlers
 * - 7.2: Recursively sanitize nested objects
 * - 7.3: Validate URL protocols (only http/https)
 * - 7.4: Throw ValidationError for invalid URLs
 * - 7.6: Preserve legitimate special characters
 * - 7.7: Provide separate methods for string, object, and URL sanitization
 */
export class InputSanitizer {
	/**
	 * HTML tags to remove from strings
	 */
	private static readonly HTML_TAG_PATTERN = /<[^>]*>/g

	/**
	 * JavaScript protocols to remove
	 */
	private static readonly JS_PROTOCOL_PATTERN = /javascript:|data:|vbscript:/gi

	/**
	 * Event handler attributes to remove
	 */
	private static readonly EVENT_HANDLER_PATTERN = /\s*on\w+\s*=\s*["']?[^"']*["']?/gi

	/**
	 * Allowed URL protocols
	 */
	private static readonly ALLOWED_PROTOCOLS = ['http:', 'https:']

	/**
	 * Sanitize a string by removing HTML tags, JavaScript protocols, and event handlers
	 *
	 * @param input - The string to sanitize
	 * @returns Sanitized string with dangerous content removed
	 *
	 * Requirements: 7.1, 7.6
	 */
	static sanitizeString(input: string): string {
		if (typeof input !== 'string') {
			return input
		}

		let sanitized = input

		// Remove HTML tags
		sanitized = sanitized.replace(this.HTML_TAG_PATTERN, '')

		// Remove JavaScript protocols
		sanitized = sanitized.replace(this.JS_PROTOCOL_PATTERN, '')

		// Remove event handlers
		sanitized = sanitized.replace(this.EVENT_HANDLER_PATTERN, '')

		return sanitized
	}

	/**
	 * Recursively sanitize all string values in an object
	 *
	 * @param obj - The object to sanitize
	 * @returns New object with all string values sanitized
	 *
	 * Requirements: 7.2, 7.6
	 */
	static sanitizeObject<T extends Record<string, any>>(obj: T): T {
		if (obj === null || obj === undefined) {
			return obj
		}

		if (typeof obj !== 'object') {
			return obj
		}

		// Handle arrays
		if (Array.isArray(obj)) {
			return obj.map((item) => {
				if (typeof item === 'string') {
					return this.sanitizeString(item)
				} else if (typeof item === 'object' && item !== null) {
					return this.sanitizeObject(item)
				}
				return item
			}) as any
		}

		// Handle objects
		const sanitized: Record<string, any> = {}

		for (const [key, value] of Object.entries(obj)) {
			if (typeof value === 'string') {
				sanitized[key] = this.sanitizeString(value)
			} else if (typeof value === 'object' && value !== null) {
				sanitized[key] = this.sanitizeObject(value)
			} else {
				sanitized[key] = value
			}
		}

		return sanitized as T
	}

	/**
	 * Validate and sanitize a URL to ensure it uses a safe protocol
	 *
	 * @param url - The URL to validate and sanitize
	 * @returns Sanitized URL
	 * @throws ValidationError if the URL uses an invalid protocol
	 *
	 * Requirements: 7.3, 7.4
	 */
	static sanitizeUrl(url: string): string {
		if (typeof url !== 'string' || url.trim().length === 0) {
			throw new ValidationError('URL must be a non-empty string')
		}

		const trimmedUrl = url.trim()

		// Check for dangerous protocols BEFORE sanitization
		// This ensures we detect and reject them rather than just removing them
		const dangerousProtocolMatch = trimmedUrl.match(/^(javascript|data|vbscript):/i)
		if (dangerousProtocolMatch) {
			throw new ValidationError(
				`Invalid URL protocol: ${dangerousProtocolMatch[0].toLowerCase()}. Only http: and https: are allowed.`
			)
		}

		// Remove any event handlers
		let sanitized = trimmedUrl.replace(this.EVENT_HANDLER_PATTERN, '')

		// Parse the URL to validate protocol
		try {
			const parsedUrl = new URL(sanitized)

			// Check if protocol is allowed
			if (!this.ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
				throw new ValidationError(
					`Invalid URL protocol: ${parsedUrl.protocol}. Only http: and https: are allowed.`
				)
			}

			return parsedUrl.toString()
		} catch (error) {
			// If URL parsing fails, it might be a relative URL
			// Check if it starts with a protocol
			if (sanitized.includes(':')) {
				const parts = sanitized.split(':')
				const protocolPart = parts[0]
				if (protocolPart) {
					const protocol = protocolPart.toLowerCase() + ':'
					if (!this.ALLOWED_PROTOCOLS.includes(protocol)) {
						throw new ValidationError(
							`Invalid URL protocol: ${protocol}. Only http: and https: are allowed.`
						)
					}
				}
			}

			// For relative URLs or parsing errors, return the sanitized string
			// The server will handle further validation
			return sanitized
		}
	}

	/**
	 * Mask sensitive fields in an object for logging purposes
	 *
	 * @param obj - The object to mask
	 * @param sensitiveFields - Array of field names to mask
	 * @returns New object with sensitive fields masked
	 */
	static maskSensitiveFields(obj: any, sensitiveFields: string[]): any {
		if (obj === null || obj === undefined) {
			return obj
		}

		if (typeof obj !== 'object') {
			return obj
		}

		// Handle arrays
		if (Array.isArray(obj)) {
			return obj.map((item) => this.maskSensitiveFields(item, sensitiveFields))
		}

		// Handle objects
		const masked: Record<string, any> = {}

		for (const [key, value] of Object.entries(obj)) {
			// Check if this field should be masked
			const shouldMask = sensitiveFields.some((field) =>
				key.toLowerCase().includes(field.toLowerCase())
			)

			if (shouldMask) {
				masked[key] = '***REDACTED***'
			} else if (typeof value === 'object' && value !== null) {
				masked[key] = this.maskSensitiveFields(value, sensitiveFields)
			} else {
				masked[key] = value
			}
		}

		return masked
	}
}
