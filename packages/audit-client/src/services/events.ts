import { BaseResource } from '../core/base-resource'
import {
	ConnectionOptions,
	ManagedConnection,
	ManagedReadableStream,
	StreamConfig,
	StreamingManager,
	StreamMetrics,
} from '../infrastructure/streaming'
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

import type {
	AuditEvent,
	AuditEventStatus,
	BulkCreateResult,
	CreateAuditEventInput,
	CreateAuditEventOptions,
	DataClassification,
	ExportEventsParams,
	ExportResult,
	IntegrityVerificationResult,
	PaginatedAuditEvents,
	QueryAuditEventsParams,
	StreamEventsParams,
	SubscriptionParams,
} from '@/types/api'
import type { RequestOptions } from '../core/base-resource'

/**
 * Enhanced event subscription interface with streaming capabilities
 */
export interface EventSubscription {
	id: string
	isConnected: boolean
	connect(): Promise<void>
	disconnect(): void
	on(event: 'message' | 'error' | 'connect' | 'disconnect', handler: (data?: any) => void): void
	off(event: 'message' | 'error' | 'connect' | 'disconnect', handler: (data?: any) => void): void
	updateFilter(filter: SubscriptionParams['filter']): void
	getMetrics(): StreamMetrics | null
	send(data: any): boolean
	cleanup(): void
	destroy(): void
}

/**
 * Enhanced real-time event subscription implementation using streaming infrastructure
 */
class EventSubscriptionImpl implements EventSubscription {
	public readonly id: string
	public isConnected: boolean = false

	private managedConnection: ManagedConnection | null = null
	private streamingManager: StreamingManager
	private eventHandlers: Map<string, Set<Function>> = new Map()

	constructor(
		private baseUrl: string,
		private params: SubscriptionParams,
		private authManager: any
	) {
		this.id = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
		this.streamingManager = new StreamingManager({
			maxReconnectAttempts: params.maxReconnectAttempts || 5,
			reconnectDelay: 1000,
			reconnectBackoffMultiplier: 2,
			maxReconnectDelay: 30000,
			heartbeatInterval: params.heartbeatInterval || 30000,
		})
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

			// Build connection URL with filters
			const url = this.buildConnectionUrl()

			// Create connection options
			const connectionOptions: ConnectionOptions = {
				headers: authHeaders,
				reconnect: this.params.reconnect !== false,
				maxReconnectAttempts: this.params.maxReconnectAttempts || 5,
				heartbeatInterval: this.params.heartbeatInterval || 30000,
			}

			// Create managed connection
			this.managedConnection = await this.streamingManager.createRealtimeConnection(
				this.id,
				url,
				transport,
				connectionOptions
			)

			// Set up event handlers
			this.setupConnectionHandlers()

			// Connect
			await this.managedConnection.connect()
			this.isConnected = true
			this.emit('connect')
		} catch (error) {
			this.emit('error', error)
		}
	}

	private buildConnectionUrl(): string {
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

		return url.toString()
	}

	private setupConnectionHandlers(): void {
		if (!this.managedConnection) return

		this.managedConnection.on('connect', () => {
			this.isConnected = true
			this.emit('connect')
		})

		this.managedConnection.on('disconnect', () => {
			this.isConnected = false
			this.emit('disconnect')
		})

		this.managedConnection.on('data', (_, data) => {
			this.emit('message', data)
		})

		this.managedConnection.on('error', (_, error) => {
			this.emit('error', error)
		})

		this.managedConnection.on('reconnect', (_, data) => {
			// Connection is automatically handled by ManagedConnection
		})
	}

	disconnect(): void {
		if (this.managedConnection) {
			this.managedConnection.disconnect()
			this.managedConnection = null
		}

		this.isConnected = false
		this.emit('disconnect')
	}

	/**
	 * Clean up all event handlers to prevent memory leaks
	 * This method clears all registered event handlers without disconnecting
	 */
	cleanup(): void {
		// Clear all event handlers
		this.eventHandlers.forEach((handlers) => handlers.clear())
		this.eventHandlers.clear()
	}

	/**
	 * Completely destroy the subscription and release all resources
	 * This includes disconnecting and cleaning up all event handlers
	 */
	destroy(): void {
		// Disconnect if still connected
		this.disconnect()

		// Clean up all event handlers
		this.cleanup()

		// Clear the streaming manager reference
		this.streamingManager = null as any
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
		if (this.isConnected && this.managedConnection) {
			// Reconnect with new filter
			this.disconnect()
			setTimeout(() => this.connect(), 100)
		}
	}

	/**
	 * Get connection metrics
	 */
	getMetrics(): StreamMetrics | null {
		return this.managedConnection?.getMetrics() || null
	}

	/**
	 * Send data through the connection (WebSocket only)
	 */
	send(data: any): boolean {
		if (!this.managedConnection || !this.isConnected) {
			return false
		}

		const message = typeof data === 'string' ? data : JSON.stringify(data)
		return this.managedConnection.send(message)
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
 * - Streaming large datasets with backpressure management
 * - Real-time event subscriptions with enhanced connection management
 */
export class EventsService extends BaseResource {
	private streamingManager: StreamingManager
	private activeSubscriptions: Set<EventSubscription> = new Set()

	constructor(config: any, logger?: any, performanceMonitor?: any) {
		super(config, logger, performanceMonitor)
		this.streamingManager = new StreamingManager(
			{
				enableCompression: config.performance?.enableCompression || true,
				maxConcurrentStreams: config.performance?.maxConcurrentRequests || 10,
				chunkSize: 8192,
				batchSize: 100,
				enableMetrics: true,
			},
			logger
		)
	}
	/**
	 * Create a single audit event
	 *
	 * @param event - The audit event data to create
	 * @returns Promise resolving to the created audit event
	 *
	 * Requirements: 4.1 - WHEN creating audit events THEN the client SHALL validate event data and submit to the server API
	 */
	async create(
		event: CreateAuditEventInput,
		options: CreateAuditEventOptions = {}
	): Promise<AuditEvent> {
		// Validate input data
		const validationResult = validateCreateAuditEventInput(event)
		if (!validationResult.success) {
			throw new ValidationError('Invalid audit event data', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const response = await this.request<AuditEvent>('/audit/events', {
			method: 'POST',
			body: { eventData: validationResult.data, options },
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
	 * Stream audit events for large datasets with enhanced backpressure management
	 *
	 * @param params - Stream parameters including filters and batch size
	 * @returns Promise resolving to a managed readable stream of audit events
	 *
	 * Requirements: 4.5 - WHEN handling large result sets THEN the client SHALL support pagination and streaming responses
	 */
	async stream(params: StreamEventsParams): Promise<ManagedReadableStream<AuditEvent>> {
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

		// Create enhanced streaming source
		const streamSource: UnderlyingDefaultSource<AuditEvent> = {
			start: async (controller) => {
				try {
					// Get the raw stream from the server
					const rawStream = await this.request<ReadableStream<Uint8Array>>('/audit/events/stream', {
						method: 'GET',
						query: queryParams,
						responseType: 'stream',
					})

					// Process the stream with proper parsing and error handling
					const reader = rawStream.getReader()
					const decoder = new TextDecoder()
					let buffer = ''

					const processChunk = async () => {
						try {
							const { done, value } = await reader.read()

							if (done) {
								// Process any remaining data in buffer
								if (buffer.trim()) {
									try {
										const event = JSON.parse(buffer.trim()) as AuditEvent
										controller.enqueue(event)
									} catch (error) {
										this.logger.warn('Failed to parse final buffer chunk', { buffer, error })
									}
								}
								controller.close()
								return
							}

							// Decode chunk and add to buffer
							buffer += decoder.decode(value, { stream: true })

							// Process complete lines (assuming NDJSON format)
							const lines = buffer.split('\n')
							buffer = lines.pop() || '' // Keep incomplete line in buffer

							for (const line of lines) {
								if (line.trim()) {
									try {
										const event = JSON.parse(line.trim()) as AuditEvent
										controller.enqueue(event)
									} catch (error) {
										this.logger.warn('Failed to parse stream line', { line, error })
									}
								}
							}

							// Continue processing
							processChunk()
						} catch (error) {
							controller.error(error)
						}
					}

					// Start processing
					processChunk()
				} catch (error) {
					controller.error(error)
				}
			},
		}

		// Create managed stream with enhanced features
		const managedStream = this.streamingManager.createExportStream(streamSource, {
			batchSize: validatedParams.batchSize || 100,
			enableCompression: this.config.performance?.enableCompression || false,
			enableMetrics: true,
		})

		// Add stream transformers if needed
		if (validatedParams.format === 'json') {
			// Already in JSON format, no transformation needed
			return managedStream
		}

		// For other formats, we could add transformers here
		return managedStream
	}

	/**
	 * Subscribe to real-time audit events using enhanced WebSocket or Server-Sent Events
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
		const cleanParams: SubscriptionParams = {
			bufferSize: 0,
			compression: false,
			transport: 'websocket',
			reconnect: false,
			maxReconnectAttempts: 0,
			heartbeatInterval: 0,
		}

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

		const subscription = new EventSubscriptionImpl(
			this.config.baseUrl,
			cleanParams,
			this.authManager
		)

		// Track the subscription
		this.activeSubscriptions.add(subscription)

		// Set up automatic cleanup when subscription disconnects
		subscription.on('disconnect', () => {
			this.activeSubscriptions.delete(subscription)
		})

		return subscription
	}

	/**
	 * Get streaming and connection metrics
	 *
	 * @returns Current streaming metrics including connection stats and performance data
	 */
	getStreamingMetrics(): {
		connections: StreamMetrics
		totalConnections: number
		activeConnections: number
	} {
		return this.streamingManager.getMetrics()
	}

	/**
	 * Create a custom stream processor for advanced streaming scenarios
	 *
	 * @param source - Custom stream source
	 * @param config - Stream configuration options
	 * @returns Managed readable stream with enhanced capabilities
	 */
	createCustomStream<T>(
		source: UnderlyingDefaultSource<T>,
		config: Partial<StreamConfig> = {}
	): ManagedReadableStream<T> {
		return this.streamingManager.createExportStream(source, config)
	}

	/**
	 * Cleanup streaming resources
	 */
	async destroyStreaming(): Promise<void> {
		await this.streamingManager.destroy()
	}

	/**
	 * Get all active subscriptions
	 * @returns Array of active subscription instances
	 */
	getActiveSubscriptions(): EventSubscription[] {
		return Array.from(this.activeSubscriptions)
	}

	/**
	 * Get the count of active subscriptions
	 * @returns Number of active subscriptions
	 */
	getActiveSubscriptionCount(): number {
		return this.activeSubscriptions.size
	}

	/**
	 * Destroy all active subscriptions and clean up resources
	 * This method should be called when the service is being destroyed
	 */
	destroyAllSubscriptions(): void {
		this.activeSubscriptions.forEach((subscription) => {
			if ('destroy' in subscription && typeof subscription.destroy === 'function') {
				subscription.destroy()
			} else {
				subscription.disconnect()
			}
		})
		this.activeSubscriptions.clear()
	}

	/**
	 * Complete cleanup of the EventsService
	 * Destroys all subscriptions and streaming resources
	 */
	async destroy(): Promise<void> {
		// Destroy all active subscriptions
		this.destroyAllSubscriptions()

		// Destroy streaming resources
		await this.destroyStreaming()
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
