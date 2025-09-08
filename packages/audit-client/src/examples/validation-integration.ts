/**
 * Example demonstrating validation integration in audit-client services
 *
 * This file shows how the validation utilities are integrated throughout
 * the audit-client services to provide comprehensive input/output validation.
 */

import { ComplianceService } from '../services/compliance'
import { EventsService } from '../services/events'
import { HealthService } from '../services/health'
import { MetricsService } from '../services/metrics'
import { PresetsService } from '../services/presets'
import { ScheduledReportsService } from '../services/scheduled-reports'
import { ValidationError } from '../utils/validation'

import type { AuditClientConfig } from '../core/config'

// Example configuration
const config: AuditClientConfig = {
	baseUrl: 'https://api.audit-service.com',
	authentication: {
		type: 'bearer',
		token: 'your-auth-token',
	},
	// ... other config options
} as any

/**
 * Example 1: Events Service with Validation
 */
async function eventsServiceExample() {
	const eventsService = new EventsService(config)

	try {
		// Valid audit event creation
		const validEvent = await eventsService.create({
			action: 'user.login',
			targetResourceType: 'user',
			targetResourceId: 'user-123',
			principalId: 'user-123',
			organizationId: 'org-456',
			status: 'success',
			dataClassification: 'INTERNAL',
			sessionContext: {
				sessionId: 'sess-789',
				ipAddress: '192.168.1.1',
				userAgent: 'Mozilla/5.0...',
			},
			details: {
				loginMethod: 'password',
				mfaUsed: true,
			},
		})

		console.log('✅ Valid event created:', validEvent.id)
	} catch (error) {
		if (error instanceof ValidationError) {
			console.error('❌ Validation failed:', error.getFormattedMessage())
			console.error('All errors:', error.getAllErrors())
		}
	}

	try {
		// Invalid audit event creation (missing required fields)
		await eventsService.create({
			action: '', // Invalid: empty action
			targetResourceType: 'user',
			principalId: '', // Invalid: empty principalId
			organizationId: 'org-456',
			status: 'invalid-status' as any, // Invalid: not a valid status
			dataClassification: 'INTERNAL',
		})
	} catch (error) {
		if (error instanceof ValidationError) {
			console.error('❌ Expected validation error:', error.message)
			// This will show detailed validation errors from Zod
		}
	}

	try {
		// Valid query with filters
		const events = await eventsService.query({
			filter: {
				dateRange: {
					startDate: '2024-01-01T00:00:00Z',
					endDate: '2024-01-31T23:59:59Z',
				},
				principalIds: ['user-123', 'user-456'],
				statuses: ['success', 'failure'],
				dataClassifications: ['INTERNAL', 'CONFIDENTIAL'],
			},
			pagination: {
				limit: 50,
				offset: 0,
			},
			sort: {
				field: 'timestamp',
				direction: 'desc',
			},
		})

		console.log('✅ Query successful:', events.events.length, 'events found')
	} catch (error) {
		if (error instanceof ValidationError) {
			console.error('❌ Query validation failed:', error.message)
		}
	}
}

/**
 * Example 2: Compliance Service with Validation
 */
async function complianceServiceExample() {
	const complianceService = new ComplianceService(config)

	try {
		// Valid HIPAA report generation
		const hipaaReport = await complianceService.generateHipaaReport({
			dateRange: {
				startDate: '2024-01-01T00:00:00Z',
				endDate: '2024-01-31T23:59:59Z',
			},
			organizationIds: ['org-456'],
			includeDetails: true,
			includeMetadata: true,
		})

		console.log('✅ HIPAA report generated:', hipaaReport.id)
	} catch (error) {
		if (error instanceof ValidationError) {
			console.error('❌ HIPAA report validation failed:', error.message)
		}
	}

	try {
		// Invalid GDPR export (missing required fields)
		await complianceService.exportGdprData({
			dataSubjectId: '', // Invalid: empty data subject ID
			organizationId: 'org-456',
			includePersonalData: true,
			includePseudonymizedData: false,
			includeMetadata: true,
			format: 'invalid-format' as any, // Invalid: not a valid format
		})
	} catch (error) {
		if (error instanceof ValidationError) {
			console.error('❌ Expected GDPR export validation error:', error.message)
		}
	}
}

/**
 * Example 3: Presets Service with Validation
 */
async function presetsServiceExample() {
	const presetsService = new PresetsService(config)

	try {
		// Valid preset creation
		const preset = await presetsService.create({
			name: 'user-login-success',
			description: 'Template for successful user login events',
			template: {
				action: 'user.login',
				targetResourceType: 'user',
				dataClassification: 'INTERNAL',
				defaultStatus: 'success',
			},
			validation: {
				requiredFields: ['principalId', 'organizationId'],
				optionalFields: ['targetResourceId', 'sessionContext'],
				fieldValidation: {
					principalId: { type: 'string', required: true, minLength: 1 },
					organizationId: { type: 'string', required: true, minLength: 1 },
				},
			},
			tags: ['authentication', 'login', 'success'],
		})

		console.log('✅ Preset created:', preset.name)

		// Valid preset application
		const result = await presetsService.apply('user-login-success', {
			principalId: 'user-123',
			organizationId: 'org-456',
			targetResourceId: 'user-123',
			sessionContext: {
				sessionId: 'sess-789',
				ipAddress: '192.168.1.1',
				userAgent: 'Mozilla/5.0...',
			},
		})

		if (result.success && result.auditEvent) {
			console.log('✅ Preset applied successfully:', result.auditEvent.id)
		}
	} catch (error) {
		if (error instanceof ValidationError) {
			console.error('❌ Preset validation failed:', error.message)
		}
	}
}

/**
 * Example 4: Metrics Service with Validation
 */
async function metricsServiceExample() {
	const metricsService = new MetricsService(config)

	try {
		// Valid system metrics retrieval
		const systemMetrics = await metricsService.getSystemMetrics()
		console.log('✅ System metrics retrieved:', systemMetrics.timestamp)

		// Valid audit metrics with parameters
		const auditMetrics = await metricsService.getAuditMetrics({
			timeRange: {
				startDate: '2024-01-01T00:00:00Z',
				endDate: '2024-01-31T23:59:59Z',
			},
			granularity: 'day',
			includeBreakdown: true,
			organizationIds: ['org-456'],
		})

		console.log('✅ Audit metrics retrieved:', auditMetrics.eventsProcessed, 'events processed')
	} catch (error) {
		if (error instanceof ValidationError) {
			console.error('❌ Metrics validation failed:', error.message)
		}
	}

	try {
		// Invalid alerts query
		await metricsService.getAlerts({
			status: ['invalid-status'] as any, // Invalid: not a valid alert status
			severity: ['critical', 'invalid-severity'] as any, // Invalid: mixed valid/invalid
			pagination: {
				limit: -1, // Invalid: negative limit
				offset: 0,
			},
		})
	} catch (error) {
		if (error instanceof ValidationError) {
			console.error('❌ Expected alerts validation error:', error.message)
		}
	}
}

/**
 * Example 5: Scheduled Reports Service with Validation
 */
async function scheduledReportsServiceExample() {
	const scheduledReportsService = new ScheduledReportsService(config)

	try {
		// Valid scheduled report creation
		const scheduledReport = await scheduledReportsService.create({
			name: 'Monthly HIPAA Report',
			description: 'Automated monthly HIPAA compliance report',
			reportType: 'hipaa',
			criteria: {
				dateRange: {
					startDate: '2024-01-01T00:00:00Z',
					endDate: '2024-01-31T23:59:59Z',
				},
				organizationIds: ['org-456'],
				format: 'pdf',
				includeDetails: true,
			},
			schedule: {
				frequency: 'monthly',
				dayOfMonth: 1,
				hour: 9,
				minute: 0,
				timezone: 'America/New_York',
			},
			deliveryConfig: {
				method: 'email',
				config: {
					recipients: ['admin@company.com', 'compliance@company.com'],
				},
			},
			isActive: true,
		})

		console.log('✅ Scheduled report created:', scheduledReport.id)
	} catch (error) {
		if (error instanceof ValidationError) {
			console.error('❌ Scheduled report validation failed:', error.message)
		}
	}
}

/**
 * Example 6: Health Service with Validation
 */
async function healthServiceExample() {
	const healthService = new HealthService(config)

	try {
		// Valid health check
		const healthStatus = await healthService.check({
			timeout: 5000,
			includeDetails: true,
			checkDependencies: true,
		})

		console.log('✅ Health check completed:', healthStatus.status)

		// Valid detailed health check
		const detailedHealth = await healthService.detailed({
			componentChecks: ['database', 'cache', 'storage'],
		})

		console.log('✅ Detailed health check completed:', detailedHealth.components)
	} catch (error) {
		if (error instanceof ValidationError) {
			console.error('❌ Health check validation failed:', error.message)
		}
	}
}

/**
 * Run all examples
 */
export async function runValidationExamples() {
	console.log('🚀 Running validation integration examples...\n')

	console.log('📊 Events Service Examples:')
	await eventsServiceExample()

	console.log('\n📋 Compliance Service Examples:')
	await complianceServiceExample()

	console.log('\n🎯 Presets Service Examples:')
	await presetsServiceExample()

	console.log('\n📈 Metrics Service Examples:')
	await metricsServiceExample()

	console.log('\n⏰ Scheduled Reports Service Examples:')
	await scheduledReportsServiceExample()

	console.log('\n❤️ Health Service Examples:')
	await healthServiceExample()

	console.log('\n✅ All validation integration examples completed!')
}

/**
 * Key Benefits of Validation Integration:
 *
 * 1. **Input Validation**: All service methods validate input parameters using Zod schemas
 * 2. **Output Validation**: Responses are validated to ensure they match expected types
 * 3. **Type Safety**: TypeScript types are automatically inferred from Zod schemas
 * 4. **Error Handling**: Comprehensive error messages with field-level details
 * 5. **Runtime Safety**: Catches invalid data at runtime, not just compile time
 * 6. **Consistency**: All services use the same validation patterns and utilities
 * 7. **Maintainability**: Centralized validation logic in utils/validation.ts
 * 8. **Developer Experience**: Clear error messages help developers fix issues quickly
 */

// Export for use in tests or other modules
export {
	eventsServiceExample,
	complianceServiceExample,
	presetsServiceExample,
	metricsServiceExample,
	scheduledReportsServiceExample,
	healthServiceExample,
}
