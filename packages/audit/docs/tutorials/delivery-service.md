# Delivery Service Tutorials

This comprehensive tutorial guide covers practical implementation scenarios for the Delivery Service, from basic setup to advanced enterprise patterns.

## Table of Contents

1. [Basic Implementation](#basic-implementation)
2. [Healthcare Compliance Setup](#healthcare-compliance-setup)
3. [Multi-Destination Fanout](#multi-destination-fanout)
4. [Security Configuration](#security-configuration)
5. [High-Volume Processing](#high-volume-processing)
6. [Monitoring and Observability](#monitoring-and-observability)
7. [Error Handling and Recovery](#error-handling-and-recovery)
8. [Advanced Patterns](#advanced-patterns)

## Basic Implementation

### Setting Up a Simple Delivery Pipeline

This tutorial shows how to set up a basic delivery pipeline for audit reports.

#### Step 1: Initialize the Service

```typescript
import { createDeliveryDatabaseClient, createDeliveryService } from '@repo/audit/delivery'

// Database setup
const databaseClient = createDeliveryDatabaseClient({
	connectionString: process.env.DATABASE_URL,
	ssl: process.env.NODE_ENV === 'production',
})

// Service configuration
const deliveryService = createDeliveryService({
	database: databaseClient,
	config: {
		retry: {
			maxAttempts: 3,
			baseDelay: 1000,
			maxDelay: 30000,
			jitterFactor: 0.1,
		},
		circuitBreaker: {
			failureThreshold: 5,
			resetTimeout: 60000,
		},
	},
})
```

#### Step 2: Create Basic Destinations

```typescript
// Email destination for compliance team
const complianceEmail = await deliveryService.createDestination({
	organizationId: 'hospital-001',
	label: 'Compliance Team Email',
	type: 'email',
	description: 'Daily compliance reports to the compliance team',
	config: {
		email: {
			service: 'sendgrid',
			apiKey: process.env.SENDGRID_API_KEY,
			from: 'audit@hospital.com',
			subject: 'Daily Compliance Report - {{date}}',
			bodyTemplate: `
        Dear Compliance Team,
        
        Please find attached the daily compliance report for {{date}}.
        
        Summary:
        - Total audit events: {{totalEvents}}
        - Failed login attempts: {{failedLogins}}
        - Data access events: {{dataAccess}}
        
        Best regards,
        Audit System
      `,
			recipients: ['compliance@hospital.com', 'security@hospital.com'],
		},
	},
})

// Webhook destination for SIEM integration
const siemWebhook = await deliveryService.createDestination({
	organizationId: 'hospital-001',
	label: 'SIEM Integration',
	type: 'webhook',
	description: 'Real-time audit events to SIEM system',
	config: {
		webhook: {
			url: 'https://siem.hospital.com/api/audit-events',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${process.env.SIEM_API_TOKEN}`,
				'X-Source': 'audit-system',
			},
			timeout: 15000,
			retryConfig: {
				maxRetries: 5,
				backoffMultiplier: 2,
				maxBackoffDelay: 120000,
			},
		},
	},
})
```

#### Step 3: Implement Delivery Logic

```typescript
async function deliverDailyReport(reportData: any) {
	try {
		const response = await deliveryService.deliver({
			organizationId: 'hospital-001',
			destinations: [complianceEmail.id, siemWebhook.id],
			payload: {
				type: 'report',
				data: {
					reportId: `daily-${new Date().toISOString().split('T')[0]}`,
					title: 'Daily Compliance Report',
					generatedAt: new Date().toISOString(),
					...reportData,
				},
				metadata: {
					reportType: 'daily-compliance',
					confidentiality: 'internal',
					retentionDays: 2555, // 7 years for HIPAA
				},
			},
			options: {
				priority: 7,
				correlationId: `daily-report-${Date.now()}`,
				tags: ['compliance', 'daily', 'automated'],
			},
		})

		console.log('Report delivery initiated:', response.deliveryId)
		return response
	} catch (error) {
		console.error('Failed to deliver daily report:', error)
		throw error
	}
}

// Schedule daily report delivery
async function scheduleDailyReports() {
	const reportData = await generateDailyComplianceReport()
	await deliverDailyReport(reportData)
}
```

#

# Healthcare Compliance Setup

### HIPAA-Compliant Delivery Configuration

This tutorial demonstrates setting up delivery destinations that meet HIPAA requirements.

#### Step 1: Secure Storage Destination

```typescript
// S3 destination with HIPAA-compliant configuration
const hipaaArchive = await deliveryService.createDestination({
	organizationId: 'hospital-001',
	label: 'HIPAA Compliant Archive',
	type: 'storage',
	description: 'Long-term storage for HIPAA compliance (7 years)',
	config: {
		storage: {
			provider: 's3',
			config: {
				region: 'us-east-1',
				bucket: 'hospital-hipaa-audit-archive',
				accessKeyId: process.env.AWS_ACCESS_KEY_ID,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
				serverSideEncryption: 'AES256',
				storageClass: 'STANDARD_IA', // Cost-effective for long-term storage
			},
			path: '/audit-logs/{organizationId}/{year}/{month}/{day}/',
			retention: {
				days: 2555, // 7 years as required by HIPAA
				autoCleanup: true,
			},
		},
	},
})
```

#### Step 2: Encrypted Email for PHI

```typescript
// Secure email destination for PHI-containing reports
const secureEmail = await deliveryService.createDestination({
	organizationId: 'hospital-001',
	label: 'Secure PHI Email',
	type: 'email',
	description: 'Encrypted email for PHI-containing audit reports',
	config: {
		email: {
			service: 'ses', // AWS SES with encryption
			config: {
				region: 'us-east-1',
				accessKeyId: process.env.AWS_SES_ACCESS_KEY,
				secretAccessKey: process.env.AWS_SES_SECRET_KEY,
				configurationSet: 'hipaa-compliant-emails',
			},
			from: 'hipaa-audit@hospital.com',
			subject: '[CONFIDENTIAL] PHI Audit Report - {{date}}',
			bodyTemplate: `
        CONFIDENTIAL - CONTAINS PHI
        
        This message contains Protected Health Information (PHI) and is intended
        only for the authorized recipient(s). If you are not the intended
        recipient, please delete this message immediately.
        
        Report Details:
        - Report ID: {{reportId}}
        - Generated: {{generatedAt}}
        - PHI Records: {{phiRecordCount}}
        
        The detailed report is attached as an encrypted file.
        Password will be provided separately.
      `,
			recipients: ['privacy-officer@hospital.com'],
			encryption: {
				enabled: true,
				algorithm: 'AES-256-GCM',
			},
		},
	},
})
```

#### Step 3: PHI Access Logging

```typescript
async function logPhiAccess(accessEvent: any) {
	// Immediate delivery for PHI access events
	const response = await deliveryService.deliver({
		organizationId: 'hospital-001',
		destinations: [complianceWebhook.id, hipaaArchive.id],
		payload: {
			type: 'phi-access',
			data: {
				eventId: accessEvent.id,
				patientId: accessEvent.patientId,
				userId: accessEvent.userId,
				action: accessEvent.action,
				timestamp: accessEvent.timestamp,
				ipAddress: accessEvent.ipAddress,
				userAgent: accessEvent.userAgent,
				accessReason: accessEvent.reason,
				dataElements: accessEvent.dataElements,
			},
			metadata: {
				eventType: 'phi-access',
				confidentiality: 'restricted',
				complianceRequired: true,
				retentionYears: 7,
			},
		},
		options: {
			priority: 10, // Highest priority for PHI events
			idempotencyKey: `phi-access-${accessEvent.id}`,
			correlationId: accessEvent.sessionId,
		},
	})

	// Also send to secure email for high-risk access
	if (accessEvent.riskLevel === 'high') {
		await deliveryService.deliver({
			organizationId: 'hospital-001',
			destinations: [secureEmail.id],
			payload: {
				type: 'alert',
				data: {
					alertType: 'high-risk-phi-access',
					...accessEvent,
				},
				metadata: {
					alertLevel: 'critical',
					requiresReview: true,
				},
			},
			options: {
				priority: 10,
				tags: ['alert', 'high-risk', 'phi-access'],
			},
		})
	}

	return response
}
```

## Multi-Destination Fanout

### Implementing Robust Multi-Destination Delivery

This tutorial shows how to set up delivery to multiple destinations with different priorities and fallback strategies.

#### Step 1: Create Destination Hierarchy

```typescript
// Primary destinations
const primaryDestinations = {
	realTimeWebhook: await deliveryService.createDestination({
		organizationId: 'enterprise-001',
		label: 'Real-time Analytics',
		type: 'webhook',
		config: {
			webhook: {
				url: 'https://analytics.enterprise.com/api/events',
				method: 'POST',
				timeout: 5000, // Fast timeout for real-time
				retryConfig: {
					maxRetries: 2, // Limited retries for real-time
					backoffMultiplier: 1.5,
					maxBackoffDelay: 10000,
				},
			},
		},
	}),

	complianceEmail: await deliveryService.createDestination({
		organizationId: 'enterprise-001',
		label: 'Compliance Notifications',
		type: 'email',
		config: {
			email: {
				service: 'sendgrid',
				apiKey: process.env.SENDGRID_API_KEY,
				from: 'audit@enterprise.com',
				subject: 'Audit Event Notification',
				recipients: ['compliance@enterprise.com'],
			},
		},
	}),
}

// Backup destinations
const backupDestinations = {
	s3Archive: await deliveryService.createDestination({
		organizationId: 'enterprise-001',
		label: 'S3 Backup Archive',
		type: 'storage',
		config: {
			storage: {
				provider: 's3',
				config: {
					region: 'us-west-2',
					bucket: 'enterprise-audit-backup',
				},
				path: '/backup/{year}/{month}/',
				retention: { days: 365, autoCleanup: true },
			},
		},
	}),
}
```

For more advanced tutorials and examples, see the complete documentation in the repository.
