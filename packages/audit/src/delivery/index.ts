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

// Tracing
export {
	DeliveryTracer,
	traceDeliveryOperation,
	createDeliveryTracer,
} from './observability/tracer.js'
export type { IDeliveryTracer, DeliverySpanContext, DeliverySpan } from './observability/tracer.js'

// Metrics
export {
	DeliveryMetricsCollector,
	createDeliveryMetricsCollector,
} from './observability/metrics.js'
export type { IDeliveryMetricsCollector } from './observability/metrics.js'

// Performance monitoring
export {
	DeliveryPerformanceMonitor,
	PerformanceTimer,
	createDeliveryPerformanceMonitor,
} from './observability/performance.js'
export type {
	IDeliveryPerformanceMonitor,
	PerformanceMetrics,
} from './observability/performance.js'

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

// Alert manager
export { AlertManager } from './alert-manager.js'

// Alert debouncer
export { AlertDebouncer, createAlertDebouncer } from './alert-debouncer.js'

// Alert access control
export { AlertAccessControl, createAlertAccessControl } from './alert-access-control.js'
export type { AlertUserContext, AlertRole, AlertPermission } from './alert-access-control.js'

// Validation components
export { DestinationValidator } from './validation/destination-validator.js'
export { ConnectionTester } from './validation/connection-tester.js'

// API layer
export { DeliveryAPI, createDeliveryAPI, createAPIRequestContext, DeliveryAPIError } from './api.js'
export type { APIResponse, APIRequestContext } from './api.js'

// Service factory and dependency injection
export {
	DeliveryServiceFactory,
	createDeliveryServiceFactory,
	createDeliveryServiceContainer,
	createMinimalDeliveryService,
} from './factory.js'
export type {
	DeliveryServiceFactoryConfig,
	DeliveryServiceContainer,
	ServiceStatus,
} from './factory.js'

// Configuration management
export {
	ConfigurationManager,
	createConfigurationManager,
	loadConfigFromEnvironment,
	loadConfigFromFile,
	DEFAULT_CONFIG,
} from './config.js'
export type {
	DeliveryServiceConfiguration,
	Environment,
	ConfigSource,
	ConfigValidationResult,
	ConfigMetadata,
} from './config.js'

// Types
export type * from './types.js'
