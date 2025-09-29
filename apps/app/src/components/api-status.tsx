import { useSidebar } from '@/components/ui/sidebar'
import { Status, StatusIndicator, StatusLabel } from '@/components/ui/status'
import { useApiStatus } from '@/hooks/use-api-check'

function ApiStatus() {
	const { data: status, loading, error } = useApiStatus()
	const { state } = useSidebar()

	if (loading) {
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
				{state === 'collapsed' ? null : <StatusLabel>error.message</StatusLabel>}
			</Status>
		)
	}

	if (!status) {
		return (
			<Status status="offline">
				<StatusIndicator />
				{state === 'collapsed' ? null : <StatusLabel>Offline</StatusLabel>}
			</Status>
		)
	}

	switch (status.status) {
		case 'healthy':
			return (
				<Status status="online">
					<StatusIndicator />
					{state === 'collapsed' ? null : <StatusLabel>{Math.floor(status.uptime)}</StatusLabel>}
				</Status>
			)
		case 'degraded':
			return (
				<Status status="degraded">
					<StatusIndicator />
					{state === 'collapsed' ? null : <StatusLabel>{Math.floor(status.uptime)}</StatusLabel>}
				</Status>
			)
		case 'unhealthy':
			return (
				<Status status="offline">
					<StatusIndicator />
					{state === 'collapsed' ? null : <StatusLabel>{Math.floor(status.uptime)}</StatusLabel>}
				</Status>
			)
		default:
			return (
				<Status status="offline">
					<StatusIndicator />
					{state === 'collapsed' ? null : <StatusLabel>{Math.floor(status.uptime)}</StatusLabel>}
				</Status>
			)
	}
}

export { ApiStatus }
