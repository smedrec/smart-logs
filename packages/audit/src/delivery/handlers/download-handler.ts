/**
 * Download link destination handler with secure URL generation
 * Requirements 1.1, 9.1, 9.2, 9.3, 9.4: Secure download links with tracking and expiration
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { URL } from 'node:url'

import type { IDownloadLinkRepository } from '../database-client.js'
import type { IDestinationHandler } from '../interfaces.js'
import type {
	ConnectionTestResult,
	DeliveryFeature,
	DeliveryPayload,
	DeliveryResult,
	DestinationConfig,
	ValidationResult,
} from '../types.js'

/**
 * Download link configuration interface
 */
interface DownloadConfig {
	expiryHours: number
	maxAccess?: number
	baseUrl?: string // Base URL for download links (defaults to current domain)
	secretKey?: string // Custom secret key for signing (optional)
	allowedIpRanges?: string[] // IP ranges allowed to access downloads
	requireAuth?: boolean // Whether authentication is required
}

/**
 * Download link metadata interface
 */
interface DownloadLinkMetadata {
	id: string
	organizationId: string
	deliveryId?: string
	objectId: string
	objectType: string
	objectMetadata: Record<string, any>
	filePath: string
	fileName: string
	mimeType?: string
	fileSize?: number
	expiresAt: string
	maxAccess?: number
	createdBy?: string
}

/**
 * Access record interface for tracking downloads
 */
interface AccessRecord {
	timestamp: string
	userId?: string
	ipAddress?: string
	userAgent?: string
	success: boolean
	error?: string
}

/**
 * Download handler implementing secure download link generation
 * Requirements 1.1, 9.1, 9.2: Signed URL generation with expiration and validation
 */
export class DownloadHandler implements IDestinationHandler {
	readonly type = 'download' as const

	private readonly defaultSecretKey: string
	private readonly defaultBaseUrl: string

	constructor(
		private readonly downloadRepository?: IDownloadLinkRepository,
		secretKey?: string,
		baseUrl?: string
	) {
		// Generate a default secret key if none provided
		this.defaultSecretKey = secretKey || this.generateSecretKey()
		this.defaultBaseUrl = baseUrl || 'https://api.example.com' // Should be configured per environment
	}

	/**
	 * Validate download configuration
	 * Requirements 1.1, 9.1: Configuration validation for download destinations
	 */
	validateConfig(config: DestinationConfig): ValidationResult {
		const errors: string[] = []
		const warnings: string[] = []

		const downloadConfig = config.download
		if (!downloadConfig) {
			errors.push('Download configuration is required')
			return { isValid: false, errors, warnings }
		}

		// Validate expiry hours
		if (!downloadConfig.expiryHours) {
			errors.push('Expiry hours is required')
		} else if (typeof downloadConfig.expiryHours !== 'number' || downloadConfig.expiryHours <= 0) {
			errors.push('Expiry hours must be a positive number')
		} else if (downloadConfig.expiryHours > 8760) {
			// More than 1 year
			warnings.push('Expiry hours exceeds 1 year. Consider using a shorter expiration time.')
		}

		// Validate max access if provided
		if (downloadConfig.maxAccess !== undefined) {
			if (typeof downloadConfig.maxAccess !== 'number' || downloadConfig.maxAccess <= 0) {
				errors.push('Max access must be a positive number')
			}
		}

		// Validate base URL if provided
		if (downloadConfig.baseUrl) {
			try {
				const url = new URL(downloadConfig.baseUrl)
				if (!['http:', 'https:'].includes(url.protocol)) {
					errors.push('Base URL must use HTTP or HTTPS protocol')
				}
				if (url.protocol === 'http:') {
					warnings.push('HTTP URLs are not secure. Consider using HTTPS.')
				}
			} catch (error) {
				errors.push('Invalid base URL format')
			}
		}

		// Validate IP ranges if provided
		if (downloadConfig.allowedIpRanges) {
			if (!Array.isArray(downloadConfig.allowedIpRanges)) {
				errors.push('Allowed IP ranges must be an array')
			} else {
				for (const range of downloadConfig.allowedIpRanges) {
					if (typeof range !== 'string') {
						errors.push('IP ranges must be strings')
						break
					}
					// Basic IP/CIDR validation
					if (!this.isValidIpRange(range)) {
						errors.push(`Invalid IP range format: ${range}`)
					}
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
	 * Test connection for download handler (validates configuration)
	 * Requirements 1.1, 9.1: Connection testing and validation
	 */
	async testConnection(config: DestinationConfig): Promise<ConnectionTestResult> {
		const validation = this.validateConfig(config)
		if (!validation.isValid) {
			return {
				success: false,
				error: `Configuration validation failed: ${validation.errors.join(', ')}`,
			}
		}

		const startTime = Date.now()

		try {
			// Test download link generation with a dummy payload
			const downloadConfig = config.download!
			const testMetadata: DownloadLinkMetadata = {
				id: 'test-link-' + Date.now(),
				organizationId: 'test-org',
				objectId: 'test-object',
				objectType: 'test',
				objectMetadata: { test: true },
				filePath: '/tmp/test-file.txt',
				fileName: 'test-file.txt',
				mimeType: 'text/plain',
				fileSize: 100,
				expiresAt: new Date(Date.now() + downloadConfig.expiryHours * 3600000).toISOString(),
				maxAccess: downloadConfig.maxAccess,
				createdBy: 'test-user',
			}

			const signedUrl = await this.generateSignedUrl(testMetadata, downloadConfig)

			// Validate the generated URL
			const isValid = await this.validateSignedUrl(signedUrl, downloadConfig)

			const responseTime = Date.now() - startTime

			return {
				success: isValid,
				responseTime,
				details: {
					testUrl: signedUrl,
					urlValid: isValid,
				},
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
	 * Deliver payload by creating a secure download link
	 * Requirements 1.1, 9.1, 9.2: Download link generation and storage
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

		const startTime = Date.now()

		try {
			const downloadConfig = config.download!

			// Extract file information from payload
			const fileInfo = this.extractFileInfo(payload)
			if (!fileInfo) {
				return {
					success: false,
					responseTime: Date.now() - startTime,
					error: 'Unable to extract file information from payload',
					retryable: false,
				}
			}

			// Calculate expiration time
			const expiresAt = new Date(Date.now() + downloadConfig.expiryHours * 3600000).toISOString()

			// Create download link metadata
			const linkMetadata: DownloadLinkMetadata = {
				id: this.generateLinkId(),
				organizationId: payload.organizationId,
				deliveryId: payload.deliveryId,
				objectId: fileInfo.objectId,
				objectType: payload.type,
				objectMetadata: {
					...payload.metadata,
					...fileInfo.metadata,
				},
				filePath: fileInfo.filePath,
				fileName: fileInfo.fileName,
				mimeType: fileInfo.mimeType,
				fileSize: fileInfo.fileSize,
				expiresAt,
				maxAccess: downloadConfig.maxAccess,
				createdBy: payload.metadata.createdBy as string,
			}

			// Generate signed URL
			const signedUrl = await this.generateSignedUrl(linkMetadata, downloadConfig)

			// Store download link in database if repository is available
			if (this.downloadRepository) {
				await this.downloadRepository.createDownloadLink({
					...linkMetadata,
					signedUrl,
					signature: this.extractSignatureFromUrl(signedUrl),
					algorithm: 'HMAC-SHA256',
					accessCount: 0,
					accessedBy: [],
					isActive: 'true',
					metadata: {
						deliveryConfig: downloadConfig,
						createdVia: 'delivery-service',
					},
				})
			}

			const responseTime = Date.now() - startTime

			return {
				success: true,
				deliveredAt: new Date().toISOString(),
				responseTime,
				crossSystemReference: linkMetadata.id,
				retryable: false,
			}
		} catch (error) {
			const responseTime = Date.now() - startTime
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

			return {
				success: false,
				responseTime,
				error: errorMessage,
				retryable: this.isRetryableError(error),
			}
		}
	}

	/**
	 * Check if handler supports a specific feature
	 * Requirements 9.1, 9.2, 9.3, 9.4: Feature support declaration
	 */
	supportsFeature(feature: DeliveryFeature): boolean {
		const supportedFeatures: DeliveryFeature[] = [
			'signature_verification',
			'idempotency',
			'encryption', // URLs are cryptographically signed
		]
		return supportedFeatures.includes(feature)
	}

	/**
	 * Get JSON schema for download configuration
	 */
	getConfigSchema(): Record<string, any> {
		return {
			type: 'object',
			properties: {
				download: {
					type: 'object',
					required: ['expiryHours'],
					properties: {
						expiryHours: {
							type: 'number',
							minimum: 0.1,
							maximum: 8760,
							description: 'Hours until download link expires',
						},
						maxAccess: {
							type: 'number',
							minimum: 1,
							maximum: 1000,
							description: 'Maximum number of times the link can be accessed',
						},
						baseUrl: {
							type: 'string',
							format: 'uri',
							pattern: '^https?://',
							description: 'Base URL for download links',
						},
						secretKey: {
							type: 'string',
							minLength: 32,
							description: 'Custom secret key for URL signing',
						},
						allowedIpRanges: {
							type: 'array',
							items: {
								type: 'string',
								description: 'IP address or CIDR range',
							},
							description: 'IP ranges allowed to access downloads',
						},
						requireAuth: {
							type: 'boolean',
							description: 'Whether authentication is required for downloads',
						},
					},
				},
			},
		}
	}

	/**
	 * Generate a secure signed URL for download
	 * Requirements 9.1, 9.2: Signed URL generation with expiration timestamps
	 */
	private async generateSignedUrl(
		metadata: DownloadLinkMetadata,
		config: DownloadConfig
	): Promise<string> {
		const baseUrl = config.baseUrl || this.defaultBaseUrl
		const secretKey = config.secretKey || this.defaultSecretKey

		// Create base URL with parameters
		const url = new URL(`${baseUrl}/api/download/${metadata.id}`)
		url.searchParams.set('expires', metadata.expiresAt)
		url.searchParams.set('org', metadata.organizationId)

		if (metadata.maxAccess) {
			url.searchParams.set('max_access', metadata.maxAccess.toString())
		}

		// Create signature payload from URL parameters (without signature)
		const signaturePayload = this.createSignaturePayloadFromUrl(url)

		// Generate HMAC signature
		const signature = createHmac('sha256', secretKey).update(signaturePayload).digest('hex')

		// Add signature to URL
		url.searchParams.set('signature', signature)

		return url.toString()
	}

	/**
	 * Validate a signed URL
	 * Requirements 9.1, 9.2: Cryptographic signature validation for download links
	 */
	private async validateSignedUrl(signedUrl: string, config: DownloadConfig): Promise<boolean> {
		try {
			const url = new URL(signedUrl)
			const providedSignature = url.searchParams.get('signature')

			if (!providedSignature) {
				return false
			}

			// Extract metadata from URL parameters for signature validation
			const metadata: DownloadLinkMetadata = {
				id: url.pathname.split('/').pop() || '',
				organizationId: url.searchParams.get('org') || '',
				objectId: url.searchParams.get('object_id') || url.pathname.split('/').pop() || '',
				objectType: 'test',
				objectMetadata: {},
				filePath: url.searchParams.get('file_path') || '/tmp/test',
				fileName: 'test-file.txt',
				expiresAt: url.searchParams.get('expires') || '',
				maxAccess: url.searchParams.get('max_access')
					? parseInt(url.searchParams.get('max_access')!)
					: undefined,
			}

			// Remove signature from URL for validation
			url.searchParams.delete('signature')

			// Recreate signature payload using the same method as generation
			const signaturePayload = this.createSignaturePayloadFromUrl(url)
			const secretKey = config.secretKey || this.defaultSecretKey

			// Generate expected signature
			const expectedSignature = createHmac('sha256', secretKey)
				.update(signaturePayload)
				.digest('hex')

			// Use timing-safe comparison
			return timingSafeEqual(
				Buffer.from(providedSignature, 'hex'),
				Buffer.from(expectedSignature, 'hex')
			)
		} catch (error) {
			return false
		}
	}

	/**
	 * Create signature payload from URL and metadata
	 * Requirements 9.1, 9.2: Signature payload generation for security
	 */
	private createSignaturePayload(url: URL, metadata: DownloadLinkMetadata): string {
		// Include critical parameters in signature
		const params = new URLSearchParams()
		params.set('id', metadata.id)
		params.set('org', metadata.organizationId)
		params.set('expires', metadata.expiresAt)
		params.set('object_id', metadata.objectId)
		params.set('file_path', metadata.filePath)

		if (metadata.maxAccess) {
			params.set('max_access', metadata.maxAccess.toString())
		}

		// Sort parameters for consistent signature
		params.sort()

		return `${url.pathname}?${params.toString()}`
	}

	/**
	 * Create signature payload from URL parameters only
	 * Requirements 9.1, 9.2: Consistent signature generation and validation
	 */
	private createSignaturePayloadFromUrl(url: URL): string {
		// Create a copy of the URL parameters and sort them for consistency
		const params = new URLSearchParams(url.searchParams)
		params.sort()

		return `${url.pathname}?${params.toString()}`
	}

	/**
	 * Extract file information from delivery payload
	 */
	private extractFileInfo(payload: DeliveryPayload): {
		objectId: string
		filePath: string
		fileName: string
		mimeType?: string
		fileSize?: number
		metadata: Record<string, any>
	} | null {
		// Try to extract file info from payload data
		if (payload.data && typeof payload.data === 'object') {
			const data = payload.data as any

			// Look for common file properties
			const objectId = data.id || data.objectId || payload.deliveryId
			const filePath = data.filePath || data.path || data.url
			const fileName =
				data.fileName || data.name || `${objectId}.${this.getFileExtension(payload.type)}`
			const mimeType = data.mimeType || data.contentType || this.getMimeType(payload.type)
			const fileSize = data.fileSize || data.size

			if (objectId && filePath) {
				return {
					objectId,
					filePath,
					fileName,
					mimeType,
					fileSize,
					metadata: {
						originalData: data,
						extractedAt: new Date().toISOString(),
					},
				}
			}
		}

		// Fallback: create file info from payload metadata using correct file types
		const objectId = payload.deliveryId
		const fileName = `${payload.type}-${payload.deliveryId}.${this.getFileExtension(payload.type)}`
		const mimeType = this.getMimeType(payload.type)

		return {
			objectId,
			filePath: `/tmp/${payload.deliveryId}`,
			fileName,
			mimeType,
			fileSize: JSON.stringify(payload.data).length,
			metadata: {
				fallbackGenerated: true,
				originalPayload: payload,
			},
		}
	}

	/**
	 * Get file extension based on payload type
	 */
	private getFileExtension(type: string): string {
		const extensions: Record<string, string> = {
			report: 'pdf',
			export: 'csv',
			data: 'json',
			custom: 'bin',
		}
		return extensions[type] || 'bin'
	}

	/**
	 * Get MIME type based on payload type
	 */
	private getMimeType(type: string): string {
		const mimeTypes: Record<string, string> = {
			report: 'application/pdf',
			export: 'text/csv',
			data: 'application/json',
			custom: 'application/octet-stream',
		}
		return mimeTypes[type] || 'application/octet-stream'
	}

	/**
	 * Generate a unique link ID
	 */
	private generateLinkId(): string {
		const timestamp = Date.now().toString(36)
		const random = randomBytes(8).toString('hex')
		return `dl_${timestamp}_${random}`
	}

	/**
	 * Generate a secure secret key
	 */
	private generateSecretKey(): string {
		return randomBytes(32).toString('hex')
	}

	/**
	 * Extract signature from signed URL
	 */
	private extractSignatureFromUrl(signedUrl: string): string {
		try {
			const url = new URL(signedUrl)
			return url.searchParams.get('signature') || ''
		} catch {
			return ''
		}
	}

	/**
	 * Validate IP range format (basic validation)
	 */
	private isValidIpRange(range: string): boolean {
		// Basic IP/CIDR validation - could be enhanced with proper IP validation library
		const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
		const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}(\/\d{1,3})?$/
		return ipv4Regex.test(range) || ipv6Regex.test(range)
	}

	/**
	 * Determine if error is retryable
	 */
	private isRetryableError(error: unknown): boolean {
		if (!(error instanceof Error)) {
			return false
		}

		const retryableErrors = [
			'ECONNRESET',
			'ECONNREFUSED',
			'ETIMEDOUT',
			'ENOTFOUND',
			'Database connection failed',
			'Temporary file system error',
		]

		return retryableErrors.some((retryableError) => error.message.includes(retryableError))
	}
}
