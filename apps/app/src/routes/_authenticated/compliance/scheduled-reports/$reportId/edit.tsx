import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { lazy } from 'react'

// Lazy load the report configuration form component
const ReportConfigurationForm = lazy(() =>
	import('@/components/compliance/forms').then((module) => ({
		default: module.ReportConfigurationForm,
	}))
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
	const navigate = useNavigate()

	const handleSubmit = async (data: any) => {
		// TODO: Implement report update logic
		console.log('Updating report:', reportId, data)
		// Navigate back to report details after successful update
		navigate({
			to: '/compliance/scheduled-reports/$reportId',
			params: { reportId },
		})
	}

	const handleCancel = () => {
		navigate({
			to: '/compliance/scheduled-reports/$reportId',
			params: { reportId },
		})
	}

	return (
		<ReportConfigurationForm
			mode="edit"
			reportId={reportId}
			onSubmit={handleSubmit}
			onCancel={handleCancel}
		/>
	)
}
