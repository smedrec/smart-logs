export {
	getSharedRedisConnectionWithConfig,
	getSharedRedisConnection,
	closeSharedRedisConnection,
	getRedisConnectionStatus,
} from './connection.js'

export { RedisService } from './service.js'
export type { RedisConfig, CacheOptions } from './types.js'

// Export Redis and RedisOptions types for convenience if consumers need them
export type { Redis, RedisOptions } from 'ioredis'
