import { createWriteStream, promises as fs } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { promisify } from 'node:util'
import { gzip } from 'node:zlib'

import { registerResource, unregisterResource } from '../core/resource-manager.js'

import type { WriteStream } from 'node:fs'
import type { FileConfig } from '../types/config.js'
import type { LogEntry } from '../types/log-entry.js'
import type { LogTransport } from '../types/transport.js'

const gzipAsync = promisify(gzip)

/**
 * File transport with rotation support
 * Implements configurable file rotation by size and time with proper resource management
 * Addresses requirements 5.2 and 8.3: File output with rotation and resource cleanup
 */
export class FileTransport implements LogTransport {
	public readonly name = 'file'

	private writeStream: WriteStream | null = null
	private currentFileSize = 0
	private lastRotationTime = Date.now()
	private isClosing = false
	private pendingWrites = new Set<Promise<void>>()
	private readonly resourceId: string

	constructor(private config: FileConfig) {
		this.validateConfig()
		this.resourceId = `FileTransport-${this.config.filename}`

		// Register with resource manager
		registerResource({
			id: this.resourceId,
			type: 'stream',
			cleanup: () => this.close(),
			metadata: {
				filename: this.config.filename,
				maxSize: this.config.maxSize,
			},
		})
	}

	/**
	 * Send log entries to file with atomic write operations
	 */
	async send(entries: LogEntry[]): Promise<void> {
		if (this.isClosing) {
			throw new Error('FileTransport is closing, cannot send logs')
		}

		await this.ensureFileStream()

		for (const entry of entries) {
			const logLine = this.formatLogEntry(entry)
			const writePromise = this.writeToFile(logLine)
			this.pendingWrites.add(writePromise)

			try {
				await writePromise
			} finally {
				this.pendingWrites.delete(writePromise)
			}

			// Check if rotation is needed after each write
			await this.checkRotation()
		}
	}

	/**
	 * Flush all pending writes
	 */
	async flush(): Promise<void> {
		if (this.writeStream) {
			// Wait for all pending writes to complete
			await Promise.all(Array.from(this.pendingWrites))

			// Flush the stream
			return new Promise<void>((resolve, reject) => {
				if (!this.writeStream) {
					resolve()
					return
				}

				this.writeStream.write('', (error: Error | null | undefined) => {
					if (error) {
						reject(error)
					} else {
						resolve()
					}
				})
			})
		}
	}

	/**
	 * Close the transport and cleanup resources
	 */
	async close(): Promise<void> {
		if (this.isClosing) {
			return
		}

		this.isClosing = true

		try {
			// Wait for all pending writes to complete
			await Promise.all(Array.from(this.pendingWrites))

			if (this.writeStream) {
				await new Promise<void>((resolve, reject) => {
					if (!this.writeStream) {
						resolve()
						return
					}

					this.writeStream.end((error: Error | null | undefined) => {
						if (error) {
							reject(error)
						} else {
							this.writeStream = null
							resolve()
						}
					})
				})
			}
		} finally {
			// Unregister from resource manager
			await unregisterResource(this.resourceId)
		}
	}

	/**
	 * Check if the transport is healthy
	 */
	isHealthy(): boolean {
		return !this.isClosing && (this.writeStream?.writable ?? false)
	}

	/**
	 * Ensure file stream is available and directory exists
	 */
	private async ensureFileStream(): Promise<void> {
		if (!this.writeStream || this.writeStream.destroyed) {
			await this.createFileStream()
		}
	}

	/**
	 * Create file stream with proper directory structure
	 */
	private async createFileStream(): Promise<void> {
		const filePath = this.getCurrentFilePath()
		const dir = dirname(filePath)

		// Create directory structure if it doesn't exist
		try {
			await fs.mkdir(dir, { recursive: true })
		} catch (error) {
			throw new Error(`Failed to create log directory ${dir}: ${(error as Error).message}`)
		}

		// Check if file exists to get current size
		try {
			const stats = await fs.stat(filePath)
			this.currentFileSize = stats.size
		} catch {
			// File doesn't exist, start with size 0
			this.currentFileSize = 0
		}

		// Create write stream with proper flags
		this.writeStream = createWriteStream(filePath, {
			flags: 'a', // Append mode
			encoding: 'utf8',
			highWaterMark: 64 * 1024, // 64KB buffer
		})

		// Handle stream errors
		this.writeStream.on('error', (error: Error) => {
			console.error(`FileTransport stream error: ${error.message}`)
		})
	}

	/**
	 * Write log line to file atomically
	 */
	private async writeToFile(logLine: string): Promise<void> {
		if (!this.writeStream) {
			throw new Error('File stream not available')
		}

		const data = logLine + '\n'
		const dataSize = Buffer.byteLength(data, 'utf8')

		return new Promise<void>((resolve, reject) => {
			if (!this.writeStream) {
				reject(new Error('File stream not available'))
				return
			}

			this.writeStream.write(data, 'utf8', (error: Error | null | undefined) => {
				if (error) {
					reject(error)
				} else {
					this.currentFileSize += dataSize
					resolve()
				}
			})
		})
	}

	/**
	 * Format log entry as JSON string
	 */
	private formatLogEntry(entry: LogEntry): string {
		const logObject: Record<string, any> = {
			'@timestamp': entry.timestamp.toISOString(),
			level: entry.level,
			message: entry.message,
			correlationId: entry.correlationId,
			...entry.fields,
			...entry.metadata,
		}

		// Add optional fields only if present
		if (entry.requestId) logObject.requestId = entry.requestId
		if (entry.traceId) logObject.traceId = entry.traceId
		if (entry.spanId) logObject.spanId = entry.spanId
		if (entry.performance) logObject.performance = entry.performance

		return JSON.stringify(logObject)
	}

	/**
	 * Get current file path with rotation suffix
	 */
	private getCurrentFilePath(): string {
		// Filename is guaranteed to be present after validation in constructor
		const filename = this.config.filename!

		if (this.config.rotateDaily) {
			const now = new Date()
			const ext = extname(filename)
			const base = basename(filename, ext)
			const dir = dirname(filename)

			let suffix: string
			switch (this.config.rotationInterval) {
				case 'daily':
					suffix = now.toISOString().split('T')[0] // YYYY-MM-DD
					break
				case 'weekly':
					const year = now.getFullYear()
					const week = this.getWeekNumber(now)
					suffix = `${year}-W${week.toString().padStart(2, '0')}`
					break
				case 'monthly':
					suffix = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`
					break
				default:
					suffix = now.toISOString().split('T')[0]
			}

			return join(dir, `${base}-${suffix}${ext}`)
		}
		return filename
	}

	/**
	 * Check if rotation is needed and perform rotation
	 */
	private async checkRotation(): Promise<void> {
		const needsSizeRotation = this.currentFileSize >= this.config.maxSize
		const needsTimeRotation = this.config.rotateDaily && this.needsTimeRotation()

		if (needsSizeRotation || needsTimeRotation) {
			await this.rotateFile()
		}
	}

	/**
	 * Check if time-based rotation is needed
	 */
	private needsTimeRotation(): boolean {
		const now = Date.now()
		const lastRotation = new Date(this.lastRotationTime)
		const current = new Date(now)

		switch (this.config.rotationInterval) {
			case 'daily':
				return lastRotation.toDateString() !== current.toDateString()
			case 'weekly':
				return this.getWeekNumber(lastRotation) !== this.getWeekNumber(current)
			case 'monthly':
				return (
					lastRotation.getFullYear() !== current.getFullYear() ||
					lastRotation.getMonth() !== current.getMonth()
				)
			default:
				return false
		}
	}

	/**
	 * Get week number for weekly rotation
	 */
	private getWeekNumber(date: Date): number {
		const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
		const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
		return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
	}

	/**
	 * Rotate the current file
	 */
	private async rotateFile(): Promise<void> {
		if (!this.writeStream) return

		// Close current stream
		await new Promise<void>((resolve, reject) => {
			if (!this.writeStream) {
				resolve()
				return
			}

			this.writeStream.end((error?: Error) => {
				if (error) {
					reject(error)
				} else {
					resolve()
				}
			})
		})

		const currentPath = this.getCurrentFilePath()

		// Generate rotated filename
		const rotatedPath = await this.generateRotatedFilename(currentPath)

		try {
			// Move current file to rotated name
			await fs.rename(currentPath, rotatedPath)

			// Compress rotated file if enabled
			if (this.config.compress) {
				await this.compressFile(rotatedPath)
			}

			// Clean up old files
			await this.cleanupOldFiles()
		} catch (error) {
			console.error(`Failed to rotate log file: ${(error as Error).message}`)
		}

		// Reset state and create new stream
		this.currentFileSize = 0
		this.lastRotationTime = Date.now()
		this.writeStream = null
		await this.createFileStream()
	}

	/**
	 * Generate filename for rotated file
	 */
	private async generateRotatedFilename(currentPath: string): Promise<string> {
		const ext = extname(currentPath)
		const base = basename(currentPath, ext)
		const dir = dirname(currentPath)

		let counter = 1
		let rotatedPath: string

		do {
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
			rotatedPath = join(dir, `${base}.${timestamp}.${counter}${ext}`)
			counter++

			try {
				await fs.access(rotatedPath)
				// File exists, try next counter
			} catch {
				// File doesn't exist, use this name
				break
			}
		} while (counter < 1000) // Prevent infinite loop

		return rotatedPath
	}

	/**
	 * Compress a file using gzip
	 */
	private async compressFile(filePath: string): Promise<void> {
		try {
			const data = await fs.readFile(filePath)
			const compressed = await gzipAsync(data)
			const compressedPath = `${filePath}.gz`

			await fs.writeFile(compressedPath, compressed)
			await fs.unlink(filePath) // Remove original file
		} catch (error) {
			console.error(`Failed to compress file ${filePath}: ${(error as Error).message}`)
		}
	}

	/**
	 * Clean up old log files based on maxFiles and retention period configuration
	 */
	private async cleanupOldFiles(): Promise<void> {
		try {
			// Filename is guaranteed to be present after validation in constructor
			const filename = this.config.filename!
			const dir = dirname(filename)
			const base = basename(filename, extname(filename))

			const files = await fs.readdir(dir)
			const logFiles = files
				.filter((file) => file.startsWith(base) && file !== basename(filename))
				.map((file) => join(dir, file))

			// Get file stats for all log files
			const fileStats = await Promise.all(
				logFiles.map(async (file) => {
					try {
						const stats = await fs.stat(file)
						return { file, mtime: stats.mtime, size: stats.size }
					} catch {
						return null // File might have been deleted
					}
				})
			)

			const validFiles = fileStats.filter((stat) => stat !== null) as Array<{
				file: string
				mtime: Date
				size: number
			}>

			// Sort by modification time (oldest first)
			validFiles.sort((a, b) => a.mtime.getTime() - b.mtime.getTime())

			// Remove files older than retention period
			const retentionCutoff = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000
			const filesToRemoveByAge = validFiles.filter((stat) => stat.mtime.getTime() < retentionCutoff)

			// Remove excess files beyond maxFiles limit
			const remainingFiles = validFiles.filter((stat) => stat.mtime.getTime() >= retentionCutoff)
			const filesToRemoveByCount = remainingFiles.slice(
				0,
				Math.max(0, remainingFiles.length - this.config.maxFiles + 1)
			)

			// Combine files to remove (deduplicate)
			const allFilesToRemove = new Set([
				...filesToRemoveByAge.map((stat) => stat.file),
				...filesToRemoveByCount.map((stat) => stat.file),
			])

			// Remove the files
			for (const file of allFilesToRemove) {
				try {
					await fs.unlink(file)
					console.log(`Removed old log file: ${file}`)
				} catch (error) {
					console.error(`Failed to remove old log file ${file}: ${(error as Error).message}`)
				}
			}

			// Log cleanup summary
			if (allFilesToRemove.size > 0) {
				console.log(`Cleaned up ${allFilesToRemove.size} old log files`)
			}
		} catch (error) {
			console.error(`Failed to cleanup old log files: ${(error as Error).message}`)
		}
	}

	/**
	 * Validate configuration
	 */
	private validateConfig(): void {
		if (!this.config.filename) {
			throw new Error('FileTransport: filename is required')
		}

		if (this.config.maxSize <= 0) {
			throw new Error('FileTransport: maxSize must be positive')
		}

		if (this.config.maxFiles <= 0) {
			throw new Error('FileTransport: maxFiles must be positive')
		}
	}
}
