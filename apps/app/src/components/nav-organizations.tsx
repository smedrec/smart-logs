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
import {
	activeOrganizationCollection,
	authClient,
	authStateCollection,
	OrganizationsCollection,
} from '@/lib/auth-client'
import { useLiveQuery } from '@tanstack/react-db'
import { Link } from '@tanstack/react-router'
import { Folder, Forward, MoreHorizontal, PlusCircle, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Spinner } from './ui/spinner'

import type { ActiveOrganization } from '@/lib/auth-client'

function NavOrganizations() {
	const { isMobile } = useSidebar()

	const activeOrganizationId = authStateCollection.get(`auth`)?.session.activeOrganizationId
	const {
		data: organizationsData,
		isLoading: isLoadingOrganizations,
		isError: organizationsError,
	} = useLiveQuery((q) => q.from({ organization: OrganizationsCollection }))

	const organizations = useMemo(() => organizationsData || [], [organizationsData])

	/**useEffect(() => {
		async function insertActiveOrganization() {
			const { data: activeOrganization } = await authClient.organization.getFullOrganization()
			if (!activeOrganization) return
			activeOrganizationCollection.insert({ id: activeOrganization.slug, ...activeOrganization })
		}
		const activeOrganization = organizations.find((org) => org.id === activeOrganizationId)
		if (activeOrganization && !activeOrganizationCollection.get(activeOrganization.slug)) {
			insertActiveOrganization()
		}
	}, [activeOrganizationId, organizations])*/

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
					const active = item.id === activeOrganizationId
					return (
						<SidebarMenuItem key={item.name}>
							<SidebarMenuButton isActive={active} asChild>
								{/** @ts-expect-error */}
								<Link to={`/organizations/${item.slug}`}>
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
