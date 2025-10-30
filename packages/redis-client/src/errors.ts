export interface ErrorMetadata {
	[key: string]: any
}

export abstract class BaseError extends Error {
	public readonly code: string
	public readonly statusCode: number
	public readonly metadata?: ErrorMetadata
	public readonly timestamp: Date

	constructor(code: string, message: string, statusCode: number, metadata?: ErrorMetadata) {
		super(message)
		this.name = this.constructor.name
		this.code = code
		this.statusCode = statusCode
		this.metadata = metadata
		this.timestamp = new Date()

		Error.captureStackTrace(this, this.constructor)
	}

	public toJSON(): Object {
		return {
			name: this.name,
			code: this.code,
			statusCode: this.statusCode,
			message: this.message,
			metadata: this.metadata,
			timestamp: this.timestamp,
			stack: this.stack,
		}
	}
}

export class RedisError extends BaseError {
	constructor(message: string, metadata?: any) {
		super('REDIS_ERROR', message, 500, metadata)
	}
}

export class RedisServiceNotInitializedError extends RedisError {
	constructor(message: string, metadata?: any) {
		super(`Redis service not initialized: ${message}`, metadata)
	}
}

export class RedisConnectionError extends RedisError {
	constructor(message: string, metadata?: any) {
		super(`Redis connection error: ${message}`, metadata)
	}
}

export class RedisCacheError extends RedisError {
	constructor(message: string, metadata?: any) {
		super(`Redis cache error: ${message}`, metadata)
	}
}
