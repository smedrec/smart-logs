import { useSidebar } from '@/components/ui/sidebar'
import { Status, StatusIndicator, StatusLabel } from '@/components/ui/status'
import { auditClient } from '@/lib/audit-client'
import { useQuery } from '@tanstack/react-query'

function ApiStatus() {
	const { state } = useSidebar()
	const {
		isPending,
		error,
		data: status,
	} = useQuery({
		queryKey: ['health-check'],
		queryFn: async () => await auditClient.health.check(),
	})

	if (isPending) {
		return (
			<Status status="maintenance">
				<StatusIndicator />
				{state === 'collapsed' ? null : <StatusLabel>Loading...</StatusLabel>}
			</Status>
		)
	}

	if (error) {
		return (
			<Status status="offline">
				<StatusIndicator />
				{state === 'collapsed' ? null : <StatusLabel>Error</StatusLabel>}
			</Status>
		)
	}

	switch (status.status) {
		case 'healthy':
			return (
				<Status status="online">
					<StatusIndicator />
					{state === 'collapsed' ? null : <StatusLabel>`${Math.floor(status.uptime)}`</StatusLabel>}
				</Status>
			)
		case 'degraded':
			return (
				<Status status="degraded">
					<StatusIndicator />
					{state === 'collapsed' ? null : <StatusLabel>`${Math.floor(status.uptime)}`</StatusLabel>}
				</Status>
			)
		case 'unhealthy':
			return (
				<Status status="offline">
					<StatusIndicator />
					{state === 'collapsed' ? null : <StatusLabel>`${Math.floor(status.uptime)}`</StatusLabel>}
				</Status>
			)
		default:
			return (
				<Status status="offline">
					<StatusIndicator />
					{state === 'collapsed' ? null : <StatusLabel>`${Math.floor(status.uptime)}`</StatusLabel>}
				</Status>
			)
	}
}

export { ApiStatus }
