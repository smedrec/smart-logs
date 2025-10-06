/**
 * App Navigation Component
 *
 * Provides navigation specific to app features with active route highlighting
 * and proper accessibility support.
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { Link, useRouterState } from '@tanstack/react-router'
import {
	AlertTriangle,
	BarChart3,
	Calendar,
	CheckCircle,
	CircleAlert,
	Clock,
	FileCheck2,
	FileText,
	History,
	Home,
	Play,
	Settings,
} from 'lucide-react'
import { useState } from 'react'

interface NavigationItem {
	title: string
	href: string
	icon: React.ComponentType<{ className?: string }>
	badge?: string | number
	description?: string
	children?: NavigationItem[]
}

interface NavigationProps {
	className?: string
	collapsed?: boolean
}

export function Navigation({ className, collapsed = false }: NavigationProps) {
	const routerState = useRouterState()
	const currentPath = routerState.location.pathname
	const [openSections, setOpenSections] = useState<string[]>(['reports'])

	const navigationItems: NavigationItem[] = [
		{
			title: 'Dashboard',
			href: ROUTES.DASHBOARD,
			icon: Home,
			description: 'Overview of system status and metrics',
		},
		{
			title: 'Alerts Board',
			href: ROUTES.ALERTS_BOARD,
			icon: CircleAlert,
			description: 'View and manage system alerts',
		},
		{
			title: 'Active Alerts',
			href: ROUTES.ALERTS_ACTIVE,
			icon: AlertTriangle,
			description: 'Currently active alerts',
		},
		{
			title: 'Acknowledged Alerts',
			href: ROUTES.ALERTS_ACKNOWLEDGED,
			icon: Clock,
			description: 'Alerts that have been acknowledged',
		},
		{
			title: 'Resolved Alerts',
			href: ROUTES.ALERTS_RESOLVED,
			icon: CheckCircle,
			description: 'Alerts that have been resolved',
		},
		{
			title: 'Compliance Dashboard',
			href: ROUTES.COMPLIANCE_DASHBOARD,
			icon: BarChart3,
			description: 'Overview of compliance status and metrics',
		},
		{
			title: 'Scheduled Reports',
			href: ROUTES.SCHEDULED_REPORTS,
			icon: Calendar,
			description: 'Manage automated compliance reports',
			children: [
				{
					title: 'All Reports',
					href: ROUTES.SCHEDULED_REPORTS,
					icon: FileText,
				},
				{
					title: 'Create Report',
					href: ROUTES.CREATE_REPORT,
					icon: FileCheck2,
				},
			],
		},
		{
			title: 'Execution History',
			href: ROUTES.EXECUTION_HISTORY,
			icon: History,
			description: 'View report execution history and results',
		},
		{
			title: 'Report Templates',
			href: ROUTES.TEMPLATES,
			icon: FileText,
			description: 'Manage report templates and configurations',
		},
	]

	const toggleSection = (sectionKey: string) => {
		setOpenSections((prev) =>
			prev.includes(sectionKey) ? prev.filter((key) => key !== sectionKey) : [...prev, sectionKey]
		)
	}

	const isActiveRoute = (href: string) => {
		if (href === ROUTES.COMPLIANCE_DASHBOARD) {
			return currentPath === href
		}
		return currentPath.startsWith(href)
	}

	const isParentActive = (item: NavigationItem) => {
		if (isActiveRoute(item.href)) return true
		return item.children?.some((child) => isActiveRoute(child.href)) ?? false
	}

	const renderNavigationItem = (item: NavigationItem, level = 0) => {
		const hasChildren = item.children && item.children.length > 0
		const isActive = isActiveRoute(item.href)
		const isParentOfActive = isParentActive(item)
		const sectionKey = item.title.toLowerCase().replace(/\s+/g, '-')
		const isOpen = openSections.includes(sectionKey)

		if (hasChildren) {
			return (
				<Collapsible key={item.href} open={isOpen} onOpenChange={() => toggleSection(sectionKey)}>
					<CollapsibleTrigger asChild>
						<Button
							variant={isParentOfActive ? 'secondary' : 'ghost'}
							className={cn(
								'w-full justify-start gap-2 h-9',
								level > 0 && 'ml-4 w-[calc(100%-1rem)]',
								isParentOfActive && 'bg-secondary text-secondary-foreground',
								collapsed && 'justify-center px-2'
							)}
							title={collapsed ? item.title : undefined}
						>
							<item.icon className={cn('h-4 w-4', collapsed && 'h-5 w-5')} />
							{!collapsed && (
								<>
									<span className="flex-1 text-left">{item.title}</span>
									{item.badge && (
										<Badge variant="secondary" className="ml-auto">
											{item.badge}
										</Badge>
									)}
								</>
							)}
						</Button>
					</CollapsibleTrigger>
					{!collapsed && (
						<CollapsibleContent className="space-y-1">
							{item.children?.map((child) => renderNavigationItem(child, level + 1))}
						</CollapsibleContent>
					)}
				</Collapsible>
			)
		}

		return (
			<Link key={item.href} to={item.href} className={cn('block', level > 0 && 'ml-4')}>
				<Button
					variant={isActive ? 'secondary' : 'ghost'}
					className={cn(
						'w-full justify-start gap-2 h-9',
						level > 0 && 'w-[calc(100%-1rem)]',
						isActive && 'bg-secondary text-secondary-foreground font-medium',
						collapsed && 'justify-center px-2'
					)}
					title={collapsed ? item.title : undefined}
				>
					<item.icon className={cn('h-4 w-4', collapsed && 'h-5 w-5')} />
					{!collapsed && (
						<>
							<span className="flex-1 text-left">{item.title}</span>
							{item.badge && (
								<Badge variant="secondary" className="ml-auto">
									{item.badge}
								</Badge>
							)}
						</>
					)}
				</Button>
			</Link>
		)
	}

	return (
		<nav className={cn('space-y-1', className)} aria-label="Compliance navigation">
			{!collapsed && (
				<div className="px-3 py-2">
					<h2 className="mb-2 px-2 text-lg font-semibold tracking-tight">Compliance</h2>
					<p className="px-2 text-sm text-muted-foreground">
						Manage compliance reports and monitoring
					</p>
				</div>
			)}
			<div className="space-y-1 px-3">
				{navigationItems.map((item) => renderNavigationItem(item))}
			</div>
		</nav>
	)
}

/**
 * Compliance Navigation Sidebar
 *
 * A dedicated sidebar component for compliance navigation
 */
export function NavigationSidebar({ className }: { className?: string }) {
	return (
		<div className={cn('pb-12 min-h-screen', className)}>
			<div className="space-y-4 py-4">
				<Navigation />
			</div>
		</div>
	)
}
