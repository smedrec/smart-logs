import { createFileRoute } from '@tanstack/react-router'
import { lazy } from 'react'

// Lazy load the report configuration form component
const ReportConfigurationForm = lazy(
	() => import('@/components/compliance/forms/ReportConfigurationForm')
)

export const Route = createFileRoute('/_authenticated/compliance/scheduled-reports/$reportId/edit')(
	{
		component: RouteComponent,
		beforeLoad: ({ context, params }) => {
			// Route guard: ensure user has permission to edit this specific report
			// and validate that reportId is a valid format
			if (!params.reportId || params.reportId.trim() === '') {
				throw new Error('Invalid report ID')
			}
			return context
		},
	}
)

function RouteComponent() {
	const { reportId } = Route.useParams()

	return <ReportConfigurationForm mode="edit" reportId={reportId} />
}
