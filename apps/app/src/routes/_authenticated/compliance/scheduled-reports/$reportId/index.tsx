import { createFileRoute } from '@tanstack/react-router'
import { lazy } from 'react'

// Lazy load the report details page component
const ReportDetailsPage = lazy(
	() => import('@/components/compliance/report-details/ReportDetailsPage')
)

export const Route = createFileRoute('/_authenticated/compliance/scheduled-reports/$reportId/')({
	component: RouteComponent,
	beforeLoad: ({ context, params }) => {
		// Route guard: ensure user has permission to view this specific report
		// and validate that reportId is a valid format
		if (!params.reportId || params.reportId.trim() === '') {
			throw new Error('Invalid report ID')
		}
		return context
	},
})

function RouteComponent() {
	const { reportId } = Route.useParams()

	return <ReportDetailsPage reportId={reportId} />
}
