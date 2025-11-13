import { useAuditContext } from '@/contexts/audit-provider'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { lazy } from 'react'
import { z } from 'zod'

import type { CreateScheduledReportInput, UpdateScheduledReportInput } from '@smedrec/audit-client'

// Lazy load the report configuration form component
const ReportConfigurationForm = lazy(() =>
	import('@/components/compliance/forms').then((module) => ({
		default: module.ReportConfigurationForm,
	}))
)

// URL search params schema for pre-filling form data
const createReportSearchSchema = z.object({
	reportType: z
		.enum([
			'HIPAA_AUDIT_TRAIL',
			'GDPR_PROCESSING_ACTIVITIES',
			'INTEGRITY_VERIFICATION',
			'CUSTOM_REPORT',
		])
		.optional(),
	template: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/compliance/scheduled-reports/create')({
	component: RouteComponent,
	validateSearch: createReportSearchSchema,
	beforeLoad: ({ context }) => {
		// Route guard: ensure user has permission to create reports
		return context
	},
})

function RouteComponent() {
	const search = Route.useSearch()
	const navigate = useNavigate()
	const context = Route.useRouteContext()
	const user = 'user' in context ? context.user : null
	const { client } = useAuditContext()

	const handleSubmit = async (data: CreateScheduledReportInput | UpdateScheduledReportInput) => {
		if (!client) {
			throw new Error('Audit client is not available')
		}

		try {
			// Create the scheduled report using the audit client
			const result = await client.scheduledReports.create(data as CreateScheduledReportInput)

			// Navigate to the newly created report's detail page
			navigate({
				to: '/compliance/scheduled-reports/$reportId',
				params: { reportId: result.id },
			})
		} catch (error) {
			console.error('Failed to create report:', error)
			throw error // Let the form component handle the error display
		}
	}

	const handleCancel = () => {
		navigate({ to: '/compliance/scheduled-reports' })
	}

	return (
		<ReportConfigurationForm
			mode="create"
			initialData={
				search.reportType
					? {
							reportType: search.reportType,
						}
					: undefined
			}
			onSubmit={handleSubmit}
			onCancel={handleCancel}
			userId={user?.id || 'system'}
		/>
	)
}
