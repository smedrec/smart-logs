// Main exports for the enhanced audit client library

// Core exports
export { AuditClient } from './core/client'
export { BaseResource } from './core/base-resource'
export { ConfigManager, ConfigurationError } from './core/config'
export type {
	AuditClientConfig,
	PartialAuditClientConfig,
	AuthenticationConfig,
	RetryConfig,
	CacheConfig,
	BatchingConfig,
	PerformanceConfig,
	LoggingConfig,
	ErrorHandlingConfig,
	InterceptorConfig,
	EnvironmentConfig,
	ConfigValidationResult,
} from './core/config'

// Base resource exports
export type { RequestOptions, RequestInterceptor, ResponseInterceptor } from './core/base-resource'

// Infrastructure exports
export { AuthManager, AuthenticationError } from './infrastructure/auth'
export {
	CacheManager,
	MemoryCache,
	LocalStorageCache,
	SessionStorageCache,
} from './infrastructure/cache'
export type { CacheStorage, CacheStats } from './infrastructure/cache'
export {
	RetryManager,
	RetryExhaustedError,
	HttpError,
	CircuitBreakerOpenError,
} from './infrastructure/retry'
export type { RetryContext, RetryResult, CircuitBreakerStats } from './infrastructure/retry'
export { BatchManager } from './infrastructure/batch'
export type {
	BatchableRequest,
	BatchRequestOptions,
	BatchExecutionResult,
	BatchingStats,
} from './infrastructure/batch'
export {
	ErrorHandler,
	AuditClientError,
	NetworkError,
	TimeoutError,
	ValidationError,
	CacheError,
	BatchError,
	GenericError,
	AuthTokenRefreshStrategy,
	CacheInvalidationStrategy,
} from './infrastructure/error'
export type { ErrorContext, ErrorRecoveryStrategy, Logger } from './infrastructure/error'

// Services exports (will be implemented in later tasks)
export * from './services'

// Utils exports (will be implemented in later tasks)
export * from './utils'

// Legacy types for backward compatibility
export type {
	ClientOptions,
	PaginationParams,
	DeleteObjectResponse,
	VersionResponse,
	AuditEvent,
	CreateAuditEventInput,
	QueryAuditEventsParams,
	PaginatedAuditEvents,
} from './types'
