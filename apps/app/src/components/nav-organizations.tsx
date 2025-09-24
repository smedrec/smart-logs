'use client'

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from '@/components/ui/sidebar'
import { authClient } from '@/lib/auth-client'
import { Link } from '@tanstack/react-router'
import { Folder, Forward, MoreHorizontal, PlusCircle, Trash2 } from 'lucide-react'
import { useMemo } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Spinner } from './ui/spinner'

function NavOrganizations() {
	const { isMobile } = useSidebar()
	const {
		data: organizationsData,
		isPending: isLoadingOrganizations,
		error: organizationsError,
	} = authClient.useListOrganizations()
	const { data: activeOrganization } = authClient.useActiveOrganization()

	const organizations = useMemo(() => organizationsData || [], [organizationsData])

	const organizationsLoadError = organizationsError
		? 'Error loading organizations: NetworkError: Unable to connect to the server. Please check if the server is running.'
		: undefined

	return (
		<SidebarGroup className="group-data-[collapsible=icon]:hidden">
			<SidebarGroupLabel>Organizations</SidebarGroupLabel>
			<SidebarMenu>
				{organizationsLoadError && (
					<div className="px-4 py-2 text-red-500 text-xs">{organizationsLoadError}</div>
				)}
				{isLoadingOrganizations && !organizationsError && <Spinner variant="bars" size={32} />}
				{organizations.map((item) => {
					const active = item.id === activeOrganization?.id
					return (
						<SidebarMenuItem key={item.name}>
							<SidebarMenuButton isActive={active} asChild>
								<Link to={`/dashboard/organizations/${item.slug}`}>
									<Avatar className="h-4 w-4 rounded-full border border-background object-cover">
										<AvatarImage src={item.logo || undefined} alt={item.name} />
										<AvatarFallback>OR</AvatarFallback>
									</Avatar>
									<span>{item.name}</span>
								</Link>
							</SidebarMenuButton>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<SidebarMenuAction showOnHover>
										<MoreHorizontal />
										<span className="sr-only">More</span>
									</SidebarMenuAction>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									className="w-48 rounded-lg"
									side={isMobile ? 'bottom' : 'right'}
									align={isMobile ? 'end' : 'start'}
								>
									<DropdownMenuItem>
										<Folder className="text-muted-foreground" />
										<span>View Organization</span>
									</DropdownMenuItem>
									<DropdownMenuItem>
										<Forward className="text-muted-foreground" />
										<span>Share Organization</span>
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem>
										<Trash2 className="text-muted-foreground" />
										<span>Delete Organization</span>
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</SidebarMenuItem>
					)
				})}
				<SidebarMenuItem>
					<SidebarMenuButton className="text-sidebar-foreground/70">
						<PlusCircle className="text-sidebar-foreground/70" />
						<span>Create Organization</span>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		</SidebarGroup>
	)
}

export { NavOrganizations }
