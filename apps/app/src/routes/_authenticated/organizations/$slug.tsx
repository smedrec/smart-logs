import { AuditPresets } from '@/components/organization/audit-presets'
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb'
import { activeOrganizationCollection, authClient } from '@/lib/auth-client'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/organizations/$slug')({
	component: RouteComponent,
})

function RouteComponent() {
	const { slug } = Route.useParams()
	//const name = activeOrganizationCollection.get(slug)?.name
	return (
		<div className="flex flex-1 flex-col gap-4 p-4">
			<PageBreadcrumb link="Organization" page={slug} />
			<AuditPresets />
		</div>
	)
}
