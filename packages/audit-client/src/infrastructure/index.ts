// Infrastructure layer exports
// This file will export all infrastructure components

export * from './auth'
export * from './cache'
export * from './retry'
export * from './batch'
export * from './logger'
export * from './plugins'

// Export streaming module with explicit re-exports to avoid naming conflicts
export {
	StreamingManager as StreamManager,
	ConnectionManager,
	StreamProcessor,
	ManagedReadableStream,
	ManagedConnection,
	DEFAULT_STREAM_CONFIG,
} from './streaming'

export type {
	StreamConfig,
	StreamEventType,
	StreamEventHandler,
	StreamMetrics,
	StreamConnectionState,
	BackpressureStrategy,
	StreamTransformer,
	StreamFilter,
	ConnectionOptions,
} from './streaming'

// Export performance module with explicit re-exports to avoid naming conflicts
export {
	StreamingManager as PerformanceStreamingManager,
	CompressionManager,
	RequestQueueManager,
	PerformanceMetricsCollector,
	RequestDeduplicationManager,
	PerformanceManager,
} from './performance'

export type { PerformanceConfig, PerformanceMetrics, RequestPerformance } from './performance'

// Export error module with explicit re-exports to avoid naming conflicts
export {
	AuditClientError,
	HttpError,
	NetworkError,
	TimeoutError,
	ValidationError,
	AuthenticationError as ErrorAuthenticationError, // Rename to avoid conflict with auth module
	ConfigurationError,
	RetryExhaustedError,
	CacheError,
	BatchError,
	GenericError,
	ErrorHandler,
	AuthTokenRefreshStrategy,
	CacheInvalidationStrategy,
} from './error'

export type { ErrorContext, ErrorRecoveryStrategy } from './error'
