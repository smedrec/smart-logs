/**
 * Compliance Breadcrumbs Component
 *
 * Provides breadcrumb navigation for compliance pages with automatic
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
import { COMPLIANCE_ROUTES } from '@/lib/compliance-routes'
import { Link, useRouterState } from '@tanstack/react-router'
import { FileCheck2, Home } from 'lucide-react'
import { useMemo } from 'react'

interface BreadcrumbItem {
	label: string
	href?: string
	icon?: React.ComponentType<{ className?: string }>
}

interface ComplianceBreadcrumbsProps {
	className?: string
	customItems?: BreadcrumbItem[]
	showHome?: boolean
	showComplianceRoot?: boolean
}

export function ComplianceBreadcrumbs({
	className,
	customItems,
	showHome = true,
	showComplianceRoot = true,
}: ComplianceBreadcrumbsProps) {
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

		// Add compliance root breadcrumb
		if (showComplianceRoot && currentPath !== COMPLIANCE_ROUTES.DASHBOARD) {
			items.push({
				label: 'Compliance',
				href: COMPLIANCE_ROUTES.DASHBOARD,
				icon: FileCheck2,
			})
		}

		// Generate breadcrumbs based on current route
		if (currentPath === COMPLIANCE_ROUTES.DASHBOARD) {
			items.push({
				label: 'Dashboard',
			})
		} else if (currentPath === COMPLIANCE_ROUTES.SCHEDULED_REPORTS) {
			items.push({
				label: 'Scheduled Reports',
			})
		} else if (currentPath === COMPLIANCE_ROUTES.CREATE_REPORT) {
			items.push({
				label: 'Scheduled Reports',
				href: COMPLIANCE_ROUTES.SCHEDULED_REPORTS,
			})
			items.push({
				label: 'Create Report',
			})
		} else if (currentPath.includes('/scheduled-reports/') && currentPath.includes('/edit')) {
			const reportId = params.reportId
			items.push({
				label: 'Scheduled Reports',
				href: COMPLIANCE_ROUTES.SCHEDULED_REPORTS,
			})
			items.push({
				label: `Report ${reportId}`,
				href: COMPLIANCE_ROUTES.VIEW_REPORT(reportId),
			})
			items.push({
				label: 'Edit',
			})
		} else if (currentPath.includes('/scheduled-reports/') && currentPath.includes('/executions')) {
			const reportId = params.reportId
			items.push({
				label: 'Scheduled Reports',
				href: COMPLIANCE_ROUTES.SCHEDULED_REPORTS,
			})
			items.push({
				label: `Report ${reportId}`,
				href: COMPLIANCE_ROUTES.VIEW_REPORT(reportId),
			})
			items.push({
				label: 'Execution History',
			})
		} else if (currentPath.includes('/scheduled-reports/') && currentPath.includes('/execute')) {
			const reportId = params.reportId
			items.push({
				label: 'Scheduled Reports',
				href: COMPLIANCE_ROUTES.SCHEDULED_REPORTS,
			})
			items.push({
				label: `Report ${reportId}`,
				href: COMPLIANCE_ROUTES.VIEW_REPORT(reportId),
			})
			items.push({
				label: 'Execute',
			})
		} else if (currentPath.includes('/scheduled-reports/') && !currentPath.includes('/')) {
			const reportId = params.reportId
			items.push({
				label: 'Scheduled Reports',
				href: COMPLIANCE_ROUTES.SCHEDULED_REPORTS,
			})
			items.push({
				label: `Report ${reportId}`,
			})
		} else if (currentPath === COMPLIANCE_ROUTES.TEMPLATES) {
			items.push({
				label: 'Report Templates',
			})
		} else if (currentPath === COMPLIANCE_ROUTES.EXECUTION_HISTORY) {
			items.push({
				label: 'Execution History',
			})
		}

		// Add custom items if provided
		if (customItems) {
			items.push(...customItems)
		}

		return items
	}, [currentPath, params, customItems, showHome, showComplianceRoot])

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
export function useComplianceBreadcrumbs() {
	const routerState = useRouterState()
	const currentPath = routerState.location.pathname
	const params = routerState.location.params as Record<string, string>

	return useMemo(() => {
		const items: BreadcrumbItem[] = []

		// Generate breadcrumbs based on current route
		if (currentPath === COMPLIANCE_ROUTES.DASHBOARD) {
			items.push({ label: 'Dashboard' })
		} else if (currentPath === COMPLIANCE_ROUTES.SCHEDULED_REPORTS) {
			items.push({ label: 'Scheduled Reports' })
		} else if (currentPath === COMPLIANCE_ROUTES.CREATE_REPORT) {
			items.push(
				{ label: 'Scheduled Reports', href: COMPLIANCE_ROUTES.SCHEDULED_REPORTS },
				{ label: 'Create Report' }
			)
		} else if (currentPath.includes('/scheduled-reports/') && params.reportId) {
			const reportId = params.reportId
			items.push(
				{ label: 'Scheduled Reports', href: COMPLIANCE_ROUTES.SCHEDULED_REPORTS },
				{ label: `Report ${reportId}`, href: COMPLIANCE_ROUTES.VIEW_REPORT(reportId) }
			)

			if (currentPath.includes('/edit')) {
				items.push({ label: 'Edit' })
			} else if (currentPath.includes('/executions')) {
				items.push({ label: 'Execution History' })
			} else if (currentPath.includes('/execute')) {
				items.push({ label: 'Execute' })
			}
		}

		return items
	}, [currentPath, params])
}
