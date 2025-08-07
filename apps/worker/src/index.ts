import 'dotenv/config'

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { pino } from 'pino'

import {
	CircuitBreakerHealthCheck,
	ConfigurationManager,
	ConsoleAlertHandler,
	DatabaseAlertHandler,
	DatabaseErrorLogger,
	DatabaseHealthCheck,
	DEFAULT_RELIABLE_PROCESSOR_CONFIG,
	ErrorHandler,
	HealthCheckService,
	MonitoringService,
	ProcessingHealthCheck,
	QueueHealthCheck,
	RedisHealthCheck,
	RedisMetricsCollector,
	ReliableEventProcessor,
} from '@repo/audit'
import {
	AuditDbWithConfig,
	auditLog as auditLogTableSchema,
	errorAggregation,
	errorLog,
} from '@repo/audit-db'
import {
	closeSharedRedisConnection,
	getRedisConnectionStatus,
	getSharedRedisConnectionWithConfig,
	Redis,
} from '@repo/redis-client'

import type { LogLevel } from 'workers-tagged-logger'
import type { AuditLogEvent, ReliableProcessorConfig } from '@repo/audit'

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info') as LogLevel

const logger = pino({ name: 'audit-worker', level: LOG_LEVEL })

// Configuration manager
let configManager: ConfigurationManager | undefined = undefined

// Using configuration manager
let connection: Redis | undefined = undefined

// Using configuration manager
let auditDbService: AuditDbWithConfig | undefined = undefined

// Reliable event processor instance
let reliableProcessor: ReliableEventProcessor<AuditLogEvent> | undefined = undefined

// Monitoring and health check services
let databaseAlertHandler: DatabaseAlertHandler | undefined = undefined
let metricsCollector: RedisMetricsCollector | undefined = undefined
let monitoringService: MonitoringService | undefined = undefined
let healthCheckService: HealthCheckService | undefined = undefined

// Error handling services
let errorHandler: ErrorHandler | undefined = undefined
let databaseErrorLogger: DatabaseErrorLogger | undefined = undefined

// Simple healthcheck server for audit worker
const app = new Hono()

app.get('/healthz', async (c) => {
	if (!healthCheckService) {
		logger.warn('Health check called before services are initialized.')
		c.status(503)
		return c.text('Service Unavailable: Services not initialized')
	}

	try {
		const healthStatus = await healthCheckService.checkAllComponents()

		if (healthStatus.status === 'OK') {
			return c.json(healthStatus)
		} else {
			logger.warn(`Health check failed with status: ${healthStatus.status}`)
			c.status(healthStatus.status === 'CRITICAL' ? 503 : 200)
			return c.json(healthStatus)
		}
	} catch (error) {
		logger.error('Health check failed with error:', error)
		c.status(503)
		return c.json({
			status: 'CRITICAL',
			error: error instanceof Error ? error.message : 'Unknown error',
			timestamp: new Date().toISOString(),
		})
	}
})

app.get('/metrics', async (c) => {
	if (!reliableProcessor || !monitoringService) {
		c.status(503)
		return c.json({ error: 'Services not initialized' })
	}

	try {
		const [processorMetrics, cbMetrics, dlMetrics, auditMetrics] = await Promise.all([
			reliableProcessor.getMetrics(),
			reliableProcessor.getCircuitBreakerMetrics(),
			reliableProcessor.getDeadLetterMetrics(),
			Promise.resolve(monitoringService.getMetrics()),
		])

		return c.json({
			processor: processorMetrics,
			circuitBreaker: cbMetrics,
			deadLetter: dlMetrics,
			monitoring: auditMetrics,
		})
	} catch (error) {
		logger.error('Failed to collect metrics:', error)
		c.status(500)
		return c.json({
			error: 'Failed to collect metrics',
			message: error instanceof Error ? error.message : 'Unknown error',
		})
	}
})

app.get('/health/:component', async (c) => {
	if (!healthCheckService) {
		c.status(503)
		return c.json({ error: 'Health check service not initialized' })
	}

	const componentName = c.req.param('component')

	try {
		const componentHealth = await healthCheckService.checkComponent(componentName)

		if (!componentHealth) {
			c.status(404)
			return c.json({
				error: 'Component not found',
				component: componentName,
			})
		}

		const statusCode =
			componentHealth.status === 'CRITICAL' ? 503 : componentHealth.status === 'WARNING' ? 200 : 200

		c.status(statusCode)
		return c.json(componentHealth)
	} catch (error) {
		logger.error('Failed to check component health:', error)
		c.status(500)
		return c.json({
			error: 'Failed to check component health',
			message: error instanceof Error ? error.message : 'Unknown error',
		})
	}
})

//const server = serve(app)

// Main function to start the worker
async function main() {
	logger.info('🏁 Audit worker starting...')

	// 0. Initialize configuration manager
	if (!configManager) {
		logger.info('🔗 Initializing configuration manager...')
		configManager = new ConfigurationManager('default/audit-development.json', 's3')
		try {
			await configManager.initialize()
		} catch (error) {
			// Exit if initialization fails
			const message =
				error instanceof Error
					? error.message
					: 'Unknown error during configuration manager initialization'
			logger.error('🔴 Configuration manager initialization failed:', message)
			throw new Error(message)
		}
	}

	const config = configManager.getConfig()

	// 1. Initialize Redis connection
	try {
		if (!connection) {
			logger.info('🔗 Connecting to Redis...')
			connection = getSharedRedisConnectionWithConfig(config.redis)
		}
	} catch (error) {
		// TODO: Optionally, implement retry logic here or ensure process exits.
		logger.error('🔴 Halting worker start due to redis connection failure.', error)
		throw error
	}

	// Optional: Log connection status from the client
	logger.info(`Redis connection status: ${getRedisConnectionStatus()}`)

	// Events 'connect' and 'error' are handled within the shared client.
	// We can add listeners here too, but it might be redundant if the shared client's logging is sufficient.
	// For example, if specific actions for this worker are needed on 'error':
	connection.on('error', (err) => {
		logger.error('🔴 Redis connection error impacting BullMQ worker:', err)
		// Consider if process should exit or if client's reconnection logic is sufficient.
	})

	// 2. Initialize database connection
	if (!auditDbService) {
		auditDbService = new AuditDbWithConfig(config.database)
	}

	// 3. Check database connection
	const dbConnected = await auditDbService.checkAuditDbConnection()
	if (!dbConnected) {
		logger.error('🔴 Halting worker start due to database connection failure.')
		// TODO: Optionally, implement retry logic here or ensure process exits.
		// For simplicity, exiting if DB is not available on startup.
		await closeSharedRedisConnection() // Use client's close function
		process.exit(1)
	}

	const db = auditDbService.getDrizzleInstance()

	// 4. Initialize error handling services
	if (!databaseErrorLogger) {
		databaseErrorLogger = new DatabaseErrorLogger(db, errorLog, errorAggregation)
	}
	if (!errorHandler) {
		errorHandler = new ErrorHandler(undefined, undefined, databaseErrorLogger)
	}

	// 5. Initialize monitoring and health check services
	if (!databaseAlertHandler) {
		databaseAlertHandler = new DatabaseAlertHandler(db)
	}
	if (!metricsCollector) {
		metricsCollector = new RedisMetricsCollector(connection)
	}
	if (!monitoringService) {
		monitoringService = new MonitoringService(undefined, metricsCollector)
		monitoringService.addAlertHandler(new ConsoleAlertHandler())
		monitoringService.addAlertHandler(databaseAlertHandler)
	}

	if (!healthCheckService) {
		healthCheckService = new HealthCheckService()
		// Register health checks
		healthCheckService.registerHealthCheck(
			new DatabaseHealthCheck(() => auditDbService!.checkAuditDbConnection())
		)
		healthCheckService.registerHealthCheck(new RedisHealthCheck(() => getRedisConnectionStatus()))
	}

	// 6. Define the reliable event processor with monitoring integration
	const processAuditEvent = async (eventData: AuditLogEvent): Promise<void> => {
		const startTime = Date.now()
		logger.info(`Processing audit event for action: ${eventData.action}`)

		try {
			// Process event through monitoring service for pattern detection
			await monitoringService!.processEvent(eventData)

			// Extract known fields and prepare 'details' for the rest
			const {
				timestamp,
				ttl,
				principalId,
				organizationId,
				action,
				targetResourceType,
				targetResourceId,
				status,
				outcomeDescription,
				hash,
				hashAlgorithm,
				eventVersion,
				correlationId,
				dataClassification,
				retentionPolicy,
				processingLatency,
				archivedAt,
				...additionalDetails // Captures all other properties including practitioner-specific fields
			} = eventData

			// This will throw an error if database operation fails, which will be caught by the retry mechanism
			await db.insert(auditLogTableSchema).values({
				timestamp, // This comes from the event, should be an ISO string
				ttl,
				principalId,
				organizationId,
				action,
				targetResourceType,
				targetResourceId,
				status,
				outcomeDescription,
				hash,
				hashAlgorithm,
				eventVersion,
				correlationId,
				dataClassification,
				retentionPolicy,
				processingLatency: processingLatency || Date.now() - startTime,
				archivedAt,
				details: Object.keys(additionalDetails).length > 0 ? additionalDetails : null,
			})

			logger.info(`✅ Audit event processed successfully. Action '${action}' stored.`)
		} catch (error) {
			// Use comprehensive error handling for better error tracking and logging
			const err = error instanceof Error ? error : new Error(String(error))

			if (errorHandler) {
				await errorHandler.handleError(
					err,
					{
						correlationId: eventData.correlationId,
						userId: eventData.principalId,
						sessionId: eventData.sessionContext?.sessionId,
						metadata: {
							action: eventData.action,
							targetResourceType: eventData.targetResourceType,
							targetResourceId: eventData.targetResourceId,
							eventData: eventData,
						},
					},
					'audit-processor',
					'processAuditEvent'
				)
			}

			logger.error(`❌ Failed to process audit event: ${err.message}`)
			throw err // Re-throw to trigger retry mechanism
		}
	}

	// 7. Configure reliable processor
	/**const processorConfig: ReliableProcessorConfig = {
		...DEFAULT_RELIABLE_PROCESSOR_CONFIG,
		queueName: config.reliableProcessor.queueName,
		concurrency: config.reliableProcessor.concurrency,
		retryConfig: {
			...DEFAULT_RELIABLE_PROCESSOR_CONFIG.retryConfig,
			maxRetries: config.retry.maxRetries,
			baseDelay: config.retry.baseDelay,
			maxDelay: config.retry.maxDelay,
		},
		circuitBreakerConfig: {
			...DEFAULT_RELIABLE_PROCESSOR_CONFIG.circuitBreakerConfig,
			failureThreshold: config.reliableProcessor.circuitBreakerConfig.failureThreshold,
			recoveryTimeout: config.reliableProcessor.circuitBreakerConfig.recoveryTimeout,
		},
		deadLetterConfig: {
			...DEFAULT_RELIABLE_PROCESSOR_CONFIG.deadLetterConfig,
			queueName: config.reliableProcessor.deadLetterConfig.queueName,
			alertThreshold: config.reliableProcessor.deadLetterConfig.alertThreshold,
		},
	} */

	// 8. Create and start the reliable event processor
	if (!reliableProcessor) {
		reliableProcessor = new ReliableEventProcessor<AuditLogEvent>(
			connection,
			db,
			processAuditEvent,
			config.reliableProcessor
		)

		try {
			await reliableProcessor.start()
		} catch (error) {
			logger.error('Failed to start reliable processor:', error)
			throw error
		}
	}

	// 9. Register additional health checks that depend on the processor
	healthCheckService.registerHealthCheck(
		new QueueHealthCheck(
			async () => {
				const metrics = await reliableProcessor!.getMetrics()
				return metrics.queueDepth || 0
			},
			async () => {
				const metrics = await reliableProcessor!.getMetrics()
				return metrics.totalProcessed || 0
			}
		)
	)

	healthCheckService.registerHealthCheck(
		new ProcessingHealthCheck(async () => monitoringService!.getMetrics())
	)

	healthCheckService.registerHealthCheck(
		new CircuitBreakerHealthCheck(async () => {
			const healthStatus = await reliableProcessor!.getHealthStatus()
			return healthStatus.circuitBreakerState || 'UNKNOWN'
		})
	)

	logger.info(
		`👂 Reliable processor listening for jobs on queue: "${config.reliableProcessor.queueName}"`
	)

	const server = serve({
		fetch: app.fetch,
		port: config.worker.port,
	})

	logger.info(`👂 Healthcheck server listening on port ${config.worker.port}`)

	// Graceful shutdown
	const gracefulShutdown = async (signal: string) => {
		logger.info(`🚦 Received ${signal}. Shutting down gracefully...`)
		server.close()
		if (reliableProcessor) {
			await reliableProcessor.stop()
		}
		await closeSharedRedisConnection() // Use client's close function
		await auditDbService?.end()
		logger.info('🚪 Reliable processor, Postgres and Redis connections closed. Exiting.')
		process.exit(0)
	}

	process.on('SIGINT', () => gracefulShutdown('SIGINT')) // Ctrl+C
	process.on('SIGTERM', () => gracefulShutdown('SIGTERM')) // kill
}

// Start the application
main().catch(async (error) => {
	logger.error('💥 Unhandled error in main application scope:', error.message)
	await auditDbService?.end()
	// Ensure Redis connection is closed on fatal error
	void closeSharedRedisConnection().finally(() => process.exit(1))
})
