import z from 'zod'
import { ZodNumberFormat } from 'zod/v4'

import { BaseResource } from '../core/base-resource'
import {
	ConnectionOptions,
	ManagedConnection,
	StreamConfig,
	StreamingManager,
} from '../infrastructure/streaming'
import {
	assertDefined,
	assertType,
	isAlert,
	isNonEmptyString,
	isObject,
	isSystemMetrics,
} from '../utils/type-guards'
import {
	validateAlert,
	validateAlertsParams,
	validateAuditMetricsParams,
	validateSystemMetrics,
	validateUsageMetricsParams,
	ValidationError,
} from '../utils/validation'

import type {
	Alert,
	AlertActionResponse,
	AlertSeverity,
	AlertsParams,
	AlertType,
	AuditMetrics,
	AuditMetricsParams,
	CpuUsage,
	MemoryUsage,
	PaginatedAlerts,
	PerformanceMetrics,
	SystemMetrics,
	UsageMetrics,
	UsageMetricsParams,
} from '@/types/metrics'
import type { RequestOptions } from '../core/base-resource'

/**
 * Database metrics
 */
export interface DatabaseMetrics {
	connectionCount: number
	activeQueries: number
	averageQueryTime: number
	slowQueries: number
	totalQueries: number
	errorRate: number
}

/**
 * Cache metrics
 */
export interface CacheMetrics {
	hitRate: number
	missRate: number
	evictionRate: number
	memoryUsage: number
	totalRequests: number
	totalHits: number
	totalMisses: number
}

/**
 * API metrics
 */
export interface ApiMetrics {
	requestsPerSecond: number
	averageResponseTime: number
	errorRate: number
	activeConnections: number
	totalRequests: number
	totalErrors: number
	endpointStats: Record<string, EndpointStats>
}

/**
 * Endpoint-specific statistics
 */
export interface EndpointStats {
	requestCount: number
	averageResponseTime: number
	errorCount: number
	errorRate: number
	lastAccessed: string
}

/**
 * Alert Statistics interface
 */
export interface AlertStatistics {
	total: number
	active: number
	acknowledged: number
	resolved: number
	dismissed: number
	bySeverity: Record<AlertSeverity, number>
	byType: Record<AlertType, number>
	bySource: Record<string, number>
	trends: {
		period: string
		created: number
		resolved: number
	}[]
}

/**
 * Real-time metrics subscription parameters
 */
export interface MetricsSubscriptionParams {
	metricsTypes: ('system' | 'audit' | 'performance' | 'usage')[]
	updateInterval?: number // seconds
	includeAlerts?: boolean
}

/**
 * Real-time metrics data
 */
export interface RealTimeMetricsData {
	timestamp: string
	type: 'system' | 'audit' | 'performance' | 'usage' | 'alert'
	data: SystemMetrics | AuditMetrics | PerformanceMetrics | UsageMetrics | Alert
}

/**
 * Metrics subscription interface
 */
export interface MetricsSubscription {
	id: string
	isActive: boolean
	connect(): Promise<void>
	disconnect(): void
	onData(callback: (data: RealTimeMetricsData) => void): void
	onError(callback: (error: Error) => void): void
	onClose(callback: () => void): void
}

/**
 * Alert acknowledgment request
 */
export interface AcknowledgeAlertRequest {
	acknowledgedBy: string
	notes?: string
}

/**
 * Alert resolution request
 */
export interface ResolveAlertRequest {
	resolution: string
}

/**
 * Metrics and Monitoring Service
 *
 * Provides comprehensive system monitoring capabilities including:
 * - System metrics (CPU, memory, disk, network)
 * - Audit-specific metrics (events, compliance, integrity)
 * - Performance metrics (response times, throughput)
 * - Usage statistics and quotas
 * - Alert management and real-time notifications
 * - Real-time metrics streaming
 */
export class MetricsService extends BaseResource {
	private streamingManager: StreamingManager

	constructor(config: any, logger?: any) {
		super(config, logger)
		this.streamingManager = new StreamingManager(
			{
				enableCompression: config.performance?.enableCompression || true,
				maxConcurrentStreams: config.performance?.maxConcurrentRequests || 10,
				heartbeatInterval: 5000, // 5 seconds for metrics
				enableMetrics: true,
			},
			logger
		)
	}

	/**
	 * Get current system metrics
	 *
	 * @returns Promise<SystemMetrics> Current system performance metrics
	 */
	async getSystemMetrics(): Promise<SystemMetrics> {
		const response = await this.request<SystemMetrics>('/metrics/system', {
			method: 'GET',
		})

		// Validate response using type guards
		assertType(response, isSystemMetrics, 'Invalid system metrics response from server')
		return response
	}

	/**
	 * Get audit-specific metrics
	 *
	 * @param params Query parameters for audit metrics
	 * @returns Promise<AuditMetrics> Audit system metrics
	 */
	async getAuditMetrics(
		params: AuditMetricsParams = {
			granularity: 'minute',
			includeBreakdown: false,
			includeTimeline: false,
		}
	): Promise<AuditMetrics> {
		// Validate input parameters
		const validationResult = validateAuditMetricsParams(params)
		if (!validationResult.success) {
			throw new ValidationError('Invalid audit metrics parameters', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const validatedQuery = validationResult.data!

		const response = await this.request<AuditMetrics>('/metrics/audit', {
			method: 'GET',
			query: validatedQuery,
		})

		// Validate response structure
		assertType(response, isObject, 'Invalid audit metrics response from server')
		assertDefined(response.timestamp, 'Audit metrics response missing timestamp')

		return response
	}

	/**
	 * Get performance metrics
	 *
	 * @returns Promise<PerformanceMetrics> System performance metrics
	 */
	async getPerformanceMetrics(): Promise<PerformanceMetrics> {
		return this.request<PerformanceMetrics>('/metrics/performance', {
			method: 'GET',
		})
	}

	/**
	 * Get API usage metrics and statistics
	 *
	 * @param params Query parameters for usage metrics
	 * @returns Promise<UsageMetrics> API usage statistics
	 */
	async getUsageMetrics(
		params: UsageMetricsParams = {
			granularity: 'hour',
			includeDetails: false,
		}
	): Promise<UsageMetrics> {
		// Validate input parameters
		const validationResult = validateUsageMetricsParams(params)
		if (!validationResult.success) {
			throw new ValidationError('Invalid usage metrics parameters', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const validatedQuery = validationResult.data!

		const response = await this.request<UsageMetrics>('/metrics/usage', {
			method: 'GET',
			query: validatedQuery,
		})

		// Validate response structure
		assertType(response, isObject, 'Invalid usage metrics response from server')
		assertDefined(response.timestamp, 'Usage metrics response missing timestamp')

		return response
	}

	/**
	 * Get all active alerts
	 *
	 * @param params Query parameters for filtering alerts
	 * @returns Promise<PaginatedAlerts> List of system alerts
	 */
	async getAlerts(params: AlertsParams = {}): Promise<PaginatedAlerts> {
		// Validate input parameters
		const validationResult = validateAlertsParams(params)
		if (!validationResult.success) {
			throw new ValidationError('Invalid alerts parameters', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const validatedQuery = validationResult.data!

		const response = await this.request<PaginatedAlerts>('/metrics/alerts', {
			method: 'GET',
			query: validatedQuery,
		})

		// Validate response structure
		assertType(response, isObject, 'Invalid paginated alerts response from server')
		assertDefined(response.data, 'Paginated alerts response missing alerts array')
		assertDefined(response.pagination, 'Paginated alerts response missing pagination')

		return response
	}

	/**
	 * Get a specific alert by ID
	 *
	 * @param id Alert ID
	 * @returns Promise<Alert | null> Alert details or null if not found
	 */
	async getAlert(id: string): Promise<Alert | null> {
		// Validate input
		assertDefined(id, 'Alert ID is required')
		if (!isNonEmptyString(id)) {
			throw new ValidationError('Alert ID must be a non-empty string')
		}

		try {
			const response = await this.request<Alert>(`/metrics/alerts/${id}`, {
				method: 'GET',
			})

			// Validate response
			assertType(response, isAlert, 'Invalid alert response from server')
			return response
		} catch (error: any) {
			if (error.status === 404) {
				return null
			}
			throw error
		}
	}

	/**
	 * Get alert statistics summary
	 *
	 * @returns Promise<any> Alert statistics summary
	 */
	async getAlertStatistics(): Promise<AlertStatistics> {
		return this.request<AlertStatistics>('/metrics/alerts/statistics', {
			method: 'GET',
		})
	}

	/**
	 * Acknowledge an alert
	 *
	 * @param id Alert ID
	 * @returns Promise<AlertActionResponse> Acknowledgment result
	 */
	async acknowledgeAlert(id: string): Promise<AlertActionResponse> {
		return this.request<AlertActionResponse>(`/metrics/alerts/${id}/acknowledge`, {
			method: 'POST',
		})
	}

	/**
	 * Resolve an alert
	 *
	 * @param id Alert ID
	 * @param request Resolution details
	 * @returns Promise<AlertActionResponse> Resolution result
	 */
	async resolveAlert(id: string, request: ResolveAlertRequest): Promise<AlertActionResponse> {
		return this.request<AlertActionResponse>(`/metrics/alerts/${id}/resolve`, {
			method: 'POST',
			body: request,
		})
	}

	/**
	 * Dismiss an alert
	 *
	 * @param id Alert ID
	 * @returns Promise<{ success: boolean }> Dismissal result
	 */
	async dismissAlert(id: string): Promise<AlertActionResponse> {
		return this.request<AlertActionResponse>(`/metrics/alerts/${id}/dismiss`, {
			method: 'POST',
		})
	}

	/**
	 * Get historical metrics data
	 *
	 * @param type Metrics type
	 * @param timeRange Time range for historical data
	 * @param granularity Data granularity
	 * @returns Promise<any[]> Historical metrics data
	 */
	async getHistoricalMetrics(
		type: 'system' | 'audit' | 'performance' | 'usage',
		timeRange: { startDate: string; endDate: string },
		granularity: 'hour' | 'day' | 'week' | 'month' = 'hour'
	): Promise<any[]> {
		return this.request<any[]>(`/metrics/${type}/historical`, {
			method: 'GET',
			query: {
				startDate: timeRange.startDate,
				endDate: timeRange.endDate,
				granularity,
			},
		})
	}

	/**
	 * Export metrics data
	 *
	 * @param type Metrics type
	 * @param timeRange Time range for export
	 * @param format Export format
	 * @returns Promise<Blob> Exported metrics data
	 */
	async exportMetrics(
		type: 'system' | 'audit' | 'performance' | 'usage',
		timeRange: { startDate: string; endDate: string },
		format: 'csv' | 'json' | 'xlsx' = 'csv'
	): Promise<Blob> {
		return this.request<Blob>(`/metrics/${type}/export`, {
			method: 'POST',
			body: {
				timeRange,
				format,
			},
			responseType: 'blob',
		})
	}

	/**
	 * Subscribe to real-time metrics updates
	 *
	 * @param params Subscription parameters
	 * @returns MetricsSubscription Real-time metrics subscription
	 */
	subscribeToMetrics(params: MetricsSubscriptionParams): MetricsSubscription {
		return new MetricsSubscriptionImpl(this.config.baseUrl, params, this.authManager)
	}

	/**
	 * Get metrics summary dashboard data
	 *
	 * @returns Promise<any> Dashboard summary data
	 */
	async getDashboardSummary(): Promise<{
		system: Partial<SystemMetrics>
		audit: Partial<AuditMetrics>
		performance: Partial<PerformanceMetrics>
		alerts: {
			total: number
			critical: number
			high: number
			recent: Alert[]
		}
		trends: {
			eventsGrowth: number
			performanceTrend: number
			errorRateTrend: number
		}
	}> {
		return this.request('/metrics/dashboard', {
			method: 'GET',
		})
	}

	/**
	 * Create a custom metrics query
	 *
	 * @param query Custom metrics query
	 * @returns Promise<any> Query results
	 */
	async customQuery(query: {
		metrics: string[]
		filters?: Record<string, any>
		timeRange?: { startDate: string; endDate: string }
		groupBy?: string[]
		aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count'
	}): Promise<any> {
		return this.request('/metrics/query', {
			method: 'POST',
			body: query,
		})
	}

	/**
	 * Get metrics configuration and thresholds
	 *
	 * @returns Promise<any> Metrics configuration
	 */
	async getMetricsConfig(): Promise<{
		alertThresholds: Record<string, any>
		retentionPolicies: Record<string, any>
		samplingRates: Record<string, number>
		enabledMetrics: string[]
	}> {
		return this.request('/metrics/config', {
			method: 'GET',
		})
	}

	/**
	 * Update metrics configuration
	 *
	 * @param config Updated configuration
	 * @returns Promise<any> Updated configuration
	 */
	async updateMetricsConfig(config: {
		alertThresholds?: Record<string, any>
		retentionPolicies?: Record<string, any>
		samplingRates?: Record<string, number>
		enabledMetrics?: string[]
	}): Promise<any> {
		return this.request('/metrics/config', {
			method: 'PUT',
			body: config,
		})
	}

	/**
	 * Create enhanced real-time metrics subscription with streaming infrastructure
	 *
	 * @param params - Subscription parameters
	 * @returns Enhanced managed connection for real-time metrics
	 *
	 * Requirements: 10.4 - WHEN system alerts are available THEN the client SHALL provide methods to retrieve and acknowledge alerts
	 */
	async createEnhancedMetricsStream(params: {
		metrics?: string[]
		interval?: number
		transport?: 'websocket' | 'sse'
		filters?: Record<string, any>
	}): Promise<ManagedConnection> {
		// Build connection URL with parameters
		const url = this.buildMetricsStreamUrl(params)

		// Create connection options
		const connectionOptions: ConnectionOptions = {
			reconnect: true,
			maxReconnectAttempts: 10,
			heartbeatInterval: params.interval || 5000,
		}

		// Create managed connection
		const connection = await this.streamingManager.createRealtimeConnection(
			`metrics_${Date.now()}`,
			url,
			params.transport || 'websocket',
			connectionOptions
		)

		// Set up metrics-specific event handlers
		connection.on('data', (_, data) => {
			// Process metrics data
			this.processMetricsData(data)
		})

		connection.on('error', (_, error) => {
			this.logger.error('Metrics stream error', { error })
		})

		return connection
	}

	/**
	 * Stream historical metrics data with backpressure management
	 *
	 * @param params - Historical metrics parameters
	 * @returns Managed readable stream for historical metrics
	 */
	async streamHistoricalMetrics(params: {
		metrics: string[]
		timeRange: { startDate: string; endDate: string }
		resolution?: 'minute' | 'hour' | 'day'
		format?: 'json' | 'csv'
	}) {
		// Create streaming source for historical metrics
		const streamSource: UnderlyingDefaultSource<any> = {
			start: async (controller) => {
				try {
					// Get the raw stream from the server
					const rawStream = await this.request<ReadableStream<Uint8Array>>(
						'/metrics/historical/stream',
						{
							method: 'POST',
							body: params,
							responseType: 'stream',
						}
					)

					// Process the stream with proper parsing
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
										const data = JSON.parse(buffer.trim())
										controller.enqueue(data)
									} catch (error) {
										this.logger.warn('Failed to parse final metrics buffer', { buffer, error })
									}
								}
								controller.close()
								return
							}

							// Decode chunk and add to buffer
							buffer += decoder.decode(value, { stream: true })

							// Process complete lines
							const lines = buffer.split('\n')
							buffer = lines.pop() || ''

							for (const line of lines) {
								if (line.trim()) {
									try {
										const data = JSON.parse(line.trim())
										controller.enqueue(data)
									} catch (error) {
										this.logger.warn('Failed to parse metrics line', { line, error })
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

		// Create managed stream
		return this.streamingManager.createExportStream(streamSource, {
			enableCompression: true,
			enableMetrics: true,
			batchSize: 1000, // Larger batches for metrics data
		})
	}

	/**
	 * Get streaming metrics for the metrics service itself
	 */
	getStreamingMetrics() {
		return this.streamingManager.getMetrics()
	}

	/**
	 * Cleanup streaming resources
	 */
	async destroyStreaming(): Promise<void> {
		await this.streamingManager.destroy()
	}

	private buildMetricsStreamUrl(params: any): string {
		const wsUrl = this.config.baseUrl.replace(/^https?/, 'wss').replace(/^http/, 'ws')
		const url = new URL(`${wsUrl}/api/v1/metrics/stream`)

		// Add parameters to URL
		if (params.metrics?.length) {
			url.searchParams.set('metrics', params.metrics.join(','))
		}
		if (params.interval) {
			url.searchParams.set('interval', params.interval.toString())
		}
		if (params.filters) {
			Object.entries(params.filters).forEach(([key, value]) => {
				url.searchParams.set(key, String(value))
			})
		}

		return url.toString()
	}

	private processMetricsData(data: any): void {
		// Process and validate metrics data
		try {
			if (data.type === 'system' && isSystemMetrics(data.payload)) {
				// Handle system metrics
				this.logger.debug('Received system metrics', data.payload)
			} else if (data.type === 'alert' && isAlert(data.payload)) {
				// Handle alert data
				this.logger.info('Received alert', data.payload)
			}
		} catch (error) {
			this.logger.warn('Failed to process metrics data', { data, error })
		}
	}
}

/**
 * Implementation of MetricsSubscription for real-time metrics streaming
 */
class MetricsSubscriptionImpl implements MetricsSubscription {
	public readonly id: string
	public isActive: boolean = false

	private ws: WebSocket | null = null
	private eventSource: EventSource | null = null
	private reconnectAttempts: number = 0
	private maxReconnectAttempts: number = 5
	private reconnectDelay: number = 1000

	private dataCallbacks: Array<(data: RealTimeMetricsData) => void> = []
	private errorCallbacks: Array<(error: Error) => void> = []
	private closeCallbacks: Array<() => void> = []

	constructor(
		private baseUrl: string,
		private params: MetricsSubscriptionParams,
		private authManager: any
	) {
		this.id = `metrics-sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
	}

	async connect(): Promise<void> {
		if (this.isActive) {
			return
		}

		try {
			const authHeaders = await this.authManager.getAuthHeaders()
			const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/metrics/stream'

			// Try WebSocket first, fallback to Server-Sent Events
			if (typeof WebSocket !== 'undefined') {
				await this.connectWebSocket(wsUrl, authHeaders)
			} else {
				await this.connectEventSource(wsUrl, authHeaders)
			}

			this.isActive = true
			this.reconnectAttempts = 0
		} catch (error) {
			this.handleError(error as Error)
		}
	}

	disconnect(): void {
		this.isActive = false

		if (this.ws) {
			this.ws.close()
			this.ws = null
		}

		if (this.eventSource) {
			this.eventSource.close()
			this.eventSource = null
		}

		this.closeCallbacks.forEach((callback) => callback())
	}

	onData(callback: (data: RealTimeMetricsData) => void): void {
		this.dataCallbacks.push(callback)
	}

	onError(callback: (error: Error) => void): void {
		this.errorCallbacks.push(callback)
	}

	onClose(callback: () => void): void {
		this.closeCallbacks.push(callback)
	}

	private async connectWebSocket(url: string, authHeaders: Record<string, string>): Promise<void> {
		return new Promise((resolve, reject) => {
			// Note: WebSocket doesn't support custom headers directly
			// In a real implementation, you'd need to pass auth via query params or subprotocol
			const queryParams = new URLSearchParams()
			queryParams.set('metricsTypes', this.params.metricsTypes.join(','))
			if (this.params.updateInterval) {
				queryParams.set('updateInterval', this.params.updateInterval.toString())
			}
			if (this.params.includeAlerts !== undefined) {
				queryParams.set('includeAlerts', this.params.includeAlerts.toString())
			}
			const wsUrl = `${url}?${queryParams.toString()}`

			this.ws = new WebSocket(wsUrl)

			this.ws.onopen = () => {
				resolve()
			}

			this.ws.onmessage = (event) => {
				try {
					const data: RealTimeMetricsData = JSON.parse(event.data)
					this.dataCallbacks.forEach((callback) => callback(data))
				} catch (error) {
					this.handleError(new Error('Failed to parse metrics data'))
				}
			}

			this.ws.onerror = (error) => {
				reject(new Error('WebSocket connection failed'))
			}

			this.ws.onclose = () => {
				this.isActive = false
				this.attemptReconnect()
			}
		})
	}

	private async connectEventSource(
		url: string,
		authHeaders: Record<string, string>
	): Promise<void> {
		return new Promise((resolve, reject) => {
			const queryParams = new URLSearchParams()
			queryParams.set('metricsTypes', this.params.metricsTypes.join(','))
			if (this.params.updateInterval) {
				queryParams.set('updateInterval', this.params.updateInterval.toString())
			}
			if (this.params.includeAlerts !== undefined) {
				queryParams.set('includeAlerts', this.params.includeAlerts.toString())
			}
			const sseUrl = `${url.replace('/stream', '/sse')}?${queryParams.toString()}`

			this.eventSource = new EventSource(sseUrl)

			this.eventSource.onopen = () => {
				resolve()
			}

			this.eventSource.onmessage = (event) => {
				try {
					const data: RealTimeMetricsData = JSON.parse(event.data)
					this.dataCallbacks.forEach((callback) => callback(data))
				} catch (error) {
					this.handleError(new Error('Failed to parse metrics data'))
				}
			}

			this.eventSource.onerror = (error) => {
				if (this.eventSource?.readyState === EventSource.CONNECTING) {
					// Still connecting, wait
					return
				}
				reject(new Error('EventSource connection failed'))
			}
		})
	}

	private handleError(error: Error): void {
		this.errorCallbacks.forEach((callback) => callback(error))
	}

	private attemptReconnect(): void {
		if (!this.isActive || this.reconnectAttempts >= this.maxReconnectAttempts) {
			this.disconnect()
			return
		}

		this.reconnectAttempts++
		const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

		setTimeout(() => {
			if (this.isActive) {
				this.connect().catch((error) => {
					this.handleError(error)
				})
			}
		}, delay)
	}
}
