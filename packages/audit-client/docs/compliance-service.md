# ComplianceService Documentation

The `ComplianceService` provides comprehensive compliance reporting capabilities for HIPAA, GDPR, and custom compliance frameworks. It offers features for report generation, data export, pseudonymization, and template management.

## Features

- **HIPAA Compliance Reports**: Generate detailed HIPAA compliance reports with risk assessments
- **GDPR Compliance Reports**: Create GDPR compliance reports with consent management tracking
- **Custom Reports**: Generate flexible custom reports using templates
- **GDPR Data Export**: Export user data for GDPR data portability requests
- **Data Pseudonymization**: Pseudonymize sensitive data for privacy protection
- **Report Templates**: Manage and create custom report templates
- **Streaming Support**: Handle large reports with streaming capabilities
- **Multiple Formats**: Support for PDF, CSV, JSON, and XLSX output formats

## Basic Usage

```typescript
import { ComplianceService } from '@smart-logs/audit-client'

import type { ReportCriteria } from '@smart-logs/audit-client'

// Initialize the service
const complianceService = new ComplianceService(config)

// Generate a HIPAA compliance report
const criteria: ReportCriteria = {
	dateRange: {
		startDate: '2024-01-01',
		endDate: '2024-12-31',
	},
	organizationIds: ['healthcare-org-1'],
	dataClassifications: ['PHI'],
}

const hipaaReport = await complianceService.generateHipaaReport(criteria)
```

## API Reference

### Report Generation

#### `generateHipaaReport(criteria: ReportCriteria): Promise<HIPAAReport>`

Generates a comprehensive HIPAA compliance report.

**Parameters:**

- `criteria`: Report filtering criteria including date range, organizations, and data classifications

**Returns:**

- `HIPAAReport`: Complete HIPAA compliance report with sections, violations, and risk assessment

**Example:**

```typescript
const report = await complianceService.generateHipaaReport({
	dateRange: {
		startDate: '2024-01-01',
		endDate: '2024-12-31',
	},
	organizationIds: ['healthcare-org-1'],
	dataClassifications: ['PHI'],
	includeDetails: true,
})

console.log(`Compliance Score: ${report.summary.complianceScore}%`)
console.log(`Violations: ${report.summary.violations}`)
console.log(`Risk Level: ${report.summary.riskAssessment.overallRisk}`)
```

#### `generateGdprReport(criteria: ReportCriteria): Promise<GDPRReport>`

Generates a GDPR compliance report with consent management and data retention analysis.

**Parameters:**

- `criteria`: Report filtering criteria

**Returns:**

- `GDPRReport`: Complete GDPR compliance report with data subject information and consent tracking

**Example:**

```typescript
const gdprReport = await complianceService.generateGdprReport({
	dateRange: {
		startDate: '2024-01-01',
		endDate: '2024-12-31',
	},
	organizationIds: ['eu-company-1'],
	actions: ['data-processing', 'data-access'],
})

console.log(`Data Subjects: ${gdprReport.summary.dataSubjects}`)
console.log(`Active Consents: ${gdprReport.summary.consentManagement.activeConsents}`)
```

#### `generateCustomReport(params: CustomReportParams): Promise<CustomReport>`

Generates a custom report using a specified template.

**Parameters:**

- `params`: Custom report parameters including template ID, criteria, and output format

**Returns:**

- `CustomReport`: Generated custom report with data and summary

**Example:**

```typescript
const customReport = await complianceService.generateCustomReport({
	templateId: 'security-audit-v1',
	name: 'Q4 Security Audit',
	criteria: {
		dateRange: {
			startDate: '2024-10-01',
			endDate: '2024-12-31',
		},
	},
	parameters: {
		includeFailedAttempts: true,
		riskThreshold: 'medium',
	},
	outputFormat: 'xlsx',
	includeCharts: true,
})
```

### GDPR Data Management

#### `exportGdprData(params: GdprExportParams): Promise<GdprExportResult>`

Exports user data for GDPR data portability requests.

**Parameters:**

- `params`: Export parameters including data subject ID and format

**Returns:**

- `GdprExportResult`: Export result with data and download information

**Example:**

```typescript
const exportResult = await complianceService.exportGdprData({
	dataSubjectId: 'user-12345',
	organizationId: 'company-1',
	includePersonalData: true,
	includePseudonymizedData: false,
	includeMetadata: true,
	format: 'json',
	categories: ['personal-info', 'activity-logs'],
})

console.log(`Export ID: ${exportResult.exportId}`)
console.log(`Total Records: ${exportResult.summary.totalRecords}`)
console.log(`Download URL: ${exportResult.downloadUrl}`)
```

#### `pseudonymizeData(params: PseudonymizationParams): Promise<PseudonymizationResult>`

Pseudonymizes sensitive data for privacy protection.

**Parameters:**

- `params`: Pseudonymization parameters including data subjects, fields, and method

**Returns:**

- `PseudonymizationResult`: Result of the pseudonymization operation

**Example:**

```typescript
const result = await complianceService.pseudonymizeData({
	dataSubjectIds: ['user-123', 'user-456'],
	organizationId: 'company-1',
	fields: ['email', 'phone', 'address'],
	method: 'hash',
	preserveFormat: true,
	saltValue: 'secure-salt-2024',
})

console.log(`Processed: ${result.summary.processedRecords} records`)
console.log(`Failed: ${result.summary.failedRecords} records`)
```

### Template Management

#### `getReportTemplates(): Promise<ReportTemplate[]>`

Retrieves all available report templates.

**Returns:**

- `ReportTemplate[]`: Array of available report templates

#### `getReportTemplate(templateId: string): Promise<ReportTemplate | null>`

Retrieves a specific report template by ID.

**Parameters:**

- `templateId`: Unique identifier of the template

**Returns:**

- `ReportTemplate | null`: Template details or null if not found

#### `createReportTemplate(template: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReportTemplate>`

Creates a new report template.

**Parameters:**

- `template`: Template definition without system-generated fields

**Returns:**

- `ReportTemplate`: Created template with generated ID and timestamps

**Example:**

```typescript
const template = await complianceService.createReportTemplate({
	name: 'Custom Security Template',
	description: 'Template for security audits',
	category: 'security',
	version: '1.0',
	parameters: [
		{
			name: 'riskLevel',
			type: 'string',
			required: false,
			description: 'Minimum risk level',
			defaultValue: 'medium',
			options: ['low', 'medium', 'high'],
		},
	],
	outputFormats: ['pdf', 'csv'],
	isActive: true,
})
```

### Report Management

#### `downloadReport(reportId: string, options: ReportDownloadOptions): Promise<Blob>`

Downloads a generated report in the specified format.

**Parameters:**

- `reportId`: Unique identifier of the report
- `options`: Download options including format and compression

**Returns:**

- `Blob`: Report file as a binary blob

**Example:**

```typescript
const reportBlob = await complianceService.downloadReport('report-123', {
	format: 'pdf',
	includeCharts: true,
	includeMetadata: true,
	compression: 'zip',
})

// Save to file or display to user
const url = URL.createObjectURL(reportBlob)
const link = document.createElement('a')
link.href = url
link.download = 'compliance-report.pdf'
link.click()
```

#### `getReportStatus(reportId: string): Promise<ReportStatus>`

Gets the current status of a report generation process.

**Parameters:**

- `reportId`: Unique identifier of the report

**Returns:**

- `ReportStatus`: Current status, progress, and estimated completion time

#### `streamReport(reportId: string, format?: 'json' | 'csv'): Promise<ReadableStream>`

Streams large report data for processing.

**Parameters:**

- `reportId`: Unique identifier of the report
- `format`: Output format (default: 'json')

**Returns:**

- `ReadableStream`: Streaming data for the report

**Example:**

```typescript
const stream = await complianceService.streamReport('large-report-123', 'json')
const reader = stream.getReader()

while (true) {
	const { done, value } = await reader.read()
	if (done) break

	// Process each chunk of data
	const chunk = new TextDecoder().decode(value)
	console.log('Received chunk:', chunk)
}
```

## Type Definitions

### ReportCriteria

```typescript
interface ReportCriteria {
	dateRange: {
		startDate: string
		endDate: string
	}
	organizationIds?: string[]
	principalIds?: string[]
	resourceTypes?: string[]
	actions?: string[]
	dataClassifications?: ('PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI')[]
	includeDetails?: boolean
	includeMetadata?: boolean
}
```

### HIPAAReport

```typescript
interface HIPAAReport {
	id: string
	generatedAt: string
	criteria: ReportCriteria
	summary: {
		totalEvents: number
		complianceScore: number
		violations: number
		recommendations: string[]
		riskAssessment: {
			overallRisk: 'low' | 'medium' | 'high' | 'critical'
			riskFactors: string[]
		}
	}
	sections: HIPAASection[]
	metadata: ReportMetadata
}
```

### GDPRReport

```typescript
interface GDPRReport {
	id: string
	generatedAt: string
	criteria: ReportCriteria
	summary: {
		totalEvents: number
		dataSubjects: number
		processingActivities: number
		lawfulBases: string[]
		consentManagement: {
			totalConsents: number
			activeConsents: number
			withdrawnConsents: number
		}
		dataRetention: {
			withinRetentionPeriod: number
			exceedsRetentionPeriod: number
		}
	}
	sections: GDPRSection[]
	metadata: ReportMetadata
}
```

## Error Handling

The ComplianceService includes comprehensive validation and error handling:

```typescript
try {
	const report = await complianceService.generateHipaaReport(criteria)
} catch (error) {
	if (error.message.includes('Invalid date format')) {
		// Handle date validation error
	} else if (error.message.includes('Date range cannot exceed 1 year')) {
		// Handle date range validation error
	} else {
		// Handle other errors
		console.error('Report generation failed:', error)
	}
}
```

## Best Practices

1. **Date Range Validation**: Always ensure date ranges are valid and not exceeding 1 year
2. **Large Reports**: Use streaming for reports with large datasets
3. **Error Handling**: Implement proper error handling for all operations
4. **Template Reuse**: Create reusable templates for common report types
5. **Data Privacy**: Use pseudonymization for sensitive data when possible
6. **Caching**: Enable caching for frequently accessed templates and small reports

## Examples

For complete working examples, see the [compliance examples file](../src/examples/compliance-examples.ts).
