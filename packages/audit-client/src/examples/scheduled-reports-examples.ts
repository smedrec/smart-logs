/**
 * Scheduled Reports Service Examples
 *
 * This file demonstrates how to use the ScheduledReportsService for managing
 * automated audit report generation and scheduling.
 */

import { AuditClient } from '../core/client'

import type {
	CreateScheduledReportInput,
	ExecutionHistoryParams,
	ListScheduledReportsParams,
	UpdateScheduledReportInput,
} from '../services/scheduled-reports'

// Initialize the audit client
const client = new AuditClient({
	baseUrl: 'https://api.example.com',
	authentication: {
		type: 'apiKey',
		apiKey: 'your-api-key-here',
	},
})

/**
 * Example 1: Create a daily HIPAA compliance report
 */
export async function createDailyHipaaReport() {
	try {
		const reportInput: CreateScheduledReportInput = {
			name: 'Daily HIPAA Compliance Report',
			description: 'Automated daily report for HIPAA compliance monitoring',
			reportType: 'hipaa',
			criteria: {
				dateRange: {
					startDate: '2024-01-01',
					endDate: '2024-12-31',
				},
				organizationIds: ['org-123'],
				dataClassifications: ['PHI'],
				includeDetails: true,
				includeMetadata: true,
				format: 'pdf',
			},
			schedule: {
				frequency: 'daily',
				hour: 6, // 6 AM
				minute: 0,
				timezone: 'America/New_York',
			},
			deliveryConfig: {
				method: 'email',
				config: {
					recipients: ['compliance@company.com', 'security@company.com'],
				},
			},
			isActive: true,
		}

		const scheduledReport = await client.scheduledReports.create(reportInput)
		console.log('Created daily HIPAA report:', scheduledReport)

		return scheduledReport
	} catch (error) {
		console.error('Failed to create daily HIPAA report:', error)
		throw error
	}
}

/**
 * Example 2: Create a weekly GDPR data processing report
 */
export async function createWeeklyGdprReport() {
	try {
		const reportInput: CreateScheduledReportInput = {
			name: 'Weekly GDPR Processing Activities Report',
			description: 'Weekly report of all data processing activities for GDPR compliance',
			reportType: 'gdpr',
			criteria: {
				dateRange: {
					startDate: '2024-01-01',
					endDate: '2024-12-31',
				},
				organizationIds: ['org-123'],
				actions: ['data_access', 'data_modification', 'data_deletion'],
				includeDetails: true,
				format: 'csv',
			},
			schedule: {
				frequency: 'weekly',
				dayOfWeek: 1, // Monday
				hour: 8, // 8 AM
				minute: 30,
				timezone: 'Europe/London',
			},
			deliveryConfig: {
				method: 'webhook',
				config: {
					webhookUrl: 'https://company.com/api/reports/webhook',
				},
			},
			isActive: true,
		}

		const scheduledReport = await client.scheduledReports.create(reportInput)
		console.log('Created weekly GDPR report:', scheduledReport)

		return scheduledReport
	} catch (error) {
		console.error('Failed to create weekly GDPR report:', error)
		throw error
	}
}

/**
 * Example 3: Create a monthly custom security report
 */
export async function createMonthlySecurityReport() {
	try {
		const reportInput: CreateScheduledReportInput = {
			name: 'Monthly Security Audit Report',
			description: 'Comprehensive monthly security audit report',
			reportType: 'custom',
			criteria: {
				dateRange: {
					startDate: '2024-01-01',
					endDate: '2024-12-31',
				},
				organizationIds: ['org-123'],
				actions: ['login', 'logout', 'failed_login', 'password_change'],
				resourceTypes: ['user', 'session', 'authentication'],
				includeDetails: true,
				includeMetadata: true,
				format: 'xlsx',
			},
			schedule: {
				frequency: 'monthly',
				dayOfMonth: 1, // First day of the month
				hour: 9, // 9 AM
				minute: 0,
				timezone: 'UTC',
			},
			deliveryConfig: {
				method: 'storage',
				config: {
					storageLocation: 's3://company-reports/security/',
				},
			},
			isActive: true,
		}

		const scheduledReport = await client.scheduledReports.create(reportInput)
		console.log('Created monthly security report:', scheduledReport)

		return scheduledReport
	} catch (error) {
		console.error('Failed to create monthly security report:', error)
		throw error
	}
}

/**
 * Example 4: List all scheduled reports with filtering
 */
export async function listScheduledReports() {
	try {
		const params: ListScheduledReportsParams = {
			organizationId: 'org-123',
			isActive: true,
			limit: 20,
			sortBy: 'name',
			sortOrder: 'asc',
		}

		const result = await client.scheduledReports.list(params)
		console.log(`Found ${result.pagination.total} scheduled reports:`)

		result.reports.forEach((report) => {
			console.log(`- ${report.name} (${report.reportType}) - Next: ${report.nextExecution}`)
		})

		return result
	} catch (error) {
		console.error('Failed to list scheduled reports:', error)
		throw error
	}
}

/**
 * Example 5: Update a scheduled report
 */
export async function updateScheduledReport(reportId: string) {
	try {
		const updates: UpdateScheduledReportInput = {
			name: 'Updated Daily HIPAA Report',
			schedule: {
				hour: 7, // Change from 6 AM to 7 AM
				minute: 30, // Change from :00 to :30
			},
			deliveryConfig: {
				config: {
					recipients: [
						'compliance@company.com',
						'security@company.com',
						'manager@company.com', // Add new recipient
					],
				},
			},
		}

		const updatedReport = await client.scheduledReports.update(reportId, updates)
		console.log('Updated scheduled report:', updatedReport)

		return updatedReport
	} catch (error) {
		console.error('Failed to update scheduled report:', error)
		throw error
	}
}

/**
 * Example 6: Execute a scheduled report immediately
 */
export async function executeReportNow(reportId: string) {
	try {
		const execution = await client.scheduledReports.execute(reportId)
		console.log('Started immediate execution:', execution)

		// Poll for completion
		let status = execution.status
		while (status === 'pending' || status === 'running') {
			await new Promise((resolve) => setTimeout(resolve, 5000)) // Wait 5 seconds

			const currentExecution = await client.scheduledReports.getExecutionStatus(
				reportId,
				execution.id
			)
			status = currentExecution.status

			console.log(`Execution status: ${status}`)
			if (currentExecution.progress) {
				console.log(`Progress: ${currentExecution.progress}%`)
			}
		}

		if (status === 'completed') {
			console.log('Execution completed successfully!')

			// Download the result
			const blob = await client.scheduledReports.downloadExecution(reportId, execution.id, 'json')
			console.log(`Downloaded report (${blob.size} bytes)`)
		} else if (status === 'failed') {
			console.error('Execution failed')
		}

		return execution
	} catch (error) {
		console.error('Failed to execute report:', error)
		throw error
	}
}

/**
 * Example 7: Get execution history for a report
 */
export async function getReportExecutionHistory(reportId: string) {
	try {
		const params: ExecutionHistoryParams = {
			limit: 10,
			sortBy: 'startedAt',
			sortOrder: 'desc',
		}

		const history = await client.scheduledReports.getExecutionHistory(reportId, params)
		console.log(`Found ${history.pagination.total} executions:`)

		history.executions.forEach((execution) => {
			console.log(`- ${execution.id}: ${execution.status} (${execution.startedAt})`)
			if (execution.completedAt) {
				const duration =
					new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()
				console.log(`  Duration: ${Math.round(duration / 1000)}s`)
			}
			if (execution.recordCount) {
				console.log(`  Records: ${execution.recordCount}`)
			}
		})

		return history
	} catch (error) {
		console.error('Failed to get execution history:', error)
		throw error
	}
}

/**
 * Example 8: Manage report lifecycle (enable/disable)
 */
export async function manageReportLifecycle(reportId: string) {
	try {
		// Disable the report temporarily
		console.log('Disabling report...')
		const disabledReport = await client.scheduledReports.disable(reportId)
		console.log(`Report disabled: ${disabledReport.isActive}`)

		// Wait for some condition or time
		await new Promise((resolve) => setTimeout(resolve, 2000))

		// Re-enable the report
		console.log('Re-enabling report...')
		const enabledReport = await client.scheduledReports.enable(reportId)
		console.log(`Report enabled: ${enabledReport.isActive}`)
		console.log(`Next execution: ${enabledReport.nextExecution}`)

		return enabledReport
	} catch (error) {
		console.error('Failed to manage report lifecycle:', error)
		throw error
	}
}

/**
 * Example 9: Get upcoming executions across all reports
 */
export async function getUpcomingExecutions() {
	try {
		const upcoming = await client.scheduledReports.getUpcomingExecutions('org-123', 20)

		console.log('Upcoming report executions:')
		upcoming.forEach((item) => {
			const nextDate = new Date(item.nextExecution)
			console.log(`- ${item.reportName} (${item.frequency}): ${nextDate.toLocaleString()}`)
		})

		return upcoming
	} catch (error) {
		console.error('Failed to get upcoming executions:', error)
		throw error
	}
}

/**
 * Example 10: Delete a scheduled report
 */
export async function deleteScheduledReport(reportId: string) {
	try {
		// Get the report first to show what we're deleting
		const report = await client.scheduledReports.get(reportId)
		if (!report) {
			console.log('Report not found')
			return
		}

		console.log(`Deleting report: ${report.name}`)

		// Delete the report
		await client.scheduledReports.delete(reportId)
		console.log('Report deleted successfully')

		// Verify deletion
		const deletedReport = await client.scheduledReports.get(reportId)
		console.log(`Verification - Report exists: ${deletedReport !== null}`)
	} catch (error) {
		console.error('Failed to delete scheduled report:', error)
		throw error
	}
}

/**
 * Example 11: Comprehensive report management workflow
 */
export async function comprehensiveReportWorkflow() {
	try {
		console.log('=== Comprehensive Scheduled Reports Workflow ===')

		// 1. Create a new report
		console.log('\n1. Creating new report...')
		const newReport = await createDailyHipaaReport()

		// 2. List all reports
		console.log('\n2. Listing all reports...')
		await listScheduledReports()

		// 3. Update the report
		console.log('\n3. Updating report...')
		await updateScheduledReport(newReport.id)

		// 4. Execute immediately
		console.log('\n4. Executing report immediately...')
		await executeReportNow(newReport.id)

		// 5. Check execution history
		console.log('\n5. Checking execution history...')
		await getReportExecutionHistory(newReport.id)

		// 6. Get upcoming executions
		console.log('\n6. Getting upcoming executions...')
		await getUpcomingExecutions()

		// 7. Manage lifecycle
		console.log('\n7. Managing report lifecycle...')
		await manageReportLifecycle(newReport.id)

		console.log('\n=== Workflow completed successfully ===')
		return newReport
	} catch (error) {
		console.error('Workflow failed:', error)
		throw error
	}
}

// Export all examples for easy usage
export const scheduledReportsExamples = {
	createDailyHipaaReport,
	createWeeklyGdprReport,
	createMonthlySecurityReport,
	listScheduledReports,
	updateScheduledReport,
	executeReportNow,
	getReportExecutionHistory,
	manageReportLifecycle,
	getUpcomingExecutions,
	deleteScheduledReport,
	comprehensiveReportWorkflow,
}
