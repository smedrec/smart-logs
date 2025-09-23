import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import ReactDOM from 'react-dom/client'

import { Spinner } from './components/ui/kibo-ui/spinner'
import { AuthProvider, useAuth } from './contexts/auth'
import { routeTree } from './routeTree.gen'
import { queryClient, trpc } from './utils/trpc'

const router = createRouter({
	routeTree,
	defaultPreload: 'intent',
	defaultPendingComponent: () => <Spinner variant="bars" size={64} />,
	context: { trpc, queryClient, auth: { isPending: true, isAuthenticated: false, session: null } },
	Wrap: function WrapComponent({ children }: { children: React.ReactNode }) {
		return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	},
})

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router
	}
}

function InnerApp() {
	const auth = useAuth()
	if (auth.isPending) {
		return (
			<div className="h-svh">
				<div className="m-auto flex h-full w-full flex-col items-center justify-center gap-2">
					<Spinner variant="bars" size={64} />
				</div>
			</div>
		)
	}
	return <RouterProvider router={router} context={{ auth }} />
}

function App() {
	return (
		<AuthProvider>
			<InnerApp />
		</AuthProvider>
	)
}

const rootElement = document.getElementById('app')

if (!rootElement) {
	throw new Error('Root element not found')
}

if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement)
	root.render(<App />)
}
