import { PageBreadcrumb } from '@/components/ui/page-breadcrumb'
import {
	//APIKeysCard,
	ChangeEmailCard,
	DeleteAccountCard,
	UpdateAvatarCard,
	UpdateNameCard,
} from '@daveyplate/better-auth-ui'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/settings/account')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<div className="flex flex-1 flex-col gap-4 p-4">
			<PageBreadcrumb link="Settings" page="Account" />
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
			<DeleteAccountCard />
		</div>
	)
}
