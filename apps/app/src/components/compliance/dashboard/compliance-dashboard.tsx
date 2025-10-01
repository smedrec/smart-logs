import { Card } from '@/components/ui/card'
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb'
import React from 'react'

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

	return (
		<div className={`space-y-6 ${className || ''}`}>
			{/* Navigation and Breadcrumbs */}
			<div className="flex flex-col space-y-4">
				<PageBreadcrumb items={breadcrumbItems} />
				<div className="flex flex-col space-y-2">
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
