// Main exports for the enhanced audit client library
export * from './core'
export * from './services'
export * from './infrastructure'
export * from './utils'
export * from './types'

// Re-export the main client class for convenience
export { AuditClient } from './core/client'

// Re-export commonly used types
export type {
	AuditClientConfig,
	AuditEvent,
	CreateAuditEventInput,
	QueryAuditEventsParams,
	PaginatedAuditEvents,
} from './types'
