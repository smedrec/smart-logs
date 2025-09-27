import Loader from '@/components/loader'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/contexts/auth-provider'
import { ThemeProvider } from '@/contexts/theme-provider'
import { AuthUIProviderTanstack } from '@daveyplate/better-auth-ui/tanstack'
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

import '../index.css'

import { AuditProvider } from '@/contexts/audit-provider'
import { authClient } from '@/lib/auth-client'
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
	const router = useRouter()
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
					<AuthUIProviderTanstack
						authClient={authClient}
						navigate={(href) => router.navigate({ href })}
						replace={(href) => router.navigate({ href, replace: true })}
						Link={({ href, ...props }) => <Link to={href} {...props} />}
						avatar={true}
						organization={{
							logo: true,
							customRoles: [
								{ role: 'auditor', label: 'Auditor' },
								{ role: 'officer', label: 'Compliance Officer' },
								{ role: 'developer', label: 'Developer' },
							],
						}}
						apiKey={{
							metadata: {
								environment: 'development',
								version: 'v1',
							},
						}}
					>
						<AuditProvider>
							<div className="grid grid-rows-[auto_1fr] h-svh">
								{isFetching ? <Loader /> : <Outlet />}
							</div>
						</AuditProvider>
					</AuthUIProviderTanstack>
				</AuthProvider>
				<Toaster richColors />
			</ThemeProvider>
			<TanStackRouterDevtools position="bottom-left" />
			<ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
		</>
	)
}
