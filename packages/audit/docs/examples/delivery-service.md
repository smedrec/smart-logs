# Delivery Service Examples

Practical examples and use cases for implementing the Delivery Service in various scenarios.

## Table of Contents

1. [Healthcare Scenarios](#healthcare-scenarios)
2. [Multi-tenant Setup](#multi-tenant-setup)
3. [High-volume Processing](#high-volume-processing)
4. [Security Implementations](#security-implementations)
5. [Integration Patterns](#integration-patterns)
6. [Error Handling Examples](#error-handling-examples)

## Healthcare Scenarios

### HIPAA Compliance Audit Trail

Complete implementation for HIPAA-compliant audit trail delivery:

```typescript
import { createDeliveryService } from '@repo/audit/delivery'

class HIPAAAuditDelivery {
	private deliveryService: any
	private complianceDestinations: Map<string, string> = new Map()

	constructor(databaseClient: any) {
		this.deliveryService = createDeliveryService({
			database: databaseClient,
			config: {
				retry: {
					maxAttempts: 10, // High retry count for compliance
					baseDelay: 2000,
					maxDelay: 300000, // 5 minutes max delay
				},
				security: {
					encryption: { enabled: true },
					webhookSecrets: { rotationDays: 30 },
				},
			},
		})

		this.setupComplianceDestinations()
	}

	private async setupComplianceDestinations() {
		// HIPAA-compliant S3 archive
		const hipaaArchive = await this.deliveryService.createDestination({
			organizationId: 'hospital-001',
			label: 'HIPAA Audit Archive',
			type: 'storage',
			description: '7-year retention for HIPAA compliance',
			config: {
				storage: {
					provider: 's3',
					config: {
						region: 'us-east-1',
						bucket: 'hipaa-audit-archive',
						serverSideEncryption: 'aws:kms',
						kmsKeyId: process.env.HIPAA_KMS_KEY_ID,
						storageClass: 'STANDARD_IA',
					},
					path: '/audit-logs/{organizationId}/{year}/{month}/{day}/',
					retention: {
						days: 2555, // 7 years
						autoCleanup: true,
					},
				},
			},
		})

		// Compliance officer email
		const complianceEmail = await this.deliveryService.createDestination({
			organizationId: 'hospital-001',
			label: 'Compliance Officer Notifications',
			type: 'email',
			config: {
				email: {
					service: 'ses',
					config: {
						region: 'us-east-1',
						configurationSet: 'hipaa-compliant-emails',
					},
					from: 'hipaa-audit@hospital.com',
					subject: '[HIPAA] Audit Event Notification - {{eventType}}',
					bodyTemplate: `
            CONFIDENTIAL - HIPAA PROTECTED INFORMATION
            
            An audit event requiring attention has occurred:
            
            Event Type: {{eventType}}
            Patient ID: {{patientId}}
            User: {{userId}}
            Timestamp: {{timestamp}}
            Action: {{action}}
            
            This notification is sent in compliance with HIPAA audit requirements.
            Please review the attached detailed report.
          `,
					recipients: ['compliance@hospital.com', 'privacy-officer@hospital.com'],
					encryption: {
						enabled: true,
						algorithm: 'AES-256-GCM',
					},
				},
			},
		})

		this.complianceDestinations.set('archive', hipaaArchive.id)
		this.complianceDestinations.set('email', complianceEmail.id)
	}

	async logPatientAccess(accessEvent: {
		patientId: string
		userId: string
		action: string
		timestamp: string
		ipAddress: string
		userAgent: string
		dataElements: string[]
		accessReason: string
		riskLevel: 'low' | 'medium' | 'high'
	}) {
		const destinations = [this.complianceDestinations.get('archive')]

		// Add email notification for high-risk access
		if (accessEvent.riskLevel === 'high') {
			destinations.push(this.complianceDestinations.get('email'))
		}

		return await this.deliveryService.deliver({
			organizationId: 'hospital-001',
			destinations,
			payload: {
				type: 'phi-access-audit',
				data: {
					eventId: `phi-access-${Date.now()}`,
					...accessEvent,
					complianceFlags: {
						hipaaRequired: true,
						retentionYears: 7,
						phiInvolved: true,
					},
				},
				metadata: {
					eventType: 'phi-access',
					confidentiality: 'restricted',
					complianceFramework: 'HIPAA',
					auditCategory: 'patient-data-access',
				},
			},
			options: {
				priority: accessEvent.riskLevel === 'high' ? 10 : 8,
				idempotencyKey: `phi-access-${accessEvent.patientId}-${accessEvent.timestamp}`,
				correlationId: accessEvent.userId,
				tags: ['hipaa', 'phi-access', accessEvent.riskLevel],
			},
		})
	}

	async generateComplianceReport(reportPeriod: {
		startDate: string
		endDate: string
		reportType: 'monthly' | 'quarterly' | 'annual'
	}) {
		const reportData = await this.generateReportData(reportPeriod)

		return await this.deliveryService.deliver({
			organizationId: 'hospital-001',
			destinations: [
				this.complianceDestinations.get('archive'),
				this.complianceDestinations.get('email'),
			],
			payload: {
				type: 'compliance-report',
				data: {
					reportId: `compliance-${reportPeriod.reportType}-${reportPeriod.startDate}`,
					period: reportPeriod,
					summary: reportData.summary,
					details: reportData.details,
					generatedAt: new Date().toISOString(),
				},
				metadata: {
					reportType: `hipaa-${reportPeriod.reportType}`,
					confidentiality: 'internal',
					complianceFramework: 'HIPAA',
				},
			},
			options: {
				priority: 9,
				correlationId: `compliance-report-${reportPeriod.reportType}`,
				tags: ['compliance', 'report', reportPeriod.reportType],
			},
		})
	}

	private async generateReportData(period: any) {
		// Implementation would query audit database for the period
		return {
			summary: {
				totalEvents: 1250,
				phiAccessEvents: 890,
				securityEvents: 15,
				complianceViolations: 2,
			},
			details: {
				// Detailed compliance metrics
			},
		}
	}
}
```

### FHIR Resource Audit Integration

Example of integrating delivery service with FHIR resource auditing:

```typescript
class FHIRAuditDelivery {
	constructor(private deliveryService: any) {}

	async auditFHIRResourceAccess(fhirEvent: {
		resourceType: string
		resourceId: string
		action: 'create' | 'read' | 'update' | 'delete'
		userId: string
		patientId?: string
		timestamp: string
		outcome: 'success' | 'failure'
		outcomeDescription?: string
	}) {
		// Create FHIR-compliant audit event
		const auditEvent = {
			resourceType: 'AuditEvent',
			type: {
				system: 'http://dicom.nema.org/resources/ontology/DCM',
				code: this.getFHIRActionCode(fhirEvent.action),
				display: fhirEvent.action.toUpperCase(),
			},
			subtype: [
				{
					system: 'http://hl7.org/fhir/restful-interaction',
					code: fhirEvent.action,
					display: fhirEvent.action,
				},
			],
			action: fhirEvent.action.charAt(0).toUpperCase(),
			recorded: fhirEvent.timestamp,
			outcome: fhirEvent.outcome === 'success' ? '0' : '4',
			outcomeDesc: fhirEvent.outcomeDescription,
			agent: [
				{
					type: {
						coding: [
							{
								system: 'http://terminology.hl7.org/CodeSystem/extra-security-role-type',
								code: 'humanuser',
								display: 'human user',
							},
						],
					},
					who: {
						identifier: {
							value: fhirEvent.userId,
						},
					},
					requestor: true,
				},
			],
			source: {
				site: 'Hospital EHR System',
				identifier: {
					value: 'ehr-system-001',
				},
			},
			entity: [
				{
					what: {
						reference: `${fhirEvent.resourceType}/${fhirEvent.resourceId}`,
					},
					type: {
						system: 'http://terminology.hl7.org/CodeSystem/audit-entity-type',
						code: '2',
						display: 'System Object',
					},
				},
			],
		}

		// Add patient entity if applicable
		if (fhirEvent.patientId) {
			auditEvent.entity.push({
				what: {
					reference: `Patient/${fhirEvent.patientId}`,
				},
				type: {
					system: 'http://terminology.hl7.org/CodeSystem/audit-entity-type',
					code: '1',
					display: 'Person',
				},
				role: {
					system: 'http://terminology.hl7.org/CodeSystem/object-role',
					code: '1',
					display: 'Patient',
				},
			})
		}

		return await this.deliveryService.deliver({
			organizationId: 'hospital-001',
			destinations: 'default', // Use default FHIR audit destinations
			payload: {
				type: 'fhir-audit-event',
				data: auditEvent,
				metadata: {
					fhirVersion: '4.0.1',
					resourceType: fhirEvent.resourceType,
					action: fhirEvent.action,
					outcome: fhirEvent.outcome,
				},
			},
			options: {
				priority: fhirEvent.outcome === 'failure' ? 9 : 7,
				idempotencyKey: `fhir-audit-${fhirEvent.resourceType}-${fhirEvent.resourceId}-${fhirEvent.timestamp}`,
				tags: ['fhir', 'audit', fhirEvent.resourceType.toLowerCase()],
			},
		})
	}

	private getFHIRActionCode(action: string): string {
		const actionCodes = {
			create: '110100',
			read: '110101',
			update: '110102',
			delete: '110103',
		}
		return actionCodes[action] || '110100'
	}
}
```

## Multi-tenant Setup

### Organization-Isolated Delivery Service

Example of setting up delivery service for multiple healthcare organizations:

```typescript
class MultiTenantDeliveryService {
	private deliveryService: any
	private organizationConfigs: Map<string, any> = new Map()

	constructor(databaseClient: any) {
		this.deliveryService = createDeliveryService({
			database: databaseClient,
			config: {
				security: {
					organizationIsolation: true,
					accessControl: { enabled: true },
				},
			},
		})
	}

	async setupOrganization(orgConfig: {
		organizationId: string
		name: string
		complianceRequirements: string[]
		defaultDestinations: {
			email: string
			storage: string
			webhook?: string
		}
		retentionPolicies: {
			auditLogs: number // days
			reports: number
		}
	}) {
		// Create organization-specific destinations
		const destinations = await this.createOrganizationDestinations(orgConfig)

		// Set up default destinations
		for (const [type, destinationId] of Object.entries(destinations)) {
			await this.deliveryService.setDefaultDestination(orgConfig.organizationId, destinationId)
		}

		// Store organization configuration
		this.organizationConfigs.set(orgConfig.organizationId, {
			...orgConfig,
			destinations,
		})

		return destinations
	}

	private async createOrganizationDestinations(orgConfig: any) {
		const destinations: Record<string, string> = {}

		// Organization-specific email destination
		const emailDest = await this.deliveryService.createDestination({
			organizationId: orgConfig.organizationId,
			label: `${orgConfig.name} - Compliance Email`,
			type: 'email',
			config: {
				email: {
					service: 'sendgrid',
					apiKey: process.env[`SENDGRID_KEY_${orgConfig.organizationId.toUpperCase()}`],
					from: `audit@${orgConfig.organizationId}.com`,
					subject: `[${orgConfig.name}] Audit Notification - {{eventType}}`,
					recipients: [orgConfig.defaultDestinations.email],
				},
			},
		})
		destinations.email = emailDest.id

		// Organization-specific storage destination
		const storageDest = await this.deliveryService.createDestination({
			organizationId: orgConfig.organizationId,
			label: `${orgConfig.name} - Audit Archive`,
			type: 'storage',
			config: {
				storage: {
					provider: 's3',
					config: {
						region: 'us-east-1',
						bucket: `audit-archive-${orgConfig.organizationId}`,
						accessKeyId: process.env.AWS_ACCESS_KEY_ID,
						secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
					},
					path: `/${orgConfig.organizationId}/audit-logs/{year}/{month}/`,
					retention: {
						days: orgConfig.retentionPolicies.auditLogs,
						autoCleanup: true,
					},
				},
			},
		})
		destinations.storage = storageDest.id

		// Optional webhook destination
		if (orgConfig.defaultDestinations.webhook) {
			const webhookDest = await this.deliveryService.createDestination({
				organizationId: orgConfig.organizationId,
				label: `${orgConfig.name} - Integration Webhook`,
				type: 'webhook',
				config: {
					webhook: {
						url: orgConfig.defaultDestinations.webhook,
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'X-Organization': orgConfig.organizationId,
						},
						timeout: 30000,
					},
				},
			})
			destinations.webhook = webhookDest.id
		}

		return destinations
	}

	async deliverForOrganization(
		organizationId: string,
		payload: any,
		options?: {
			destinationTypes?: string[]
			priority?: number
			tags?: string[]
		}
	) {
		const orgConfig = this.organizationConfigs.get(organizationId)
		if (!orgConfig) {
			throw new Error(`Organization ${organizationId} not configured`)
		}

		// Determine destinations based on options
		let destinations: string[]
		if (options?.destinationTypes) {
			destinations = options.destinationTypes
				.map((type) => orgConfig.destinations[type])
				.filter(Boolean)
		} else {
			destinations = 'default' // Use default destinations
		}

		return await this.deliveryService.deliver({
			organizationId,
			destinations,
			payload: {
				...payload,
				metadata: {
					...payload.metadata,
					organizationName: orgConfig.name,
					complianceRequirements: orgConfig.complianceRequirements,
				},
			},
			options: {
				priority: options?.priority || 5,
				correlationId: `${organizationId}-${Date.now()}`,
				tags: [...(options?.tags || []), 'multi-tenant', organizationId],
			},
		})
	}

	async getOrganizationMetrics(
		organizationId: string,
		timeRange: {
			startDate: string
			endDate: string
		}
	) {
		return await this.deliveryService.getDeliveryMetrics({
			organizationId,
			startDate: timeRange.startDate,
			endDate: timeRange.endDate,
		})
	}
}

// Usage example
const multiTenantService = new MultiTenantDeliveryService(databaseClient)

// Setup multiple organizations
await multiTenantService.setupOrganization({
	organizationId: 'hospital-a',
	name: 'General Hospital A',
	complianceRequirements: ['HIPAA', 'SOC2'],
	defaultDestinations: {
		email: 'compliance@hospital-a.com',
		storage: 'audit-archive-hospital-a',
		webhook: 'https://api.hospital-a.com/audit-webhook',
	},
	retentionPolicies: {
		auditLogs: 2555, // 7 years
		reports: 365, // 1 year
	},
})

await multiTenantService.setupOrganization({
	organizationId: 'clinic-b',
	name: 'Specialty Clinic B',
	complianceRequirements: ['HIPAA'],
	defaultDestinations: {
		email: 'admin@clinic-b.com',
		storage: 'audit-archive-clinic-b',
	},
	retentionPolicies: {
		auditLogs: 2555,
		reports: 180,
	},
})

// Deliver audit events for different organizations
await multiTenantService.deliverForOrganization(
	'hospital-a',
	{
		type: 'patient-access',
		data: patientAccessEvent,
	},
	{
		destinationTypes: ['email', 'storage', 'webhook'],
		priority: 8,
		tags: ['patient-access', 'high-priority'],
	}
)

await multiTenantService.deliverForOrganization(
	'clinic-b',
	{
		type: 'user-login',
		data: loginEvent,
	},
	{
		destinationTypes: ['storage'],
		priority: 5,
	}
)
```

## High-volume Processing

### Batch Processing Implementation

Example for handling high-volume audit event processing:

```typescript
class HighVolumeAuditProcessor {
	private batchProcessor: BatchDeliveryProcessor
	private metricsCollector: any
	private performanceMonitor: any

	constructor(deliveryService: any) {
		this.batchProcessor = new BatchDeliveryProcessor(deliveryService)
		this.metricsCollector = createDeliveryMetricsCollector({
			enabled: true,
			collectInterval: 10000,
		})
		this.performanceMonitor = createDeliveryPerformanceMonitor({
			enabled: true,
			sampleRate: 0.1,
		})
	}

	async processAuditEventStream(eventStream: AsyncIterable<any>) {
		const batchSize = 1000
		const batch: any[] = []
		let processedCount = 0
		let errorCount = 0

		const timer = this.performanceMonitor.startTimer('batch-stream-processing')

		try {
			for await (const event of eventStream) {
				batch.push(this.transformAuditEvent(event))

				if (batch.length >= batchSize) {
					try {
						await this.processBatch(batch.splice(0, batchSize))
						processedCount += batchSize
						this.metricsCollector.recordBatchProcessed(batchSize)
					} catch (error) {
						errorCount += batchSize
						this.metricsCollector.recordBatchError()
						console.error('Batch processing failed:', error)
					}
				}

				// Log progress every 10,000 events
				if (processedCount % 10000 === 0) {
					console.log(`Processed ${processedCount} events, ${errorCount} errors`)
				}
			}

			// Process remaining events
			if (batch.length > 0) {
				await this.processBatch(batch)
				processedCount += batch.length
			}

			return {
				totalProcessed: processedCount,
				totalErrors: errorCount,
				successRate: ((processedCount - errorCount) / processedCount) * 100,
			}
		} finally {
			timer.end()
		}
	}

	private transformAuditEvent(rawEvent: any) {
		return {
			organizationId: rawEvent.organizationId,
			destinations: this.selectDestinations(rawEvent),
			payload: {
				type: 'audit-event',
				data: {
					eventId: rawEvent.id,
					timestamp: rawEvent.timestamp,
					userId: rawEvent.userId,
					action: rawEvent.action,
					resource: rawEvent.resource,
					outcome: rawEvent.outcome,
					details: rawEvent.details,
				},
				metadata: {
					eventType: rawEvent.type,
					severity: rawEvent.severity,
					source: rawEvent.source,
				},
			},
			options: {
				priority: this.calculatePriority(rawEvent),
				correlationId: rawEvent.sessionId,
				tags: this.generateTags(rawEvent),
			},
		}
	}

	private selectDestinations(event: any): string[] {
		const destinations = ['default']

		// Add specific destinations based on event characteristics
		if (event.severity === 'high' || event.type === 'security-event') {
			destinations.push('security-webhook')
		}

		if (event.type === 'phi-access') {
			destinations.push('compliance-email')
		}

		return destinations
	}

	private calculatePriority(event: any): number {
		const priorityMap = {
			'security-event': 10,
			'phi-access': 9,
			'admin-action': 7,
			'user-action': 5,
			'system-event': 3,
		}
		return priorityMap[event.type] || 5
	}

	private generateTags(event: any): string[] {
		const tags = ['batch-processed', event.type]

		if (event.severity) {
			tags.push(`severity-${event.severity}`)
		}

		if (event.source) {
			tags.push(`source-${event.source}`)
		}

		return tags
	}

	private async processBatch(batch: any[]) {
		// Group by organization for efficient processing
		const groupedBatch = this.groupByOrganization(batch)

		const promises = Object.entries(groupedBatch).map(([orgId, events]) =>
			this.processOrganizationBatch(orgId, events)
		)

		await Promise.allSettled(promises)
	}

	private groupByOrganization(batch: any[]) {
		return batch.reduce((groups, event) => {
			const orgId = event.organizationId
			if (!groups[orgId]) {
				groups[orgId] = []
			}
			groups[orgId].push(event)
			return groups
		}, {})
	}

	private async processOrganizationBatch(organizationId: string, events: any[]) {
		// Further group by destination for bulk delivery
		const destinationGroups = this.groupByDestinations(events)

		for (const [destinations, groupedEvents] of Object.entries(destinationGroups)) {
			await this.deliverBulkEvents(organizationId, destinations.split(','), groupedEvents)
		}
	}

	private groupByDestinations(events: any[]) {
		return events.reduce((groups, event) => {
			const destKey = event.destinations.sort().join(',')
			if (!groups[destKey]) {
				groups[destKey] = []
			}
			groups[destKey].push(event)
			return groups
		}, {})
	}

	private async deliverBulkEvents(organizationId: string, destinations: string[], events: any[]) {
		// Create bulk payload
		const bulkPayload = {
			type: 'bulk-audit-events',
			data: {
				eventCount: events.length,
				events: events.map((e) => e.payload.data),
				batchId: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
				processedAt: new Date().toISOString(),
			},
			metadata: {
				batchSize: events.length,
				organizationId,
				eventTypes: [...new Set(events.map((e) => e.payload.metadata.eventType))],
			},
		}

		return await this.batchProcessor.addToBatch({
			organizationId,
			destinations,
			payload: bulkPayload,
			options: {
				priority: Math.max(...events.map((e) => e.options.priority)),
				correlationId: `bulk-${organizationId}-${Date.now()}`,
				tags: ['bulk-delivery', 'high-volume', ...new Set(events.flatMap((e) => e.options.tags))],
			},
		})
	}
}

// Usage example
const processor = new HighVolumeAuditProcessor(deliveryService)

// Process a stream of audit events (could be from Kafka, database, etc.)
async function* generateAuditEventStream() {
	// Simulate high-volume event stream
	for (let i = 0; i < 100000; i++) {
		yield {
			id: `event-${i}`,
			organizationId: `org-${i % 10}`, // 10 different organizations
			timestamp: new Date().toISOString(),
			userId: `user-${i % 1000}`,
			action: ['read', 'write', 'delete'][i % 3],
			resource: `resource-${i % 100}`,
			type: ['user-action', 'admin-action', 'system-event'][i % 3],
			severity: ['low', 'medium', 'high'][i % 3],
			source: 'ehr-system',
			outcome: 'success',
		}
	}
}

const eventStream = generateAuditEventStream()
const result = await processor.processAuditEventStream(eventStream)

console.log(`Processing complete:`)
console.log(`- Total processed: ${result.totalProcessed}`)
console.log(`- Total errors: ${result.totalErrors}`)
console.log(`- Success rate: ${result.successRate.toFixed(2)}%`)
```

This comprehensive examples documentation provides practical, production-ready code that demonstrates how to implement the delivery service in various real-world scenarios. Each example includes proper error handling, monitoring, and follows best practices for healthcare compliance and high-volume processing.
