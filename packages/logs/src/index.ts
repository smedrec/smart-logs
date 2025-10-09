// Core types and interfaces
export * from './types/index.js'

// Configuration management
export * from './config/index.js'

// Core logging components
export * from './core/index.js'

// Transport implementations
export * from './transports/index.js'

// Batching and queuing implementations
export { BatchManager } from './batch/batch-manager.js'
export { RetryManager } from './batch/retry-manager.js'
export { CircuitBreaker } from './batch/circuit-breaker.js'

// Utilities
export * from './utils/index.js'

// Legacy exports for backward compatibility (avoiding duplicates)
export { StructuredLogger, LoggerFactory, createRequestLogger } from './logging.js'
export * from './console.js'
