import { AuditPresets } from '@/components/organization/audit-presets'
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
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
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem className="hidden md:block">
						<BreadcrumbLink href="#">Organization</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator className="hidden md:block" />
					<BreadcrumbItem>
						<BreadcrumbPage>{organization?.name}</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<AuditPresets />
		</div>
	)
}
