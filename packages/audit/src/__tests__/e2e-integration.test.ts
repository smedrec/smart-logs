/**
 * End-to-End Integration Tests for Complete Audit System
 * Tests the complete audit event lifecycle from creation to storage and retrieval
 */

import { sql } from 'drizzle-orm'
import { Redis } from 'ioredis'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { AuditDb } from '@repo/audit-db'
import { closeSharedRedisConnection, getSharedRedisConnection } from '@repo/redis-client'

import { AuditService } from '../audit.js'
import { GDPRComplianceService } from '../gdpr/gdpr-compliance.js'
import { DatabaseAlertHandler } from '../monitor/database-alert-handler.js'
import { MonitoringService } from '../monitor/monitoring.js'
import { ReliableEventProcessor } from '../queue/reliable-processor.js'
import { ComplianceReportingService } from '../report/compliance-reporting.js'

import type { AuditLogEvent, EnhancedAuditLogEvent } from '../types.js'

describe('End-to-End Audit System Integration', () => {
	let auditDb: AuditDb
	let redis: Redis
	let auditService: AuditService
	let eventProcessor: ReliableEventProcessor
	let monitoringService: MonitoringService
	let gdprService: GDPRComplianceService
	let reportingService: ComplianceReportingService

	beforeAll(async () => {
		// Setup test database
		const dbUrl = process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit_test'
		auditDb = new AuditDb(dbUrl)

		// Verify database connection
		const connected = await auditDb.checkAuditDbConnection()
		if (!connected) {
			throw new Error('Cannot connect to test database')
		}

		// Setup Redis connection
		redis = getSharedRedisConnection()

		// Initialize services
		auditService = new AuditService({
			database: auditDb,
			redis,
			enableCryptographicIntegrity: true,
			enableGDPRCompliance: true,
			enableMonitoring: true,
		})

		monitoringService = new MonitoringService()
		monitoringService.addAlertHandler(new DatabaseAlertHandler(auditDb))

		gdprService = new GDPRComplianceService(auditDb)
		reportingService = new ComplianceReportingService(auditDb)

		eventProcessor = new ReliableEventProcessor(
			redis,
			async (event: AuditLogEvent) => {
				await auditService.logEvent(event)
				await monitoringService.processEvent(event)
			},
			{
				queueName: 'e2e-test-queue',
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
					minimumThroughput: 5,
				},
				deadLetterConfig: {
					queueName: 'e2e-test-dlq',
					maxRetentionDays: 7,
					alertThreshold: 10,
					processingInterval: 30000,
				},
				persistentStorage: true,
				durabilityGuarantees: true,
			}
		)

		await eventProcessor.start()
	})

	afterAll(async () => {
		await eventProcessor?.cleanup()
		await auditDb?.end()
		await closeSharedRedisConnection()
	})

	describe('Complete Audit Event Lifecycle', () => {
		it('should process audit events through complete pipeline with cryptographic integrity', async () => {
			const testEvent: AuditLogEvent = {
				timestamp: new Date().toISOString(),
				action: 'fhir.patient.read',
				status: 'success',
				principalId: 'doctor-123',
				targetResourceType: 'Patient',
				targetResourceId: 'patient-456',
				sessionContext: {
					sessionId: 'session-789',
					ipAddress: '192.168.1.100',
					userAgent: 'Mozilla/5.0 (compatible; FHIR-Client/1.0)',
				},
				dataClassification: 'PHI',
				retentionPolicy: 'healthcare-7years',
			}

			// 1. Queue event for processing
			await eventProcessor.addEvent(testEvent)

			// 2. Wait for processing to complete
			await new Promise((resolve) => setTimeout(resolve, 1000))

			// 3. Verify event was stored with cryptographic integrity
			const db = auditDb.getDrizzleInstance()
			const storedEvents = await db.execute(
				sql`SELECT * FROM audit_log WHERE principal_id = ${testEvent.principalId} ORDER BY created_at DESC LIMIT 1`
			)

			expect(storedEvents).toHaveLength(1)
			const storedEvent = storedEvents[0] as any

			expect(storedEvent.action).toBe(testEvent.action)
			expect(storedEvent.status).toBe(testEvent.status)
			expect(storedEvent.principal_id).toBe(testEvent.principalId)
			expect(storedEvent.target_resource_type).toBe(testEvent.targetResourceType)
			expect(storedEvent.target_resource_id).toBe(testEvent.targetResourceId)
			expect(storedEvent.hash).toBeDefined()
			expect(storedEvent.hash_algorithm).toBe('SHA-256')
			expect(storedEvent.data_classification).toBe('PHI')
			expect(storedEvent.retention_policy).toBe('healthcare-7years')

			// 4. Verify cryptographic integrity
			const isValid = await auditService.verifyEventIntegrity(storedEvent.id)
			expect(isValid).toBe(true)

			// 5. Verify monitoring processed the event
			const metrics = monitoringService.getMetrics()
			expect(metrics.eventsProcessed).toBeGreaterThan(0)
		})

		it('should handle FHIR audit events with proper categorization', async () => {
			const fhirEvents: AuditLogEvent[] = [
				{
					timestamp: new Date().toISOString(),
					action: 'fhir.patient.create',
					status: 'success',
					principalId: 'nurse-456',
					targetResourceType: 'Patient',
					targetResourceId: 'patient-new-001',
					dataClassification: 'PHI',
				},
				{
					timestamp: new Date().toISOString(),
					action: 'fhir.observation.create',
					status: 'success',
					principalId: 'doctor-789',
					targetResourceType: 'Observation',
					targetResourceId: 'obs-001',
					dataClassification: 'PHI',
				},
				{
					timestamp: new Date().toISOString(),
					action: 'fhir.bundle.process',
					status: 'success',
					principalId: 'system-integration',
					targetResourceType: 'Bundle',
					targetResourceId: 'bundle-batch-001',
					dataClassification: 'PHI',
				},
			]

			// Process all FHIR events
			for (const event of fhirEvents) {
				await eventProcessor.addEvent(event)
			}

			// Wait for processing
			await new Promise((resolve) => setTimeout(resolve, 1500))

			// Verify all events were stored and categorized correctly
			const db = auditDb.getDrizzleInstance()
			const storedFhirEvents = await db.execute(
				sql`SELECT * FROM audit_log WHERE action LIKE 'fhir.%' ORDER BY created_at DESC LIMIT 3`
			)

			expect(storedFhirEvents).toHaveLength(3)

			// Verify each event has proper FHIR categorization
			for (const storedEvent of storedFhirEvents) {
				expect((storedEvent as any).action).toMatch(/^fhir\./)
				expect((storedEvent as any).data_classification).toBe('PHI')
				expect((storedEvent as any).hash).toBeDefined()
			}
		})

		it('should handle authentication audit events with security monitoring', async () => {
			const authEvents: AuditLogEvent[] = [
				{
					timestamp: new Date().toISOString(),
					action: 'auth.login.success',
					status: 'success',
					principalId: 'user-auth-test',
					sessionContext: {
						sessionId: 'session-auth-001',
						ipAddress: '192.168.1.200',
						userAgent: 'Mozilla/5.0',
					},
				},
				{
					timestamp: new Date().toISOString(),
					action: 'auth.password.change',
					status: 'success',
					principalId: 'user-auth-test',
					sessionContext: {
						sessionId: 'session-auth-002',
						ipAddress: '192.168.1.200',
						userAgent: 'Mozilla/5.0',
					},
				},
				{
					timestamp: new Date().toISOString(),
					action: 'auth.logout',
					status: 'success',
					principalId: 'user-auth-test',
					sessionContext: {
						sessionId: 'session-auth-002',
						ipAddress: '192.168.1.200',
						userAgent: 'Mozilla/5.0',
					},
				},
			]

			// Process authentication events
			for (const event of authEvents) {
				await eventProcessor.addEvent(event)
			}

			// Wait for processing
			await new Promise((resolve) => setTimeout(resolve, 1000))

			// Verify events were stored
			const db = auditDb.getDrizzleInstance()
			const storedAuthEvents = await db.execute(
				sql`SELECT * FROM audit_log WHERE action LIKE 'auth.%' AND principal_id = 'user-auth-test' ORDER BY created_at DESC`
			)

			expect(storedAuthEvents.length).toBeGreaterThanOrEqual(3)

			// Verify session context was preserved
			for (const storedEvent of storedAuthEvents) {
				const sessionContext = JSON.parse((storedEvent as any).session_context || '{}')
				expect(sessionContext.ipAddress).toBe('192.168.1.200')
				expect(sessionContext.userAgent).toBe('Mozilla/5.0')
			}
		})
	})

	describe('GDPR Compliance Integration', () => {
		it('should export user audit data in portable format', async () => {
			const testUserId = 'gdpr-test-user-001'

			// Create test events for the user
			const userEvents: AuditLogEvent[] = [
				{
					timestamp: new Date().toISOString(),
					action: 'data.read',
					status: 'success',
					principalId: testUserId,
					targetResourceType: 'Patient',
					targetResourceId: 'patient-gdpr-001',
				},
				{
					timestamp: new Date().toISOString(),
					action: 'data.update',
					status: 'success',
					principalId: testUserId,
					targetResourceType: 'Patient',
					targetResourceId: 'patient-gdpr-001',
				},
			]

			// Process events
			for (const event of userEvents) {
				await eventProcessor.addEvent(event)
			}

			await new Promise((resolve) => setTimeout(resolve, 1000))

			// Export user data
			const exportData = await gdprService.exportUserData(testUserId)

			expect(exportData).toBeDefined()
			expect(exportData.userId).toBe(testUserId)
			expect(exportData.auditLogs).toHaveLength(2)
			expect(exportData.exportTimestamp).toBeDefined()
			expect(exportData.format).toBe('JSON')

			// Verify exported data contains all user events
			const exportedActions = exportData.auditLogs.map((log) => log.action)
			expect(exportedActions).toContain('data.read')
			expect(exportedActions).toContain('data.update')
		})

		it('should pseudonymize user data while maintaining referential integrity', async () => {
			const testUserId = 'gdpr-pseudonymize-user'

			// Create events with cross-references
			const events: AuditLogEvent[] = [
				{
					timestamp: new Date().toISOString(),
					action: 'fhir.patient.read',
					status: 'success',
					principalId: testUserId,
					targetResourceType: 'Patient',
					targetResourceId: 'patient-pseudo-001',
				},
				{
					timestamp: new Date().toISOString(),
					action: 'data.share',
					status: 'success',
					principalId: testUserId,
					targetResourceType: 'Patient',
					targetResourceId: 'patient-pseudo-001',
				},
			]

			for (const event of events) {
				await eventProcessor.addEvent(event)
			}

			await new Promise((resolve) => setTimeout(resolve, 1000))

			// Pseudonymize user data
			const pseudonymizationResult = await gdprService.pseudonymizeUserData(testUserId)

			expect(pseudonymizationResult.success).toBe(true)
			expect(pseudonymizationResult.pseudonymId).toBeDefined()
			expect(pseudonymizationResult.affectedRecords).toBeGreaterThan(0)

			// Verify data was pseudonymized
			const db = auditDb.getDrizzleInstance()
			const pseudonymizedEvents = await db.execute(
				sql`SELECT * FROM audit_log WHERE principal_id = ${pseudonymizationResult.pseudonymId}`
			)

			expect(pseudonymizedEvents.length).toBe(2)

			// Verify original user ID no longer exists
			const originalEvents = await db.execute(
				sql`SELECT * FROM audit_log WHERE principal_id = ${testUserId}`
			)

			expect(originalEvents.length).toBe(0)
		})
	})

	describe('Compliance Reporting Integration', () => {
		it('should generate comprehensive compliance reports', async () => {
			// Create diverse audit events for reporting
			const reportingEvents: AuditLogEvent[] = [
				{
					timestamp: new Date().toISOString(),
					action: 'fhir.patient.read',
					status: 'success',
					principalId: 'doctor-report-001',
					targetResourceType: 'Patient',
					targetResourceId: 'patient-report-001',
					dataClassification: 'PHI',
				},
				{
					timestamp: new Date().toISOString(),
					action: 'data.export',
					status: 'success',
					principalId: 'admin-report-001',
					targetResourceType: 'Patient',
					targetResourceId: 'patient-report-001',
					dataClassification: 'PHI',
				},
				{
					timestamp: new Date().toISOString(),
					action: 'auth.login.failure',
					status: 'failure',
					principalId: 'unauthorized-user',
					outcomeDescription: 'Invalid credentials',
				},
			]

			for (const event of reportingEvents) {
				await eventProcessor.addEvent(event)
			}

			await new Promise((resolve) => setTimeout(resolve, 1000))

			// Generate compliance report
			const report = await reportingService.generateComplianceReport({
				startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
				endDate: new Date(),
				includeFailures: true,
				includePHI: true,
				groupBy: 'action',
			})

			expect(report).toBeDefined()
			expect(report.summary.totalEvents).toBeGreaterThan(0)
			expect(report.summary.successfulEvents).toBeGreaterThan(0)
			expect(report.summary.failedEvents).toBeGreaterThan(0)
			expect(report.eventsByAction).toBeDefined()
			expect(report.securityEvents).toBeDefined()
			expect(report.phiAccess).toBeDefined()
		})

		it('should verify audit trail integrity in reports', async () => {
			const integrityTestEvent: AuditLogEvent = {
				timestamp: new Date().toISOString(),
				action: 'integrity.test',
				status: 'success',
				principalId: 'integrity-test-user',
				targetResourceType: 'TestResource',
				targetResourceId: 'test-resource-001',
			}

			await eventProcessor.addEvent(integrityTestEvent)
			await new Promise((resolve) => setTimeout(resolve, 1000))

			// Generate integrity verification report
			const integrityReport = await reportingService.generateIntegrityReport({
				startDate: new Date(Date.now() - 60 * 60 * 1000), // Last hour
				endDate: new Date(),
				verifyHashes: true,
			})

			expect(integrityReport).toBeDefined()
			expect(integrityReport.summary.totalEventsChecked).toBeGreaterThan(0)
			expect(integrityReport.summary.integrityViolations).toBe(0)
			expect(integrityReport.summary.verificationSuccessRate).toBe(100)
		})
	})

	describe('Real-time Monitoring and Alerting', () => {
		it('should detect and alert on suspicious patterns', async () => {
			// Generate suspicious failed authentication pattern
			const suspiciousEvents: AuditLogEvent[] = []
			for (let i = 0; i < 6; i++) {
				suspiciousEvents.push({
					timestamp: new Date().toISOString(),
					action: 'auth.login.failure',
					status: 'failure',
					principalId: 'suspicious-user-e2e',
					sessionContext: {
						sessionId: `session-${i}`,
						ipAddress: '192.168.1.999',
						userAgent: 'Suspicious-Bot/1.0',
					},
					outcomeDescription: 'Invalid credentials',
				})
			}

			// Process suspicious events
			for (const event of suspiciousEvents) {
				await eventProcessor.addEvent(event)
			}

			await new Promise((resolve) => setTimeout(resolve, 1500))

			// Check for generated alerts
			const activeAlerts = monitoringService.getActiveAlerts()
			expect(activeAlerts.length).toBeGreaterThan(0)

			const securityAlert = activeAlerts.find(
				(alert) => alert.type === 'SECURITY' && alert.title.includes('FAILED_AUTH')
			)
			expect(securityAlert).toBeDefined()
			expect(securityAlert!.severity).toBe('HIGH')

			// Verify alert was persisted to database
			const db = auditDb.getDrizzleInstance()
			const persistedAlerts = await db.execute(
				sql`SELECT * FROM alerts WHERE alert_type = 'SECURITY' AND resolved = false ORDER BY created_at DESC LIMIT 1`
			)

			expect(persistedAlerts.length).toBeGreaterThan(0)
		})

		it('should track system health and performance metrics', async () => {
			// Generate various events to populate metrics
			const performanceEvents: AuditLogEvent[] = []
			for (let i = 0; i < 10; i++) {
				performanceEvents.push({
					timestamp: new Date().toISOString(),
					action: 'performance.test',
					status: i % 7 === 0 ? 'failure' : 'success', // Some failures for realistic metrics
					principalId: `perf-user-${i}`,
				})
			}

			for (const event of performanceEvents) {
				await eventProcessor.addEvent(event)
			}

			await new Promise((resolve) => setTimeout(resolve, 1000))

			// Check system metrics
			const metrics = monitoringService.getMetrics()
			expect(metrics.eventsProcessed).toBeGreaterThan(0)
			expect(metrics.successRate).toBeGreaterThan(0)
			expect(metrics.errorRate).toBeGreaterThanOrEqual(0)
			expect(metrics.averageProcessingTime).toBeGreaterThan(0)

			// Check processor health
			const healthStatus = await eventProcessor.getHealthStatus()
			expect(healthStatus.isRunning).toBe(true)
			expect(healthStatus.healthScore).toBeGreaterThan(0)
			expect(healthStatus.processorMetrics.totalProcessed).toBeGreaterThan(0)
		})
	})

	describe('Error Recovery and Resilience', () => {
		it('should recover from temporary database failures', async () => {
			const resilientEvent: AuditLogEvent = {
				timestamp: new Date().toISOString(),
				action: 'resilience.test',
				status: 'success',
				principalId: 'resilience-test-user',
			}

			// Mock temporary database failure
			const originalLogEvent = auditService.logEvent.bind(auditService)
			let attemptCount = 0

			vi.spyOn(auditService, 'logEvent').mockImplementation(async (event: AuditLogEvent) => {
				attemptCount++
				if (attemptCount <= 2) {
					const error = new Error('Database connection failed')
					;(error as any).code = 'ECONNRESET'
					throw error
				}
				return originalLogEvent(event)
			})

			// Process event - should succeed after retries
			await eventProcessor.addEvent(resilientEvent)
			await new Promise((resolve) => setTimeout(resolve, 2000))

			// Verify event was eventually processed
			const db = auditDb.getDrizzleInstance()
			const processedEvents = await db.execute(
				sql`SELECT * FROM audit_log WHERE principal_id = 'resilience-test-user'`
			)

			expect(processedEvents.length).toBeGreaterThan(0)
			expect(attemptCount).toBeGreaterThan(2) // Confirms retries occurred

			// Restore original method
			vi.restoreAllMocks()
		})

		it('should handle high-volume processing without data loss', async () => {
			const highVolumeEvents: AuditLogEvent[] = []

			// Generate 50 events for high-volume test
			for (let i = 0; i < 50; i++) {
				highVolumeEvents.push({
					timestamp: new Date().toISOString(),
					action: 'high.volume.test',
					status: 'success',
					principalId: `volume-user-${i}`,
					targetResourceType: 'VolumeResource',
					targetResourceId: `resource-${i}`,
				})
			}

			// Process all events concurrently
			const startTime = Date.now()
			await Promise.all(highVolumeEvents.map((event) => eventProcessor.addEvent(event)))

			// Wait for processing to complete
			await new Promise((resolve) => setTimeout(resolve, 3000))
			const processingTime = Date.now() - startTime

			// Verify all events were processed
			const db = auditDb.getDrizzleInstance()
			const processedEvents = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE action = 'high.volume.test'`
			)

			const eventCount = (processedEvents[0] as any).count
			expect(Number(eventCount)).toBe(50)

			// Verify reasonable processing time (should be under 10 seconds)
			expect(processingTime).toBeLessThan(10000)

			// Verify system health after high volume
			const healthStatus = await eventProcessor.getHealthStatus()
			expect(healthStatus.healthScore).toBeGreaterThan(50) // Should maintain reasonable health
		})
	})
})
