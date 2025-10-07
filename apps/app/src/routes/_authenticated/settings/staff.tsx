import { PageHeader } from '@/components/navigation'
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { OrganizationInvitationsCard, OrganizationMembersCard } from '@daveyplate/better-auth-ui'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/settings/staff')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<div className="flex flex-1 flex-col gap-4 p-4">
			{/* Page Header */}
			<PageHeader title="Staff" description="Manage the current organization staff" />
			<OrganizationMembersCard />
			<OrganizationInvitationsCard />
		</div>
	)
}
