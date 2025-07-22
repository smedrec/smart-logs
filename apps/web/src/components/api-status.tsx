import { Status, StatusIndicator, StatusLabel } from '@/components/ui/kibo-ui/status'
import { trpc } from '@/utils/trpc'
import { useQuery } from '@tanstack/react-query'

function ApiStatus() {
	const healthCheck = useQuery(trpc.health.check.queryOptions())
	return (
		<span className="text-sm text-muted-foreground">
			{healthCheck.isLoading ? (
				'Checking...'
			) : healthCheck.data ? (
				<Status status="online">
					<StatusIndicator />
					<StatusLabel />
				</Status>
			) : (
				<Status status="offline">
					<StatusIndicator />
					<StatusLabel />
				</Status>
			)}
		</span>
	)
}

export { ApiStatus }
