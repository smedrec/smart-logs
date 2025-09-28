import SignUpForm from '@/components/auth/sign-up-form'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(auth)/sign-up')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm">
				<SignUpForm
					onSwitchToSignIn={function (): void {
						throw new Error('Function not implemented.')
					}}
				/>
				<p>By clicking Sign Up, I agree to SMEDREC's terms, privacy policy, and cookie policy.</p>
			</div>
		</div>
	)
}
