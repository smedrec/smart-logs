import Redis from 'ioredis'

import type { Redis as RedisClientType, RedisOptions } from 'ioredis'

interface RedisConfig {
	/** Redis connection URL */
	url: string

	/** Connection timeout in milliseconds */
	connectTimeout: number

	/** Command timeout in milliseconds */
	commandTimeout: number

	/** Maximum number of retries */
	maxRetriesPerRequest: number | null

	/** Retry delay on failure */
	retryDelayOnFailover: number

	/** Enable offline queue */
	enableOfflineQueue: boolean

	/** Enable auto pipelining */
	enableAutoPipelining: boolean
}

/**
 * Default Redis connection options.
 * These can be overridden by options provided to `getSharedRedisConnection`.
 */
const DEFAULT_REDIS_OPTIONS: RedisOptions = {
	maxRetriesPerRequest: null, // Important for BullMQ, means commands are not retried by ioredis itself.
	enableAutoPipelining: true,
	// Add a default connection timeout to prevent hanging indefinitely
	// if Redis is unavailable during initial connection.
	connectTimeout: 10000, // 10 seconds
}

export class RedisCache {
	private redis: RedisClientType | null = null
	private prefix: string
	private defaultTTL: number
	private config: RedisConfig | undefined

	constructor(prefix: string, defaultTTL: number = 30 * 60, config?: RedisConfig) {
		this.prefix = prefix
		this.defaultTTL = defaultTTL
		this.config = config
	}

	private async getRedisClient(): Promise<RedisClientType> {
		if (this.redis) {
			return this.redis
		}

		// Create new connection with your proven solution
		const redisUrl = this.config?.url || process.env.REDIS_URL

		if (!redisUrl) {
			throw new Error('REDIS_URL environment variable is required')
		}

		const connectionOptions: RedisOptions = {
			...DEFAULT_REDIS_OPTIONS,
			...this.config,
		}

		this.redis = new Redis(redisUrl, connectionOptions)

		// Event listeners from your proven solution
		this.redis.on('error', (err) => {
			console.error(`Redis error for ${this.prefix} cache:`, err)
		})

		//await this.redis.connect()
		return this.redis
	}

	private parseValue<T>(value: string | null): T | undefined {
		if (!value) return undefined

		try {
			return JSON.parse(value) as T
		} catch {
			// If parsing fails, return the raw string (for backwards compatibility)
			return value as unknown as T
		}
	}

	private stringifyValue(value: any): string {
		if (typeof value === 'string') {
			return value
		}

		return JSON.stringify(value)
	}

	private getKey(key: string): string {
		return `${this.prefix}:${key}`
	}

	async get<T>(key: string): Promise<T | undefined> {
		try {
			const redis = await this.getRedisClient()
			const value = await redis.get(this.getKey(key))
			return this.parseValue<T>(value)
		} catch (error) {
			console.error(`Redis get error for ${this.prefix} cache, key "${key}":`, error)
			// Reset connection on error to force reconnection next time
			this.redis = null
			return undefined
		}
	}

	async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
		try {
			const redis = await this.getRedisClient()
			const serializedValue = this.stringifyValue(value)
			const redisKey = this.getKey(key)
			const ttl = ttlSeconds ?? this.defaultTTL

			await redis.set(redisKey, serializedValue)
			if (ttl > 0) {
				await redis.expire(redisKey, ttl)
			}
		} catch (error) {
			console.error(`Redis set error for ${this.prefix} cache, key "${key}":`, error)
			// Reset connection on error
			this.redis = null
		}
	}

	async delete(key: string): Promise<void> {
		try {
			const redis = await this.getRedisClient()
			await redis.del(this.getKey(key))
		} catch (error) {
			console.error(`Redis delete error for ${this.prefix} cache, key "${key}":`, error)
			// Reset connection on error
			this.redis = null
		}
	}

	async healthCheck(): Promise<void> {
		try {
			const redis = await this.getRedisClient()
			await redis.ping()
		} catch (error) {
			// Reset connection state on health check failure
			if (this.redis) {
				await this.redis.quit()
				this.redis = null
			}
			throw new Error(`Redis health check failed: ${error}`)
		}
	}
}
