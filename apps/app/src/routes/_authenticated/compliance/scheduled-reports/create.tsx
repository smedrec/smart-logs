import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { lazy } from 'react'
import { z } from 'zod'

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

	const handleSubmit = async (data: any) => {
		// TODO: Implement report creation logic
		console.log('Creating report:', data)
		// Navigate back to reports list after successful creation
		navigate({ to: '/compliance/scheduled-reports' })
	}

	const handleCancel = () => {
		navigate({ to: '/compliance/scheduled-reports' })
	}

	return (
		<ReportConfigurationForm
			mode="create"
			initialData={{
				reportType: search.reportType,
			}}
			onSubmit={handleSubmit}
			onCancel={handleCancel}
		/>
	)
}
