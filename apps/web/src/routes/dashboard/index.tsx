import { Spinner } from '@/components/ui/kibo-ui/spinner'
import { trpc } from '@/utils/trpc'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/')({
	component: RouteComponent,
})

function RouteComponent() {
	const { data: alerts, isLoading } = useQuery(trpc.alerts.active.queryOptions())

	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			<div className="grid auto-rows-min gap-4 md:grid-cols-3">
				<div className="bg-muted/50 aspect-video rounded-xl" />
				<div className="bg-muted/50 aspect-video rounded-xl" />
				<div className="bg-muted/50 aspect-video rounded-xl" />
			</div>
			<div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min">
				{isLoading ? (
					<div className="flex flex-1 items-center justify-center">
						<Spinner variant="bars" size={64} />
					</div>
				) : (
					<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
						{alerts?.map((alert) => (
							<div key={alert.id}>
								{alert.title} - {alert.description}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
