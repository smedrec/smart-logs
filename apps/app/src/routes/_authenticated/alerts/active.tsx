import { createColumns } from '@/components/alerts/columns'
import { DataTable } from '@/components/alerts/data-table'
import ResolveAlertForm from '@/components/alerts/form'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb'
import { Spinner } from '@/components/ui/spinner'
import { auditClient } from '@/lib/audit-client'
import { authStateCollection } from '@/lib/auth-client'
import { recentAlertsCollection } from '@/lib/collections'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import type { DataTableRef } from '@/components/alerts/data-table'
import type { Alert } from '@/lib/collections'

export const Route = createFileRoute('/_authenticated/alerts/active')({
	component: RouteComponent,
	/**loader: async () => {
		await Promise.all([alertsCollection.preload()])
		return null
	},*/
})

function RouteComponent() {
	const [resolvingAlert, setResolvingAlert] = useState<Set<string>>(new Set())
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [formKey, setFormKey] = useState(0)
	const activeOrganizationId = authStateCollection.get('auth')?.session.activeOrganizationId
	const alertsCollection = recentAlertsCollection(activeOrganizationId)
	const columns = createColumns()
	const dataTableRef = useRef<DataTableRef>(null)

	const resolveAlert = useMutation({
		mutationFn: async (params: { alertId: string; resolutionNotes: string }) => {
			try {
				await auditClient.metrics.resolveAlert(params.alertId, {
					resolution: params.resolutionNotes,
				})
				return { success: true, message: 'fulfilled' }
			} catch (error) {
				return false
			}
		},
	})

	const { data: activeAlerts, isLoading } = useLiveQuery((q) =>
		q
			.from({ alert: alertsCollection })
			.where(({ alert }) => eq(alert.resolved, 'false'))
			.orderBy(({ alert }) => alert.created_at, 'desc')
	)

	const handlemultiResolve = (alerts: Alert[]) => {
		const alertIds = new Set(alerts.map((record) => record.id))
		setResolvingAlert(alertIds)
		setIsDialogOpen(true)
	}

	const handleResolve = async (resolutionNotes: string) => {
		if (resolvingAlert.size === 0) {
			toast.error('No alert selected to resolve')
			return
		}

		try {
			const results = await Promise.allSettled(
				Array.from(resolvingAlert).map(async (alertId) => {
					try {
						const result = await resolveAlert.mutateAsync({ alertId, resolutionNotes })
						return result === false ? result : result.success
					} catch (error) {
						toast.error(`Failed to resolve alert ${alertId}`)
						return false
					}
				})
			)

			const numResolved = results.filter(
				(result) => result.status === 'fulfilled' && result.value === true
			).length

			// Show summary toast
			if (numResolved === resolvingAlert.size) {
				toast.success(`Resolved ${numResolved} alerts`)
			} else if (numResolved > 0) {
				toast.success(`Resolved ${numResolved} of ${resolvingAlert.size} alerts`)
			}
		} catch (error) {
			toast.error('An unexpected error occurred')
		} finally {
			// Always execute cleanup
			setResolvingAlert(new Set())
			setFormKey((prev) => prev + 1) // Force form reset
			setIsDialogOpen(false)
			dataTableRef.current?.clearRowSelection()
		}
	}

	return (
		<div className="flex flex-1 flex-col gap-4 p-4">
			<PageBreadcrumb link="Alerts" page="Active" />
			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{'Resolve Alert'}</DialogTitle>
						<DialogDescription>
							Please fill out the form below to update the data.
						</DialogDescription>
					</DialogHeader>
					<div>
						<ResolveAlertForm key={formKey} onSubmit={handleResolve} />
					</div>
				</DialogContent>
			</Dialog>
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
						onmultiResolve={handlemultiResolve}
					/>
				)}
			</div>
		</div>
	)
}
