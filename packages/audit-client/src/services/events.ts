import { BaseResource } from '../core/base-resource'
import {
	assertDefined,
	assertType,
	isAuditEvent,
	isBulkCreateResult,
	isCreateAuditEventInput,
	isExportResult,
	isIntegrityVerificationResult,
	isPaginatedAuditEvents,
} from '../utils/type-guards'
import {
	validateBulkCreateAuditEventsInput,
	validateCreateAuditEventInput,
	validateExportEventsParams,
	validateQueryAuditEventsParams,
	validateStatisticsParams,
	validateStreamEventsParams,
	validateSubscriptionParams,
	ValidationError,
} from '../utils/validation'

import type { RequestOptions } from '../core/base-resource'

/**
 * Session context information for audit events
 */
export interface SessionContext {
	sessionId: string
	ipAddress: string
	userAgent: string
	geolocation?: string
}

/**
 * Data classification levels for audit events
 */
export type DataClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI'

/**
 * Audit event status types
 */
export type AuditEventStatus = 'attempt' | 'success' | 'failure'

/**
 * Complete audit event interface
 */
export interface AuditEvent {
	id: string
	timestamp: string
	action: string
	targetResourceType: string
	targetResourceId?: string
	principalId: string
	organizationId: string
	status: AuditEventStatus
	outcomeDescription?: string
	dataClassification: DataClassification
	details?: Record<string, any>
	hash?: string
	correlationId?: string
	sessionContext?: SessionContext
}

/**
 * Input interface for creating audit events
 */
export interface CreateAuditEventInput {
	action: string
	targetResourceType: string
	targetResourceId?: string
	principalId: string
	organizationId: string
	status: AuditEventStatus
	outcomeDescription?: string
	dataClassification: DataClassification
	sessionContext?: SessionContext
	details?: Record<string, any>
}

/**
 * Bulk create input interface
 */
export interface BulkCreateAuditEventsInput {
	events: CreateAuditEventInput[]
}

/**
 * Bulk create result interface
 */
export interface BulkCreateResult {
	requestId: string
	total: number
	successful: number
	failed: number
	results: Array<{
		success: boolean
		event?: AuditEvent
		error?: string
		index: number
	}>
	processingTime: number
}

/**
 * Query parameters for audit events
 */
export interface QueryAuditEventsParams {
	filter?: {
		dateRange?: {
			startDate: string
			endDate: string
		}
		principalIds?: string[]
		organizationIds?: string[]
		actions?: string[]
		statuses?: AuditEventStatus[]
		dataClassifications?: DataClassification[]
		resourceTypes?: string[]
		verifiedOnly?: boolean
		correlationId?: string
	}
	pagination?: {
		limit?: number
		offset?: number
	}
	sort?: {
		field: 'timestamp' | 'status' | 'action'
		direction: 'asc' | 'desc'
	}
}

/**
 * Paginated audit events response
 */
export interface PaginatedAuditEvents {
	events: AuditEvent[]
	pagination: {
		total: number
		limit: number
		offset: number
		hasNext: boolean
		hasPrevious: boolean
	}
	metadata?: {
		queryTime: number
		cacheHit: boolean
		totalFiltered: number
	}
}

/**
 * Integrity verification result
 */
export interface IntegrityVerificationResult {
	eventId: string
	isValid: boolean
	verificationTimestamp: string
	hashAlgorithm: string
	computedHash: string
	storedHash: string
	details?: {
		signatureValid?: boolean
		chainIntegrity?: boolean
		timestampValid?: boolean
	}
}

/**
 * Export parameters
 */
export interface ExportEventsParams {
	filter?: QueryAuditEventsParams['filter']
	format: 'json' | 'csv' | 'xml'
	includeMetadata?: boolean
	compression?: 'gzip' | 'zip' | 'none'
	encryption?: {
		enabled: boolean
		algorithm?: string
		publicKey?: string
	}
}

/**
 * Export result
 */
export interface ExportResult {
	exportId: string
	recordCount: number
	dataSize: number
	format: string
	exportTimestamp: string
	downloadUrl?: string
	expiresAt?: string
	metadata?: {
		compression?: string
		encryption?: boolean
		checksum?: string
	}
}

/**
 * Stream parameters for large datasets
 */
export interface StreamEventsParams {
	filter?: QueryAuditEventsParams['filter']
	batchSize?: number
	format?: 'json' | 'ndjson'
}

/**
 * Subscription parameters for real-time events
 */
export interface SubscriptionParams {
	filter?: {
		actions?: string[]
		principalIds?: string[]
		organizationIds?: string[]
		resourceTypes?: string[]
		dataClassifications?: DataClassification[]
		statuses?: AuditEventStatus[]
	}
	transport?: 'websocket' | 'sse' | 'polling'
	reconnect?: boolean
	maxReconnectAttempts?: number
	heartbeatInterval?: number
}

/**
 * Event subscription interface
 */
export interface EventSubscription {
	id: string
	isConnected: boolean
	connect(): Promise<void>
	disconnect(): void
	on(event: 'message' | 'error' | 'connect' | 'disconnect', handler: (data?: any) => void): void
	off(event: 'message' | 'error' | 'connect' | 'disconnect', handler: (data?: any) => void): void
	updateFilter(filter: SubscriptionParams['filter']): void
}

/**
 * Real-time event subscription implementation
 */
class EventSubscriptionImpl implements EventSubscription {
	public readonly id: string
	public isConnected: boolean = false

	private connection: WebSocket | EventSource | null = null
	private eventHandlers: Map<string, Set<Function>> = new Map()
	private reconnectAttempts: number = 0
	private heartbeatTimer: NodeJS.Timeout | null = null

	constructor(
		private baseUrl: string,
		private params: SubscriptionParams,
		private authManager: any
	) {
		this.id = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
		this.initializeEventHandlers()
	}

	private initializeEventHandlers(): void {
		this.eventHandlers.set('message', new Set())
		this.eventHandlers.set('error', new Set())
		this.eventHandlers.set('connect', new Set())
		this.eventHandlers.set('disconnect', new Set())
	}

	async connect(): Promise<void> {
		if (this.isConnected) {
			return
		}

		try {
			const authHeaders = await this.authManager.getAuthHeaders()
			const transport = this.params.transport || 'websocket'

			if (transport === 'websocket') {
				await this.connectWebSocket(authHeaders)
			} else {
				await this.connectSSE(authHeaders)
			}

			this.isConnected = true
			this.reconnectAttempts = 0
			this.startHeartbeat()
			this.emit('connect')
		} catch (error) {
			this.emit('error', error)
			if (this.params.reconnect && this.shouldReconnect()) {
				setTimeout(() => this.connect(), this.getReconnectDelay())
			}
		}
	}

	private async connectWebSocket(authHeaders: Record<string, string>): Promise<void> {
		const wsUrl = this.baseUrl.replace(/^https?/, 'wss').replace(/^http/, 'ws')
		const url = new URL(`${wsUrl}/api/v1/audit/events/subscribe`)

		// Add filter parameters to URL
		if (this.params.filter) {
			Object.entries(this.params.filter).forEach(([key, value]) => {
				if (Array.isArray(value)) {
					url.searchParams.set(key, value.join(','))
				} else if (value) {
					url.searchParams.set(key, String(value))
				}
			})
		}

		this.connection = new WebSocket(url.toString())

		this.connection.onopen = () => {
			this.isConnected = true
		}

		this.connection.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data)
				this.emit('message', data)
			} catch (error) {
				this.emit('error', new Error('Failed to parse WebSocket message'))
			}
		}

		this.connection.onerror = (error) => {
			this.emit('error', error)
		}

		this.connection.onclose = () => {
			this.isConnected = false
			this.emit('disconnect')
			if (this.params.reconnect && this.shouldReconnect()) {
				setTimeout(() => this.connect(), this.getReconnectDelay())
			}
		}
	}

	private async connectSSE(authHeaders: Record<string, string>): Promise<void> {
		const url = new URL(`${this.baseUrl}/api/v1/audit/events/subscribe`)

		// Add filter parameters to URL
		if (this.params.filter) {
			Object.entries(this.params.filter).forEach(([key, value]) => {
				if (Array.isArray(value)) {
					url.searchParams.set(key, value.join(','))
				} else if (value) {
					url.searchParams.set(key, String(value))
				}
			})
		}

		// Note: EventSource doesn't support custom headers in browsers
		// This would need server-side support for auth via query params or cookies
		this.connection = new EventSource(url.toString())

		this.connection.onopen = () => {
			this.isConnected = true
		}

		this.connection.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data)
				this.emit('message', data)
			} catch (error) {
				this.emit('error', new Error('Failed to parse SSE message'))
			}
		}

		this.connection.onerror = (error) => {
			this.emit('error', error)
			this.isConnected = false
			this.emit('disconnect')
			if (this.params.reconnect && this.shouldReconnect()) {
				setTimeout(() => this.connect(), this.getReconnectDelay())
			}
		}
	}

	disconnect(): void {
		if (this.connection) {
			if (this.connection instanceof WebSocket) {
				this.connection.close()
			} else if (this.connection instanceof EventSource) {
				this.connection.close()
			}
			this.connection = null
		}

		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer)
			this.heartbeatTimer = null
		}

		this.isConnected = false
		this.emit('disconnect')
	}

	on(event: 'message' | 'error' | 'connect' | 'disconnect', handler: (data?: any) => void): void {
		const handlers = this.eventHandlers.get(event)
		if (handlers) {
			handlers.add(handler)
		}
	}

	off(event: 'message' | 'error' | 'connect' | 'disconnect', handler: (data?: any) => void): void {
		const handlers = this.eventHandlers.get(event)
		if (handlers) {
			handlers.delete(handler)
		}
	}

	updateFilter(filter: SubscriptionParams['filter']): void {
		if (filter) {
			this.params.filter = filter
		}
		if (this.isConnected) {
			// Reconnect with new filter
			this.disconnect()
			setTimeout(() => this.connect(), 100)
		}
	}

	private emit(event: string, data?: any): void {
		const handlers = this.eventHandlers.get(event)
		if (handlers) {
			handlers.forEach((handler) => {
				try {
					handler(data)
				} catch (error) {
					console.error(`Error in event handler for ${event}:`, error)
				}
			})
		}
	}

	private shouldReconnect(): boolean {
		const maxAttempts = this.params.maxReconnectAttempts || 5
		return this.reconnectAttempts < maxAttempts
	}

	private getReconnectDelay(): number {
		// Exponential backoff with jitter
		const baseDelay = 1000
		const maxDelay = 30000
		const delay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts), maxDelay)
		const jitter = Math.random() * 0.1 * delay
		this.reconnectAttempts++
		return delay + jitter
	}

	private startHeartbeat(): void {
		const interval = this.params.heartbeatInterval || 30000
		this.heartbeatTimer = setInterval(() => {
			if (this.connection instanceof WebSocket && this.connection.readyState === WebSocket.OPEN) {
				this.connection.send(JSON.stringify({ type: 'ping' }))
			}
		}, interval)
	}
}

/**
 * Comprehensive Events Service for audit event management
 *
 * Provides complete audit event operations including:
 * - Creating single and bulk audit events
 * - Querying with advanced filtering and pagination
 * - Retrieving specific events by ID
 * - Verifying event integrity
 * - Exporting events with multiple formats
 * - Streaming large datasets
 * - Real-time event subscriptions
 */
export class EventsService extends BaseResource {
	/**
	 * Create a single audit event
	 *
	 * @param event - The audit event data to create
	 * @returns Promise resolving to the created audit event
	 *
	 * Requirements: 4.1 - WHEN creating audit events THEN the client SHALL validate event data and submit to the server API
	 */
	async create(event: CreateAuditEventInput): Promise<AuditEvent> {
		// Validate input data
		const validationResult = validateCreateAuditEventInput(event)
		if (!validationResult.success) {
			throw new ValidationError('Invalid audit event data', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const response = await this.request<AuditEvent>('/audit/events', {
			method: 'POST',
			body: validationResult.data,
		})

		// Validate response
		assertType(response, isAuditEvent, 'Invalid audit event response from server')
		return response
	}

	/**
	 * Create multiple audit events in a single request
	 *
	 * @param events - Array of audit events to create
	 * @returns Promise resolving to bulk creation result
	 *
	 * Requirements: 4.1 - WHEN creating audit events THEN the client SHALL validate event data and submit to the server API
	 */
	async bulkCreate(events: CreateAuditEventInput[]): Promise<BulkCreateResult> {
		// Validate input data
		const bulkInput = { events }
		const validationResult = validateBulkCreateAuditEventsInput(bulkInput)
		if (!validationResult.success) {
			throw new ValidationError('Invalid bulk create input', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const response = await this.request<BulkCreateResult>('/audit/events/bulk', {
			method: 'POST',
			body: validationResult.data,
		})

		// Validate response
		assertType(response, isBulkCreateResult, 'Invalid bulk create result from server')
		return response
	}

	/**
	 * Query audit events with advanced filtering, pagination, and sorting
	 *
	 * @param params - Query parameters including filters, pagination, and sorting
	 * @returns Promise resolving to paginated audit events
	 *
	 * Requirements: 4.2 - WHEN querying audit events THEN the client SHALL support filtering, pagination, and sorting options
	 * Requirements: 4.5 - WHEN handling large result sets THEN the client SHALL support pagination and streaming responses
	 */
	async query(params: QueryAuditEventsParams = {}): Promise<PaginatedAuditEvents> {
		// Validate input parameters
		const validationResult = validateQueryAuditEventsParams(params)
		if (!validationResult.success) {
			throw new ValidationError('Invalid query parameters', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const validatedParams = validationResult.data!
		const queryParams: Record<string, any> = {}

		// Handle date range filter
		if (validatedParams.filter?.dateRange) {
			queryParams.startDate = validatedParams.filter.dateRange.startDate
			queryParams.endDate = validatedParams.filter.dateRange.endDate
		}

		// Handle array filters
		if (validatedParams.filter?.principalIds?.length) {
			queryParams.principalIds = validatedParams.filter.principalIds.join(',')
		}
		if (validatedParams.filter?.organizationIds?.length) {
			queryParams.organizationIds = validatedParams.filter.organizationIds.join(',')
		}
		if (validatedParams.filter?.actions?.length) {
			queryParams.actions = validatedParams.filter.actions.join(',')
		}
		if (validatedParams.filter?.statuses?.length) {
			queryParams.statuses = validatedParams.filter.statuses.join(',')
		}
		if (validatedParams.filter?.dataClassifications?.length) {
			queryParams.dataClassifications = validatedParams.filter.dataClassifications.join(',')
		}
		if (validatedParams.filter?.resourceTypes?.length) {
			queryParams.resourceTypes = validatedParams.filter.resourceTypes.join(',')
		}

		// Handle boolean filters
		if (validatedParams.filter?.verifiedOnly !== undefined) {
			queryParams.verifiedOnly = validatedParams.filter.verifiedOnly.toString()
		}

		// Handle correlation ID filter
		if (validatedParams.filter?.correlationId) {
			queryParams.correlationId = validatedParams.filter.correlationId
		}

		// Handle pagination
		if (validatedParams.pagination?.limit !== undefined) {
			queryParams.limit = validatedParams.pagination.limit.toString()
		}
		if (validatedParams.pagination?.offset !== undefined) {
			queryParams.offset = validatedParams.pagination.offset.toString()
		}

		// Handle sorting
		if (validatedParams.sort?.field) {
			queryParams.sortField = validatedParams.sort.field
		}
		if (validatedParams.sort?.direction) {
			queryParams.sortDirection = validatedParams.sort.direction
		}

		const response = await this.request<PaginatedAuditEvents>('/audit/events', {
			method: 'GET',
			query: queryParams,
		})

		// Validate response
		assertType(
			response,
			isPaginatedAuditEvents,
			'Invalid paginated audit events response from server'
		)
		return response
	}

	/**
	 * Get a specific audit event by ID
	 *
	 * @param id - The audit event ID
	 * @returns Promise resolving to the audit event or null if not found
	 *
	 * Requirements: 4.3 - WHEN retrieving specific events THEN the client SHALL provide methods to get events by ID
	 */
	async getById(id: string): Promise<AuditEvent | null> {
		try {
			return await this.request<AuditEvent>(`/audit/events/${id}`)
		} catch (error: any) {
			// Return null for 404 errors, re-throw others
			if (error?.status === 404 || error?.code === 'NOT_FOUND') {
				return null
			}
			throw error
		}
	}

	/**
	 * Verify the cryptographic integrity of an audit event
	 *
	 * @param id - The audit event ID to verify
	 * @returns Promise resolving to integrity verification result
	 *
	 * Requirements: 4.4 - WHEN verifying event integrity THEN the client SHALL provide cryptographic verification methods
	 */
	async verify(id: string): Promise<IntegrityVerificationResult> {
		// Validate input
		assertDefined(id, 'Event ID is required for verification')
		if (typeof id !== 'string' || id.trim().length === 0) {
			throw new ValidationError('Event ID must be a non-empty string')
		}

		const response = await this.request<IntegrityVerificationResult>(`/audit/events/${id}/verify`, {
			method: 'POST',
		})

		// Validate response
		assertType(
			response,
			isIntegrityVerificationResult,
			'Invalid integrity verification result from server'
		)
		return response
	}

	/**
	 * Export audit events in various formats
	 *
	 * @param params - Export parameters including filters and format options
	 * @returns Promise resolving to export result with download information
	 *
	 * Requirements: 4.5 - WHEN handling large result sets THEN the client SHALL support pagination and streaming responses
	 */
	async export(params: ExportEventsParams): Promise<ExportResult> {
		// Validate input parameters
		const validationResult = validateExportEventsParams(params)
		if (!validationResult.success) {
			throw new ValidationError('Invalid export parameters', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const response = await this.request<ExportResult>('/audit/events/export', {
			method: 'POST',
			body: validationResult.data,
		})

		// Validate response
		assertType(response, isExportResult, 'Invalid export result from server')
		return response
	}

	/**
	 * Stream audit events for large datasets
	 *
	 * @param params - Stream parameters including filters and batch size
	 * @returns Promise resolving to a readable stream of audit events
	 *
	 * Requirements: 4.5 - WHEN handling large result sets THEN the client SHALL support pagination and streaming responses
	 */
	async stream(params: StreamEventsParams): Promise<ReadableStream<AuditEvent>> {
		// Validate input parameters
		const validationResult = validateStreamEventsParams(params)
		if (!validationResult.success) {
			throw new ValidationError('Invalid stream parameters', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const validatedParams = validationResult.data!
		const queryParams: Record<string, any> = {}

		// Handle filters similar to query method
		if (validatedParams.filter?.dateRange) {
			queryParams.startDate = validatedParams.filter.dateRange.startDate
			queryParams.endDate = validatedParams.filter.dateRange.endDate
		}

		if (validatedParams.filter?.principalIds?.length) {
			queryParams.principalIds = validatedParams.filter.principalIds.join(',')
		}
		if (validatedParams.filter?.organizationIds?.length) {
			queryParams.organizationIds = validatedParams.filter.organizationIds.join(',')
		}
		if (validatedParams.filter?.actions?.length) {
			queryParams.actions = validatedParams.filter.actions.join(',')
		}
		if (validatedParams.filter?.statuses?.length) {
			queryParams.statuses = validatedParams.filter.statuses.join(',')
		}
		if (validatedParams.filter?.dataClassifications?.length) {
			queryParams.dataClassifications = validatedParams.filter.dataClassifications.join(',')
		}
		if (validatedParams.filter?.resourceTypes?.length) {
			queryParams.resourceTypes = validatedParams.filter.resourceTypes.join(',')
		}

		if (validatedParams.filter?.verifiedOnly !== undefined) {
			queryParams.verifiedOnly = validatedParams.filter.verifiedOnly.toString()
		}
		if (validatedParams.filter?.correlationId) {
			queryParams.correlationId = validatedParams.filter.correlationId
		}

		// Handle stream-specific parameters
		if (validatedParams.batchSize) {
			queryParams.batchSize = validatedParams.batchSize.toString()
		}
		if (validatedParams.format) {
			queryParams.format = validatedParams.format
		}

		return this.request<ReadableStream<AuditEvent>>('/audit/events/stream', {
			method: 'GET',
			query: queryParams,
			responseType: 'stream',
		})
	}

	/**
	 * Subscribe to real-time audit events using WebSocket or Server-Sent Events
	 *
	 * @param params - Subscription parameters including filters and transport options
	 * @returns EventSubscription instance for managing the real-time connection
	 *
	 * Requirements: 4.5 - Real-time event subscription capabilities
	 */
	subscribe(params: SubscriptionParams): EventSubscription {
		// Validate input parameters
		const validationResult = validateSubscriptionParams(params)
		if (!validationResult.success) {
			throw new ValidationError('Invalid subscription parameters', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const validatedData = validationResult.data!

		// Create clean params object that only includes defined properties
		const cleanParams: SubscriptionParams = {}

		if (validatedData.filter) {
			const filter: SubscriptionParams['filter'] = {}
			if (validatedData.filter.actions) filter.actions = validatedData.filter.actions
			if (validatedData.filter.principalIds) filter.principalIds = validatedData.filter.principalIds
			if (validatedData.filter.organizationIds)
				filter.organizationIds = validatedData.filter.organizationIds
			if (validatedData.filter.resourceTypes)
				filter.resourceTypes = validatedData.filter.resourceTypes
			if (validatedData.filter.dataClassifications)
				filter.dataClassifications = validatedData.filter.dataClassifications
			if (validatedData.filter.statuses) filter.statuses = validatedData.filter.statuses

			// Only add filter if it has properties
			if (Object.keys(filter).length > 0) {
				cleanParams.filter = filter
			}
		}

		if (validatedData.transport) cleanParams.transport = validatedData.transport
		if (validatedData.reconnect !== undefined) cleanParams.reconnect = validatedData.reconnect
		if (validatedData.maxReconnectAttempts !== undefined)
			cleanParams.maxReconnectAttempts = validatedData.maxReconnectAttempts
		if (validatedData.heartbeatInterval !== undefined)
			cleanParams.heartbeatInterval = validatedData.heartbeatInterval

		return new EventSubscriptionImpl(this.config.baseUrl, cleanParams, this.authManager)
	}

	/**
	 * Download an exported audit events file
	 *
	 * @param exportId - The export ID from a previous export request
	 * @param format - The desired download format
	 * @returns Promise resolving to the file blob
	 */
	async downloadExport(exportId: string, format: 'json' | 'csv' | 'xml' = 'json'): Promise<Blob> {
		return this.request<Blob>(`/audit/events/exports/${exportId}/download`, {
			method: 'GET',
			query: { format },
			responseType: 'blob',
		})
	}

	/**
	 * Get the status of an export request
	 *
	 * @param exportId - The export ID to check
	 * @returns Promise resolving to export status information
	 */
	async getExportStatus(exportId: string): Promise<{
		id: string
		status: 'pending' | 'processing' | 'completed' | 'failed'
		progress?: number
		recordCount?: number
		error?: string
		completedAt?: string
		expiresAt?: string
	}> {
		return this.request(`/audit/events/exports/${exportId}/status`)
	}

	/**
	 * Cancel an ongoing export request
	 *
	 * @param exportId - The export ID to cancel
	 * @returns Promise resolving when cancellation is complete
	 */
	async cancelExport(exportId: string): Promise<void> {
		await this.request<void>(`/audit/events/exports/${exportId}/cancel`, {
			method: 'POST',
		})
	}

	/**
	 * Get audit event statistics for a given time period
	 *
	 * @param params - Parameters for statistics query
	 * @returns Promise resolving to audit event statistics
	 */
	async getStatistics(params: {
		dateRange: { startDate: string; endDate: string }
		groupBy?: 'hour' | 'day' | 'week' | 'month'
		filters?: QueryAuditEventsParams['filter']
	}): Promise<{
		totalEvents: number
		eventsByStatus: Record<AuditEventStatus, number>
		eventsByAction: Record<string, number>
		eventsByDataClassification: Record<DataClassification, number>
		timeline?: Array<{
			timestamp: string
			count: number
		}>
	}> {
		// Validate input parameters
		const validationResult = validateStatisticsParams(params)
		if (!validationResult.success) {
			throw new ValidationError('Invalid statistics parameters', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const validatedParams = validationResult.data!
		const queryParams: Record<string, any> = {
			startDate: validatedParams.dateRange.startDate,
			endDate: validatedParams.dateRange.endDate,
		}

		if (validatedParams.groupBy) {
			queryParams.groupBy = validatedParams.groupBy
		}

		// Add filters if provided
		if (validatedParams.filters) {
			if (validatedParams.filters.principalIds?.length) {
				queryParams.principalIds = validatedParams.filters.principalIds.join(',')
			}
			if (validatedParams.filters.organizationIds?.length) {
				queryParams.organizationIds = validatedParams.filters.organizationIds.join(',')
			}
			if (validatedParams.filters.actions?.length) {
				queryParams.actions = validatedParams.filters.actions.join(',')
			}
			if (validatedParams.filters.resourceTypes?.length) {
				queryParams.resourceTypes = validatedParams.filters.resourceTypes.join(',')
			}
		}

		return this.request('/audit/events/statistics', {
			method: 'GET',
			query: queryParams,
		})
	}
}
