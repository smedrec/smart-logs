import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGzip, gzipSync } from 'node:zlib'

import type { LogEntry } from '../types/index.js'

/**
 * LogSerializer with proper JSON handling and compression
 * Addresses requirements 4.2, 3.2, 4.5
 */
export class LogSerializer {
	/**
	 * Serialize a log entry to JSON string with circular reference handling
	 */
	static serialize(entry: LogEntry): string {
		try {
			// Create a serializable object avoiding circular references
			const serializable = this.createSerializableObject(entry)
			return JSON.stringify(serializable)
		} catch (error) {
			// Fallback serialization for problematic entries
			return this.fallbackSerialize(entry, error)
		}
	}

	/**
	 * Serialize multiple log entries efficiently
	 */
	static serializeBatch(entries: LogEntry[]): string[] {
		return entries.map((entry) => this.serialize(entry))
	}

	/**
	 * Compress a serialized log entry using gzip
	 */
	static compress(data: string): Buffer {
		try {
			return gzipSync(Buffer.from(data, 'utf8'))
		} catch (error) {
			throw new Error(
				`Compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			)
		}
	}

	/**
	 * Compress multiple log entries as a batch
	 */
	static compressBatch(entries: string[]): Buffer {
		const batchData = entries.join('\n')
		return this.compress(batchData)
	}

	/**
	 * Stream-based compression for large payloads to avoid blocking event loop
	 */
	static async compressStream(data: string): Promise<Buffer> {
		const chunks: Buffer[] = []

		const readable = Readable.from([data])
		const gzipStream = createGzip()

		const collectChunks = new Transform({
			transform(chunk: Buffer, _encoding, callback) {
				chunks.push(chunk)
				callback()
			},
		})

		try {
			await pipeline(readable, gzipStream, collectChunks)
			return Buffer.concat(chunks)
		} catch (error) {
			throw new Error(
				`Stream compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			)
		}
	}

	/**
	 * Create a serializable object from LogEntry, handling circular references
	 */
	private static createSerializableObject(entry: LogEntry): Record<string, unknown> {
		const serializable: Record<string, unknown> = {
			'@timestamp': this.formatTimestamp(entry.timestamp),
			'@id': entry.id,
			level: entry.level,
			message: entry.message,
			correlationId: entry.correlationId,
			source: entry.source,
			version: entry.version,
		}

		// Add optional fields only if present
		if (entry.requestId) serializable.requestId = entry.requestId
		if (entry.traceId) serializable.traceId = entry.traceId
		if (entry.spanId) serializable.spanId = entry.spanId

		// Add fields with circular reference protection
		if (entry.fields && Object.keys(entry.fields).length > 0) {
			serializable.fields = this.sanitizeFields(entry.fields)
		}

		// Add metadata with normalization
		if (entry.metadata) {
			serializable.metadata = this.normalizeMetadata(
				entry.metadata as unknown as Record<string, unknown>
			)
		}

		// Add performance metrics if present
		if (entry.performance) {
			serializable.performance = this.normalizePerformanceMetrics(
				entry.performance as unknown as Record<string, unknown>
			)
		}

		return serializable
	}

	/**
	 * Format timestamp in ISO 8601 format for consistency
	 */
	private static formatTimestamp(timestamp: Date): string {
		return timestamp.toISOString()
	}

	/**
	 * Sanitize fields to prevent circular references and ensure serializability
	 */
	private static sanitizeFields(fields: Record<string, unknown>): Record<string, unknown> {
		const sanitized: Record<string, unknown> = {}
		const seen = new WeakSet()

		for (const [key, value] of Object.entries(fields)) {
			sanitized[key] = this.sanitizeValue(value, seen)
		}

		return sanitized
	}

	/**
	 * Recursively sanitize values to handle circular references
	 */
	private static sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
		// Handle null and undefined
		if (value === null || value === undefined) {
			return value
		}

		// Handle primitives
		if (typeof value !== 'object') {
			return value
		}

		// Handle circular references
		if (typeof value === 'object' && seen.has(value as object)) {
			return '[Circular Reference]'
		}

		// Handle arrays
		if (Array.isArray(value)) {
			seen.add(value)
			const sanitizedArray = value.map((item) => this.sanitizeValue(item, seen))
			seen.delete(value)
			return sanitizedArray
		}

		// Handle objects
		if (value && typeof value === 'object') {
			seen.add(value)
			const sanitizedObject: Record<string, unknown> = {}

			for (const [key, val] of Object.entries(value)) {
				sanitizedObject[key] = this.sanitizeValue(val, seen)
			}

			seen.delete(value)
			return sanitizedObject
		}

		// Fallback for non-serializable values
		return '[Non-Serializable]'
	}

	/**
	 * Normalize metadata for consistent structure
	 */
	private static normalizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
		const normalized: Record<string, unknown> = {}

		for (const [key, value] of Object.entries(metadata)) {
			// Skip undefined values
			if (value === undefined) continue

			// Normalize specific metadata types
			if (key === 'request' && value && typeof value === 'object') {
				normalized[key] = this.normalizeRequestMetadata(value as Record<string, unknown>)
			} else if (key === 'database' && value && typeof value === 'object') {
				normalized[key] = this.normalizeDatabaseMetadata(value as Record<string, unknown>)
			} else if (key === 'security' && value && typeof value === 'object') {
				normalized[key] = this.normalizeSecurityMetadata(value as Record<string, unknown>)
			} else {
				normalized[key] = value
			}
		}

		return normalized
	}

	/**
	 * Normalize request metadata
	 */
	private static normalizeRequestMetadata(
		request: Record<string, unknown>
	): Record<string, unknown> {
		const normalized: Record<string, unknown> = {}

		if (request.method) normalized.method = String(request.method).toUpperCase()
		if (request.url) normalized.url = String(request.url)
		if (request.userAgent) normalized.userAgent = String(request.userAgent)
		if (request.ip) normalized.ip = String(request.ip)
		if (typeof request.duration === 'number') normalized.duration = request.duration
		if (typeof request.statusCode === 'number') normalized.statusCode = request.statusCode

		return normalized
	}

	/**
	 * Normalize database metadata
	 */
	private static normalizeDatabaseMetadata(
		database: Record<string, unknown>
	): Record<string, unknown> {
		const normalized: Record<string, unknown> = {}

		if (database.operation) normalized.operation = String(database.operation)
		if (database.table) normalized.table = String(database.table)
		if (typeof database.duration === 'number') normalized.duration = database.duration
		if (typeof database.rowsAffected === 'number') normalized.rowsAffected = database.rowsAffected
		if (database.query) normalized.query = String(database.query)

		return normalized
	}

	/**
	 * Normalize security metadata
	 */
	private static normalizeSecurityMetadata(
		security: Record<string, unknown>
	): Record<string, unknown> {
		const normalized: Record<string, unknown> = {}

		if (security.event) normalized.event = String(security.event)
		if (security.userId) normalized.userId = String(security.userId)
		if (security.severity) normalized.severity = String(security.severity)
		if (security.action) normalized.action = String(security.action)
		if (security.resource) normalized.resource = String(security.resource)

		return normalized
	}

	/**
	 * Normalize performance metrics
	 */
	private static normalizePerformanceMetrics(
		performance: Record<string, unknown>
	): Record<string, unknown> {
		const normalized: Record<string, unknown> = {}

		if (typeof performance.cpuUsage === 'number') normalized.cpuUsage = performance.cpuUsage
		if (typeof performance.memoryUsage === 'number')
			normalized.memoryUsage = performance.memoryUsage
		if (typeof performance.duration === 'number') normalized.duration = performance.duration
		if (typeof performance.operationCount === 'number')
			normalized.operationCount = performance.operationCount

		return normalized
	}

	/**
	 * Fallback serialization when normal serialization fails
	 */
	private static fallbackSerialize(entry: LogEntry, originalError: unknown): string {
		const fallback = {
			'@timestamp': this.formatTimestamp(entry.timestamp),
			'@id': entry.id,
			level: entry.level,
			message: entry.message,
			correlationId: entry.correlationId,
			source: entry.source,
			version: entry.version,
			'@error': `Serialization failed: ${originalError instanceof Error ? originalError.message : 'Unknown error'}`,
		}

		try {
			return JSON.stringify(fallback)
		} catch {
			// Ultimate fallback - basic string representation
			return `{"@timestamp":"${this.formatTimestamp(entry.timestamp)}","level":"${entry.level}","message":"${entry.message}","@error":"Critical serialization failure"}`
		}
	}
}
