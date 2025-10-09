// Core implementations
export { StructuredLogger } from './structured-logger.js'
export { CorrelationManager } from './correlation-manager.js'

// Async operation handling components
export { DefaultBatchManager } from './batch-manager.js'
export { DefaultRetryManager } from './retry-manager.js'
export { DefaultCircuitBreaker } from './circuit-breaker.js'

// Graceful shutdown and resource management
export {
	ShutdownManager,
	getShutdownManager,
	registerForShutdown,
	gracefulShutdown,
	type ShutdownConfig,
	type ShutdownResource,
} from './shutdown-manager.js'

export {
	ResourceManager,
	getResourceManager,
	registerResource,
	unregisterResource,
	shouldApplyBackpressure,
	type ResourceConfig,
	type ManagedResource,
	type MemoryStats,
} from './resource-manager.js'

export {
	MemoryAwareQueue,
	createMemoryAwareQueue,
	type QueueConfig,
	type QueueItem,
} from './memory-aware-queue.js'
