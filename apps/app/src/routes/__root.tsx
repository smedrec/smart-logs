import Loader from '@/components/loader'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/contexts/auth-provider'
import { ThemeProvider } from '@/contexts/theme-provider'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import '../index.css'

import { seo } from '@/lib/seo'

import type { QueryClient } from '@tanstack/react-query'

export interface RouterAppContext {
	queryClient: QueryClient
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
			<ThemeProvider
				attribute="class"
				defaultTheme="dark"
				disableTransitionOnChange
				storageKey="vite-ui-theme"
			>
				<AuthProvider>
					<div className="grid grid-rows-[auto_1fr] h-svh">
						{isFetching ? <Loader /> : <Outlet />}
					</div>
				</AuthProvider>
				<Toaster richColors />
			</ThemeProvider>
			<TanStackRouterDevtools position="bottom-left" />
			<ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
		</>
	)
}
