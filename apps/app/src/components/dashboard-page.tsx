/**
 * Compliance Dashboard Component
 *
 * Main dashboard for compliance features showing overview metrics,
 * recent activity, and quick actions.
 */

import { CompliancePageHeader } from '@/components/compliance/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useDashboardUrlState } from '@/hooks/useComplianceUrlState'
import { Link } from '@tanstack/react-router'
import {
	AlertTriangle,
	BarChart3,
	Calendar,
	CheckCircle,
	Clock,
	FileCheck2,
	Plus,
	TrendingUp,
	XCircle,
} from 'lucide-react'

interface DashboardMetric {
	title: string
	value: string | number
	change?: string
	trend?: 'up' | 'down' | 'neutral'
	icon: React.ComponentType<{ className?: string }>
}

interface RecentActivity {
	id: string
	type: 'execution' | 'creation' | 'error'
	title: string
	description: string
	timestamp: Date
	status: 'success' | 'error' | 'pending'
}

export default function ComplianceDashboard() {
	const { state: dashboardState, setParam } = useDashboardUrlState()

	// Mock data - in real implementation, this would come from API
	const metrics: DashboardMetric[] = [
		{
			title: 'Active Reports',
			value: 12,
			change: '+2 this month',
			trend: 'up',
			icon: FileCheck2,
		},
		{
			title: 'Executions Today',
			value: 8,
			change: '+25% vs yesterday',
			trend: 'up',
			icon: BarChart3,
		},
		{
			title: 'Success Rate',
			value: '98.5%',
			change: '+0.3% this week',
			trend: 'up',
			icon: TrendingUp,
		},
		{
			title: 'Avg Duration',
			value: '2.4m',
			change: '-15s vs last week',
			trend: 'up',
			icon: Clock,
		},
	]

	const recentActivity: RecentActivity[] = [
		{
			id: '1',
			type: 'execution',
			title: 'HIPAA Audit Report',
			description: 'Monthly audit report completed successfully',
			timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
			status: 'success',
		},
		{
			id: '2',
			type: 'creation',
			title: 'GDPR Processing Activities',
			description: 'New scheduled report created',
			timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
			status: 'success',
		},
		{
			id: '3',
			type: 'error',
			title: 'Integrity Verification',
			description: 'Report execution failed - database connection timeout',
			timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
			status: 'error',
		},
	]

	const getActivityIcon = (type: RecentActivity['type'], status: RecentActivity['status']) => {
		if (status === 'error') return XCircle
		if (status === 'success') return CheckCircle
		if (status === 'pending') return Clock

		switch (type) {
			case 'execution':
				return BarChart3
			case 'creation':
				return Plus
			case 'error':
				return AlertTriangle
			default:
				return FileCheck2
		}
	}

	const getActivityIconColor = (status: RecentActivity['status']) => {
		switch (status) {
			case 'success':
				return 'text-green-600'
			case 'error':
				return 'text-red-600'
			case 'pending':
				return 'text-yellow-600'
			default:
				return 'text-gray-600'
		}
	}

	const formatTimestamp = (timestamp: Date) => {
		const now = new Date()
		const diff = now.getTime() - timestamp.getTime()
		const minutes = Math.floor(diff / (1000 * 60))
		const hours = Math.floor(diff / (1000 * 60 * 60))

		if (minutes < 60) {
			return `${minutes}m ago`
		} else if (hours < 24) {
			return `${hours}h ago`
		} else {
			return timestamp.toLocaleDateString()
		}
	}

	return (
		<div className="flex flex-col gap-6 p-6">
			<CompliancePageHeader
				title="Dashboard"
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
			/>

			{/* Metrics Cards */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{metrics.map((metric) => (
					<Card key={metric.title}>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
							<metric.icon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{metric.value}</div>
							{metric.change && (
								<p
									className={`text-xs ${
										metric.trend === 'up'
											? 'text-green-600'
											: metric.trend === 'down'
												? 'text-red-600'
												: 'text-muted-foreground'
									}`}
								>
									{metric.change}
								</p>
							)}
						</CardContent>
					</Card>
				))}
			</div>

			<div className="grid gap-6 md:grid-cols-2">
				{/* Recent Activity */}
				<Card>
					<CardHeader>
						<CardTitle>Recent Activity</CardTitle>
						<CardDescription>Latest report executions and system events</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{recentActivity.map((activity) => {
								const Icon = getActivityIcon(activity.type, activity.status)
								return (
									<div key={activity.id} className="flex items-start gap-3">
										<Icon className={`h-4 w-4 mt-1 ${getActivityIconColor(activity.status)}`} />
										<div className="flex-1 space-y-1">
											<div className="flex items-center gap-2">
												<p className="text-sm font-medium">{activity.title}</p>
												<Badge
													variant={
														activity.status === 'success'
															? 'default'
															: activity.status === 'error'
																? 'destructive'
																: 'secondary'
													}
													className="text-xs"
												>
													{activity.status}
												</Badge>
											</div>
											<p className="text-xs text-muted-foreground">{activity.description}</p>
											<p className="text-xs text-muted-foreground">
												{formatTimestamp(activity.timestamp)}
											</p>
										</div>
									</div>
								)
							})}
						</div>
						<div className="mt-4 pt-4 border-t">
							<Link to="/compliance/execution-history">
								<Button variant="ghost" size="sm" className="w-full">
									View All Activity
								</Button>
							</Link>
						</div>
					</CardContent>
				</Card>

				{/* Quick Actions */}
				<Card>
					<CardHeader>
						<CardTitle>Quick Actions</CardTitle>
						<CardDescription>Common compliance tasks and shortcuts</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							<Link to="/compliance/scheduled-reports/create">
								<Button className="w-full justify-start gap-2">
									<Plus className="h-4 w-4" />
									Create New Report
								</Button>
							</Link>

							<Link to="/compliance/scheduled-reports">
								<Button variant="outline" className="w-full justify-start gap-2">
									<Calendar className="h-4 w-4" />
									Manage Scheduled Reports
								</Button>
							</Link>

							<Link to="/compliance/execution-history">
								<Button variant="outline" className="w-full justify-start gap-2">
									<Clock className="h-4 w-4" />
									View Execution History
								</Button>
							</Link>

							<Link to="/compliance/report-templates">
								<Button variant="outline" className="w-full justify-start gap-2">
									<FileCheck2 className="h-4 w-4" />
									Manage Templates
								</Button>
							</Link>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* System Health Status */}
			<Card>
				<CardHeader>
					<CardTitle>System Health</CardTitle>
					<CardDescription>Current status of compliance monitoring systems</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 md:grid-cols-3">
						<div className="flex items-center gap-3">
							<CheckCircle className="h-5 w-5 text-green-600" />
							<div>
								<p className="text-sm font-medium">Audit Service</p>
								<p className="text-xs text-muted-foreground">Operational</p>
							</div>
						</div>

						<div className="flex items-center gap-3">
							<CheckCircle className="h-5 w-5 text-green-600" />
							<div>
								<p className="text-sm font-medium">Report Engine</p>
								<p className="text-xs text-muted-foreground">Operational</p>
							</div>
						</div>

						<div className="flex items-center gap-3">
							<AlertTriangle className="h-5 w-5 text-yellow-600" />
							<div>
								<p className="text-sm font-medium">Data Pipeline</p>
								<p className="text-xs text-muted-foreground">Degraded Performance</p>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
