import { createHash, createHmac, randomBytes } from 'crypto'

import { InfisicalKmsClient } from '@repo/infisical-kms'

import { SecurityConfig } from './config/types.js'

import type { SigningAlgorithm } from '@repo/infisical-kms'
import type { AuditLogEvent } from './types.js'

/**
 * Configuration for cryptographic operations
 */
export interface CryptoConfig {
	hashAlgorithm: 'SHA-256'
	signatureAlgorithm: 'HMAC-SHA256'
	secretKey?: string
}

/**
 * Default cryptographic configuration
 */
export const DEFAULT_CRYPTO_CONFIG: Omit<CryptoConfig, 'secretKey'> = {
	hashAlgorithm: 'SHA-256',
	signatureAlgorithm: 'HMAC-SHA256',
}

/**
 * Generates a default secret key if none is provided
 * In production, this should be set via environment variables
 */
export function generateDefaultSecret(): string {
	console.warn(
		'[CryptoService] No AUDIT_CRYPTO_SECRET provided, generating random secret. This should be set in production.'
	)
	return randomBytes(32).toString('hex')
}

/**
 * The response of the event signature
 */
export interface EventSignatureResponse {
	/**
	 * The signature of the event
	 */
	signature: string
	/**
	 * The algorithm used to generate the signature
	 */
	algorithm: SigningAlgorithm
}

/**
 * Interface for cryptographic integrity verification
 */
export interface CryptographicService {
	generateHash(event: AuditLogEvent): string
	verifyHash(event: AuditLogEvent, expectedHash: string): boolean
	generateEventSignature(
		event: AuditLogEvent,
		signingAlgorithm?: SigningAlgorithm
	): Promise<EventSignatureResponse>
	verifyEventSignature(
		event: AuditLogEvent,
		signature: string,
		signingAlgorithm?: SigningAlgorithm
	): Promise<boolean>
}

/**
 * Cryptographic service for audit event integrity verification
 * Implements SHA-256 hashing and HMAC-SHA256 signatures for tamper detection
 */
export class CryptoService implements CryptographicService {
	private kms: InfisicalKmsClient | undefined = undefined
	constructor(private config: SecurityConfig) {
		if (this.config.kms.enabled) this.init()
	}

	private init() {
		if (!this.kms)
			this.kms = new InfisicalKmsClient({
				baseUrl: this.config.kms.baseUrl,
				encryptionKey: this.config.kms.encryptionKey,
				signingKey: this.config.kms.signingKey,
				accessToken: this.config.kms.accessToken,
			})
	}
	/**
	 * Generates a SHA-256 hash of critical audit event fields
	 * Uses a standardized algorithm to ensure consistency across the system
	 *
	 * @param event The audit event to hash
	 * @returns SHA-256 hash as hexadecimal string
	 */
	generateHash(event: AuditLogEvent): string {
		// Extract critical fields for hashing in a deterministic order
		const criticalFields = this.extractCriticalFields(event)

		// Create deterministic string representation
		const dataToHash = this.createDeterministicString(criticalFields)

		// Generate SHA-256 hash
		return createHash('sha256').update(dataToHash, 'utf8').digest('hex')
	}

	/**
	 * Verifies the integrity of an audit event by comparing hashes
	 *
	 * @param event The audit event to verify
	 * @param expectedHash The expected hash value
	 * @returns true if hashes match, false if tampered
	 */
	verifyHash(event: AuditLogEvent, expectedHash: string): boolean {
		try {
			const computedHash = this.generateHash(event)
			return computedHash === expectedHash
		} catch (error) {
			console.error('[CryptoService] Hash verification failed:', error)
			return false
		}
	}

	/**
	 * Generates an HMAC-SHA256 signature for an audit event
	 * Provides additional security through secret key authentication
	 *
	 * @param event The audit event to sign
	 * @returns HMAC-SHA256 signature as hexadecimal string
	 */
	async generateEventSignature(
		event: AuditLogEvent,
		signingAlgorithm?: SigningAlgorithm
	): Promise<EventSignatureResponse> {
		// First generate the hash of the event
		const eventHash = this.generateHash(event)

		try {
			if (this.config.kms.enabled && this.kms) {
				const signature = await this.kms.sign(eventHash, signingAlgorithm)
				return {
					signature: signature.signature,
					algorithm: signature.signingAlgorithm,
				}
			} else {
				// Create HMAC signature using the hash and secret key
				const signature = createHmac('sha256', this.config.encryptionKey!)
					.update(eventHash, 'utf8')
					.digest('hex')
				return {
					signature,
					algorithm: 'HMAC-SHA256',
				}
			}
		} catch (error) {
			console.error('[CryptoService] Signature creation failed:', error)
			throw error
		}
	}

	/**
	 * Verifies the HMAC-SHA256 signature of an audit event
	 *
	 * @param event The audit event to verify
	 * @param signature The expected signature
	 * @returns true if signature is valid, false if invalid or tampered
	 */
	async verifyEventSignature(
		event: AuditLogEvent,
		signature: string,
		signingAlgorithm?: SigningAlgorithm
	): Promise<boolean> {
		const eventHash = this.generateHash(event)

		try {
			if (this.config.kms.enabled && this.kms) {
				const verify = await this.kms.verify(eventHash, signature, signingAlgorithm)
				return verify.signatureValid
			} else {
				// Create HMAC signature using the hash and secret key
				const computedSignature = createHmac('sha256', this.config.encryptionKey!)
					.update(eventHash, 'utf8')
					.digest('hex')
				return computedSignature === signature
			}
		} catch (error) {
			console.error('[CryptoService] Signature verification failed:', error)
			return false
		}
	}

	/**
	 * Extracts critical fields from audit event for hashing
	 * These fields are essential for integrity verification
	 *
	 * @param event The audit event
	 * @returns Object containing critical fields
	 */
	private extractCriticalFields(event: AuditLogEvent): Record<string, any> {
		return {
			timestamp: event.timestamp,
			action: event.action,
			status: event.status,
			principalId: event.principalId || null,
			organizationId: event.organizationId || null,
			targetResourceType: event.targetResourceType || null,
			targetResourceId: event.targetResourceId || null,
			outcomeDescription: event.outcomeDescription || null,
			// Include practitioner-specific fields if present
			/**practitionerId: (event as any).practitionerId || null,
			licenseNumber: (event as any).licenseNumber || null,
			jurisdiction: (event as any).jurisdiction || null,
			oldStatus: (event as any).oldStatus || null,
			newStatus: (event as any).newStatus || null,
			oldRole: (event as any).oldRole || null,
			newRole: (event as any).newRole || null,*/
		}
	}

	/**
	 * Creates a deterministic string representation of critical fields
	 * Ensures consistent hashing regardless of object property order
	 *
	 * @param fields The critical fields object
	 * @returns Deterministic string representation
	 */
	private createDeterministicString(fields: Record<string, any>): string {
		// Sort keys to ensure deterministic order
		const sortedKeys = Object.keys(fields).sort()

		// Create key-value pairs in sorted order
		const pairs = sortedKeys.map((key) => `${key}:${JSON.stringify(fields[key])}`)

		// Join with separator
		return pairs.join('|')
	}

	/**
	 * Generate a base64 string from a Uint8Array
	 * @param source string or Uint8Array to hash
	 * @returns base64 string
	 */
	private async sha256(source: string | Uint8Array): Promise<string> {
		const buf = typeof source === 'string' ? new TextEncoder().encode(source) : source

		const hash = await crypto.subtle.digest('sha-256', buf)
		return this.b64(hash)
	}

	/**
	 * CREDIT: https://gist.github.com/enepomnyaschih/72c423f727d395eeaa09697058238727
	 * Encodes a given Uint8Array, ArrayBuffer or string into RFC4648 base64 representation
	 * @param data
	 * @returns
	 */
	private b64(data: ArrayBuffer | string): string {
		const uint8 =
			typeof data === 'string'
				? new TextEncoder().encode(data)
				: data instanceof Uint8Array
					? data
					: new Uint8Array(data)
		let result = ''
		let i
		const l = uint8.length
		for (i = 2; i < l; i += 3) {
			result += base64abc[uint8[i - 2] >> 2]
			result += base64abc[((uint8[i - 2] & 0x03) << 4) | (uint8[i - 1] >> 4)]
			result += base64abc[((uint8[i - 1] & 0x0f) << 2) | (uint8[i] >> 6)]
			result += base64abc[uint8[i] & 0x3f]
		}
		if (i === l + 1) {
			// 1 octet yet to write
			result += base64abc[uint8[i - 2] >> 2]
			result += base64abc[(uint8[i - 2] & 0x03) << 4]
			result += '=='
		}
		if (i === l) {
			// 2 octets yet to write
			result += base64abc[uint8[i - 2] >> 2]
			result += base64abc[((uint8[i - 2] & 0x03) << 4) | (uint8[i - 1] >> 4)]
			result += base64abc[(uint8[i - 1] & 0x0f) << 2]
			result += '='
		}
		return result
	}

	/**
	 * Decodes a given RFC4648 base64 encoded string
	 * @param b64 base64 encoded string
	 * @returns Uint8Array
	 */
	private decode(b64: string): Uint8Array {
		const binString = atob(b64)
		const size = binString.length
		const bytes = new Uint8Array(size)
		for (let i = 0; i < size; i++) {
			bytes[i] = binString.charCodeAt(i)
		}
		return bytes
	}

	/**
	 * Gets the current cryptographic configuration
	 *
	 * @returns Current configuration (without secret key for security)
	 */
	getConfig(): any {
		return {
			hashAlgorithm: this.config.hashAlgorithm,
			kms: {
				enabled: this.config.kms.enabled,
				baseUrl: this.config.kms.baseUrl,
			},
		}
	}
}

const base64abc = [
	'A',
	'B',
	'C',
	'D',
	'E',
	'F',
	'G',
	'H',
	'I',
	'J',
	'K',
	'L',
	'M',
	'N',
	'O',
	'P',
	'Q',
	'R',
	'S',
	'T',
	'U',
	'V',
	'W',
	'X',
	'Y',
	'Z',
	'a',
	'b',
	'c',
	'd',
	'e',
	'f',
	'g',
	'h',
	'i',
	'j',
	'k',
	'l',
	'm',
	'n',
	'o',
	'p',
	'q',
	'r',
	's',
	't',
	'u',
	'v',
	'w',
	'x',
	'y',
	'z',
	'0',
	'1',
	'2',
	'3',
	'4',
	'5',
	'6',
	'7',
	'8',
	'9',
	'+',
	'/',
]
