import { AuditPresets } from '@/components/organization/audit-presets'
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb'
import { useActiveOrganization } from '@/hooks/auth-hooks'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/organizations/$slug')({
	component: RouteComponent,
})

function RouteComponent() {
	const { slug } = Route.useParams()
	const { data: organization } = useActiveOrganization()
	return (
		<div className="flex flex-1 flex-col gap-4 p-4">
			<PageBreadcrumb link="Organization" page={organization?.name || slug} />
			<AuditPresets />
		</div>
	)
}
