import { QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

/**
 * Constant values for cache time-to-live (TTL) and stale times
 */
export const STALE_TIMES = {
	FREQUENT: 30000, // 30 seconds - for data that changes often
	STANDARD: 120000, // 2 minutes - default
	RARE: 600000, // 10 minutes - for rarely changing data
	NEVER: Number.POSITIVE_INFINITY, // Only refetch on explicit invalidation
}

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: STALE_TIMES.STANDARD,
			// Default to no polling unless specifically configured
			refetchInterval: false,
			// Make queries retry 3 times with exponential backoff
			retry: 3,
			retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
			// Refetch query on window focus
			refetchOnWindowFocus: true,
			// Enable refetch on reconnect
			refetchOnReconnect: true,
			// Fail queries that take too long
		},
		mutations: {
			// Default to 3 retries for mutations too
			retry: 3,
			retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
		},
	},
	queryCache: new QueryCache({
		onError: (error) => {
			toast.error(error.message, {
				action: {
					label: 'retry',
					onClick: () => {
						queryClient.invalidateQueries()
					},
				},
			})
		},
	}),
})
