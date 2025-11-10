export interface RedisConfig {
	/** Redis connection URL */
	url: string

	/** Prefix */
	keyPrefix?: string

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

export interface CacheOptions {
	ttl?: number
	namespace?: string
}
