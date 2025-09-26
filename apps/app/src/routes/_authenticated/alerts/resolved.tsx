import { ComingSoon } from '@/components/coming-soon'
import { authStateCollection } from '@/lib/auth-client'
import { recentAlertsCollection } from '@/lib/collections'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/alerts/resolved')({
	component: RouteComponent,
})

function RouteComponent() {
	const activeOrganizationId = authStateCollection.get('auth')?.session.activeOrganizationId
	const alertsCollection = recentAlertsCollection(activeOrganizationId)

	const { data: resolvedAlerts } = useLiveQuery((q) =>
		q.from({ alert: alertsCollection }).where(({ alert }) => eq(alert.resolved, 'true'))
	)
	return <ComingSoon />
}
