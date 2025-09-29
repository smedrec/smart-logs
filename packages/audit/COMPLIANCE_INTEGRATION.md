# Compliance Service Integration Guide

This guide shows how to integrate the Enhanced Compliance Service with your application to generate comprehensive compliance reports compatible with audit-client types.

## Quick Start

### 1. Install Dependencies

The Enhanced Compliance Service is part of the `@repo/audit` package and works with `@repo/audit-client` types:

```bash
npm install @repo/audit @repo/audit-client @repo/audit-db
```

### 2. Basic Setup

```typescript
import { Audit, EnhancedComplianceService } from '@repo/audit'
import { EnhancedAuditDatabaseClient } from '@repo/audit-db'

// Initialize database client
const dbClient = new EnhancedAuditDatabaseClient({
	connectionString: process.env.DATABASE_URL,
	enableCaching: true,
	enableMonitoring: true,
})

// Initialize audit service
const audit = new Audit({
	organizationId: 'your-org-id',
	enableIntegrityVerification: true,
})

// Create compliance service
const complianceService = new EnhancedComplianceService(dbClient, audit)
```

### 3. Generate Your First Report

```typescript
import type { ReportCriteria } from '@repo/audit-client/types/compliance'

const criteria: ReportCriteria = {
	dateRange: {
		startDate: '2024-01-01T00:00:00Z',
		endDate: '2024-01-31T23:59:59Z',
	},
	organizationIds: ['your-org-id'],
	dataClassifications: ['PHI', 'CONFIDENTIAL'],
	limit: 1000,
}

// Generate HIPAA report
const hipaaReport = await complianceService.generateHIPAAReport(criteria)
console.log(`Compliance Score: ${hipaaReport.summary.complianceScore}%`)
```

## Advanced Usage

### HIPAA Compliance Reporting

```typescript
// Comprehensive HIPAA audit trail report
const hipaaReport = await complianceService.generateHIPAAReport({
	dateRange: {
		startDate: '2024-01-01T00:00:00Z',
		endDate: '2024-12-31T23:59:59Z',
	},
	organizationIds: ['healthcare-org-123'],
	dataClassifications: ['PHI'],
	resourceTypes: ['Patient', 'Observation', 'Condition'],
	statuses: ['success', 'failure'],
	verifiedOnly: true, // Only include cryptographically verified events
	includeIntegrityFailures: true,
})

// Access detailed safeguard analysis
hipaaReport.sections.forEach((section) => {
	console.log(`${section.title}: ${section.status} (${section.score}%)`)

	if (section.violations.length > 0) {
		console.log(`Violations found:`)
		section.violations.forEach((violation) => {
			console.log(`- ${violation.violationType}: ${violation.description}`)
		})
	}
})
```

### GDPR Compliance Reporting

```typescript
// GDPR processing activities report
const gdprReport = await complianceService.generateGDPRReport({
	dateRange: {
		startDate: '2024-01-01T00:00:00Z',
		endDate: '2024-12-31T23:59:59Z',
	},
	organizationIds: ['eu-org-456'],
	actions: [
		'data.read',
		'data.create',
		'data.update',
		'data.delete',
		'data.export',
		'consent.grant',
		'consent.withdraw',
	],
	principalIds: ['user-123', 'user-456'], // Optional: specific data subjects
})

// Review data subject rights activities
console.log(`Data Subject Requests: ${gdprReport.summary.dataSubjectRequests}`)
console.log(`Processing Activities: ${gdprReport.summary.processingActivities}`)
console.log(`Compliance Score: ${gdprReport.summary.complianceScore}%`)
```

### GDPR Data Export (Right to Portability)

```typescript
// Export all data for a specific data subject
const exportResult = await complianceService.exportGDPRData({
	dataSubjectId: 'user-789',
	dataSubjectType: 'user',
	includePersonalData: true,
	includePseudonymizedData: false,
	includeMetadata: true,
	format: 'json',
	deliveryMethod: 'download',
	encryption: {
		enabled: true,
		algorithm: 'AES-256-GCM',
		publicKey: 'user-public-key',
	},
	dateRange: {
		startDate: '2020-01-01T00:00:00Z', // All historical data
		endDate: new Date().toISOString(),
	},
})

console.log(`Export ID: ${exportResult.exportId}`)
console.log(`Records: ${exportResult.recordCount}`)
console.log(`Size: ${exportResult.dataSize} bytes`)
```

### Custom Reports with Templates

```typescript
// Define a custom report template
const customTemplate = {
	id: 'security-audit-template',
	name: 'Security Audit Report',
	description: 'Weekly security events analysis',
	version: '1.0',
	fields: [
		{ name: 'timestamp', type: 'date', required: true },
		{ name: 'principalId', type: 'string', required: true },
		{ name: 'action', type: 'string', required: true },
		{ name: 'status', type: 'string', required: true },
		{ name: 'ipAddress', type: 'string', required: false },
	],
	filters: [
		{ field: 'action', operator: 'contains', value: 'auth', required: false },
		{ field: 'status', operator: 'eq', value: 'failure', required: false },
	],
	aggregations: [
		{ field: 'status', operation: 'count', groupBy: 'principalId' },
		{ field: 'action', operation: 'count', groupBy: 'status' },
	],
	sorting: [{ field: 'timestamp', direction: 'desc' }],
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
}

// Generate custom report
const customReport = await complianceService.generateCustomReport({
	template: customTemplate,
	criteria: {
		dateRange: {
			startDate: '2024-01-01T00:00:00Z',
			endDate: '2024-01-07T23:59:59Z',
		},
		organizationIds: ['org-123'],
		actions: ['auth.login.success', 'auth.login.failure', 'auth.logout'],
	},
	parameters: {
		includeFailureAnalysis: true,
		groupByTimeInterval: 'hour',
	},
	format: 'json',
	includeRawData: true,
})
```

### Data Pseudonymization

```typescript
// Pseudonymize sensitive data for privacy protection
const pseudonymizationResult = await complianceService.pseudonymizeData({
	dataSubjectIds: ['user-123', 'user-456', 'user-789'],
	method: 'hash', // or 'encryption', 'tokenization', 'masking'
	fields: ['principalId', 'targetResourceId', 'sessionId'],
	preserveFormat: true,
	reversible: false,
	dateRange: {
		startDate: '2023-01-01T00:00:00Z',
		endDate: '2023-12-31T23:59:59Z',
	},
	dryRun: true, // Test run first
})

console.log(`Processed Records: ${pseudonymizationResult.processedRecords}`)
console.log(`Affected Fields: ${pseudonymizationResult.affectedFields.join(', ')}`)
```

## Integration Patterns

### Express.js API Integration

```typescript
import express from 'express'

import { EnhancedComplianceService } from '@repo/audit'

const app = express()
const complianceService = new EnhancedComplianceService(dbClient, audit)

// HIPAA report endpoint
app.get('/api/compliance/hipaa', async (req, res) => {
	try {
		const criteria = {
			dateRange: {
				startDate: req.query.startDate as string,
				endDate: req.query.endDate as string,
			},
			organizationIds: [req.user.organizationId],
			dataClassifications: ['PHI'],
		}

		const report = await complianceService.generateHIPAAReport(criteria)
		res.json(report)
	} catch (error) {
		res.status(500).json({ error: error.message })
	}
})

// GDPR data export endpoint
app.post('/api/gdpr/export', async (req, res) => {
	try {
		const exportResult = await complianceService.exportGDPRData({
			dataSubjectId: req.body.dataSubjectId,
			dataSubjectType: 'user',
			format: 'json',
			deliveryMethod: 'download',
			includePersonalData: true,
		})

		res.json(exportResult)
	} catch (error) {
		res.status(500).json({ error: error.message })
	}
})
```

### Scheduled Reports with Cron

```typescript
import cron from 'node-cron'

// Generate weekly HIPAA reports
cron.schedule('0 9 * * 1', async () => {
	// Every Monday at 9 AM
	const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
	const now = new Date()

	const report = await complianceService.generateHIPAAReport({
		dateRange: {
			startDate: weekAgo.toISOString(),
			endDate: now.toISOString(),
		},
		organizationIds: ['org-123'],
		dataClassifications: ['PHI'],
	})

	// Send report via email or save to file
	console.log(`Weekly HIPAA report generated: ${report.id}`)
})
```

### React Frontend Integration

```typescript
// hooks/useComplianceReports.ts
import { useEffect, useState } from 'react'

import type { HIPAAReport, ReportCriteria } from '@repo/audit-client/types/compliance'

export function useHIPAAReport(criteria: ReportCriteria) {
	const [report, setReport] = useState<HIPAAReport | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		async function generateReport() {
			setLoading(true)
			setError(null)

			try {
				const response = await fetch('/api/compliance/hipaa', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(criteria),
				})

				if (!response.ok) throw new Error('Failed to generate report')

				const reportData = await response.json()
				setReport(reportData)
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Unknown error')
			} finally {
				setLoading(false)
			}
		}

		generateReport()
	}, [criteria])

	return { report, loading, error }
}
```

## Error Handling

```typescript
try {
	const report = await complianceService.generateHIPAAReport(criteria)
	// Handle success
} catch (error) {
	if (error.message.includes('Database connection')) {
		// Handle database errors
		console.error('Database unavailable:', error)
	} else if (error.message.includes('Invalid criteria')) {
		// Handle validation errors
		console.error('Invalid report criteria:', error)
	} else {
		// Handle other errors
		console.error('Unexpected error:', error)
	}
}
```

## Performance Optimization

```typescript
// Use pagination for large datasets
const criteria: ReportCriteria = {
	dateRange: { startDate: '2024-01-01', endDate: '2024-12-31' },
	organizationIds: ['org-123'],
	limit: 1000, // Limit results
	offset: 0, // Pagination offset
}

// Enable caching for repeated queries
const dbClient = new EnhancedAuditDatabaseClient({
	connectionString: process.env.DATABASE_URL,
	enableCaching: true,
	cacheConfig: {
		ttl: 300, // 5 minutes
		maxSize: 1000,
	},
})
```

## Type Safety

The service is fully type-safe with TypeScript:

```typescript
import type {
	CustomReport,
	GdprExportParams,
	GDPRReport,
	HIPAAReport,
	PseudonymizationParams,
	ReportCriteria,
} from '@repo/audit-client/types/compliance'

// All parameters and return types are fully typed
const report: HIPAAReport = await complianceService.generateHIPAAReport(criteria)
const exportResult: GdprExportResult = await complianceService.exportGDPRData(params)
```

## Next Steps

1. **Set up monitoring**: Implement alerts for compliance violations
2. **Configure retention**: Set up automated data archival policies
3. **Add encryption**: Enable end-to-end encryption for sensitive reports
4. **Schedule reports**: Set up automated compliance reporting
5. **Integrate notifications**: Send alerts for critical compliance issues

For more examples, see `packages/audit/src/examples/compliance-example.ts`.
