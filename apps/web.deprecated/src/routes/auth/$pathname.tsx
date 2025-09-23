import { AuthView } from '@daveyplate/better-auth-ui'
import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/auth/$pathname')({
	component: RouteComponent,
})

function RouteComponent() {
	const { pathname } = Route.useParams()

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm">
				<AuthView pathname={pathname} redirectTo="/dashboard" />
				<p className="text-center text-muted-foreground text-xs p-6">
					By signing in, you agree to our{' '}
					<Link className="text-warning underline" to="/tos" target="_blank" rel="noreferrer">
						Terms of Use
					</Link>{' '}
					and{' '}
					<Link
						className="text-warning underline"
						to="/privacy-policy"
						target="_blank"
						rel="noreferrer"
					>
						Privacy Policy
					</Link>
					.
				</p>
			</div>
		</div>
	)
}
