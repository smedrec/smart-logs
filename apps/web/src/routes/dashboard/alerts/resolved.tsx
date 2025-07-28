import { createColumns } from '@/components/alerts/columns'
import { DataTable } from '@/components/alerts/data-table-resolved'
import { Spinner } from '@/components/ui/kibo-ui/spinner'
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb'
import { trpc } from '@/utils/trpc'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/alerts/resolved')({
	component: RouteComponent,
})

function RouteComponent() {
	const { data: alerts, isLoading } = useQuery(trpc.alerts.resolved.queryOptions())
	const columns = createColumns()

	const handleCleanup = () => {}
	return (
		<div className="flex flex-1 flex-col gap-4 p-4">
			<PageBreadcrumb link="Alerts" page="Resolved" />

			<div className="min-h-[100vh] flex-1 rounded-xl md:min-h-min">
				{isLoading ? (
					<div className="flex flex-1 items-center justify-center">
						<Spinner variant="bars" size={64} />
					</div>
				) : (
					<DataTable columns={columns} data={alerts ? alerts : []} onCleanup={handleCleanup} />
				)}
			</div>
		</div>
	)
}
