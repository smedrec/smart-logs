// Infrastructure layer exports
// This file will export all infrastructure components

export * from './auth'
export * from './cache'
export * from './retry'
export * from './batch'
export * from './logger'
export * from './plugins'

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
