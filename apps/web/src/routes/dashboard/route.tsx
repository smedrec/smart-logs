import { AppSidebar } from '@/components/app-sidebar'
import { ModeToggle } from '@/components/mode-toggle'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { UserButton } from '@daveyplate/better-auth-ui'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard')({
	/**beforeLoad: ({ context, location }) => {
		if (!context.auth.isAuthenticated) {
			throw redirect({
				to: '/auth/sign-in',
				search: {
					redirect: location.href,
				},
			})
		}
	},*/
	component: DashboardLayout,
})

function DashboardLayout() {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className="sticky top-0 z-50 border-b bg-background/60 px-4 py-3 backdrop-blur flex h-14 shrink-0 items-center gap-2">
					<div className="flex flex-1 items-center gap-2 px-3">
						<SidebarTrigger className="-ml-1" />
						<Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
					</div>
					<div className="flex grow justify-end gap-2 p-3">
						<ModeToggle />
						<UserButton
							className="text-accent-foreground bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50"
							classNames={{
								content: {
									avatar: {
										fallback: 'bg-destructive text-white',
									},
								},
							}}
							size="sm"
						/>
					</div>
				</header>
				<Outlet />
			</SidebarInset>
		</SidebarProvider>
	)
}
