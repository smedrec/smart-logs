import { authClient } from '@/lib/auth-client'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute(`/_authenticated/`)({
	component: IndexRedirect,
	ssr: false,
	beforeLoad: async () => {
		const res = await authClient.getSession()
		if (!res.data?.session) {
			throw redirect({
				to: `/sign-in`,
				search: {
					// Use the current location to power a redirect after login
					// (Do not use `router.state.resolvedLocation` as it can
					// potentially lag behind the actual current location)
					redirect: location.href,
				},
			})
		} else {
			throw redirect({
				to: `/dashboard`,
			})
		}
	},
})

function IndexRedirect() {
	const navigate = useNavigate()

	return (
		<div className="p-6">
			<div className="text-center">
				<p className="text-gray-500">Loading...</p>
			</div>
		</div>
	)
}
