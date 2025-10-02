import { createFileRoute } from '@tanstack/react-router'
import { lazy } from 'react'

// Lazy load the manual execution page component
const ManualExecutionPage = lazy(() =>
	import('@/components/compliance/manual').then((module) => ({
		default: module.ManualExecutionPage,
	}))
)

export const Route = createFileRoute(
	'/_authenticated/compliance/scheduled-reports/$reportId/execute'
)({
	component: RouteComponent,
	beforeLoad: ({ context, params }) => {
		// Route guard: ensure user has permission to execute this specific report
		// and validate that reportId is a valid format
		if (!params.reportId || params.reportId.trim() === '') {
			throw new Error('Invalid report ID')
		}
		return context
	},
})

function RouteComponent() {
	const { reportId } = Route.useParams()

	return <ManualExecutionPage reportId={reportId} />
}
