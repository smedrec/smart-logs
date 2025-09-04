# Scheduled Reports Service

The `ScheduledReportsService` provides comprehensive management of automated audit report generation and scheduling. This service allows you to create, update, execute, and monitor scheduled reports with flexible scheduling options and multiple delivery methods.

## Features

- **CRUD Operations**: Create, read, update, and delete scheduled reports
- **Flexible Scheduling**: Support for daily, weekly, monthly, and quarterly schedules
- **Multiple Delivery Methods**: Email, webhook, and storage delivery options
- **Execution Management**: Immediate execution and status monitoring
- **History Tracking**: Complete execution history with filtering and pagination
- **Comprehensive Validation**: Input validation for all operations

## Basic Usage

```typescript
import { AuditClient } from '@repo/audit-client'

const client = new AuditClient({
	baseUrl: 'https://api.example.com',
	authentication: {
		type: 'apiKey',
		apiKey: 'your-api-key',
	},
})

// Access the scheduled reports service
const scheduledReports = client.scheduledReports
```

## Creating Scheduled Reports

### Daily HIPAA Report

```typescript
const dailyReport = await scheduledReports.create({
	name: 'Daily HIPAA Compliance Report',
	description: 'Automated daily HIPAA compliance monitoring',
	reportType: 'hipaa',
	criteria: {
		dateRange: {
			startDate: '2024-01-01',
			endDate: '2024-12-31',
		},
		organizationIds: ['org-123'],
		dataClassifications: ['PHI'],
		format: 'pdf',
	},
	schedule: {
		frequency: 'daily',
		hour: 6,
		minute: 0,
		timezone: 'America/New_York',
	},
	deliveryConfig: {
		method: 'email',
		config: {
			recipients: ['compliance@company.com'],
		},
	},
})
```

### Weekly GDPR Report

```typescript
const weeklyReport = await scheduledReports.create({
	name: 'Weekly GDPR Processing Report',
	reportType: 'gdpr',
	criteria: {
		dateRange: {
			startDate: '2024-01-01',
			endDate: '2024-12-31',
		},
		format: 'csv',
	},
	schedule: {
		frequency: 'weekly',
		dayOfWeek: 1, // Monday
		hour: 8,
		minute: 30,
		timezone: 'Europe/London',
	},
	deliveryConfig: {
		method: 'webhook',
		config: {
			webhookUrl: 'https://company.com/webhook',
		},
	},
})
```

## Managing Reports

### List Reports

```typescript
const reports = await scheduledReports.list({
	organizationId: 'org-123',
	isActive: true,
	limit: 20,
	sortBy: 'name',
	sortOrder: 'asc',
})
```

### Update Report

```typescript
const updated = await scheduledReports.update('report-id', {
	name: 'Updated Report Name',
	schedule: {
		hour: 7, // Change time
	},
})
```

### Enable/Disable Reports

```typescript
// Disable temporarily
await scheduledReports.disable('report-id')

// Re-enable
await scheduledReports.enable('report-id')
```

## Execution Management

### Execute Immediately

```typescript
const execution = await scheduledReports.execute('report-id')
console.log('Execution started:', execution.id)
```

### Monitor Execution

```typescript
const status = await scheduledReports.getExecutionStatus('report-id', 'execution-id')
console.log('Status:', status.status)
console.log('Progress:', status.progress)
```

### Download Results

```typescript
const blob = await scheduledReports.downloadExecution('report-id', 'execution-id', 'json')
```

## API Reference

See the [examples](../src/examples/scheduled-reports-examples.ts) for comprehensive usage patterns.
