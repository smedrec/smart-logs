import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Outlet,
	useRouter,
	useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import type { trpc } from '@/utils/trpc'
import type { QueryClient } from '@tanstack/react-query'

import '../index.css'

import { Spinner } from '@/components/ui/kibo-ui/spinner'
import { authClient } from '@/lib/auth-client'
import { seo } from '@/lib/seo'
import { AuthQueryProvider } from '@daveyplate/better-auth-tanstack'
import { AuthUIProviderTanstack } from '@daveyplate/better-auth-ui/tanstack'

import type { AuthContext } from '@/contexts/auth'

export interface RouterAppContext {
	trpc: typeof trpc
	queryClient: QueryClient
	auth: AuthContext
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
	const router = useRouter()
	const isFetching = useRouterState({
		select: (s) => s.isLoading,
	})

	return (
		<>
			<HeadContent />
			<ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
				<AuthQueryProvider>
					<AuthUIProviderTanstack
						authClient={authClient}
						navigate={(href) => router.navigate({ href })}
						replace={(href) => router.navigate({ href, replace: true })}
						Link={({ href, ...props }) => <Link to={href} {...props} />}
						avatar={true}
						organization={{
							logo: true,
						}}
						apiKey={{
							metadata: {
								environment: 'development',
								version: 'v1',
							},
						}}
						settings={{
							url: '/dashboard/settings/account',
						}}
					>
						<div className="grid grid-rows-[auto_1fr] h-svh">
							{isFetching ? <Spinner variant="bars" size={64} /> : <Outlet />}
						</div>
					</AuthUIProviderTanstack>
				</AuthQueryProvider>
				<Toaster richColors />
			</ThemeProvider>
			<TanStackRouterDevtools position="bottom-left" />
			<ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
		</>
	)
}
