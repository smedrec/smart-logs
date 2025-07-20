import { QueryCache, QueryClient } from '@tanstack/react-query'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import { toast } from 'sonner'
import superjson from 'superjson'

import type { AppRouter } from '../../../server/src/routers/index'
import { STALE_TIMES } from '@/lib/constants'

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

export const trpcClient = createTRPCClient<AppRouter>({
	links: [
		httpBatchLink({
			url: `${import.meta.env.VITE_SERVER_URL}/trpc`,
			fetch(url, options) {
				return fetch(url, {
					...options,
					credentials: 'include',
				})
			},
			transformer: superjson,
		}),
	],
})

export const trpc = createTRPCOptionsProxy<AppRouter>({
	client: trpcClient,
	queryClient,
})
