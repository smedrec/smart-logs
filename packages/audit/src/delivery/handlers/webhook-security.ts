/**
 * Webhook security manager for signature generation and verification
 * Requirements 4.1, 4.2, 4.3: HMAC signatures, idempotency, and timestamps
 */

import { createHmac, randomBytes } from 'node:crypto'

/**
 * Security headers for webhook requests
 */
export interface WebhookSecurityHeaders {
	'X-Webhook-Signature'?: string
	'X-Webhook-Timestamp': string
	'X-Idempotency-Key': string
	'X-Delivery-Id': string
}

/**
 * Signature verification result
 */
export interface SignatureVerificationResult {
	isValid: boolean
	error?: string
	timestamp?: string
	age?: number // Age in milliseconds
}

/**
 * Webhook secret configuration
 */
export interface WebhookSecret {
	id: string
	key: string
	algorithm: string
	isActive: boolean
	expiresAt?: string
}

/**
 * Webhook security manager implementing HMAC-SHA256 signatures and security headers
 * Requirements 4.1, 4.2, 4.3: Security features for webhook delivery
 */
export class WebhookSecurityManager {
	private readonly defaultAlgorithm = 'sha256'
	private readonly timestampToleranceMs = 300000 // 5 minutes

	/**
	 * Generate security headers for webhook requests
	 * Requirements 4.1, 4.2, 4.3: Signature, idempotency, and timestamp headers
	 */
	async generateSecurityHeaders(
		payload: Record<string, any>,
		organizationId: string,
		deliveryId: string,
		secret?: string
	): Promise<WebhookSecurityHeaders> {
		const timestamp = new Date().toISOString()
		const idempotencyKey = this.generateIdempotencyKey(deliveryId, timestamp)

		const headers: WebhookSecurityHeaders = {
			'X-Webhook-Timestamp': timestamp,
			'X-Idempotency-Key': idempotencyKey,
			'X-Delivery-Id': deliveryId,
		}

		// Add signature if secret is provided
		if (secret) {
			const signature = this.generateSignature(payload, secret, timestamp)
			headers['X-Webhook-Signature'] = signature
		}

		return headers
	}

	/**
	 * Generate HMAC-SHA256 signature for webhook payload
	 * Requirements 4.1, 4.2: HMAC-SHA256 signature generation
	 */
	generateSignature(
		payload: Record<string, any>,
		secret: string,
		timestamp: string,
		algorithm: string = this.defaultAlgorithm
	): string {
		// Create canonical string for signing
		const canonicalString = this.createCanonicalString(payload, timestamp)

		// Generate HMAC signature
		const hmac = createHmac(algorithm, secret)
		hmac.update(canonicalString, 'utf8')
		const signature = hmac.digest('hex')

		// Return signature with algorithm prefix
		return `${algorithm}=${signature}`
	}

	/**
	 * Verify webhook signature
	 * Requirements 4.1, 4.2: Signature verification for webhook security
	 */
	verifySignature(
		payload: Record<string, any>,
		signature: string,
		secret: string,
		timestamp: string,
		toleranceMs: number = this.timestampToleranceMs
	): SignatureVerificationResult {
		try {
			// Parse signature format (algorithm=signature)
			const signatureParts = signature.split('=', 2)
			if (signatureParts.length !== 2) {
				return {
					isValid: false,
					error: 'Invalid signature format. Expected format: algorithm=signature',
				}
			}

			const [algorithm, providedSignature] = signatureParts

			// Validate timestamp age
			const timestampMs = new Date(timestamp).getTime()
			const currentMs = Date.now()
			const age = currentMs - timestampMs

			if (age > toleranceMs) {
				return {
					isValid: false,
					error: `Timestamp too old. Age: ${age}ms, Tolerance: ${toleranceMs}ms`,
					timestamp,
					age,
				}
			}

			if (age < -toleranceMs) {
				return {
					isValid: false,
					error: `Timestamp too far in future. Age: ${age}ms, Tolerance: ${toleranceMs}ms`,
					timestamp,
					age,
				}
			}

			// Generate expected signature
			const expectedSignature = this.generateSignature(payload, secret, timestamp, algorithm)
			const expectedSignaturePart = expectedSignature.split('=', 2)[1]

			// Constant-time comparison to prevent timing attacks
			const isValid = this.constantTimeCompare(providedSignature, expectedSignaturePart)

			return {
				isValid,
				timestamp,
				age,
				error: isValid ? undefined : 'Signature verification failed',
			}
		} catch (error) {
			return {
				isValid: false,
				error: error instanceof Error ? error.message : 'Unknown verification error',
			}
		}
	}

	/**
	 * Generate idempotency key for webhook requests
	 * Requirements 4.2: Idempotency key generation and header inclusion
	 */
	generateIdempotencyKey(deliveryId: string, timestamp: string): string {
		// Create deterministic idempotency key based on delivery ID and timestamp
		const hmac = createHmac('sha256', 'idempotency-key-salt')
		hmac.update(`${deliveryId}:${timestamp}`, 'utf8')
		return hmac.digest('hex').substring(0, 32) // 32 character hex string
	}

	/**
	 * Generate random webhook secret
	 * Requirements 4.4: Webhook secret generation
	 */
	generateWebhookSecret(length: number = 32): string {
		return randomBytes(length).toString('hex')
	}

	/**
	 * Validate webhook secret format
	 * Requirements 4.4, 4.5: Secret validation and format compatibility
	 */
	validateSecretFormat(secret: string): { isValid: boolean; errors: string[] } {
		const errors: string[] = []

		if (!secret) {
			errors.push('Secret cannot be empty')
		} else {
			// Check minimum length (32 characters for 128-bit security)
			if (secret.length < 32) {
				errors.push('Secret must be at least 32 characters long')
			}

			// Check maximum length (reasonable upper bound)
			if (secret.length > 256) {
				errors.push('Secret must not exceed 256 characters')
			}

			// Check for valid characters (allow alphanumeric and common symbols)
			const validPattern = /^[a-zA-Z0-9\-_+=\/]+$/
			if (!validPattern.test(secret)) {
				errors.push('Secret contains invalid characters. Use alphanumeric characters and -_+=/')
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
		}
	}

	/**
	 * Create canonical string for signature generation
	 * Requirements 4.1, 4.2: Consistent payload serialization for signatures
	 */
	private createCanonicalString(payload: Record<string, any>, timestamp: string): string {
		// Create deterministic JSON representation
		const sortedPayload = this.sortObjectKeys(payload)
		const payloadString = JSON.stringify(sortedPayload)

		// Combine timestamp and payload for signing
		return `${timestamp}.${payloadString}`
	}

	/**
	 * Sort object keys recursively for deterministic serialization
	 * Requirements 4.1: Consistent payload serialization
	 */
	private sortObjectKeys(obj: any): any {
		if (obj === null || typeof obj !== 'object') {
			return obj
		}

		if (Array.isArray(obj)) {
			return obj.map((item) => this.sortObjectKeys(item))
		}

		const sortedKeys = Object.keys(obj).sort()
		const sortedObj: Record<string, any> = {}

		for (const key of sortedKeys) {
			sortedObj[key] = this.sortObjectKeys(obj[key])
		}

		return sortedObj
	}

	/**
	 * Constant-time string comparison to prevent timing attacks
	 * Requirements 4.1: Secure signature verification
	 */
	private constantTimeCompare(a: string, b: string): boolean {
		if (a.length !== b.length) {
			return false
		}

		let result = 0
		for (let i = 0; i < a.length; i++) {
			result |= a.charCodeAt(i) ^ b.charCodeAt(i)
		}

		return result === 0
	}
}

/**
 * Utility functions for webhook security testing
 * Requirements 4.1, 4.2, 4.3: Testing utilities for signature verification
 */
export class WebhookSecurityTestUtils {
	private readonly securityManager: WebhookSecurityManager

	constructor() {
		this.securityManager = new WebhookSecurityManager()
	}

	/**
	 * Create test webhook request with valid signature
	 * Requirements 4.1, 4.2, 4.3: Test utilities for webhook security
	 */
	async createTestWebhookRequest(
		payload: Record<string, any>,
		secret: string,
		organizationId: string = 'test-org',
		deliveryId: string = 'test-delivery'
	): Promise<{
		payload: Record<string, any>
		headers: WebhookSecurityHeaders
		signature: string
	}> {
		const headers = await this.securityManager.generateSecurityHeaders(
			payload,
			organizationId,
			deliveryId,
			secret
		)

		return {
			payload,
			headers,
			signature: headers['X-Webhook-Signature'] || '',
		}
	}

	/**
	 * Verify test webhook request
	 * Requirements 4.1, 4.2: Test signature verification
	 */
	verifyTestWebhookRequest(
		payload: Record<string, any>,
		signature: string,
		secret: string,
		timestamp: string
	): SignatureVerificationResult {
		return this.securityManager.verifySignature(payload, signature, secret, timestamp)
	}

	/**
	 * Generate test secret with specified entropy
	 * Requirements 4.4: Test secret generation
	 */
	generateTestSecret(length: number = 32): string {
		return this.securityManager.generateWebhookSecret(length)
	}
}
