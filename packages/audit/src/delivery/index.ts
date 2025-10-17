/**
 * Delivery Service - Main exports
 * Requirements 1.1, 1.2, 1.3, 1.4, 3.4, 3.5: Destination management system with validation and health monitoring
 */

// Main service
export { DeliveryService, createDeliveryService } from './delivery-service.js'
export type { IDeliveryService, DeliveryServiceConfig } from './delivery-service.js'

// Database client
export { DeliveryDatabaseClient, createDeliveryDatabaseClient } from './database-client.js'
export type {
	IDeliveryDestinationRepository,
	IDeliveryLogRepository,
	IDeliveryQueueRepository,
	IDestinationHealthRepository,
	IWebhookSecretRepository,
} from './database-client.js'

// Destination manager
export { DestinationManager, createDestinationManager } from './destination-manager.js'
export type { IDestinationManager } from './destination-manager.js'

// Health monitor
export { HealthMonitor, createHealthMonitor } from './health-monitor.js'
export type { HealthMonitorConfig } from './health-monitor.js'

// Delivery scheduler
export { DeliveryScheduler, createDeliveryScheduler } from './delivery-scheduler.js'
export type { DeliverySchedulerConfig, QueueMetrics } from './delivery-scheduler.js'

// Queue manager
export { QueueManager, createQueueManager } from './queue-manager.js'
export type {
	QueueManagerConfig,
	QueueHealth,
	QueueMetrics as QueueManagerMetrics,
	QueueAlert,
} from './queue-manager.js'

// Retry manager
export { RetryManager, createRetryManager } from './retry-manager.js'
export type { RetryManagerConfig, RetryAttempt } from './retry-manager.js'

// Circuit breaker
export { CircuitBreaker, createCircuitBreaker } from './circuit-breaker.js'
export type { CircuitBreakerConfig, CircuitBreakerMetrics } from './circuit-breaker.js'

// Validation components
export { DestinationValidator } from './validation/destination-validator.js'
export { ConnectionTester } from './validation/connection-tester.js'

// Types
export type * from './types.js'
