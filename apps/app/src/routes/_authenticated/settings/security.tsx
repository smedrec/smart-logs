import { PageHeader } from '@/components/navigation'
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb'
import { ApiKeysCard, ChangePasswordCard, SessionsCard } from '@daveyplate/better-auth-ui'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/settings/security')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<div className="flex flex-1 flex-col gap-4 p-4">
			{/* Page Header */}
			<PageHeader title="Security" description="Account security settings" />
			<ApiKeysCard />
			<ChangePasswordCard />
			<SessionsCard />
		</div>
	)
}
