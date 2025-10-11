/**
 * Types related to delivery destinations and logs
 */

/**
 * DeliveryDestination represents a configured destination for delivering reports, exports or other exportable objects.
 * It supports various types such as email, webhook, storage, SFTP, and download links.
 */
export interface DeliveryDestination {
	id: string
	organizationId: string
	label: string
	type: 'email' | 'webhook' | 'storage' | 'sftp' | 'download'
	description?: string
	icon?: string // URL to an icon image
	instructions?: string // Setup or usage instructions
	disabled: boolean
	disabledAt?: string
	disabledBy?: string
	countUsage: number // Usage count
	lastUsedAt?: string
	config: {
		// Configuration details vary by type
		email?: {
			service: string // e.g., 'smtp', 'gmail', 'sendgrid', 'resend', etc.
			smtpConfig?: {
				host: string
				port: number
				secure: boolean
				auth: {
					user: string
					pass: string
				}
			}
			apiKey?: string // For services like SendGrid, Resend, etc.
			from: string
			subject: string
			bodyTemplate?: string
			attachmentName?: string
			recipients?: string[]
		}

		webhook?: {
			url: string
			method: 'POST' | 'PUT'
			headers: Record<string, string>
			timeout: number
			retryConfig: {
				maxRetries: number
				backoffMultiplier: number
				maxBackoffDelay: number
			}
		}

		storage?: {
			provider: 'local' | 's3' | 'azure' | 'gcp'
			config: Record<string, any>
			path: string
			retention: {
				days: number
				autoCleanup: boolean
			}
		}

		sftp?: {
			host: string
			port: number
			username?: string
			password?: string
			privateKey?: string
			path: string
			filename?: string
		}

		download?: {
			expiryHours: number
		}
	}
	createdAt: string
	updatedAt: string
}

/**
 * Delivery statuses for tracking delivery attempts.
 */
export type DeliveryStatus = 'pending' | 'delivered' | 'failed' | 'retrying'

/**
 * Delivery attempt record
 */
export interface DeliveryAttempt {
	attemptId: string
	timestamp: string
	status: DeliveryStatus
	method: 'email' | 'webhook' | 'storage' | 'sftp' | 'download'
	target: string
	error?: Error | string
	responseCode?: number
	responseTime?: number
	retryCount: number
}

/**
 * DeliveryLog represents a log entry for each delivery attempt to a destination.
 * It tracks the status, attempt count, timestamps, and any failure reasons or details.
 */
export interface DeliveryLog {
	id: string
	deliveryDestinationId: string
	// Details about the delivered object
	// {
	//   "type": "report" | "export" | "data",
	//   "id": string,
	//	 "executionId"?: string, // for reports
	//   "name"?: string,
	//   "size"?: number,
	//   "format"?: string,
	//   "url"?: string, // For download links
	//   ...additional metadata
	// }
	objectDetails: Record<string, any> // Details about the delivered object
	status: DeliveryStatus
	attempts: DeliveryAttempt[] // Array of delivery attempts
	lastAttemptAt?: string
	failureReason?: string
	details?: Record<string, any>
	createdAt: string
	updatedAt: string
}

/**
 * Input type for creating a new DeliveryDestination.
 * Excludes fields that are auto-generated or managed by the system.
 */
export interface CreateDeliveryDestinationInput {
	organizationId: string
	label: string
	type: 'email' | 'webhook' | 'storage' | 'sftp' | 'download'
	description?: string
	icon?: string
	instructions?: string
	config: DeliveryDestination['config']
}

/**
 * Input type for updating an existing DeliveryDestination.
 * All fields are optional to allow partial updates.
 */
export interface UpdateDeliveryDestinationInput {
	label?: string
	description?: string
	icon?: string
	instructions?: string
	config?: DeliveryDestination['config']
	disabled?: boolean
}

/**
 * Input type for listing DeliveryDestinations.
 * Allows filtering and sorting options.
 */
export interface DeliveryDestinationFilters {
	organizationId?: string
	type?: 'email' | 'webhook' | 'storage' | 'sftp' | 'download'
	disabled?: boolean
}

/**
 * Options for listing DeliveryDestinations.
 * Includes pagination and sorting options.
 */
export interface DeliveryDestinationListOptions {
	limit?: number
	offset?: number
	sortBy?: 'createdAt' | 'updatedAt' | 'label' | 'type'
	sortOrder?: 'asc' | 'desc'
	filters?: DeliveryDestinationFilters
}

/**
 * Response type for listing DeliveryDestinations.
 * Includes the list of destinations and pagination information.
 */
export interface DeliveryDestinationListResponse {
	deliveryDestinations: DeliveryDestination[]
	totalCount: number
}

/**
 * Enhanced delivery request for multi-destination fanout
 * Requirements 2.1, 2.2, 2.3, 2.4: Delivery orchestration and fanout
 */
export interface DeliveryRequest {
	organizationId: string
	destinations: string[] | 'default' // destination IDs or use default destinations
	payload: {
		type: 'report' | 'export' | 'data' | 'custom'
		data: any // the actual content to deliver
		metadata: Record<string, any>
	}
	options?: {
		priority?: number // 0-10, higher = more priority
		idempotencyKey?: string
		correlationId?: string
		tags?: string[]
	}
}

/**
 * Enhanced delivery response with tracking information
 * Requirements 2.1, 2.4, 9.1, 9.2: Delivery tracking and status
 */
export interface DeliveryResponse {
	deliveryId: string
	status: 'queued' | 'processing' | 'completed' | 'failed'
	destinations: {
		destinationId: string
		status: 'pending' | 'delivered' | 'failed' | 'retrying'
		deliveryLogId?: string
	}[]
	queuedAt: string
	estimatedDeliveryTime?: string
}

/**
 * Delivery status with detailed tracking information
 * Requirements 9.1, 9.2, 9.3, 9.4: Cross-system tracking and status
 */
export interface DeliveryStatusResponse {
	deliveryId: string
	status: 'queued' | 'processing' | 'completed' | 'failed'
	destinations: {
		destinationId: string
		status: 'pending' | 'delivered' | 'failed' | 'retrying'
		attempts: number
		lastAttemptAt?: string
		deliveredAt?: string
		failureReason?: string
		crossSystemReference?: string
	}[]
	createdAt: string
	updatedAt: string
	metadata: Record<string, any>
}

/**
 * Destination health status and metrics
 * Requirements 3.4, 3.5, 7.1, 7.2, 7.3: Health monitoring and failure tracking
 */
export interface DestinationHealth {
	destinationId: string
	status: 'healthy' | 'degraded' | 'unhealthy' | 'disabled'
	lastCheckAt: string
	consecutiveFailures: number
	totalFailures: number
	totalDeliveries: number
	successRate: string // Percentage as string
	averageResponseTime?: number // milliseconds
	lastFailureAt?: string
	lastSuccessAt?: string
	disabledAt?: string
	disabledReason?: string
	circuitBreakerState: 'closed' | 'open' | 'half-open'
	circuitBreakerOpenedAt?: string
	metadata: Record<string, any>
}

/**
 * Validation result for destination configuration
 * Requirements 1.2, 1.3, 1.4, 10.1, 10.2, 10.3, 10.4: Configuration validation
 */
export interface ValidationResult {
	isValid: boolean
	errors: string[]
	warnings: string[]
}

/**
 * Connection test result for destination validation
 * Requirements 1.2, 1.3, 1.4: Connection testing and validation
 */
export interface ConnectionTestResult {
	success: boolean
	responseTime?: number // milliseconds
	statusCode?: number
	error?: string
	details?: Record<string, any>
}

/**
 * Delivery metrics for monitoring and analytics
 * Requirements 8.1, 8.2, 8.3, 8.4, 8.5: Observability and metrics
 */
export interface DeliveryMetrics {
	totalDeliveries: number
	successfulDeliveries: number
	failedDeliveries: number
	successRate: string // Percentage as string
	averageDeliveryTime: number // milliseconds
	byDestinationType: Record<
		string,
		{
			total: number
			successful: number
			failed: number
			successRate: string
			averageTime: number
		}
	>
	byOrganization: Record<
		string,
		{
			total: number
			successful: number
			failed: number
			successRate: string
		}
	>
	timeRange: {
		start: string
		end: string
	}
}

/**
 * Queue status information
 * Requirements 2.4, 2.5: Queue management and monitoring
 */
export interface QueueStatus {
	pendingCount: number
	processingCount: number
	completedCount: number
	failedCount: number
	retryingCount: number
	averageProcessingTime: number // milliseconds
	oldestPendingAge: number // milliseconds
}

/**
 * Retry schedule information
 * Requirements 3.1, 3.2, 3.3: Retry management and scheduling
 */
export interface RetrySchedule {
	deliveryId: string
	currentAttempt: number
	maxAttempts: number
	nextRetryAt?: string
	backoffDelay: number // milliseconds
	totalDelay: number // milliseconds since first attempt
}

/**
 * Delivery feature enumeration for handler capabilities
 */
export type DeliveryFeature =
	| 'signature_verification'
	| 'idempotency'
	| 'retry_with_backoff'
	| 'connection_pooling'
	| 'rate_limiting'
	| 'compression'
	| 'encryption'
	| 'batch_delivery'

/**
 * Destination type enumeration
 */
export type DestinationType = 'webhook' | 'email' | 'storage' | 'sftp' | 'download'

/**
 * Delivery payload for handlers
 */
export interface DeliveryPayload {
	deliveryId: string
	organizationId: string
	type: 'report' | 'export' | 'data' | 'custom'
	data: any
	metadata: Record<string, any>
	correlationId?: string
	idempotencyKey?: string
}

/**
 * Delivery result from handlers
 */
export interface DeliveryResult {
	success: boolean
	deliveredAt?: string
	responseTime: number // milliseconds
	statusCode?: number
	responseHeaders?: Record<string, string>
	responseBody?: any
	crossSystemReference?: string
	error?: string
	retryable: boolean
}

/**
 * Options for listing deliveries
 */
export interface DeliveryListOptions {
	organizationId?: string
	destinationId?: string
	status?: DeliveryStatus
	startDate?: string
	endDate?: string
	limit?: number
	offset?: number
	sortBy?: 'createdAt' | 'updatedAt' | 'status'
	sortOrder?: 'asc' | 'desc'
}

/**
 * Response for listing deliveries
 */
export interface DeliveryListResponse {
	deliveries: DeliveryStatusResponse[]
	totalCount: number
}

/**
 * Options for metrics queries
 */
export interface MetricsOptions {
	organizationId?: string
	destinationType?: DestinationType
	startDate?: string
	endDate?: string
	granularity?: 'hour' | 'day' | 'week' | 'month'
}

/**
 * Destination configuration type alias
 */
export type DestinationConfig = DeliveryDestination['config']
