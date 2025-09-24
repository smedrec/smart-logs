import { Status, StatusIndicator, StatusLabel } from '@/components/ui/kibo-ui/status'
import { trpc } from '@/utils/trpc'
import { useQuery } from '@tanstack/react-query'

function ApiStatus() {
	const status = useQuery(trpc.metrics.status.queryOptions())
	const overallStatus = status.data?.status

	switch (overallStatus) {
		case 'OK':
			return (
				<Status status="online">
					<StatusIndicator />
					<StatusLabel />
				</Status>
			)
		case 'WARNING':
			return (
				<Status status="degraded">
					<StatusIndicator />
					<StatusLabel />
				</Status>
			)
		case 'CRITICAL':
			return (
				<Status status="offline">
					<StatusIndicator />
					<StatusLabel />
				</Status>
			)
		default:
			return (
				<Status status="offline">
					<StatusIndicator />
					<StatusLabel />
				</Status>
			)
	}
}

export { ApiStatus }
