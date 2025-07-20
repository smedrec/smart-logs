import Header from '@/components/header'
import Loader from '@/components/loader'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import type { trpc } from '@/utils/trpc'
import type { QueryClient } from '@tanstack/react-query'

import '../index.css'

import { authClient } from '@/lib/auth-client'
import { seo } from '@/lib/seo'

export interface RouterAppContext {
	trpc: typeof trpc
	queryClient: QueryClient
	authClient: typeof authClient
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
	head: () => ({
		meta: [
			{
				charSet: 'utf-8',
			},
			{
				name: 'viewport',
				content: 'width=device-width, initial-scale=1',
			},
			...seo({
				title: 'Smart Logs | Opensource Audit Logging compatible with FHIR',
				description:
					'Smart Logs is an opensource FHIR Auditing system that provides comprehensive audit logging capabilities for healthcare applications, ensuring compliance with HIPAA, GDPR, and other regulatory requirements.',
			}),
		],
		links: [
			{
				rel: 'icon',
				href: '/favicon.ico',
			},
		],
	}),
})

function RootComponent() {
	const isFetching = useRouterState({
		select: (s) => s.isLoading,
	})

	return (
		<>
			<HeadContent />
			<ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
				<div className="grid grid-rows-[auto_1fr] h-svh">
					<Header />
					{isFetching ? <Loader /> : <Outlet />}
				</div>
				<Toaster richColors />
			</ThemeProvider>
			<TanStackRouterDevtools position="bottom-left" />
			<ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
		</>
	)
}
