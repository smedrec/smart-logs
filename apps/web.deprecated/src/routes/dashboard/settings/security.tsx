import { PageBreadcrumb } from '@/components/ui/page-breadcrumb'
import { ChangePasswordCard, SessionsCard } from '@daveyplate/better-auth-ui'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/settings/security')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<div className="flex flex-1 flex-col gap-4 p-4">
			<PageBreadcrumb link="Settings" page="Security" />

			<ChangePasswordCard />
			<SessionsCard />
		</div>
	)
}
