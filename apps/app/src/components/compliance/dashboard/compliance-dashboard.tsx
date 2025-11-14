import { CompliancePageHeader } from '@/components/compliance/navigation'
import { performanceMonitor } from '@/lib/performance-monitor'
import { Plus } from 'lucide-react'
import React, { useEffect } from 'react'

import { COMPLIANCE_SHORTCUTS, useKeyboardNavigation } from '../hooks'
import { SkipLinks, useSkipLinkTarget } from '../navigation/skip-links'
import { DashboardStats } from './dashboard-stats'
import { RecentExecutions } from './recent-executions'
import { SystemHealth } from './system-health'
import { UpcomingReports } from './upcoming-reports'

interface ComplianceDashboardProps {
	className?: string
}

export function ComplianceDashboard({ className }: ComplianceDashboardProps) {
	// Measure page load performance
	useEffect(() => {
		performanceMonitor.measurePageLoad('compliance-dashboard')
	}, [])
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
		<div
			className={`flex flex-col gap-6 p-6 ${className || ''}`}
			ref={ref as React.RefObject<HTMLDivElement>}
		>
			{/* Skip Links for Accessibility */}
			<SkipLinks />

			{/* Compliance Page Header */}
			<CompliancePageHeader
				title="Compliance Dashboard"
				description="Monitor compliance reports, executions, and system health"
				actions={[
					{
						label: 'Create Report',
						href: '/compliance/scheduled-reports/create',
						icon: Plus,
					},
					{
						label: 'View All Reports',
						href: '/compliance/scheduled-reports',
						variant: 'outline',
					},
				]}
				shortcuts={shortcuts}
			/>

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
