'use client'

import { NavMain } from '@/components/nav-main'
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from '@/components/ui/sidebar'
import { Link } from '@tanstack/react-router'
import {
	BookOpen,
	Bot,
	CircleAlert,
	FileCheck2,
	Github,
	Settings2,
	TerminalIcon,
} from 'lucide-react'
import * as React from 'react'

import { ApiStatus } from './api-status'
import { NavOrganizations } from './nav-organizations'

// This is sample data.
const data = {
	navMain: [
		{
			title: 'Alerts',
			url: '#',
			icon: CircleAlert,
			isActive: true,
			items: [
				{
					title: 'Active',
					url: '/dashboard/alerts/active',
				},
				{
					title: 'Statistics',
					url: '/dashboard/alerts/statistics',
				},
			],
		},
		{
			title: 'Compliance',
			url: '#',
			icon: FileCheck2,
			items: [
				{
					title: 'Hipaa Report',
					url: '/dashboard/compliance/hipaa',
				},
				{
					title: 'GDPR Report',
					url: '/dashboard/compliance/gdpr',
				},
				{
					title: 'Integrity Report',
					url: '/dashboard/compliance/integrity',
				},
				{
					title: 'Export Reports',
					url: '/dashboard/compliance/export-reports',
				},
				{
					title: 'Export Events',
					url: '/dashboard/compliance/export-events',
				},
				{
					title: 'Scheduled Reports',
					url: '/dashboard/compliance/scheduled-reports',
				},
				{
					title: 'Report Templates',
					url: '/dashboard/compliance/report-templates',
				},
			],
		},
		{
			title: 'Settings',
			url: '#',
			icon: Settings2,
			items: [
				{
					title: 'Account',
					url: '/dashboard/settings/account',
				},
				{
					title: 'Organization',
					url: '/dashboard/settings/organization',
				},
				{
					title: 'Staff',
					url: '/dashboard/settings/staff',
				},
				{
					title: 'Security',
					url: '/dashboard/settings/security',
				},
				{
					title: 'Billing',
					url: '/dashboard/settings/billing',
				},
			],
		},
	],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<ApiStatus />
			</SidebarHeader>
			<SidebarContent>
				<NavMain items={data.navMain} />
				<NavOrganizations />
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<FooterLink to="https://smedrec-67bbd.web.app/" Icon={BookOpen} label="Documentation" />
					<FooterLink
						to="https://github.com/joseantcordeiro/smart-logs"
						Icon={Github}
						label="View Source"
					/>
					<FooterLink to="/dashboard/logs" Icon={TerminalIcon} label="Logs" />
				</SidebarMenu>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	)
}

/* ---------- footer link ---------- */
const FooterLink = ({ to, Icon, label }: { to: string; Icon: typeof BookOpen; label: string }) => {
	const isExternal = to.startsWith('http://') || to.startsWith('https://')

	if (isExternal) {
		return (
			<SidebarMenuItem>
				<a href={to} target="_blank" rel="noopener noreferrer">
					<SidebarMenuButton>
						<Icon className="mr-3 h-4 w-4" />
						{label}
					</SidebarMenuButton>
				</a>
			</SidebarMenuItem>
		)
	}

	return (
		<SidebarMenuItem>
			<Link to={to}>
				<SidebarMenuButton>
					<Icon className="mr-3 h-4 w-4" />
					{label}
				</SidebarMenuButton>
			</Link>
		</SidebarMenuItem>
	)
}
