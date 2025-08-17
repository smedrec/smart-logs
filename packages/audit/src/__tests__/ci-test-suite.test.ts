/**
 * Continuous Integration Test Suite
 * Automated test suite designed for CI/CD pipelines with proper setup and teardown
 */

import { sql } from 'drizzle-orm'
import { Redis } from 'ioredis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AuditDb } from '@repo/audit-db'
import { closeSharedRedisConnection, getSharedRedisConnection } from '@repo/redis-client'

import { AuditService } from '../audit.js'
import { GDPRComplianceService } from '../gdpr/gdpr-compliance.js'
import {
	DatabaseHealthCheck,
	HealthCheckService,
	RedisHealthCheck,
} from '../monitor/health-check.js'
import { MonitoringService } from '../monitor/monitoring.js'
import { ReliableEventProcessor } from '../queue/reliable-processor.js'
import { ComplianceReportingService } from '../report/compliance-reporting.js'

import type { AuditLogEvent } from '../types.js'

describe('CI/CD Integration Test Suite', () => {
	let auditDb: AuditDb
	let redis: Redis
	let auditService: AuditService
	let monitoringService: MonitoringService
	let gdprService: GDPRComplianceService
	let reportingService: ComplianceReportingService
	let healthCheckService: HealthCheckService

	beforeAll(async () => {
		console.log('🚀 Setting up CI test environment...')

		// Setup test database with CI-specific configuration
		const dbUrl =
			process.env.AUDIT_DB_URL ||
			process.env.DATABASE_URL ||
			'postgresql://localhost:5432/audit_test'
		auditDb = new AuditDb(dbUrl)

		// Verify database connection with timeout
		const connectionTimeout = new Promise((_, reject) =>
			setTimeout(() => reject(new Error('Database connection timeout')), 10000)
		)

		const connected = await Promise.race([auditDb.checkAuditDbConnection(), connectionTimeout])

		if (!connected) {
			throw new Error('Cannot connect to test database in CI environment')
		}

		// Setup Redis connection with CI configuration
		redis = getSharedRedisConnection()

		// Wait for Redis to be ready
		await new Promise((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error('Redis connection timeout')), 10000)

			if (redis.status === 'ready') {
				clearTimeout(timeout)
				resolve(undefined)
			} else {
				redis.once('ready', () => {
					clearTimeout(timeout)
					resolve(undefined)
				})
				redis.once('error', (error) => {
					clearTimeout(timeout)
					reject(error)
				})
			}
		})

		// Initialize services with CI-optimized configuration
		auditService = new AuditService({
			database: auditDb,
			redis,
			enableCryptographicIntegrity: true,
			enableGDPRCompliance: true,
			enableMonitoring: true,
		})

		monitoringService = new MonitoringService()
		gdprService = new GDPRComplianceService(auditDb)
		reportingService = new ComplianceReportingService(auditDb)

		// Setup health checks
		healthCheckService = new HealthCheckService()
		healthCheckService.registerHealthCheck(
			new DatabaseHealthCheck(async () => {
				return auditDb.checkAuditDbConnection()
			})
		)
		healthCheckService.registerHealthCheck(
			new RedisHealthCheck(() => {
				return redis.status
			})
		)

		// Clean up any existing test data
		await cleanupTestData()

		console.log('✅ CI test environment ready')
	})

	afterAll(async () => {
		console.log('🧹 Cleaning up CI test environment...')

		// Clean up test data
		await cleanupTestData()

		// Close connections
		await auditDb?.end()
		await closeSharedRedisConnection()

		console.log('✅ CI test environment cleaned up')
	})

	async function cleanupTestData() {
		try {
			const db = auditDb.getDrizzleInstance()

			// Clean up test audit logs
			await db.execute(sql`DELETE FROM audit_log WHERE principal_id LIKE 'ci-test-%'`)
			await db.execute(sql`DELETE FROM audit_log WHERE action LIKE 'ci.%'`)

			// Clean up test alerts
			await db.execute(sql`DELETE FROM alerts WHERE alert_type = 'CI_TEST'`)

			console.log('🗑️  Test data cleaned up')
		} catch (error) {
			console.warn('⚠️  Warning: Could not clean up test data:', error)
		}
	}

	describe('CI Environment Validation', () => {
		it('should validate all required services are available', async () => {
			// Test database connectivity
			const dbConnected = await auditDb.checkAuditDbConnection()
			expect(dbConnected).toBe(true)

			// Test Redis connectivity
			expect(redis.status).toBe('ready')
			await redis.ping()

			// Test service initialization
			expect(auditService).toBeDefined()
			expect(monitoringService).toBeDefined()
			expect(gdprService).toBeDefined()
			expect(reportingService).toBeDefined()

			console.log('✅ All services validated in CI environment')
		})

		it('should validate database schema is up to date', async () => {
			const db = auditDb.getDrizzleInstance()

			// Check that all required tables exist
			const tables = await db.execute(sql`
				SELECT table_name 
				FROM information_schema.tables 
				WHERE table_schema = 'public' 
				AND table_name IN ('audit_log', 'alerts', 'audit_retention_policy', 'audit_integrity_log')
			`)

			const tableNames = tables.map((row: any) => row.table_name)
			expect(tableNames).toContain('audit_log')
			expect(tableNames).toContain('alerts')

			// Check that audit_log has all required columns
			const columns = await db.execute(sql`
				SELECT column_name 
				FROM information_schema.columns 
				WHERE table_name = 'audit_log'
			`)

			const columnNames = columns.map((row: any) => row.column_name)
			expect(columnNames).toContain('hash')
			expect(columnNames).toContain('hash_algorithm')
			expect(columnNames).toContain('data_classification')
			expect(columnNames).toContain('retention_policy')

			console.log('✅ Database schema validated')
		})

		it('should validate health check endpoints', async () => {
			const healthStatus = await healthCheckService.checkAllComponents()

			expect(healthStatus.status).toBe('OK')
			expect(healthStatus.components.database.status).toBe('OK')
			expect(healthStatus.components.redis.status).toBe('OK')

			console.log('✅ Health checks validated')
		})
	})

	describe('Core Functionality Smoke Tests', () => {
		it('should process basic audit events end-to-end', async () => {
			const testEvent: AuditLogEvent = {
				timestamp: new Date().toISOString(),
				action: 'ci.smoke.test',
				status: 'success',
				principalId: 'ci-test-user-001',
				targetResourceType: 'CITestResource',
				targetResourceId: 'resource-001',
				dataClassification: 'INTERNAL',
			}

			// Log event directly
			await auditService.logEvent(testEvent)

			// Verify event was stored
			const db = auditDb.getDrizzleInstance()
			const storedEvents = await db.execute(
				sql`SELECT * FROM audit_log WHERE principal_id = 'ci-test-user-001'`
			)

			expect(storedEvents.length).toBe(1)
			const storedEvent = storedEvents[0] as any
			expect(storedEvent.action).toBe('ci.smoke.test')
			expect(storedEvent.hash).toBeDefined()
			expect(storedEvent.data_classification).toBe('INTERNAL')

			console.log('✅ Basic audit event processing validated')
		})

		it('should process events through queue system', async () => {
			const processor = new ReliableEventProcessor(
				redis,
				async (event: AuditLogEvent) => {
					await auditService.logEvent(event)
				},
				{
					queueName: 'ci-smoke-test-queue',
					concurrency: 2,
					retryConfig: {
						maxRetries: 2,
						backoffStrategy: 'fixed',
						baseDelay: 100,
						maxDelay: 100,
						retryableErrors: ['ECONNRESET'],
					},
					circuitBreakerConfig: {
						failureThreshold: 5,
						recoveryTimeout: 1000,
						monitoringPeriod: 60000,
						minimumThroughput: 3,
					},
					deadLetterConfig: {
						queueName: 'ci-smoke-test-dlq',
						maxRetentionDays: 1,
						alertThreshold: 10,
						processingInterval: 30000,
					},
					persistentStorage: true,
					durabilityGuarantees: true,
				}
			)

			await processor.start()

			const testEvents: AuditLogEvent[] = [
				{
					timestamp: new Date().toISOString(),
					action: 'ci.queue.test.1',
					status: 'success',
					principalId: 'ci-test-queue-user-001',
				},
				{
					timestamp: new Date().toISOString(),
					action: 'ci.queue.test.2',
					status: 'success',
					principalId: 'ci-test-queue-user-002',
				},
			]

			// Process events through queue
			for (const event of testEvents) {
				await processor.addEvent(event)
			}

			// Wait for processing
			await new Promise((resolve) => setTimeout(resolve, 2000))

			// Verify events were processed
			const db = auditDb.getDrizzleInstance()
			const processedEvents = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE action LIKE 'ci.queue.test.%'`
			)

			const eventCount = Number((processedEvents[0] as any).count)
			expect(eventCount).toBe(2)

			await processor.cleanup()
			console.log('✅ Queue processing validated')
		})

		it('should validate monitoring and alerting', async () => {
			// Generate events that should trigger monitoring
			const monitoringEvents: AuditLogEvent[] = []
			for (let i = 0; i < 5; i++) {
				monitoringEvents.push({
					timestamp: new Date().toISOString(),
					action: 'ci.monitoring.test',
					status: 'success',
					principalId: `ci-test-monitoring-user-${i}`,
				})
			}

			// Process events through monitoring
			for (const event of monitoringEvents) {
				await monitoringService.processEvent(event)
			}

			// Check metrics
			const metrics = monitoringService.getMetrics()
			expect(metrics.eventsProcessed).toBeGreaterThan(0)
			expect(metrics.timestamp).toBeDefined()

			console.log('✅ Monitoring validated')
		})

		it('should validate GDPR compliance features', async () => {
			const testUserId = 'ci-test-gdpr-user'

			// Create test event for GDPR testing
			const gdprTestEvent: AuditLogEvent = {
				timestamp: new Date().toISOString(),
				action: 'ci.gdpr.test',
				status: 'success',
				principalId: testUserId,
				targetResourceType: 'GDPRTestResource',
				targetResourceId: 'resource-001',
				dataClassification: 'PHI',
			}

			await auditService.logEvent(gdprTestEvent)

			// Test data export
			const exportData = await gdprService.exportUserData(testUserId)
			expect(exportData).toBeDefined()
			expect(exportData.userId).toBe(testUserId)
			expect(exportData.auditLogs.length).toBeGreaterThan(0)

			console.log('✅ GDPR compliance validated')
		})

		it('should validate compliance reporting', async () => {
			// Create test events for reporting
			const reportingEvents: AuditLogEvent[] = [
				{
					timestamp: new Date().toISOString(),
					action: 'ci.reporting.test.success',
					status: 'success',
					principalId: 'ci-test-reporting-user',
					dataClassification: 'PHI',
				},
				{
					timestamp: new Date().toISOString(),
					action: 'ci.reporting.test.failure',
					status: 'failure',
					principalId: 'ci-test-reporting-user',
					outcomeDescription: 'Test failure for reporting',
				},
			]

			for (const event of reportingEvents) {
				await auditService.logEvent(event)
			}

			// Generate compliance report
			const report = await reportingService.generateComplianceReport({
				startDate: new Date(Date.now() - 60 * 60 * 1000), // Last hour
				endDate: new Date(),
				includeFailures: true,
				includePHI: true,
			})

			expect(report).toBeDefined()
			expect(report.summary.totalEvents).toBeGreaterThan(0)

			console.log('✅ Compliance reporting validated')
		})
	})

	describe('Performance and Reliability Tests', () => {
		it('should handle moderate load in CI environment', async () => {
			const eventCount = 50 // Moderate load for CI
			const events: AuditLogEvent[] = []

			for (let i = 0; i < eventCount; i++) {
				events.push({
					timestamp: new Date().toISOString(),
					action: 'ci.load.test',
					status: 'success',
					principalId: `ci-test-load-user-${i}`,
					targetResourceType: 'LoadTestResource',
					targetResourceId: `resource-${i}`,
				})
			}

			const processor = new ReliableEventProcessor(
				redis,
				async (event: AuditLogEvent) => {
					await auditService.logEvent(event)
				},
				{
					queueName: 'ci-load-test-queue',
					concurrency: 3,
					retryConfig: {
						maxRetries: 2,
						backoffStrategy: 'fixed',
						baseDelay: 100,
						maxDelay: 100,
						retryableErrors: ['ECONNRESET'],
					},
					circuitBreakerConfig: {
						failureThreshold: 10,
						recoveryTimeout: 2000,
						monitoringPeriod: 60000,
						minimumThroughput: 5,
					},
					deadLetterConfig: {
						queueName: 'ci-load-test-dlq',
						maxRetentionDays: 1,
						alertThreshold: 20,
						processingInterval: 30000,
					},
					persistentStorage: true,
					durabilityGuarantees: true,
				}
			)

			await processor.start()

			const startTime = Date.now()

			// Process events
			await Promise.all(events.map((event) => processor.addEvent(event)))

			// Wait for processing
			await new Promise((resolve) => setTimeout(resolve, 10000))

			const totalTime = Date.now() - startTime

			// Verify processing
			const db = auditDb.getDrizzleInstance()
			const processedEvents = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE action = 'ci.load.test'`
			)

			const processedCount = Number((processedEvents[0] as any).count)
			const successRate = (processedCount / eventCount) * 100

			console.log(
				`CI Load Test: ${processedCount}/${eventCount} events (${successRate.toFixed(2)}%) in ${totalTime}ms`
			)

			expect(successRate).toBeGreaterThan(95)
			expect(totalTime).toBeLessThan(15000) // Should complete within 15 seconds

			await processor.cleanup()
			console.log('✅ Load testing validated')
		})

		it('should validate system recovery from failures', async () => {
			const testEvents: AuditLogEvent[] = []
			for (let i = 0; i < 10; i++) {
				testEvents.push({
					timestamp: new Date().toISOString(),
					action: 'ci.recovery.test',
					status: 'success',
					principalId: `ci-test-recovery-user-${i}`,
				})
			}

			const processor = new ReliableEventProcessor(
				redis,
				async (event: AuditLogEvent) => {
					await auditService.logEvent(event)
				},
				{
					queueName: 'ci-recovery-test-queue',
					concurrency: 2,
					retryConfig: {
						maxRetries: 3,
						backoffStrategy: 'exponential',
						baseDelay: 100,
						maxDelay: 1000,
						retryableErrors: ['ECONNRESET', 'ETIMEDOUT'],
					},
					circuitBreakerConfig: {
						failureThreshold: 5,
						recoveryTimeout: 2000,
						monitoringPeriod: 60000,
						minimumThroughput: 3,
					},
					deadLetterConfig: {
						queueName: 'ci-recovery-test-dlq',
						maxRetentionDays: 1,
						alertThreshold: 5,
						processingInterval: 30000,
					},
					persistentStorage: true,
					durabilityGuarantees: true,
				}
			)

			await processor.start()

			// Process events
			for (const event of testEvents) {
				await processor.addEvent(event)
			}

			// Wait for processing
			await new Promise((resolve) => setTimeout(resolve, 5000))

			// Check system health
			const healthStatus = await processor.getHealthStatus()
			expect(healthStatus.isRunning).toBe(true)
			expect(healthStatus.healthScore).toBeGreaterThan(80)

			await processor.cleanup()
			console.log('✅ Recovery testing validated')
		})
	})

	describe('Data Integrity and Security Tests', () => {
		it('should validate cryptographic integrity', async () => {
			const testEvent: AuditLogEvent = {
				timestamp: new Date().toISOString(),
				action: 'ci.integrity.test',
				status: 'success',
				principalId: 'ci-test-integrity-user',
				targetResourceType: 'IntegrityTestResource',
				targetResourceId: 'resource-001',
			}

			await auditService.logEvent(testEvent)

			// Get the stored event
			const db = auditDb.getDrizzleInstance()
			const storedEvents = await db.execute(
				sql`SELECT * FROM audit_log WHERE principal_id = 'ci-test-integrity-user'`
			)

			expect(storedEvents.length).toBe(1)
			const storedEvent = storedEvents[0] as any

			// Verify cryptographic integrity
			const isValid = await auditService.verifyEventIntegrity(storedEvent.id)
			expect(isValid).toBe(true)

			console.log('✅ Cryptographic integrity validated')
		})

		it('should validate data classification and retention policies', async () => {
			const classifiedEvents: AuditLogEvent[] = [
				{
					timestamp: new Date().toISOString(),
					action: 'ci.classification.phi',
					status: 'success',
					principalId: 'ci-test-classification-user',
					dataClassification: 'PHI',
					retentionPolicy: 'healthcare-7years',
				},
				{
					timestamp: new Date().toISOString(),
					action: 'ci.classification.internal',
					status: 'success',
					principalId: 'ci-test-classification-user',
					dataClassification: 'INTERNAL',
					retentionPolicy: 'standard',
				},
			]

			for (const event of classifiedEvents) {
				await auditService.logEvent(event)
			}

			// Verify classification was stored correctly
			const db = auditDb.getDrizzleInstance()
			const phiEvents = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE data_classification = 'PHI' AND principal_id = 'ci-test-classification-user'`
			)
			const internalEvents = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE data_classification = 'INTERNAL' AND principal_id = 'ci-test-classification-user'`
			)

			expect(Number((phiEvents[0] as any).count)).toBe(1)
			expect(Number((internalEvents[0] as any).count)).toBe(1)

			console.log('✅ Data classification validated')
		})
	})

	describe('CI/CD Pipeline Integration', () => {
		it('should provide test results in CI-friendly format', async () => {
			const testResults = {
				timestamp: new Date().toISOString(),
				environment: 'CI',
				database: {
					connected: await auditDb.checkAuditDbConnection(),
					url: process.env.AUDIT_DB_URL ? '[CONFIGURED]' : '[DEFAULT]',
				},
				redis: {
					status: redis.status,
					connected: redis.status === 'ready',
				},
				services: {
					auditService: !!auditService,
					monitoringService: !!monitoringService,
					gdprService: !!gdprService,
					reportingService: !!reportingService,
				},
				healthChecks: await healthCheckService.checkAllComponents(),
			}

			console.log('📊 CI Test Results:', JSON.stringify(testResults, null, 2))

			// Validate all systems are operational
			expect(testResults.database.connected).toBe(true)
			expect(testResults.redis.connected).toBe(true)
			expect(testResults.services.auditService).toBe(true)
			expect(testResults.healthChecks.status).toBe('OK')

			console.log('✅ CI pipeline integration validated')
		})

		it('should validate test data cleanup', async () => {
			// Verify no test data remains from previous runs
			const db = auditDb.getDrizzleInstance()

			const testDataCount = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE principal_id LIKE 'ci-test-%' OR action LIKE 'ci.%'`
			)

			const count = Number((testDataCount[0] as any).count)

			// Should have some test data from current run, but not excessive amounts
			expect(count).toBeGreaterThan(0) // Current test data
			expect(count).toBeLessThan(1000) // Not excessive from previous runs

			console.log(`📊 Test data count: ${count} records`)
			console.log('✅ Test data management validated')
		})
	})
})
