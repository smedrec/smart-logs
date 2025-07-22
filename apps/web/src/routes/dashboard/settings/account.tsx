import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
	APIKeysCard,
	ChangeEmailCard,
	DeleteAccountCard,
	UpdateAvatarCard,
	UpdateNameCard,
} from '@daveyplate/better-auth-ui'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/settings/account')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<div className="flex flex-1 flex-col gap-4 p-4">
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem className="hidden md:block">
						<BreadcrumbLink href="#">Setting</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator className="hidden md:block" />
					<BreadcrumbItem>
						<BreadcrumbPage>Account</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<div className="grid auto-rows-min gap-4 md:grid-cols-3">
				<div className="aspect-video rounded-xl">
					<UpdateAvatarCard />
				</div>
				<div className="aspect-video rounded-xl">
					<UpdateNameCard />
				</div>
				<div className="aspect-video rounded-xl">
					<ChangeEmailCard />
				</div>
			</div>
			<APIKeysCard />
			<DeleteAccountCard />
		</div>
	)
}
