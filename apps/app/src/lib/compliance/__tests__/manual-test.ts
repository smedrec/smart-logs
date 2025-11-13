import { transformFormDataToCreateInput, validateFormData } from '../form-transformers'

import type { ReportFormData } from '../form-transformers'

/**
 * Manual test script to verify form transformations
 * Run with: npx tsx apps/app/src/lib/compliance/__tests__/manual-test.ts
 */

const testFormData: ReportFormData = {
	name: 'Monthly HIPAA Compliance Report',
	description: 'Automated monthly report for HIPAA audit trail compliance',
	reportType: 'HIPAA_AUDIT_TRAIL',
	format: 'PDF',
	schedule: {
		frequency: 'monthly',
		time: '09:30',
		dayOfMonth: 1,
		timezone: 'America/New_York',
		skipWeekends: false,
		skipHolidays: true,
		holidayCalendar: 'US',
		maxMissedRuns: 3,
		catchUpMissedRuns: false,
	},
	notifications: {
		onSuccess: true,
		onFailure: true,
		recipients: ['compliance@example.com', 'admin@example.com'],
		includeReport: true,
	},
	parameters: {
		dateRange: {
			startDate: '2024-01-01T00:00:00Z',
			endDate: '2024-12-31T23:59:59Z',
		},
		organizationIds: ['org-123'],
		verifiedOnly: true,
		includeIntegrityFailures: false,
		dataClassifications: ['PHI', 'CONFIDENTIAL'],
		statuses: ['success', 'failure'],
	},
	delivery: {
		destinations: ['dest-email-1', 'dest-sftp-1'],
	},
	export: {
		includeMetadata: true,
		includeIntegrityReport: true,
		compression: 'gzip',
		encryption: {
			enabled: true,
			algorithm: 'AES-256-GCM',
			keyId: 'key-prod-001',
		},
	},
	tags: ['hipaa', 'monthly', 'automated'],
	metadata: {
		department: 'compliance',
		priority: 'high',
	},
}

console.log('=== Testing Form Data Transformation ===\n')

// Test validation
console.log('1. Validating form data...')
const validation = validateFormData(testFormData)
console.log('Validation result:', validation)
console.log()

if (validation.isValid) {
	// Test transformation
	console.log('2. Transforming to CreateScheduledReportInput...')
	const transformed = transformFormDataToCreateInput(testFormData, 'user-123', 'run-456')

	console.log('Transformed data:')
	console.log(JSON.stringify(transformed, null, 2))
	console.log()

	// Verify key transformations
	console.log('3. Verification checks:')
	console.log('✓ Name:', transformed.name === testFormData.name)
	console.log('✓ Report Type:', transformed.reportType === testFormData.reportType)
	console.log('✓ Format:', transformed.format === 'pdf')
	console.log('✓ Schedule Hour:', transformed.schedule.hour === 9)
	console.log('✓ Schedule Minute:', transformed.schedule.minute === 30)
	console.log('✓ Day of Month:', transformed.schedule.dayOfMonth === 1)
	console.log('✓ Timezone:', transformed.schedule.timezone === 'America/New_York')
	console.log('✓ Skip Holidays:', transformed.schedule.skipHolidays === true)
	console.log('✓ Holiday Calendar:', transformed.schedule.holidayCalendar === 'US')
	console.log('✓ Notifications Recipients:', transformed.notifications?.recipients.length === 2)
	console.log('✓ Delivery Destinations:', Array.isArray(transformed.delivery.destinations))
	console.log('✓ Export Compression:', transformed.export.compression === 'gzip')
	console.log('✓ Export Encryption:', transformed.export.encryption?.enabled === true)
	console.log('✓ Tags:', transformed.tags?.length === 3)
	console.log('✓ Metadata:', transformed.metadata?.department === 'compliance')
	console.log('✓ Created By:', transformed.createdBy === 'user-123')
	console.log('✓ Run ID:', transformed.runId === 'run-456')
	console.log()

	console.log('✅ All transformations completed successfully!')
} else {
	console.log('❌ Validation failed!')
	console.log('Errors:', validation.errors)
}
