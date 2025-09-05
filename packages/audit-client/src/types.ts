// ============================================================================
// Comprehensive TypeScript Type Definitions and Validation
// ============================================================================

// Export all comprehensive types from the types directory
export * from './types'

// Legacy types (kept for backward compatibility)
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

// Legacy audit event types - now implemented in types/api.ts
// These are kept for backward compatibility but will be deprecated
export interface LegacyAuditEvent {
	id: string
	timestamp: string
	action: string
}

export interface LegacyCreateAuditEventInput {
	action: string
}

export interface LegacyQueryAuditEventsParams {
	// Legacy query parameters
}

export interface LegacyPaginatedAuditEvents {
	events: LegacyAuditEvent[]
}
