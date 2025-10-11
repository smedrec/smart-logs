/**
 * Core delivery service interfaces
 * Requirements 1.1, 2.1, 2.4, 3.1: Service interfaces and contracts
 */

import type {
	ConnectionTestResult,
	CreateDeliveryDestinationInput,
	DeliveryDestination,
	DeliveryDestinationListOptions,
	DeliveryDestinationListResponse,
	DeliveryFeature,
	DeliveryListOptions,
	DeliveryListResponse,
	DeliveryMetrics,
	DeliveryPayload,
	DeliveryRequest,
	DeliveryResponse,
	DeliveryResult,
	DeliveryStatusResponse,
	DestinationConfig,
	DestinationHealth,
	DestinationType,
	MetricsOptions,
	QueueStatus,
	RetrySchedule,
	UpdateDeliveryDestinationInput,
	ValidationResult,
} from './types.js'

/**
 * Main delivery service interface
 * Requirements 1.1, 2.1, 2.4: Core delivery operations and management
 */
export interface IDeliveryService {
	// Destination management
	createDestination(input: CreateDeliveryDestinationInput): Promise<DeliveryDestination>
	updateDestination(id: string, input: UpdateDeliveryDestinationInput): Promise<DeliveryDestination>
	deleteDestination(id: string): Promise<void>
	getDestination(id: string): Promise<DeliveryDestination | null>
	listDestinations(
		options: DeliveryDestinationListOptions
	): Promise<DeliveryDestinationListResponse>

	// Delivery operations
	deliver(request: DeliveryRequest): Promise<DeliveryResponse>
	retryDelivery(deliveryId: string): Promise<DeliveryResponse>
	getDeliveryStatus(deliveryId: string): Promise<DeliveryStatusResponse>
	listDeliveries(options: DeliveryListOptions): Promise<DeliveryListResponse>

	// Health and monitoring
	getDestinationHealth(destinationId: string): Promise<DestinationHealth>
	getDeliveryMetrics(options: MetricsOptions): Promise<DeliveryMetrics>
}

/**
 * Destination manager interface for destination configuration and validation
 * Requirements 1.1, 1.2, 1.3, 1.4: Destination management and validation
 */
export interface IDestinationManager {
	validateDestination(destination: DeliveryDestination): Promise<ValidationResult>
	testConnection(destination: DeliveryDestination): Promise<ConnectionTestResult>
	getDestinationHandler(type: DestinationType): IDestinationHandler
	updateDestinationHealth(destinationId: string, health: Partial<DestinationHealth>): Promise<void>
	getDefaultDestinations(organizationId: string): Promise<DeliveryDestination[]>
	setDefaultDestination(organizationId: string, destinationId: string): Promise<void>
	removeDefaultDestination(organizationId: string, destinationId: string): Promise<void>
}

/**
 * Delivery scheduler interface for queue management
 * Requirements 2.4, 2.5: Queue management and scheduling
 */
export interface IDeliveryScheduler {
	scheduleDelivery(request: DeliveryRequest): Promise<string>
	scheduleRetry(deliveryId: string, delay: number): Promise<void>
	processDeliveryQueue(): Promise<void>
	getQueueStatus(): Promise<QueueStatus>
	cancelDelivery(deliveryId: string): Promise<void>
	pauseQueue(): Promise<void>
	resumeQueue(): Promise<void>
}

/**
 * Retry manager interface for retry logic coordination
 * Requirements 3.1, 3.2, 3.3: Retry management and exponential backoff
 */
export interface IRetryManager {
	shouldRetry(deliveryId: string, error: Error): Promise<boolean>
	calculateBackoff(attemptCount: number): number
	recordAttempt(deliveryId: string, success: boolean, error?: Error): Promise<void>
	getRetrySchedule(deliveryId: string): Promise<RetrySchedule>
	resetRetryCount(deliveryId: string): Promise<void>
	markAsNonRetryable(deliveryId: string, reason: string): Promise<void>
}

/**
 * Destination handler interface for destination-specific delivery logic
 * Requirements 1.1, 2.1: Destination-specific delivery implementations
 */
export interface IDestinationHandler {
	readonly type: DestinationType

	validateConfig(config: DestinationConfig): ValidationResult
	testConnection(config: DestinationConfig): Promise<ConnectionTestResult>
	deliver(payload: DeliveryPayload, config: DestinationConfig): Promise<DeliveryResult>
	supportsFeature(feature: DeliveryFeature): boolean
	getConfigSchema(): Record<string, any> // JSON schema for configuration validation
}

/**
 * Alert manager interface for delivery failure alerting
 * Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5: Alerting and monitoring
 */
export interface IAlertManager {
	checkFailureThresholds(destinationId: string): Promise<void>
	sendAlert(alert: DeliveryAlert): Promise<void>
	acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void>
	resolveAlert(alertId: string, resolvedBy: string, notes?: string): Promise<void>
	getActiveAlerts(organizationId: string): Promise<DeliveryAlert[]>
	configureAlertThresholds(organizationId: string, config: AlertThresholdConfig): Promise<void>
}

/**
 * Circuit breaker interface for destination protection
 * Requirements 3.4, 3.5: Circuit breaker pattern implementation
 */
export interface ICircuitBreaker {
	isOpen(destinationId: string): Promise<boolean>
	recordSuccess(destinationId: string): Promise<void>
	recordFailure(destinationId: string): Promise<void>
	getState(destinationId: string): Promise<CircuitBreakerState>
	forceOpen(destinationId: string, reason: string): Promise<void>
	forceClose(destinationId: string): Promise<void>
}

/**
 * Supporting types for interfaces
 */

export interface DeliveryAlert {
	id: string
	organizationId: string
	destinationId: string
	type: 'failure_rate' | 'consecutive_failures' | 'queue_backlog' | 'response_time'
	severity: 'low' | 'medium' | 'high' | 'critical'
	title: string
	description: string
	metadata: Record<string, any>
	createdAt: string
}

export interface AlertThresholdConfig {
	failureRateThreshold: number // percentage
	consecutiveFailureThreshold: number
	queueBacklogThreshold: number
	responseTimeThreshold: number // milliseconds
	debounceWindow: number // minutes
	escalationDelay: number // minutes
}

export interface CircuitBreakerState {
	state: 'closed' | 'open' | 'half-open'
	failureCount: number
	lastFailureAt?: string
	openedAt?: string
	nextAttemptAt?: string
}
