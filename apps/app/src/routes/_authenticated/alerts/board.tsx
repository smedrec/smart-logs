import { AlertDashboard } from '@/components/alerts/core/AlertDashboard'
import { AlertErrorBoundary } from '@/components/alerts/error/AlertErrorBoundary'
import { AlertPage } from '@/components/alerts/layout/AlertPage'
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/alerts/board')({
	component: RouteComponent,
	validateSearch: (search: Record<string, unknown>) => {
		return {
			view: (search.view as string) || 'board',
		}
	},
})

function RouteComponent() {
	const navigate = useNavigate()
	const searchParams = useSearch({ from: '/_authenticated/alerts/board' })

	const handleViewChange = (view: 'list' | 'board' | 'statistics') => {
		navigate({
			to: '/alerts/board',
			search: {
				...searchParams,
				view,
			},
		})
	}

	return (
		<AlertErrorBoundary>
			<AlertPage>
				<div className="flex flex-1 flex-col gap-4 p-4">
					<PageBreadcrumb link="Alerts" page="Board" />

					<AlertDashboard
						view={searchParams.view as 'list' | 'board' | 'statistics'}
						onViewChange={handleViewChange}
						className="flex-1"
					/>
				</div>
			</AlertPage>
		</AlertErrorBoundary>
	)
}
