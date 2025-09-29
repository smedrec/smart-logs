/**
 * @fileoverview Example usage of Enhanced Compliance Service
 *
 * This example demonstrates how to use the new compliance service
 * that's compatible with audit-client types.
 */

import { EnhancedAuditDatabaseClient } from '@repo/audit-db'

import { Audit } from '../audit.js'
import { EnhancedComplianceService } from '../report/compliance-service.js'

import type { ReportCriteria } from '../report/types.js'

/**
 * Example: Generate HIPAA Compliance Report
 */
export async function generateHIPAAReportExample() {
	// Initialize dependencies (these would come from your app setup)
	const dbClient = new EnhancedAuditDatabaseClient({
		connectionString: process.env.DATABASE_URL || '',
		enableCaching: true,
		enableMonitoring: true,
	})

	const audit = new Audit({
		organizationId: 'org-123',
		enableIntegrityVerification: true,
	})

	const complianceService = new EnhancedComplianceService(dbClient, audit)

	// Define report criteria
	const criteria: ReportCriteria = {
		dateRange: {
			startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
			endDate: new Date().toISOString(),
		},
		organizationIds: ['org-123'],
		dataClassifications: ['PHI'],
		statuses: ['success', 'failure'],
		verifiedOnly: false,
		includeIntegrityFailures: true,
		limit: 1000,
	}

	try {
		// Generate HIPAA report
		const hipaaReport = await complianceService.generateHIPAAReport(criteria)

		console.log('HIPAA Report Generated:')
		console.log(`- Report ID: ${hipaaReport.id}`)
		console.log(`- Total Events: ${hipaaReport.summary.totalEvents}`)
		console.log(`- Compliance Score: ${hipaaReport.summary.complianceScore}%`)
		console.log(`- Violations: ${hipaaReport.summary.violations}`)
		console.log(`- Sections: ${hipaaReport.sections.length}`)

		// Print section details
		hipaaReport.sections.forEach((section) => {
			console.log(`\n${section.title}:`)
			console.log(`  - Status: ${section.status}`)
			console.log(`  - Score: ${section.score}%`)
			console.log(`  - Events: ${section.events.length}`)
			console.log(`  - Violations: ${section.violations.length}`)
		})

		return hipaaReport
	} catch (error) {
		console.error('Failed to generate HIPAA report:', error)
		throw error
	}
}

/**
 * Example: Generate GDPR Compliance Report
 */
export async function generateGDPRReportExample() {
	const dbClient = new EnhancedAuditDatabaseClient({
		connectionString: process.env.DATABASE_URL || '',
		enableCaching: true,
		enableMonitoring: true,
	})

	const audit = new Audit({
		organizationId: 'org-123',
		enableIntegrityVerification: true,
	})

	const complianceService = new EnhancedComplianceService(dbClient, audit)

	const criteria: ReportCriteria = {
		dateRange: {
			startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // Last 90 days
			endDate: new Date().toISOString(),
		},
		organizationIds: ['org-123'],
		actions: ['data.read', 'data.create', 'data.update', 'data.delete', 'data.export'],
		limit: 5000,
	}

	try {
		const gdprReport = await complianceService.generateGDPRReport(criteria)

		console.log('GDPR Report Generated:')
		console.log(`- Report ID: ${gdprReport.id}`)
		console.log(`- Total Events: ${gdprReport.summary.totalEvents}`)
		console.log(`- Data Subjects: ${gdprReport.summary.dataSubjects}`)
		console.log(`- Processing Activities: ${gdprReport.summary.processingActivities}`)
		console.log(`- Data Subject Requests: ${gdprReport.summary.dataSubjectRequests}`)
		console.log(`- Compliance Score: ${gdprReport.summary.complianceScore}%`)

		return gdprReport
	} catch (error) {
		console.error('Failed to generate GDPR report:', error)
		throw error
	}
}

/**
 * Example: Export GDPR Data for Data Subject
 */
export async function exportGDPRDataExample() {
	const dbClient = new EnhancedAuditDatabaseClient({
		connectionString: process.env.DATABASE_URL || '',
		enableCaching: true,
		enableMonitoring: true,
	})

	const audit = new Audit({
		organizationId: 'org-123',
		enableIntegrityVerification: true,
	})

	const complianceService = new EnhancedComplianceService(dbClient, audit)

	const exportParams = {
		dataSubjectId: 'user-456',
		dataSubjectType: 'user' as const,
		includePersonalData: true,
		includePseudonymizedData: false,
		includeMetadata: true,
		format: 'json' as const,
		deliveryMethod: 'download' as const,
		dateRange: {
			startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // Last year
			endDate: new Date().toISOString(),
		},
	}

	try {
		const exportResult = await complianceService.exportGDPRData(exportParams)

		console.log('GDPR Data Export:')
		console.log(`- Export ID: ${exportResult.exportId}`)
		console.log(`- Status: ${exportResult.status}`)
		console.log(`- Record Count: ${exportResult.recordCount}`)
		console.log(`- Data Size: ${exportResult.dataSize} bytes`)
		console.log(`- Format: ${exportResult.format}`)

		return exportResult
	} catch (error) {
		console.error('Failed to export GDPR data:', error)
		throw error
	}
}

/**
 * Example: Generate Custom Report
 */
export async function generateCustomReportExample() {
	const dbClient = new EnhancedAuditDatabaseClient({
		connectionString: process.env.DATABASE_URL || '',
		enableCaching: true,
		enableMonitoring: true,
	})

	const audit = new Audit({
		organizationId: 'org-123',
		enableIntegrityVerification: true,
	})

	const complianceService = new EnhancedComplianceService(dbClient, audit)

	const customParams = {
		criteria: {
			dateRange: {
				startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last week
				endDate: new Date().toISOString(),
			},
			organizationIds: ['org-123'],
			actions: ['auth.login.success', 'auth.login.failure'],
			limit: 1000,
		},
		format: 'json' as const,
		includeRawData: true,
		parameters: {
			reportTitle: 'Weekly Authentication Report',
			includeFailureAnalysis: true,
		},
	}

	try {
		const customReport = await complianceService.generateCustomReport(customParams)

		console.log('Custom Report Generated:')
		console.log(`- Report ID: ${customReport.id}`)
		console.log(`- Data Records: ${customReport.data.length}`)
		console.log(`- Summary:`, customReport.summary)

		return customReport
	} catch (error) {
		console.error('Failed to generate custom report:', error)
		throw error
	}
}

/**
 * Run all examples
 */
export async function runAllExamples() {
	console.log('=== Enhanced Compliance Service Examples ===\n')

	try {
		console.log('1. Generating HIPAA Report...')
		await generateHIPAAReportExample()

		console.log('\n2. Generating GDPR Report...')
		await generateGDPRReportExample()

		console.log('\n3. Exporting GDPR Data...')
		await exportGDPRDataExample()

		console.log('\n4. Generating Custom Report...')
		await generateCustomReportExample()

		console.log('\n=== All examples completed successfully! ===')
	} catch (error) {
		console.error('Example execution failed:', error)
	}
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runAllExamples()
}
