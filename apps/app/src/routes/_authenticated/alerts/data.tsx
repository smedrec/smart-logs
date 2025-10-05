import AlertDataTableExample from '@/components/alerts/data/AlertDataTableExample'
import { authStateCollection } from '@/lib/auth-client'
import { recentAlertsCollection } from '@/lib/collections'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/alerts/data')({
	component: RouteComponent,
	validateSearch: (search: Record<string, unknown>) => {
		return {
			page: Number(search.page) || 1,
			pageSize: Number(search.pageSize) || 25,
			severity: search.severity as string,
			search: search.search as string,
			source: search.source as string,
			tags: search.tags as string,
			alertId: search.alertId as string,
		}
	},
})
function RouteComponent() {
	const activeOrganizationId = authStateCollection.get('auth')?.session.activeOrganizationId
	const alertsCollection = recentAlertsCollection(activeOrganizationId)
	const {
		data: alerts,
		isLoading,
		isError,
		status,
	} = useLiveQuery((q) =>
		q
			.from({ alert: alertsCollection })
			.where(({ alert }) => eq(alert.resolved, 'false'))
			.orderBy(({ alert }) => alert.created_at, 'desc')
	)
	return (
		<AlertDataTableExample data={alerts} loading={isLoading} error={isError ? status : undefined} />
	)
}
