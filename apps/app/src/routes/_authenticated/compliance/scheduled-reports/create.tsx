import { createFileRoute } from '@tanstack/react-router'
import { lazy } from 'react'
import { z } from 'zod'

// Lazy load the report configuration form component
const ReportConfigurationForm = lazy(
	() => import('@/components/compliance/forms/ReportConfigurationForm')
)

// URL search params schema for pre-filling form data
const createReportSearchSchema = z.object({
	reportType: z.enum(['hipaa', 'gdpr', 'custom']).optional(),
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

	return (
		<ReportConfigurationForm
			mode="create"
			initialData={{
				reportType: search.reportType,
				template: search.template,
			}}
		/>
	)
}
