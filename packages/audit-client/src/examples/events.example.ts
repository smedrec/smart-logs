/**
 * Example usage of the EventsService
 *
 * This file demonstrates how to use all the features of the EventsService
 * including creating events, querying, verifying, exporting, streaming, and subscriptions.
 */

import { EventsService } from '../services/events'

import type { PartialAuditClientConfig } from '../index'
import type { CreateAuditEventInput } from '../services/events'

// Example configuration
const config: PartialAuditClientConfig = {
	baseUrl: 'http://localhost:3000',
	apiVersion: 'v1',
	timeout: 30000,
	authentication: {
		type: 'apiKey',
		apiKey: 'your-api-key-here',
		autoRefresh: true,
	},
	retry: {
		enabled: true,
		maxAttempts: 3,
		initialDelayMs: 1000,
		maxDelayMs: 10000,
		backoffMultiplier: 2,
		retryableStatusCodes: [429, 500, 502, 503, 504],
		retryableErrors: ['ECONNRESET', 'ETIMEDOUT'],
	},
	cache: {
		enabled: true,
		defaultTtlMs: 300000, // 5 minutes
		maxSize: 100,
		storage: 'memory',
		keyPrefix: 'audit-client',
		compressionEnabled: false,
	},
	batching: {
		enabled: false,
		maxBatchSize: 10,
		batchTimeoutMs: 1000,
		batchableEndpoints: [],
	},
	performance: {
		enableCompression: true,
		enableStreaming: true,
		maxConcurrentRequests: 10,
		requestDeduplication: true,
		responseTransformation: true,
	},
	logging: {
		enabled: true,
		level: 'info',
		includeRequestBody: false,
		includeResponseBody: false,
		maskSensitiveData: true,
	},
	errorHandling: {
		throwOnError: true,
		includeStackTrace: false,
		transformErrors: true,
	},
	environment: 'production',
	customHeaders: {},
	interceptors: {
		request: [],
		response: [],
	},
}

// Initialize the Events Service
const eventsService = new EventsService(config)

/**
 * Example 1: Creating a single audit event
 * Requirements: 4.1 - WHEN creating audit events THEN the client SHALL validate event data and submit to the server API
 */
async function createSingleEvent() {
	try {
		const eventData: CreateAuditEventInput = {
			action: 'user.login',
			targetResourceType: 'User',
			targetResourceId: 'user-12345',
			principalId: 'user-12345',
			organizationId: 'org-67890',
			status: 'success',
			dataClassification: 'INTERNAL',
			outcomeDescription: 'User successfully logged in via web interface',
			sessionContext: {
				sessionId: 'sess-abc123',
				ipAddress: '192.168.1.100',
				userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
			},
			details: {
				loginMethod: 'password',
				mfaUsed: true,
				deviceFingerprint: 'fp-xyz789',
			},
		}

		const createdEvent = await eventsService.create(eventData)
		console.log('Created audit event:', createdEvent.id)
		return createdEvent
	} catch (error) {
		console.error('Failed to create audit event:', error)
		throw error
	}
}

/**
 * Example 2: Creating multiple audit events in bulk
 * Requirements: 4.1 - WHEN creating audit events THEN the client SHALL validate event data and submit to the server API
 */
async function createBulkEvents() {
	try {
		const events: CreateAuditEventInput[] = [
			{
				action: 'data.read',
				targetResourceType: 'Patient',
				targetResourceId: 'patient-001',
				principalId: 'doctor-123',
				organizationId: 'hospital-456',
				status: 'success',
				dataClassification: 'PHI',
				outcomeDescription: 'Patient record accessed for treatment',
			},
			{
				action: 'data.update',
				targetResourceType: 'Patient',
				targetResourceId: 'patient-001',
				principalId: 'doctor-123',
				organizationId: 'hospital-456',
				status: 'success',
				dataClassification: 'PHI',
				outcomeDescription: 'Patient record updated with new diagnosis',
			},
			{
				action: 'data.export',
				targetResourceType: 'Patient',
				targetResourceId: 'patient-001',
				principalId: 'doctor-123',
				organizationId: 'hospital-456',
				status: 'attempt',
				dataClassification: 'PHI',
				outcomeDescription: 'Attempted to export patient data for referral',
			},
		]

		const result = await eventsService.bulkCreate(events)
		console.log(`Bulk create completed: ${result.successful}/${result.total} successful`)

		// Handle any failures
		if (result.failed > 0) {
			const failures = result.results.filter((r) => !r.success)
			console.warn('Failed events:', failures)
		}

		return result
	} catch (error) {
		console.error('Failed to create bulk audit events:', error)
		throw error
	}
}

/**
 * Example 3: Querying audit events with complex filters
 * Requirements: 4.2 - WHEN querying audit events THEN the client SHALL support filtering, pagination, and sorting options
 */
async function queryEventsWithFilters() {
	try {
		const queryParams = {
			filter: {
				dateRange: {
					startDate: '2025-08-01T00:00:00.000Z',
					endDate: '2025-10-31T23:59:59.999Z',
				},
				principalIds: ['doctor-123', 'nurse-456'],
				actions: ['data.read', 'data.update', 'data.delete'],
				statuses: ['success', 'failure'] as const,
				dataClassifications: ['PHI', 'CONFIDENTIAL'] as const,
				resourceTypes: ['Patient', 'Practitioner'],
				verifiedOnly: true,
			},
			pagination: {
				limit: 50,
				offset: 0,
			},
			sort: {
				field: 'timestamp' as const,
				direction: 'desc' as const,
			},
		}

		const results = await eventsService.query(queryParams)
		console.log(`Found ${results.events.length} events out of ${results.pagination.total} total`)

		// Process results
		results.events.forEach((event) => {
			console.log(
				`Event ${event.id}: ${event.action} on ${event.targetResourceType} - ${event.status}`
			)
		})

		return results
	} catch (error) {
		console.error('Failed to query audit events:', error)
		throw error
	}
}

/**
 * Example 4: Retrieving a specific audit event by ID
 * Requirements: 4.3 - WHEN retrieving specific events THEN the client SHALL provide methods to get events by ID
 */
async function getEventById(eventId: string) {
	try {
		const event = await eventsService.getById(eventId)

		if (event) {
			console.log(`Retrieved event: ${event.action} at ${event.timestamp}`)
			return event
		} else {
			console.log(`Event ${eventId} not found`)
			return null
		}
	} catch (error) {
		console.error(`Failed to retrieve event ${eventId}:`, error)
		throw error
	}
}

/**
 * Example 5: Verifying audit event integrity
 * Requirements: 4.4 - WHEN verifying event integrity THEN the client SHALL provide cryptographic verification methods
 */
async function verifyEventIntegrity(eventId: string) {
	try {
		const verification = await eventsService.verify(eventId)

		console.log(`Event ${eventId} verification:`)
		console.log(`- Valid: ${verification.isValid}`)
		console.log(`- Algorithm: ${verification.hashAlgorithm}`)
		console.log(`- Computed Hash: ${verification.computedHash}`)
		console.log(`- Stored Hash: ${verification.storedHash}`)

		if (verification.details) {
			console.log(`- Signature Valid: ${verification.details.signatureValid}`)
			console.log(`- Chain Integrity: ${verification.details.chainIntegrity}`)
			console.log(`- Timestamp Valid: ${verification.details.timestampValid}`)
		}

		return verification
	} catch (error) {
		console.error(`Failed to verify event ${eventId}:`, error)
		throw error
	}
}

/**
 * Example 6: Exporting audit events
 * Requirements: 4.5 - WHEN handling large result sets THEN the client SHALL support pagination and streaming responses
 */
async function exportEvents() {
	try {
		const exportParams = {
			format: 'json' as const,
			filter: {
				dateRange: {
					startDate: '2025-08-01T00:00:00.000Z',
					endDate: '2025-10-31T23:59:59.999Z',
				},
				dataClassifications: ['PHI'] as const,
			},
			includeMetadata: true,
			compression: 'gzip' as const,
			encryption: {
				enabled: true,
				algorithm: 'AES-256-GCM',
				publicKey: 'your-public-key-here',
			},
		}

		const exportResult = await eventsService.export(exportParams)
		console.log(`Export created: ${exportResult.exportId}`)
		console.log(`Records: ${exportResult.recordCount}`)
		console.log(`Size: ${exportResult.dataSize} bytes`)
		console.log(`Download URL: ${exportResult.downloadUrl}`)
		console.log(`Expires: ${exportResult.expiresAt}`)

		return exportResult
	} catch (error) {
		console.error('Failed to export audit events:', error)
		throw error
	}
}

/**
 * Example 7: Streaming large datasets
 * Requirements: 4.5 - WHEN handling large result sets THEN the client SHALL support pagination and streaming responses
 */
async function streamEvents() {
	try {
		const streamParams = {
			filter: {
				dateRange: {
					startDate: '2023-01-01T00:00:00.000Z',
					endDate: '2023-12-31T23:59:59.999Z',
				},
			},
			batchSize: 1000,
			format: 'ndjson' as const,
		}

		const stream = await eventsService.stream(streamParams)
		const reader = stream.getReader()

		console.log('Starting to stream audit events...')
		let eventCount = 0

		try {
			while (true) {
				const { done, value } = await reader.read()

				if (done) {
					break
				}

				// Process the streamed event
				eventCount++
				if (eventCount % 1000 === 0) {
					console.log(`Processed ${eventCount} events...`)
				}
			}
		} finally {
			reader.releaseLock()
		}

		console.log(`Streaming completed. Total events processed: ${eventCount}`)
		return eventCount
	} catch (error) {
		console.error('Failed to stream audit events:', error)
		throw error
	}
}

/**
 * Example 8: Real-time event subscription
 * Requirements: 4.5 - Real-time event subscription capabilities
 */
async function subscribeToEvents() {
	try {
		const subscription = eventsService.subscribe({
			filter: {
				actions: ['user.login', 'user.logout', 'data.access'],
				principalIds: ['doctor-123'],
				organizationIds: ['hospital-456'],
			},
			transport: 'websocket',
			reconnect: true,
			maxReconnectAttempts: 5,
			heartbeatInterval: 30000,
		})

		// Set up event handlers
		subscription.on('connect', () => {
			console.log('Connected to real-time audit events')
		})

		subscription.on('message', (event) => {
			console.log('Received real-time audit event:', {
				id: event.id,
				action: event.action,
				timestamp: event.timestamp,
				status: event.status,
			})
		})

		subscription.on('error', (error) => {
			console.error('Subscription error:', error)
		})

		subscription.on('disconnect', () => {
			console.log('Disconnected from real-time audit events')
		})

		// Connect to start receiving events
		await subscription.connect()
		console.log('Subscription established:', subscription.id)

		// Example: Update filter after some time
		setTimeout(() => {
			subscription.updateFilter({
				actions: ['data.read', 'data.write'],
				principalIds: ['doctor-123', 'nurse-456'],
			})
			console.log('Updated subscription filter')
		}, 60000) // Update after 1 minute

		return subscription
	} catch (error) {
		console.error('Failed to subscribe to audit events:', error)
		throw error
	}
}

/**
 * Example 9: Getting audit event statistics
 */
async function getEventStatistics() {
	try {
		const stats = await eventsService.getStatistics({
			dateRange: {
				startDate: '2023-10-01T00:00:00.000Z',
				endDate: '2023-10-31T23:59:59.999Z',
			},
			groupBy: 'day',
			filters: {
				organizationIds: ['hospital-456'],
				dataClassifications: ['PHI'],
			},
		})

		console.log('Audit Event Statistics:')
		console.log(`Total Events: ${stats.totalEvents}`)
		console.log('Events by Status:', stats.eventsByStatus)
		console.log('Events by Action:', stats.eventsByAction)
		console.log('Events by Data Classification:', stats.eventsByDataClassification)

		if (stats.timeline) {
			console.log(`Timeline data points: ${stats.timeline.length}`)
		}

		return stats
	} catch (error) {
		console.error('Failed to get audit event statistics:', error)
		throw error
	}
}

/**
 * Complete example workflow
 */
async function completeWorkflowExample() {
	console.log('=== Comprehensive Events Service Example ===')

	try {
		// 1. Create a single event
		console.log('\n1. Creating single audit event...')
		const singleEvent = await createSingleEvent()

		// 2. Create multiple events
		console.log('\n2. Creating bulk audit events...')
		const bulkResult = await createBulkEvents()

		// 3. Query events with filters
		//console.log('\n3. Querying audit events...')
		//const queryResults = await queryEventsWithFilters()

		// 4. Get specific event by ID
		console.log('\n4. Retrieving specific event...')
		await getEventById(singleEvent.id)

		// 5. Verify event integrity
		console.log('\n5. Verifying event integrity...')
		await verifyEventIntegrity(singleEvent.id)

		// 6. Export events
		//console.log('\n6. Exporting audit events...')
		//const exportResult = await exportEvents()

		// 7. Get statistics
		console.log('\n7. Getting event statistics...')
		await getEventStatistics()

		// 8. Set up real-time subscription
		console.log('\n8. Setting up real-time subscription...')
		const subscription = await subscribeToEvents()

		// Clean up after demo
		setTimeout(() => {
			subscription.disconnect()
			console.log('\nDemo completed successfully!')
		}, 5000)
	} catch (error) {
		console.error('Workflow example failed:', error)
	}
}

// Export examples for use in other files
export {
	eventsService,
	createSingleEvent,
	createBulkEvents,
	queryEventsWithFilters,
	getEventById,
	verifyEventIntegrity,
	exportEvents,
	streamEvents,
	subscribeToEvents,
	getEventStatistics,
	completeWorkflowExample,
}

// Run the complete example if this file is executed directly
//if (require.main === module) {
completeWorkflowExample().catch(console.error)
//}
