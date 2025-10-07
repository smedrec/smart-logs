import { DataTable } from '@/components/alerts/data-table'
import createAlertColumns from '@/components/alerts/data/AlertColumns'
import { useAlertAction } from '@/components/alerts/hooks/use-alert-queries'
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb'
import { Spinner } from '@/components/ui/spinner'
import { authStateCollection } from '@/lib/auth-client'
import { recentAlertsCollection } from '@/lib/collections'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState } from 'react'

import type { DataTableRef } from '@/components/alerts/data-table'
import type { Alert } from '@/lib/collections'

export const Route = createFileRoute('/_authenticated/alerts/data')({
	component: RouteComponent,
})

function RouteComponent() {
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const activeOrganizationId = authStateCollection.get('auth')?.session.activeOrganizationId
	const alertsCollection = recentAlertsCollection(activeOrganizationId)
	const columns = createAlertColumns()
	const dataTableRef = useRef<DataTableRef>(null)
	const { acknowledge, resolve, dismiss } = useAlertAction()
	const { data: activeAlerts, isLoading } = useLiveQuery((q) =>
		q.from({ alert: alertsCollection }).where(({ alert }) => eq(alert.resolved, 'false'))
	)

	const handleResolveAlert = async (id: string, note: string) => {
		resolve.mutate({ alertId: id, action: 'resolve', notes: note })
	}

	const handleAcknowledgeAlert = async (id: string) => {
		acknowledge.mutate({ alertId: id, action: 'acknowledge' })
	}

	const handleDismissAlert = async (id: string) => {
		dismiss.mutate({ alertId: id, action: 'dismiss' })
	}

	return (
		<div className="flex flex-1 flex-col gap-4 p-4">
			<PageBreadcrumb link="Alerts" page="Active" />

			<div className="min-h-[100vh] flex-1 rounded-xl md:min-h-min">
				{isLoading ? (
					<div className="flex flex-1 items-center justify-center">
						<Spinner variant="bars" size={64} />
					</div>
				) : (
					<DataTable
						ref={dataTableRef}
						columns={columns}
						data={activeAlerts ? activeAlerts : []}
						onResolveAlert={handleResolveAlert}
						onAcknowledgeAlert={handleAcknowledgeAlert}
						onDismissAlert={handleDismissAlert}
					/>
				)}
			</div>
		</div>
	)
}
