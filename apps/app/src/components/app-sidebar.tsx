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

const data = {
	navMain: [
		{
			title: 'Alerts',
			url: '#',
			icon: CircleAlert,
			isActive: true,
			items: [
				{
					title: 'Board',
					url: '/alerts/board',
				},
				{
					title: 'Active',
					url: '/alerts/active',
				},
				{
					title: 'Acknowledged',
					url: '/alerts/acknowledged',
				},
				{
					title: 'Resolved',
					url: '/alerts/resolved',
				},
				{
					title: 'Statistics',
					url: '/alerts/statistics',
				},
			],
		},
		{
			title: 'Compliance',
			url: '/compliance',
			icon: FileCheck2,
			items: [
				{
					title: 'Dashboard',
					url: '/compliance',
				},
				{
					title: 'Scheduled Reports',
					url: '/compliance/scheduled-reports',
				},
				{
					title: 'Execution History',
					url: '/compliance/execution-history',
				},
				{
					title: 'Report Templates',
					url: '/compliance/report-templates',
				},
				{
					title: 'HIPAA Reports',
					url: '/compliance/hipaa',
				},
				{
					title: 'GDPR Reports',
					url: '/compliance/gdpr',
				},
				{
					title: 'Integrity Reports',
					url: '/compliance/integrity',
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
					url: '/settings/account',
				},
				{
					title: 'Organization',
					url: '/settings/organization',
				},
				{
					title: 'Staff',
					url: '/settings/staff',
				},
				{
					title: 'Security',
					url: '/settings/security',
				},
				{
					title: 'Billing',
					url: '/settings/billing',
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
