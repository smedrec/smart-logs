import { Card } from '@/components/ui/card'
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb'
import React from 'react'

import { COMPLIANCE_SHORTCUTS, useKeyboardNavigation } from '../hooks/use-keyboard-navigation'
import { KeyboardShortcutsDialog } from '../navigation/keyboard-shortcuts-dialog'
import { SkipLinks, useSkipLinkTarget } from '../navigation/skip-links'
import { DashboardStats } from './dashboard-stats'
import { RecentExecutions } from './recent-executions'
import { SystemHealth } from './system-health'
import { UpcomingReports } from './upcoming-reports'

interface ComplianceDashboardProps {
	className?: string
}

export function ComplianceDashboard({ className }: ComplianceDashboardProps) {
	const breadcrumbItems = [
		{ label: 'Compliance', href: '/compliance' },
		{ label: 'Dashboard', href: '/compliance/dashboard' },
	]

	// Keyboard shortcuts for dashboard
	const shortcuts = [
		{
			...COMPLIANCE_SHORTCUTS.REFRESH,
			action: () => {
				// Refresh dashboard data
				window.location.reload()
			},
		},
		{
			...COMPLIANCE_SHORTCUTS.HELP,
			action: () => {
				// Help dialog will be triggered by the KeyboardShortcutsDialog component
			},
		},
	]

	const { ref } = useKeyboardNavigation({
		shortcuts,
		scope: 'local',
	})

	const mainContentProps = useSkipLinkTarget('main-content')

	return (
		<div className={`space-y-6 ${className || ''}`} ref={ref}>
			{/* Skip Links for Accessibility */}
			<SkipLinks />

			{/* Navigation and Breadcrumbs */}
			<div className="flex flex-col space-y-4">
				<div className="flex items-center justify-between">
					<PageBreadcrumb items={breadcrumbItems} />
					<KeyboardShortcutsDialog shortcuts={shortcuts} />
				</div>
				<div className="flex flex-col space-y-2" {...mainContentProps}>
					<h1 className="text-3xl font-bold tracking-tight">Compliance Dashboard</h1>
					<p className="text-muted-foreground">
						Monitor compliance reports, executions, and system health
					</p>
				</div>
			</div>

			{/* Dashboard Grid Layout */}
			<div className="grid gap-6">
				{/* Top Row - Stats and System Health */}
				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					<div className="lg:col-span-2">
						<DashboardStats />
					</div>
					<div>
						<SystemHealth />
					</div>
				</div>

				{/* Middle Row - Recent Executions and Upcoming Reports */}
				<div className="grid gap-6 md:grid-cols-2">
					<RecentExecutions />
					<UpcomingReports />
				</div>
			</div>
		</div>
	)
}
