// Core type definitions and interfaces
export * from './logger.js'
export { LogLevel, LogLevelUtils } from './logger.js'
export * from './transport.js'
export * from './log-entry.js'

// Configuration types (avoiding duplicates)
export type {
	LoggingConfig,
	ConsoleConfig,
	FileConfig,
	OTLPConfig,
	RedisConfig,
	PerformanceConfig,
} from './config.js'
export { ConfigValidator, LoggingConfigSchema } from './config.js'

// Batch types (avoiding duplicates)
export type {
	BatchManager,
	RetryManager,
	CircuitBreaker,
	CircuitBreakerConfig,
	BatchConfig,
	RetryConfig,
} from './batch.js'

// Error handling types
export type {
	ErrorMetrics,
	ErrorContext,
	CategorizedError,
	ErrorRecoveryResult,
	ErrorHandlerConfig,
	ErrorHandler as IErrorHandler,
	AlertingProvider,
} from './error.js'
export { ErrorCategory, ErrorSeverity, RecoveryStrategy } from './error.js'
