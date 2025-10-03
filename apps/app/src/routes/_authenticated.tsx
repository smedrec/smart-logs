import { AppSidebar } from '@/components/app-sidebar'
import { NavUser } from '@/components/auth/nav-user'
import Header from '@/components/header'
import { ModeToggle } from '@/components/mode-toggle'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/contexts/auth-provider'
import { authClient, authStateCollection } from '@/lib/auth-client'
//import { useLiveQuery } from '@tanstack/react-db'
import { createFileRoute, Link, Outlet, useNavigate } from '@tanstack/react-router'

//import { useEffect, useState } from 'react'

import type { Session } from '@/lib/auth-client'

export const Route = createFileRoute('/_authenticated')({
	ssr: false, // Disable SSR - run beforeLoad only on client
	component: AuthenticatedLayout,
	beforeLoad: async () => {
		if (
			authStateCollection.get(`auth`) &&
			authStateCollection.get(`auth`)?.session.expiresAt > new Date()
		) {
			return authStateCollection.get(`auth`)
		} else {
			const result = await authClient.getSession()
			if (!result.data) {
				authStateCollection.delete(`auth`)
				return null
			}
			// Store session in local collection
			const session = result.data as Session
			authStateCollection.insert({ id: `auth`, ...session })
			return session
		}
	},
	errorComponent: ({ error }) => {
		const ErrorComponent = () => {
			const { isAuthenticated } = useAuth()

			// Only redirect to login if user is not authenticated
			if (!isAuthenticated && typeof window !== `undefined`) {
				window.location.href = `/sign-in`
				return null
			}

			// For other errors, render an error message
			return (
				<div className="min-h-screen bg-gray-50 flex items-center justify-center">
					<div className="text-center">
						<h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
						<p className="text-gray-600 mb-4">{error?.message || `An unexpected error occurred`}</p>
						<button
							onClick={() => window.location.reload()}
							className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
						>
							Retry
						</button>
					</div>
				</div>
			)
		}

		return <ErrorComponent />
	},
})

function AuthenticatedLayout() {
	const { session, isPending } = useAuth()
	const navigate = useNavigate()

	if (isPending) {
		return <Spinner variant="bars" size={64} />
	}

	if (!session) {
		navigate({ to: '/sign-in' })
	}

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className="sticky top-0 z-50 border-b bg-background/60 px-4 py-3 backdrop-blur flex h-14 shrink-0 items-center gap-2">
					<div className="flex flex-1 items-center gap-2 px-3">
						<SidebarTrigger className="-ml-1" />
						<Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
					</div>
					<Header />
				</header>
				<Outlet />
			</SidebarInset>
		</SidebarProvider>
	)
}
