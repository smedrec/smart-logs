import { useAuditContext } from '@/contexts/audit-provider'
import { useQuery } from '@tanstack/react-query'

// Hook for api status monitoring
export function useApiStatus() {
	const { client, isConnected } = useAuditContext()

	const query = useQuery({
		queryKey: ['apiStatus'],
		queryFn: async () => {
			if (!client) throw new Error('Audit client not initialized')
			return client.health.check()
		},
		enabled: isConnected && !!client,
		refetchInterval: 30000, // Refetch every 30 seconds
		staleTime: 15000, // 15 seconds
	})

	return {
		data: query.data,
		loading: query.isLoading,
		error: query.error,
		refetch: query.refetch,
	}
}
