import { EnhancedAuditDb } from '@repo/audit-db'
import { getSharedRedisConnectionWithConfig, Redis } from '@repo/redis-client'

import {
	AlertQueryFilters,
	AuditLogEvent,
	ConfigurationManager,
	createDatabaseAlertHandler,
	DatabaseAlertHandler,
	MonitoringService,
	RedisMetricsCollector,
} from '../index.js'

/**
 * Example integration of DatabaseAlertHandler with MonitoringService
 * Demonstrates multi-organizational alert persistence and management
 */

// Configuration manager
let configManager: ConfigurationManager | undefined = undefined
let connection: Redis | undefined = undefined
let auditDbInstance: EnhancedAuditDb | undefined = undefined
// Alert and health check services
let metricsCollector: RedisMetricsCollector | undefined = undefined
let databaseAlertHandler: DatabaseAlertHandler | undefined = undefined
let monitoringService: MonitoringService | undefined = undefined

/**
 * Example: Setting up monitoring with database alert persistence
 */
export async function setupMonitoringWithDatabaseAlerts() {
	// Initialize configuration
	if (!configManager) {
		console.info('🔗 Initializing configuration manager...')
		configManager = new ConfigurationManager(process.env.CONFIG_PATH!, 's3')
		try {
			await configManager.initialize()
		} catch (error) {
			// Exit if initialization fails
			const message =
				error instanceof Error
					? error.message
					: 'Unknown error during configuration manager initialization'
			console.error('🔴 Configuration manager initialization failed:', message)
			throw new Error(message)
		}
	}
	const config = configManager.getConfig()

	if (!connection) connection = getSharedRedisConnectionWithConfig(config.redis)

	if (!auditDbInstance) {
		auditDbInstance = new EnhancedAuditDb(connection, config.enhancedClient)
		// Check the database connection
		const isConnected = await auditDbInstance.checkAuditDbConnection()
		if (!isConnected) {
			console.error('Failed to connect to the audit database. Exiting.')
			process.exit(1)
		}
	}

	// Create database alert handler
	if (!databaseAlertHandler) databaseAlertHandler = new DatabaseAlertHandler(auditDbInstance)

	if (!monitoringService) {
		if (!metricsCollector) metricsCollector = new RedisMetricsCollector(connection)
		monitoringService = new MonitoringService(config.monitoring, metricsCollector)
		monitoringService.addAlertHandler(databaseAlertHandler)
	}

	return {
		monitoringService,
		databaseAlertHandler,
		cleanup: () => auditDbInstance?.getEnhancedClientInstance().close(),
	}
}

/**
 * Example: Processing audit events with alert persistence
 */
export async function processAuditEventsWithAlerts() {
	const { monitoringService, databaseAlertHandler, cleanup } =
		await setupMonitoringWithDatabaseAlerts()

	try {
		// Simulate suspicious audit events that should trigger alerts
		const suspiciousEvents: AuditLogEvent[] = [
			{
				timestamp: new Date().toISOString(),
				principalId: 'user-456',
				organizationId: 'org-123',
				action: 'auth.login.failure',
				status: 'failure',
				outcomeDescription: 'Invalid credentials',
				targetResourceType: 'User',
				targetResourceId: 'user-456',
				sessionContext: {
					sessionId: 'session-123',
					ipAddress: '192.168.1.100',
					userAgent: 'Mozilla/5.0...',
				},
			},
			// Add more failed login attempts to trigger alert
			...Array.from({ length: 5 }, (_, i) => ({
				timestamp: new Date(Date.now() + i * 1000).toISOString(),
				principalId: 'user-456',
				organizationId: 'org-123',
				action: 'auth.login.failure',
				status: 'failure' as const,
				outcomeDescription: 'Invalid credentials',
				targetResourceType: 'User',
				targetResourceId: 'user-456',
				sessionContext: {
					sessionId: `session-${i}`,
					ipAddress: '192.168.1.100',
					userAgent: 'Mozilla/5.0...',
				},
			})),
		]

		// Process events through monitoring service
		for (const event of suspiciousEvents) {
			await monitoringService.processEvent(event)
		}

		console.log('✅ Processed suspicious events - alerts should be generated')

		// Retrieve active alerts for the organization
		const activeAlerts = await databaseAlertHandler.getActiveAlerts('org-123')
		console.log(`📊 Active alerts: ${activeAlerts.length}`)

		for (const alert of activeAlerts) {
			console.log(`🚨 Alert: ${alert.title} (${alert.severity})`)
			console.log(`   Description: ${alert.description}`)
			console.log(`   Source: ${alert.source}`)
			console.log(`   Created: ${alert.timestamp}`)
		}

		// Demonstrate alert resolution
		if (activeAlerts.length > 0) {
			const alertToResolve = activeAlerts[0]
			await databaseAlertHandler.resolveAlert(alertToResolve.id, 'admin-user', {
				resolvedBy: 'security-admin',
				resolutionNotes: 'Investigated - legitimate user with forgotten password',
			})
			console.log(`✅ Resolved alert: ${alertToResolve.id}`)
		}

		// Get alert statistics
		const stats = await databaseAlertHandler.getAlertStatistics('org-123')
		console.log('📈 Alert Statistics:', stats)
	} finally {
		await cleanup()
	}
}

/**
 * Example: Querying alerts with filters
 */
export async function demonstrateAlertQuerying() {
	const { databaseAlertHandler, cleanup } = await setupMonitoringWithDatabaseAlerts()

	try {
		// Query high-severity security alerts
		const highSecurityAlerts = await databaseAlertHandler.getAlerts({
			organizationId: 'org-123',
			severity: 'HIGH',
			type: 'SECURITY',
			resolved: false,
			sortBy: 'createdAt',
			sortOrder: 'desc',
			limit: 10,
		})

		console.log(`🔍 High-severity security alerts: ${highSecurityAlerts.length}`)

		// Query all alerts from a specific source
		const monitoringAlerts = await databaseAlertHandler.getAlerts({
			organizationId: 'org-123',
			source: 'audit-monitoring',
			sortBy: 'severity',
			sortOrder: 'desc',
		})

		console.log(`📡 Monitoring alerts: ${monitoringAlerts.length}`)

		// Query resolved alerts with pagination
		const resolvedAlerts = await databaseAlertHandler.getAlerts({
			organizationId: 'org-123',
			resolved: true,
			limit: 5,
			offset: 0,
			sortBy: 'updatedAt',
			sortOrder: 'desc',
		})

		console.log(`✅ Recent resolved alerts: ${resolvedAlerts.length}`)
	} finally {
		await cleanup()
	}
}

/**
 * Example: Multi-organizational alert isolation
 */
export async function demonstrateMultiOrganizationalIsolation() {
	// Setup monitoring for two different organizations
	const org1Setup = await setupMonitoringWithDatabaseAlerts()
	const org2Setup = await setupMonitoringWithDatabaseAlerts()

	try {
		// Create alerts for organization 1
		const org1Event: AuditLogEvent = {
			timestamp: new Date().toISOString(),
			principalId: 'user-org1',
			organizationId: 'org-1',
			action: 'data.unauthorized.access',
			status: 'failure',
			outcomeDescription: 'Access denied - insufficient permissions',
		}

		await org1Setup.monitoringService.processEvent(org1Event)

		// Create alerts for organization 2
		const org2Event: AuditLogEvent = {
			timestamp: new Date().toISOString(),
			principalId: 'user-org2',
			organizationId: 'org-2',
			action: 'data.unauthorized.access',
			status: 'failure',
			outcomeDescription: 'Access denied - insufficient permissions',
		}

		await org2Setup.monitoringService.processEvent(org2Event)

		// Verify organizational isolation
		const org1Alerts = await org1Setup.databaseAlertHandler.getActiveAlerts('org-1')
		const org2Alerts = await org2Setup.databaseAlertHandler.getActiveAlerts('org-2')

		console.log(`🏢 Organization 1 alerts: ${org1Alerts.length}`)
		console.log(`🏢 Organization 2 alerts: ${org2Alerts.length}`)

		// Verify that org1 cannot access org2 alerts
		try {
			await org1Setup.databaseAlertHandler.getActiveAlerts('org-2')
			console.log('❌ Security issue: Cross-organizational access allowed!')
		} catch (error) {
			console.log('✅ Organizational isolation working correctly')
		}

		// Demonstrate alert statistics per organization
		const org1Stats = await org1Setup.databaseAlertHandler.getAlertStatistics('org-1')
		const org2Stats = await org2Setup.databaseAlertHandler.getAlertStatistics('org-2')

		console.log('📊 Organization 1 stats:', org1Stats)
		console.log('📊 Organization 2 stats:', org2Stats)
	} finally {
		await org1Setup.cleanup()
		await org2Setup.cleanup()
	}
}

/**
 * Example: Alert cleanup and maintenance
 */
export async function demonstrateAlertMaintenance() {
	const { databaseAlertHandler, cleanup } = await setupMonitoringWithDatabaseAlerts()

	try {
		// Cleanup old resolved alerts (older than 30 days)
		const deletedCount = await databaseAlertHandler.cleanupResolvedAlerts('org-123', 30)
		console.log(`🧹 Cleaned up ${deletedCount} old resolved alerts`)

		// Get current alert statistics after cleanup
		const stats = await databaseAlertHandler.getAlertStatistics('org-123')
		console.log('📊 Post-cleanup statistics:', stats)
	} finally {
		await cleanup()
	}
}

// Example usage
if (import.meta.url === `file://${process.argv[1]}`) {
	console.log('🚀 Running database alert integration examples...')

	try {
		await processAuditEventsWithAlerts()
		console.log('\n---\n')

		await demonstrateAlertQuerying()
		console.log('\n---\n')

		await demonstrateMultiOrganizationalIsolation()
		console.log('\n---\n')

		await demonstrateAlertMaintenance()

		console.log('✅ All examples completed successfully!')
	} catch (error) {
		console.error('❌ Example failed:', error)
		process.exit(1)
	}
}
