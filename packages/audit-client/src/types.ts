// Legacy types (will be enhanced in later tasks)
export interface ClientOptions {
	/** Base URL for API requests */
	baseUrl: string
	/** API key for authentication */
	apiKey?: string
	/** API version to use (default: 'v1') */
	version?: string
	/** Number of retry attempts for failed requests */
	retries?: number
	/** Initial backoff time in milliseconds between retries */
	backoffMs?: number
	/** Maximum backoff time in milliseconds between retries */
	maxBackoffMs?: number
	/** Custom headers to include with requests */
	headers?: Record<string, string>
	/** Abort signal for request */
	abortSignal?: AbortSignal
}

export interface RequestOptions {
	method?: string
	headers?: Record<string, string>
	body?: any
	credentials?: string
	stream?: boolean
	signal?: AbortSignal
}

interface Pagination {
	current: number
	pageSize: number
	totalPages: number
	count: number
}

export interface PaginationParams {
	limit?: number
	offset?: number
}

export interface DeleteObjectResponse {
	message: string
	success: boolean
}

export interface VersionResponse {
	version: string
}

// Enhanced types - Configuration types are now implemented in core/config.ts
// Re-export the main configuration types for convenience
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

// Re-export cache-related types for convenience
export type { CacheStorage, CacheStats } from './infrastructure/cache'

export interface AuditEvent {
	id: string
	timestamp: string
	action: string
	// More fields will be added in task 17
}

export interface CreateAuditEventInput {
	action: string
	// More fields will be added in task 17
}

export interface QueryAuditEventsParams {
	// Query parameters will be added in task 17
}

export interface PaginatedAuditEvents {
	events: AuditEvent[]
	// Pagination info will be added in task 17
}
