import { createColumns } from '@/components/alerts/columns'
import { DataTable } from '@/components/alerts/data-table'
import ResolveAlertForm from '@/components/alerts/form'
//import ResolveAlertForm from '@/components/alerts/form'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/kibo-ui/spinner'
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb'
import { trpc } from '@/utils/trpc'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

//import type { ResolveAlertData } from '@/components/alerts/form'
import type { Alert } from '@repo/audit'

export const Route = createFileRoute('/dashboard/alerts/active')({
	component: RouteComponent,
})

function RouteComponent() {
	const { data: alerts, isLoading } = useQuery(trpc.alerts.active.queryOptions())
	const queryClient = useQueryClient()
	const queryKey = trpc.alerts.active.queryKey()
	const [resolvingAlert, setResolvingAlert] = useState<Set<string>>(new Set())
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const columns = createColumns()
	const resolveAlert = useMutation(trpc.alerts.resolve.mutationOptions())

	const handlemultiResolve = (alerts: Alert[]) => {
		const alertIds = new Set(alerts.map((record) => record.id))
		setResolvingAlert(alertIds)
		setIsDialogOpen(true)
	}

	const handleResolve = (resolutionNotes: string) => {
		if (resolvingAlert.size === 0) {
			toast.error('No alert selected to resolve')
			return
		}
		let numResolved = 0

		Array.from(resolvingAlert).map(async (alertId) => {
			const { success } = await resolveAlert.mutateAsync({ alertId, resolutionNotes })
			if (success) {
				numResolved++
				toast.success(`Alert ${alertId} resolved`)
			}
		})

		// Always execute cleanup regardless of errors
		if (numResolved === resolvingAlert.size) {
			toast.success(`Resolved ${numResolved} alerts`)
		} else if (numResolved > 0) {
			toast.success(`Resolved ${numResolved} of ${resolvingAlert.size} alerts`)
		}
		queryClient.invalidateQueries({ queryKey })
		setResolvingAlert(new Set())
		setIsDialogOpen(false)
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
						<ResolveAlertForm onSubmit={handleResolve} />
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
						columns={columns}
						data={alerts ? alerts : []}
						onmultiResolve={handlemultiResolve}
					/>
				)}
			</div>
		</div>
	)
}
