# Compliance Form Transformers

This module provides utilities for transforming form data from the UI format to API-compatible formats for scheduled report creation and updates.

## Overview

The `form-transformers.ts` module handles the complex transformation between the user-friendly form data structure used in the `ReportConfigurationForm` component and the strict API types required by the audit client library (`CreateScheduledReportInput` and `UpdateScheduledReportInput`).

## Key Features

- **Type-safe transformations**: Converts form data to API-compatible types with full TypeScript support
- **Schedule configuration mapping**: Transforms time strings (HH:MM) to hour/minute integers and maps day-of-week numbers to enum values
- **Format normalization**: Converts UI format strings (PDF, CSV, etc.) to lowercase API format enums
- **Validation**: Comprehensive validation of form data before transformation
- **Partial updates**: Supports partial form data for update operations

## Usage

### Creating a New Report

```typescript
import {
	transformFormDataToCreateInput,
	validateFormData,
} from '@/lib/compliance/form-transformers'

const formData: ReportFormData = {
	name: 'Monthly HIPAA Report',
	reportType: 'HIPAA_AUDIT_TRAIL',
	format: 'PDF',
	schedule: {
		frequency: 'monthly',
		time: '09:30',
		dayOfMonth: 1,
		timezone: 'America/New_York',
		// ... other schedule fields
	},
	// ... other form fields
}

// Validate before transformation
const validation = validateFormData(formData)
if (!validation.isValid) {
	console.error('Validation errors:', validation.errors)
	return
}

// Transform to API format
const createInput = transformFormDataToCreateInput(
	formData,
	userId,
	runId // optional
)

// Submit to API
await complianceAuditClient.createScheduledReport(createInput)
```

### Updating an Existing Report

```typescript
import { transformFormDataToUpdateInput } from '@/lib/compliance/form-transformers'

// Partial form data for update
const partialFormData: Partial<ReportFormData> = {
	name: 'Updated Report Name',
	schedule: {
		frequency: 'weekly',
		time: '14:00',
		dayOfWeek: 1, // Monday
		timezone: 'UTC',
		// ... other schedule fields
	},
}

// Transform to API format (only includes provided fields)
const updateInput = transformFormDataToUpdateInput(
	partialFormData,
	userId,
	runId // optional
)

// Submit to API
await complianceAuditClient.updateScheduledReport(reportId, updateInput)
```

## Form Data Structure

### ReportFormData Interface

```typescript
interface ReportFormData {
	// Basic Information
	name: string
	description: string
	reportType: ReportType
	format: string // 'PDF' | 'CSV' | 'JSON' | 'XLSX' | 'HTML' | 'XML'

	// Schedule Configuration
	schedule: {
		frequency:
			| 'once'
			| 'hourly'
			| 'daily'
			| 'weekly'
			| 'monthly'
			| 'quarterly'
			| 'yearly'
			| 'custom'
		time: string // HH:MM format
		dayOfWeek?: number // 0-6 (Sunday-Saturday)
		dayOfMonth?: number // 1-31
		timezone: string
		cronExpression?: string // Required for 'custom' frequency
		startDate?: string
		endDate?: string
		skipWeekends?: boolean
		skipHolidays?: boolean
		holidayCalendar?: string
		maxMissedRuns?: number
		catchUpMissedRuns?: boolean
	}

	// Notifications
	notifications: {
		onSuccess: boolean
		onFailure: boolean
		onSkip?: boolean
		recipients: string[] // Email addresses
		includeReport?: boolean
		customMessage?: string
	}

	// Report Parameters (Criteria)
	parameters: {
		dateRange?: {
			startDate: string // ISO 8601 datetime
			endDate: string // ISO 8601 datetime
		}
		organizationIds?: string[]
		principalIds?: string[]
		actions?: string[]
		resourceTypes?: string[]
		dataClassifications?: Array<'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI'>
		statuses?: Array<'attempt' | 'success' | 'failure'>
		verifiedOnly?: boolean
		includeIntegrityFailures?: boolean
		limit?: number
		offset?: number
		sortBy?: 'timestamp' | 'status'
		sortOrder?: 'asc' | 'desc'
	}

	// Delivery Configuration
	delivery?: {
		destinations: string[] | 'default'
	}

	// Export Configuration
	export?: {
		includeMetadata?: boolean
		includeIntegrityReport?: boolean
		compression?: 'none' | 'gzip' | 'zip' | 'bzip2'
		encryption?: {
			enabled: boolean
			algorithm?: string
			keyId?: string
		}
	}

	// Metadata
	enabled?: boolean
	tags?: string[]
	metadata?: Record<string, any>
	templateId?: string
}
```

## Transformation Details

### Schedule Configuration

The schedule transformation handles several key mappings:

1. **Time Parsing**: Converts `"09:30"` to `{ hour: 9, minute: 30 }`
2. **Day of Week**: Maps numbers (0-6) to enum values (`'sunday'` - `'saturday'`)
3. **Frequency-specific Fields**: Includes appropriate fields based on frequency type
   - `weekly`: Requires `dayOfWeek`
   - `monthly`: Requires `dayOfMonth`
   - `custom`: Requires `cronExpression`

### Format Mapping

UI format strings are converted to lowercase API format enums:

- `'PDF'` → `'pdf'`
- `'CSV'` → `'csv'`
- `'JSON'` → `'json'`
- `'XLSX'` → `'xlsx'`
- `'HTML'` → `'html'`
- `'XML'` → `'xml'`

### Delivery Configuration

- If no delivery configuration is provided, defaults to `{ destinations: 'default' }`
- Supports array of destination IDs or the string `'default'`

### Notifications

- Notifications are only included if recipients are provided
- Empty recipient arrays result in `undefined` notifications in the API payload

## Validation Rules

The `validateFormData` function enforces the following rules:

### Required Fields

- Report name (non-empty, max 255 characters)
- Timezone

### Frequency-specific Requirements

- `custom`: Requires `cronExpression`
- `weekly`: Requires `dayOfWeek`
- `monthly`: Requires `dayOfMonth`

### Date Range Validation

- Start date must be before or equal to end date

### Notification Validation

- If notifications are enabled (`onSuccess` or `onFailure`), at least one recipient is required
- All recipient emails must be valid email addresses

### Length Limits

- Name: 255 characters
- Description: 1000 characters

## Testing

### Unit Tests

Run the comprehensive test suite:

```bash
npm run test -- form-transformers.test.ts
```

The test suite covers:

- Complete form data transformation
- Partial form data transformation (updates)
- Schedule configuration variations (daily, weekly, monthly, custom)
- Format mapping
- Delivery and export configuration
- Notification handling
- Validation rules
- Edge cases

### Manual Testing

A manual test script is provided for quick verification:

```bash
npx tsx apps/app/src/lib/compliance/__tests__/manual-test.ts
```

## Integration with ReportConfigurationForm

The `ReportConfigurationForm` component uses these transformers in its submit handler:

```typescript
const handleSubmit = async () => {
	// Validate
	const validation = validateFormData(formData)
	if (!validation.isValid) {
		setValidationErrors(validation.errors)
		return
	}

	// Transform
	const transformedData =
		mode === 'create'
			? transformFormDataToCreateInput(formData, userId, runId)
			: transformFormDataToUpdateInput(formData, userId, runId)

	// Submit
	await onSubmit(transformedData)
}
```

## Type Safety

All transformations maintain full type safety:

- Input: `ReportFormData` (UI format)
- Output: `CreateScheduledReportInput` or `UpdateScheduledReportInput` (API format)
- Both input and output types are validated at compile time

## Error Handling

The transformation functions are designed to be safe:

- Invalid data is caught by validation before transformation
- Type guards ensure data completeness
- Optional fields are handled gracefully
- Default values are provided where appropriate

## Future Enhancements

Potential improvements for future versions:

1. **Schema-based Validation**: Use Zod schemas for runtime validation
2. **Reverse Transformation**: Add functions to transform API data back to form format for editing
3. **Template Support**: Add transformation support for report templates
4. **Advanced Criteria**: Support for more complex query criteria
5. **Localization**: Support for internationalized date/time formats
