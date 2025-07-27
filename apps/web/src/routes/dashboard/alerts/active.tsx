import { createColumns } from '@/components/alerts/columns'
import { DataTable } from '@/components/alerts/data-table'
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
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

//import type { ResolveAlertData } from '@/components/alerts/form'
import type { Alert } from '@repo/audit'

export const Route = createFileRoute('/dashboard/alerts/active')({
	component: RouteComponent,
})

function RouteComponent() {
	const { data: alerts, isLoading } = useQuery(trpc.alerts.active.queryOptions())
	//const [resolvingAlert, setResolvingAlert] = useState<ResolveAlertData | null>(null)
	//const [isDialogOpen, setIsDialogOpen] = useState(false)
	const columns = createColumns()

	const handlemultiResolve = (alerts: Alert[]) => {
		const alertIds = new Set(alerts.map((record) => record.id))
		//setData(data.filter((record) => !alertIds.has(record.id)))
	}

	return (
		<div className="flex flex-1 flex-col gap-4 p-4">
			<PageBreadcrumb link="Alerts" page="Active" />
			{/*<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{'Resolve Alert'}</DialogTitle>
						<DialogDescription>
							Please fill out the form below to update the data.
						</DialogDescription>
					</DialogHeader>
					<div>
						<ResolveAlertForm onSubmit={handleResolve} initialData={resolvingAlert} />
					</div>
				</DialogContent>
			</Dialog>*/}
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
