/**
 * App Breadcrumbs Component
 *
 * Provides breadcrumb navigation for app pages with automatic
 * route detection and customizable breadcrumb items.
 */

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { ROUTES } from '@/lib/routes'
import { Link, useRouterState } from '@tanstack/react-router'
import { CircleAlert, FileCheck2, Home, Settings2 } from 'lucide-react'
import { useMemo } from 'react'

interface BreadcrumbItem {
	label: string
	href?: string
	icon?: React.ComponentType<{ className?: string }>
}

interface BreadcrumbsProps {
	className?: string
	customItems?: BreadcrumbItem[]
	showHome?: boolean
	showRoot?: boolean
}

export function Breadcrumbs({
	className,
	customItems,
	showHome = true,
	showRoot = true,
}: BreadcrumbsProps) {
	const routerState = useRouterState()
	const currentPath = routerState.location.pathname
	const params = routerState.location.params as Record<string, string>

	const breadcrumbItems = useMemo(() => {
		const items: BreadcrumbItem[] = []

		// Add home breadcrumb
		if (showHome) {
			items.push({
				label: 'Home',
				href: '/dashboard',
				icon: Home,
			})
		}

		// Add alerts root breadcrumb
		if (showRoot && currentPath.startsWith('/alerts')) {
			items.push({
				label: 'Alerts',
				href: ROUTES.ALERTS_BOARD,
				icon: CircleAlert,
			})
		}

		// Add compliance root breadcrumb
		if (showRoot && currentPath.startsWith('/compliance')) {
			items.push({
				label: 'Compliance',
				href: ROUTES.COMPLIANCE_DASHBOARD,
				icon: FileCheck2,
			})
		}

		if (showRoot && currentPath.startsWith('/settings')) {
			items.push({
				label: 'Settings',
				href: ROUTES.SETTINGS,
				icon: Settings2,
			})
		}

		// Generate breadcrumbs based on current route
		if (currentPath === ROUTES.DASHBOARD) {
			items.push({ label: 'Dashboard' })
		} else if (currentPath === ROUTES.COMPLIANCE_DASHBOARD) {
			items.push({
				label: 'Compliance Dashboard',
			})
		} else if (currentPath === ROUTES.SCHEDULED_REPORTS) {
			items.push({
				label: 'Scheduled Reports',
			})
		} else if (currentPath === ROUTES.CREATE_REPORT) {
			items.push({
				label: 'Scheduled Reports',
				href: ROUTES.SCHEDULED_REPORTS,
			})
			items.push({
				label: 'Create Report',
			})
		} else if (currentPath.includes('/scheduled-reports/') && currentPath.includes('/edit')) {
			const reportId = params.reportId
			items.push({
				label: 'Scheduled Reports',
				href: ROUTES.SCHEDULED_REPORTS,
			})
			items.push({
				label: `Report ${reportId}`,
				href: ROUTES.VIEW_REPORT(reportId),
			})
			items.push({
				label: 'Edit',
			})
		} else if (currentPath.includes('/scheduled-reports/') && currentPath.includes('/executions')) {
			const reportId = params.reportId
			items.push({
				label: 'Scheduled Reports',
				href: ROUTES.SCHEDULED_REPORTS,
			})
			items.push({
				label: `Report ${reportId}`,
				href: ROUTES.VIEW_REPORT(reportId),
			})
			items.push({
				label: 'Execution History',
			})
		} else if (currentPath.includes('/scheduled-reports/') && currentPath.includes('/execute')) {
			const reportId = params.reportId
			items.push({
				label: 'Scheduled Reports',
				href: ROUTES.SCHEDULED_REPORTS,
			})
			items.push({
				label: `Report ${reportId}`,
				href: ROUTES.VIEW_REPORT(reportId),
			})
			items.push({
				label: 'Execute',
			})
		} else if (currentPath.includes('/scheduled-reports/') && !currentPath.includes('/')) {
			const reportId = params.reportId
			items.push({
				label: 'Scheduled Reports',
				href: ROUTES.SCHEDULED_REPORTS,
			})
			items.push({
				label: `Report ${reportId}`,
			})
		} else if (currentPath === ROUTES.TEMPLATES) {
			items.push({
				label: 'Report Templates',
			})
		} else if (currentPath === ROUTES.EXECUTION_HISTORY) {
			items.push({
				label: 'Execution History',
			})
		} else if (currentPath === ROUTES.ALERTS_BOARD) {
			items.push({
				label: 'Alerts Board',
			})
		} else if (currentPath === ROUTES.ALERTS_ACTIVE) {
			items.push({
				label: 'Active Alerts',
			})
		} else if (currentPath === ROUTES.ALERTS_ACKNOWLEDGED) {
			items.push({
				label: 'Acknowledged Alerts',
			})
		} else if (currentPath === ROUTES.ALERTS_RESOLVED) {
			items.push({
				label: 'Resolved Alerts',
			})
		} else if (currentPath === ROUTES.SETTINGS_ACCOUNT) {
			items.push({
				label: 'Account',
			})
		} else if (currentPath === ROUTES.SETTINGS_ORGANIZATION) {
			items.push({
				label: 'Current Organization',
			})
		} else if (currentPath === ROUTES.SETTINGS_STAFF) {
			items.push({
				label: 'Staff',
			})
		} else if (currentPath === ROUTES.SETTINGS_SECURITY) {
			items.push({
				label: 'Security',
			})
		} else if (currentPath === ROUTES.SETTINGS_BILLING) {
			items.push({
				label: 'Billing',
			})
		}

		// Add custom items if provided
		if (customItems) {
			items.push(...customItems)
		}

		return items
	}, [currentPath, params, customItems, showHome, showRoot])

	if (breadcrumbItems.length <= 1) {
		return null
	}

	return (
		<Breadcrumb className={className}>
			<BreadcrumbList>
				{breadcrumbItems.map((item, index) => {
					const isLast = index === breadcrumbItems.length - 1

					return (
						<div key={`${item.label}-${index}`} className="flex items-center">
							<BreadcrumbItem>
								{isLast ? (
									<BreadcrumbPage className="flex items-center gap-1">
										{item.icon && <item.icon className="h-4 w-4" />}
										{item.label}
									</BreadcrumbPage>
								) : item.href ? (
									<BreadcrumbLink asChild>
										<Link to={item.href} className="flex items-center gap-1">
											{item.icon && <item.icon className="h-4 w-4" />}
											{item.label}
										</Link>
									</BreadcrumbLink>
								) : (
									<span className="flex items-center gap-1">
										{item.icon && <item.icon className="h-4 w-4" />}
										{item.label}
									</span>
								)}
							</BreadcrumbItem>
							{!isLast && <BreadcrumbSeparator />}
						</div>
					)
				})}
			</BreadcrumbList>
		</Breadcrumb>
	)
}

/**
 * Hook to get current breadcrumb items
 */
export function useBreadcrumbs() {
	const routerState = useRouterState()
	const currentPath = routerState.location.pathname
	const params = routerState.location.params as Record<string, string>

	return useMemo(() => {
		const items: BreadcrumbItem[] = []

		// Generate breadcrumbs based on current route
		if (currentPath === ROUTES.DASHBOARD) {
			items.push({ label: 'Dashboard' })
		} else if (currentPath === ROUTES.COMPLIANCE_DASHBOARD) {
			items.push({ label: 'Compliance Dashboard' })
		} else if (currentPath === ROUTES.SCHEDULED_REPORTS) {
			items.push({ label: 'Scheduled Reports' })
		} else if (currentPath === ROUTES.CREATE_REPORT) {
			items.push(
				{ label: 'Scheduled Reports', href: ROUTES.SCHEDULED_REPORTS },
				{ label: 'Create Report' }
			)
		} else if (currentPath.includes('/scheduled-reports/') && params.reportId) {
			const reportId = params.reportId
			items.push(
				{ label: 'Scheduled Reports', href: ROUTES.SCHEDULED_REPORTS },
				{ label: `Report ${reportId}`, href: ROUTES.VIEW_REPORT(reportId) }
			)

			if (currentPath.includes('/edit')) {
				items.push({ label: 'Edit' })
			} else if (currentPath.includes('/executions')) {
				items.push({ label: 'Execution History' })
			} else if (currentPath.includes('/execute')) {
				items.push({ label: 'Execute' })
			}
		} else if (currentPath === ROUTES.ALERTS_BOARD) {
			items.push({ label: 'Alerts Board' })
		} else if (currentPath === ROUTES.ALERTS_ACTIVE) {
			items.push({ label: 'Active Alerts' })
		} else if (currentPath === ROUTES.ALERTS_ACKNOWLEDGED) {
			items.push({ label: 'Acknowledged Alerts' })
		} else if (currentPath === ROUTES.ALERTS_RESOLVED) {
			items.push({ label: 'Resolved Alerts' })
		}

		return items
	}, [currentPath, params])
}
