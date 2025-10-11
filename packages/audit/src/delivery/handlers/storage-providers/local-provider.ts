/**
 * Local filesystem storage provider implementation
 * Requirements 1.1, 10.2, 10.4: Local filesystem handler for development and testing
 */

import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

import {
	StorageAuthenticationError,
	StorageError,
	StorageNetworkError,
	StorageNotFoundError,
} from '../storage-handler.js'

import type { ConnectionTestResult, ValidationResult } from '../../types.js'
import type {
	IStorageProvider,
	LocalStorageConfig,
	StorageConfig,
	StorageDownloadResult,
	StorageListResult,
	StorageObjectInfo,
	StorageProvider,
	StorageUploadResult,
} from '../storage-handler.js'

/**
 * Local filesystem storage provider
 * Requirements 1.1, 10.2, 10.4: Local filesystem for development and testing
 */
export class LocalStorageProvider implements IStorageProvider {
	readonly provider: StorageProvider = 'local'

	private config: LocalStorageConfig | null = null
	private basePath: string = ''

	/**
	 * Initialize local filesystem storage with configuration
	 * Requirements 10.2, 10.4: Local filesystem configuration
	 */
	async initialize(storageConfig: StorageConfig): Promise<void> {
		if (storageConfig.provider !== 'local') {
			throw new StorageError(
				'Invalid provider for LocalStorageProvider',
				'INVALID_PROVIDER',
				400,
				false
			)
		}

		this.config = storageConfig.config as LocalStorageConfig
		this.basePath = resolve(this.config.basePath)

		// Create base directory if it doesn't exist and createDirectories is enabled
		if (this.config.createDirectories !== false) {
			try {
				await fs.mkdir(this.basePath, { recursive: true })
			} catch (error: any) {
				throw new StorageError(
					`Failed to create base directory: ${error.message}`,
					'DIRECTORY_CREATION_FAILED',
					500,
					false
				)
			}
		}
	}

	/**
	 * Test connection to local filesystem
	 * Requirements 1.2, 1.3, 1.4: Connection testing and validation
	 */
	async testConnection(): Promise<ConnectionTestResult> {
		const startTime = Date.now()

		try {
			if (!this.config) {
				throw new StorageError('Local storage not initialized', 'NOT_INITIALIZED', 500, false)
			}

			// Test by checking if base path exists and is accessible
			const stats = await fs.stat(this.basePath)

			if (!stats.isDirectory()) {
				return {
					success: false,
					responseTime: Date.now() - startTime,
					error: `Base path is not a directory: ${this.basePath}`,
					details: {
						basePath: this.basePath,
						type: 'file',
					},
				}
			}

			// Test write permissions by creating a temporary file
			const testFile = join(this.basePath, '.storage-test')
			try {
				await fs.writeFile(testFile, 'test', 'utf-8')
				await fs.unlink(testFile)
			} catch (error: any) {
				return {
					success: false,
					responseTime: Date.now() - startTime,
					error: `No write permissions: ${error.message}`,
					details: {
						basePath: this.basePath,
						error: error.code,
					},
				}
			}

			return {
				success: true,
				responseTime: Date.now() - startTime,
				details: {
					basePath: this.basePath,
					permissions: stats.mode.toString(8),
				},
			}
		} catch (error: any) {
			return {
				success: false,
				responseTime: Date.now() - startTime,
				error: this.handleLocalError(error).message,
				details: {
					basePath: this.basePath,
					errorCode: error.code,
				},
			}
		}
	}

	/**
	 * Validate local filesystem configuration
	 * Requirements 1.2, 1.3, 1.4, 10.2, 10.4: Configuration validation
	 */
	validateConfig(storageConfig: StorageConfig): ValidationResult {
		const errors: string[] = []
		const warnings: string[] = []

		if (storageConfig.provider !== 'local') {
			errors.push('Provider must be "local" for LocalStorageProvider')
			return { isValid: false, errors, warnings }
		}

		const config = storageConfig.config as LocalStorageConfig

		// Required fields
		if (!config.basePath) {
			errors.push('Local storage base path is required')
		} else {
			// Validate path format
			if (config.basePath.includes('..')) {
				errors.push('Base path cannot contain ".." for security reasons')
			}

			// Check if path is absolute (recommended)
			if (!config.basePath.startsWith('/') && !config.basePath.match(/^[A-Za-z]:/)) {
				warnings.push('Relative paths may cause issues - consider using absolute paths')
			}
		}

		// Permissions validation
		if (config.permissions) {
			if (!/^[0-7]{3,4}$/.test(config.permissions)) {
				errors.push('Permissions must be in octal format (e.g., "0644", "0755")')
			}
		}

		// Directory creation setting
		if (config.createDirectories === undefined) {
			warnings.push('createDirectories not specified - will default to true')
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		}
	}

	/**
	 * Upload file to local filesystem
	 * Requirements 2.1: File upload with metadata and permissions
	 */
	async upload(
		key: string,
		data: Buffer | string,
		metadata?: Record<string, string>
	): Promise<StorageUploadResult> {
		try {
			if (!this.config) {
				throw new StorageError('Local storage not initialized', 'NOT_INITIALIZED', 500, false)
			}

			const filePath = this.getFilePath(key)
			const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8')

			// Ensure directory exists
			const dir = dirname(filePath)
			await fs.mkdir(dir, { recursive: true })

			// Write file
			await fs.writeFile(filePath, buffer)

			// Set permissions if configured
			if (this.config.permissions) {
				const mode = parseInt(this.config.permissions, 8)
				await fs.chmod(filePath, mode)
			}

			// Store metadata in a separate file if provided
			if (metadata && Object.keys(metadata).length > 0) {
				const metadataPath = `${filePath}.metadata.json`
				await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')
			}

			// Generate etag (MD5 hash of content)
			const etag = createHash('md5').update(buffer).digest('hex')

			return {
				key,
				url: `file://${filePath}`,
				etag: `"${etag}"`,
				size: buffer.length,
				metadata,
			}
		} catch (error: any) {
			throw this.handleLocalError(error)
		}
	}

	/**
	 * Download file from local filesystem
	 */
	async download(key: string): Promise<StorageDownloadResult> {
		try {
			if (!this.config) {
				throw new StorageError('Local storage not initialized', 'NOT_INITIALIZED', 500, false)
			}

			const filePath = this.getFilePath(key)

			// Check if file exists
			try {
				await fs.access(filePath)
			} catch {
				throw new StorageNotFoundError(key, 'local')
			}

			// Read file
			const data = await fs.readFile(filePath)
			const stats = await fs.stat(filePath)

			// Read metadata if it exists
			let metadata: Record<string, string> | undefined
			const metadataPath = `${filePath}.metadata.json`
			try {
				const metadataContent = await fs.readFile(metadataPath, 'utf-8')
				metadata = JSON.parse(metadataContent)
			} catch {
				// Metadata file doesn't exist or is invalid - that's okay
			}

			// Determine content type based on file extension or content
			let contentType = 'application/octet-stream'
			if (key.endsWith('.json') || this.isJsonData(data)) {
				contentType = 'application/json'
			} else if (key.endsWith('.txt')) {
				contentType = 'text/plain'
			} else if (key.endsWith('.html')) {
				contentType = 'text/html'
			} else if (key.endsWith('.xml')) {
				contentType = 'application/xml'
			}

			return {
				data,
				metadata,
				lastModified: stats.mtime,
				contentType,
				size: stats.size,
			}
		} catch (error: any) {
			throw this.handleLocalError(error)
		}
	}

	/**
	 * Delete file from local filesystem
	 */
	async delete(key: string): Promise<void> {
		try {
			if (!this.config) {
				throw new StorageError('Local storage not initialized', 'NOT_INITIALIZED', 500, false)
			}

			const filePath = this.getFilePath(key)

			// Delete main file
			try {
				await fs.unlink(filePath)
			} catch (error: any) {
				if (error.code === 'ENOENT') {
					throw new StorageNotFoundError(key, 'local')
				}
				throw error
			}

			// Delete metadata file if it exists
			const metadataPath = `${filePath}.metadata.json`
			try {
				await fs.unlink(metadataPath)
			} catch {
				// Metadata file doesn't exist - that's okay
			}
		} catch (error: any) {
			throw this.handleLocalError(error)
		}
	}

	/**
	 * Check if file exists in local filesystem
	 */
	async exists(key: string): Promise<boolean> {
		try {
			if (!this.config) {
				throw new StorageError('Local storage not initialized', 'NOT_INITIALIZED', 500, false)
			}

			const filePath = this.getFilePath(key)

			try {
				await fs.access(filePath)
				return true
			} catch {
				return false
			}
		} catch (error: any) {
			throw this.handleLocalError(error)
		}
	}

	/**
	 * List files in local filesystem
	 */
	async listObjects(prefix?: string, maxKeys?: number): Promise<StorageListResult> {
		try {
			if (!this.config) {
				throw new StorageError('Local storage not initialized', 'NOT_INITIALIZED', 500, false)
			}

			const objects: StorageObjectInfo[] = []
			const maxItems = maxKeys || 1000

			await this.walkDirectory(this.basePath, '', prefix, objects, maxItems)

			return {
				objects: objects.slice(0, maxItems),
				isTruncated: objects.length > maxItems,
			}
		} catch (error: any) {
			throw this.handleLocalError(error)
		}
	}

	/**
	 * Get provider information
	 */
	getProviderInfo() {
		return {
			name: 'Local Filesystem',
			version: '1.0',
			features: ['file-permissions', 'metadata-files', 'directory-creation', 'symbolic-links'],
		}
	}

	/**
	 * Clean up resources
	 */
	async cleanup(): Promise<void> {
		this.config = null
		this.basePath = ''
	}

	/**
	 * Get full file path from key
	 */
	private getFilePath(key: string): string {
		// Ensure key doesn't escape the base path
		const normalizedKey = key.replace(/\.\./g, '').replace(/^\/+/, '')
		return join(this.basePath, normalizedKey)
	}

	/**
	 * Recursively walk directory to list files
	 */
	private async walkDirectory(
		dirPath: string,
		relativePath: string,
		prefix?: string,
		objects: StorageObjectInfo[] = [],
		maxItems: number = 1000
	): Promise<void> {
		if (objects.length >= maxItems) return

		try {
			const entries = await fs.readdir(dirPath, { withFileTypes: true })

			for (const entry of entries) {
				if (objects.length >= maxItems) break

				const entryPath = join(dirPath, entry.name)
				const entryKey = relativePath ? `${relativePath}/${entry.name}` : entry.name

				// Skip metadata files
				if (entry.name.endsWith('.metadata.json')) continue

				if (entry.isDirectory()) {
					// Recursively walk subdirectories
					await this.walkDirectory(entryPath, entryKey, prefix, objects, maxItems)
				} else if (entry.isFile()) {
					// Check prefix filter
					if (prefix && !entryKey.startsWith(prefix)) continue

					const stats = await fs.stat(entryPath)

					// Generate etag for the file
					const data = await fs.readFile(entryPath)
					const etag = createHash('md5').update(data).digest('hex')

					objects.push({
						key: entryKey,
						size: stats.size,
						lastModified: stats.mtime,
						etag: `"${etag}"`,
					})
				}
			}
		} catch (error: any) {
			// Skip directories we can't read
			if (error.code !== 'EACCES' && error.code !== 'EPERM') {
				throw error
			}
		}
	}

	/**
	 * Handle local filesystem errors and convert to storage errors
	 */
	private handleLocalError(error: any): StorageError {
		const errorCode = error.code || error.name || 'UNKNOWN_ERROR'
		const message = error.message || 'Unknown local filesystem error'

		switch (errorCode) {
			case 'ENOENT':
				return new StorageNotFoundError(message, 'local')

			case 'EACCES':
			case 'EPERM':
				return new StorageAuthenticationError(message, 'local')

			case 'ENOSPC':
				return new StorageError(`Local storage full: ${message}`, 'STORAGE_FULL', 507, false)

			case 'EMFILE':
			case 'ENFILE':
				return new StorageError(`Too many open files: ${message}`, 'TOO_MANY_FILES', 429, true)

			case 'EIO':
				return new StorageError(`I/O error: ${message}`, 'IO_ERROR', 500, true)

			default:
				return new StorageError(`Local filesystem error: ${message}`, errorCode, 500, false)
		}
	}

	/**
	 * Check if buffer contains JSON data
	 */
	private isJsonData(buffer: Buffer): boolean {
		try {
			const str = buffer.toString('utf-8', 0, Math.min(100, buffer.length))
			return str.trim().startsWith('{') || str.trim().startsWith('[')
		} catch {
			return false
		}
	}
}

/**
 * Create and initialize local storage provider
 */
export function createLocalStorageProvider(): LocalStorageProvider {
	return new LocalStorageProvider()
}
