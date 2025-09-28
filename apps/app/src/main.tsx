import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import ReactDOM from 'react-dom/client'

import { Spinner } from './components/ui/spinner'
import { queryClient } from './lib/query-client'
import { routeTree } from './routeTree.gen'

const router = createRouter({
	routeTree,
	defaultPreload: 'intent',
	defaultPendingComponent: () => <Spinner variant="bars" size={64} />,
	context: { queryClient },
	Wrap: function WrapComponent({ children }: { children: React.ReactNode }) {
		return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	},
})

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router
	}
}

const rootElement = document.getElementById('app')

if (!rootElement) {
	throw new Error('Root element not found')
}

if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement)
	root.render(<RouterProvider router={router} />)
}
