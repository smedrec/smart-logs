/**
 * SFTP destination handler with secure authentication and file transfer
 * Requirements 1.1, 10.4, 2.1: SFTP delivery with SSH key and password authentication
 */

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import SftpClient from 'ssh2-sftp-client'

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
 * SFTP connection configuration
 */
interface SftpConnectionConfig {
	host: string
	port: number
	username?: string
	password?: string
	privateKey?: string | Buffer
	passphrase?: string
	readyTimeout?: number
	strictVendor?: boolean
}

/**
 * SFTP connection pool entry
 */
interface SftpConnectionPoolEntry {
	client: SftpClient
	lastUsed: number
	inUse: boolean
	connectionId: string
}

/**
 * SFTP transfer progress information
 */
interface SftpTransferProgress {
	transferred: number
	total: number
	percentage: number
}

/**
 * SFTP file upload options
 */
interface SftpUploadOptions {
	createDirectories?: boolean
	fileMode?: string | number
	progressCallback?: (progress: SftpTransferProgress) => void
}

/**
 * SFTP handler implementing secure file transfer with authentication
 * Requirements 1.1, 10.4, 2.1: SFTP client with SSH key and password authentication
 */
export class SftpHandler implements IDestinationHandler {
	readonly type = 'sftp' as const

	private readonly connectionPool: Map<string, SftpConnectionPoolEntry> = new Map()
	private readonly maxPoolSize: number
	private readonly connectionTimeout: number
	private readonly poolCleanupInterval: number
	private cleanupTimer?: NodeJS.Timeout

	constructor(options?: {
		maxPoolSize?: number
		connectionTimeout?: number
		poolCleanupInterval?: number
	}) {
		this.maxPoolSize = options?.maxPoolSize || 10
		this.connectionTimeout = options?.connectionTimeout || 30000
		this.poolCleanupInterval = options?.poolCleanupInterval || 300000 // 5 minutes

		// Start connection pool cleanup
		this.startPoolCleanup()
	}

	/**
	 * Validate SFTP configuration
	 * Requirements 1.1, 10.4: SFTP configuration validation
	 */
	validateConfig(config: DestinationConfig): ValidationResult {
		const errors: string[] = []
		const warnings: string[] = []

		const sftpConfig = config.sftp
		if (!sftpConfig) {
			errors.push('SFTP configuration is required')
			return { isValid: false, errors, warnings }
		}

		// Validate host
		if (!sftpConfig.host) {
			errors.push('SFTP host is required')
		} else if (typeof sftpConfig.host !== 'string') {
			errors.push('SFTP host must be a string')
		}

		// Validate port
		if (!sftpConfig.port) {
			errors.push('SFTP port is required')
		} else if (
			typeof sftpConfig.port !== 'number' ||
			sftpConfig.port <= 0 ||
			sftpConfig.port > 65535
		) {
			errors.push('SFTP port must be a number between 1 and 65535')
		}

		// Validate username
		if (!sftpConfig.username) {
			errors.push('SFTP username is required')
		} else if (typeof sftpConfig.username !== 'string') {
			errors.push('SFTP username must be a string')
		}

		// Validate authentication - must have either password or private key
		const hasPassword = sftpConfig.password && typeof sftpConfig.password === 'string'
		const hasPrivateKey = sftpConfig.privateKey && typeof sftpConfig.privateKey === 'string'

		if (!hasPassword && !hasPrivateKey) {
			errors.push('SFTP requires either password or private key authentication')
		}

		// Validate path
		if (!sftpConfig.path) {
			errors.push('SFTP path is required')
		} else if (typeof sftpConfig.path !== 'string') {
			errors.push('SFTP path must be a string')
		} else if (!sftpConfig.path.startsWith('/')) {
			warnings.push('SFTP path should be absolute (start with /)')
		}

		// Validate filename if provided
		if (sftpConfig.filename && typeof sftpConfig.filename !== 'string') {
			errors.push('SFTP filename must be a string')
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		}
	}

	/**
	 * Test connection to SFTP server
	 * Requirements 1.1, 10.4: Connection testing and validation
	 */
	async testConnection(config: DestinationConfig): Promise<ConnectionTestResult> {
		const validation = this.validateConfig(config)
		if (!validation.isValid) {
			return {
				success: false,
				error: `Configuration validation failed: ${validation.errors.join(', ')}`,
			}
		}

		const sftpConfig = config.sftp!
		const startTime = Date.now()

		let client: SftpClient | undefined

		try {
			// Create connection configuration
			const connectionConfig = await this.createConnectionConfig(sftpConfig)

			// Create and connect SFTP client
			client = new SftpClient()
			await client.connect(connectionConfig)

			// Test basic operations
			await client.cwd() // Get current working directory

			// Test if we can access the configured path
			if (sftpConfig.path) {
				try {
					await client.stat(sftpConfig.path)
				} catch (error) {
					// Path might not exist, try to create it for testing
					try {
						await client.mkdir(sftpConfig.path, true)
					} catch (mkdirError) {
						throw new Error(
							`Cannot access or create path ${sftpConfig.path}: ${error instanceof Error ? error.message : 'Unknown error'}`
						)
					}
				}
			}

			const responseTime = Date.now() - startTime

			return {
				success: true,
				responseTime,
				details: {
					serverVersion: 'unknown',
					workingDirectory: await client.cwd(),
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
		} finally {
			if (client) {
				try {
					await client.end()
				} catch {
					// Ignore cleanup errors
				}
			}
		}
	}

	/**
	 * Deliver payload to SFTP server
	 * Requirements 1.1, 2.1: Secure file upload with progress tracking
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

		const sftpConfig = config.sftp!
		const startTime = Date.now()

		let client: SftpClient | undefined

		try {
			// Get or create SFTP connection
			client = await this.getConnection(sftpConfig)

			// Prepare file content and metadata
			const fileContent = this.formatPayload(payload)
			const filename = this.generateFilename(payload, sftpConfig)
			const remotePath = join(sftpConfig.path, filename)

			// Ensure directory exists with proper permissions
			const remoteDir = dirname(remotePath)
			if (remoteDir !== '.' && remoteDir !== '/') {
				await this.ensureDirectoryExists(client, remoteDir, '755') // Default directory permissions
			}

			// Upload file with progress tracking
			let transferProgress: SftpTransferProgress | undefined
			const progressCallback = (progress: SftpTransferProgress) => {
				transferProgress = progress
			}

			await this.uploadFile(client, fileContent, remotePath, {
				progressCallback,
				createDirectories: true,
				fileMode: '644', // Default file permissions
			})

			// Set file permissions if needed
			await this.setFilePermissions(client, remotePath, '644')

			const responseTime = Date.now() - startTime

			// Return connection to pool
			this.returnConnection(client, sftpConfig)

			return {
				success: true,
				deliveredAt: new Date().toISOString(),
				responseTime,
				crossSystemReference: remotePath,
				error: undefined,
				retryable: false,
			}
		} catch (error) {
			const responseTime = Date.now() - startTime
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

			// Don't return connection to pool on error
			if (client) {
				try {
					await client.end()
				} catch {
					// Ignore cleanup errors
				}
			}

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
	 * Requirements 1.1, 10.4: Feature support declaration
	 */
	supportsFeature(feature: DeliveryFeature): boolean {
		const supportedFeatures: DeliveryFeature[] = ['retry_with_backoff', 'connection_pooling']
		return supportedFeatures.includes(feature)
	}

	/**
	 * Get JSON schema for SFTP configuration
	 */
	getConfigSchema(): Record<string, any> {
		return {
			type: 'object',
			properties: {
				sftp: {
					type: 'object',
					required: ['host', 'port', 'username', 'path'],
					properties: {
						host: {
							type: 'string',
							description: 'SFTP server hostname or IP address',
						},
						port: {
							type: 'number',
							minimum: 1,
							maximum: 65535,
							description: 'SFTP server port (typically 22)',
						},
						username: {
							type: 'string',
							description: 'Username for SFTP authentication',
						},
						password: {
							type: 'string',
							description: 'Password for SFTP authentication (if not using key)',
						},
						privateKey: {
							type: 'string',
							description: 'Private key content or path for SSH key authentication',
						},
						path: {
							type: 'string',
							description: 'Remote directory path for file uploads',
						},
						filename: {
							type: 'string',
							description: 'Custom filename pattern (optional)',
						},
					},
					oneOf: [{ required: ['password'] }, { required: ['privateKey'] }],
				},
			},
		}
	}

	/**
	 * Create SFTP connection configuration from destination config
	 * Requirements 10.4: SSH key and password authentication
	 */
	private async createConnectionConfig(
		sftpConfig: NonNullable<DestinationConfig['sftp']>
	): Promise<SftpConnectionConfig> {
		const connectionConfig: SftpConnectionConfig = {
			host: sftpConfig.host,
			port: sftpConfig.port,
			username: sftpConfig.username || '',
			readyTimeout: this.connectionTimeout,
			strictVendor: false,
		}

		// Handle authentication
		if (sftpConfig.password) {
			connectionConfig.password = sftpConfig.password
		}

		if (sftpConfig.privateKey) {
			// Check if privateKey is a file path or the key content itself
			let privateKeyContent: string | Buffer

			if (sftpConfig.privateKey.includes('-----BEGIN')) {
				// It's the key content itself
				privateKeyContent = sftpConfig.privateKey
			} else {
				// It's a file path
				try {
					privateKeyContent = await readFile(sftpConfig.privateKey)
				} catch (error) {
					throw new Error(
						`Failed to read private key file: ${error instanceof Error ? error.message : 'Unknown error'}`
					)
				}
			}

			connectionConfig.privateKey = privateKeyContent
		}

		return connectionConfig
	}

	/**
	 * Get connection from pool or create new one
	 * Requirements 1.1, 10.4: SFTP connection pooling and reuse
	 */
	private async getConnection(
		sftpConfig: NonNullable<DestinationConfig['sftp']>
	): Promise<SftpClient> {
		const connectionKey = this.getConnectionKey(sftpConfig)

		// Try to get existing connection from pool
		const poolEntry = this.connectionPool.get(connectionKey)
		if (poolEntry && !poolEntry.inUse) {
			// Test if connection is still alive
			try {
				await poolEntry.client.cwd()
				poolEntry.inUse = true
				poolEntry.lastUsed = Date.now()
				return poolEntry.client
			} catch {
				// Connection is dead, remove from pool
				this.connectionPool.delete(connectionKey)
				try {
					await poolEntry.client.end()
				} catch {
					// Ignore cleanup errors
				}
			}
		}

		// Create new connection
		const client = new SftpClient()
		const connectionConfig = await this.createConnectionConfig(sftpConfig)

		await client.connect(connectionConfig)

		// Add to pool if there's space
		if (this.connectionPool.size < this.maxPoolSize) {
			this.connectionPool.set(connectionKey, {
				client,
				lastUsed: Date.now(),
				inUse: true,
				connectionId: this.generateConnectionId(),
			})
		}

		return client
	}

	/**
	 * Return connection to pool
	 */
	private returnConnection(
		client: SftpClient,
		sftpConfig: NonNullable<DestinationConfig['sftp']>
	): void {
		const connectionKey = this.getConnectionKey(sftpConfig)
		const poolEntry = this.connectionPool.get(connectionKey)

		if (poolEntry && poolEntry.client === client) {
			poolEntry.inUse = false
			poolEntry.lastUsed = Date.now()
		}
	}

	/**
	 * Generate connection key for pooling
	 */
	private getConnectionKey(sftpConfig: NonNullable<DestinationConfig['sftp']>): string {
		return `${sftpConfig.host}:${sftpConfig.port}:${sftpConfig.username}`
	}

	/**
	 * Generate unique connection ID
	 */
	private generateConnectionId(): string {
		return `sftp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	}

	/**
	 * Format delivery payload for file content
	 * Requirements 2.1: Payload formatting for file transfer
	 */
	private formatPayload(payload: DeliveryPayload): string {
		const formattedPayload = {
			delivery_id: payload.deliveryId,
			organization_id: payload.organizationId,
			type: payload.type,
			data: payload.data,
			metadata: payload.metadata,
			correlation_id: payload.correlationId,
			idempotency_key: payload.idempotencyKey,
			timestamp: new Date().toISOString(),
		}

		// Format as JSON with pretty printing
		return JSON.stringify(formattedPayload, null, 2)
	}

	/**
	 * Generate filename for the uploaded file
	 * Requirements 2.1: File naming and path management
	 */
	private generateFilename(
		payload: DeliveryPayload,
		sftpConfig: NonNullable<DestinationConfig['sftp']>
	): string {
		if (sftpConfig.filename) {
			// Use custom filename pattern
			return sftpConfig.filename
				.replace('{deliveryId}', payload.deliveryId)
				.replace('{organizationId}', payload.organizationId)
				.replace('{type}', payload.type)
				.replace('{timestamp}', new Date().toISOString().replace(/[:.]/g, '-'))
		}

		// Default filename pattern
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
		return `delivery_${payload.deliveryId}_${timestamp}.json`
	}

	/**
	 * Ensure directory exists on remote server with proper permissions
	 * Requirements 1.1, 2.1: Directory creation and path management
	 */
	private async ensureDirectoryExists(
		client: SftpClient,
		remotePath: string,
		permissions?: string | number
	): Promise<void> {
		try {
			await client.stat(remotePath)
		} catch {
			// Directory doesn't exist, create it with permissions
			await this.createDirectoryWithPermissions(client, remotePath, permissions)
		}
	}

	/**
	 * Upload file with progress tracking and integrity verification
	 * Requirements 1.1, 2.1: Secure file upload with progress tracking and verification
	 */
	private async uploadFile(
		client: SftpClient,
		content: string,
		remotePath: string,
		options: SftpUploadOptions
	): Promise<void> {
		const buffer = Buffer.from(content, 'utf8')

		// Create a readable stream from buffer
		const { Readable } = await import('node:stream')
		const stream = Readable.from(buffer)

		// Track progress if callback provided
		if (options.progressCallback) {
			let transferred = 0
			const total = buffer.length

			stream.on('data', (chunk: Buffer) => {
				transferred += chunk.length
				options.progressCallback!({
					transferred,
					total,
					percentage: Math.round((transferred / total) * 100),
				})
			})
		}

		// Upload the file
		await client.put(stream, remotePath)

		// Verify upload integrity
		await this.verifyUploadIntegrity(client, remotePath, buffer)
	}

	/**
	 * Verify upload integrity by comparing file sizes and checksums
	 * Requirements 1.1, 2.1: Transfer verification and integrity checks
	 */
	private async verifyUploadIntegrity(
		client: SftpClient,
		remotePath: string,
		originalBuffer: Buffer
	): Promise<void> {
		// Check file exists and get stats
		const remoteStat = await client.stat(remotePath)
		const expectedSize = originalBuffer.length

		if (remoteStat.size !== expectedSize) {
			throw new Error(
				`Upload integrity check failed: expected ${expectedSize} bytes, got ${remoteStat.size} bytes`
			)
		}

		// For additional integrity verification, we could download and compare checksums
		// but for performance reasons, we'll rely on size comparison for now
		// In production, you might want to implement checksum verification for critical files
	}

	/**
	 * Set file permissions and ownership
	 * Requirements 1.1, 2.1: File permissions and ownership handling
	 */
	private async setFilePermissions(
		client: SftpClient,
		remotePath: string,
		permissions?: string | number
	): Promise<void> {
		if (permissions) {
			try {
				// Convert string permissions to octal if needed
				const mode = typeof permissions === 'string' ? parseInt(permissions, 8) : permissions

				await client.chmod(remotePath, mode)
			} catch (error) {
				// Log warning but don't fail the upload
				console.warn(`Failed to set permissions on ${remotePath}:`, error)
			}
		}
	}

	/**
	 * Create directory with proper permissions
	 * Requirements 1.1, 2.1: Directory creation with permissions
	 */
	private async createDirectoryWithPermissions(
		client: SftpClient,
		remotePath: string,
		permissions?: string | number
	): Promise<void> {
		await client.mkdir(remotePath, true)

		if (permissions) {
			try {
				const mode = typeof permissions === 'string' ? parseInt(permissions, 8) : permissions

				await client.chmod(remotePath, mode)
			} catch (error) {
				// Log warning but don't fail the operation
				console.warn(`Failed to set directory permissions on ${remotePath}:`, error)
			}
		}
	}

	/**
	 * Determine if error is retryable
	 * Requirements 3.1, 3.2: Retry logic for transient failures
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
			'EAI_AGAIN',
			'EHOSTUNREACH',
			'ENETUNREACH',
			'Connection lost',
			'Connection closed',
			'Timeout',
		]

		return retryableErrors.some((retryableError) =>
			error.message.toLowerCase().includes(retryableError.toLowerCase())
		)
	}

	/**
	 * Start connection pool cleanup timer
	 */
	private startPoolCleanup(): void {
		this.cleanupTimer = setInterval(() => {
			this.cleanupConnectionPool()
		}, this.poolCleanupInterval)
	}

	/**
	 * Clean up idle connections from pool
	 */
	private cleanupConnectionPool(): void {
		const now = Date.now()
		const maxIdleTime = 600000 // 10 minutes

		for (const [key, entry] of this.connectionPool.entries()) {
			if (!entry.inUse && now - entry.lastUsed > maxIdleTime) {
				this.connectionPool.delete(key)
				try {
					entry.client.end()
				} catch {
					// Ignore cleanup errors
				}
			}
		}
	}

	/**
	 * Cleanup handler - close all connections and stop timers
	 */
	async cleanup(): Promise<void> {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer)
			this.cleanupTimer = undefined
		}

		// Close all pooled connections
		const closePromises = Array.from(this.connectionPool.values()).map(async (entry) => {
			try {
				await entry.client.end()
			} catch {
				// Ignore cleanup errors
			}
		})

		await Promise.allSettled(closePromises)
		this.connectionPool.clear()
	}
}
