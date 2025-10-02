import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuditContext } from '@/contexts/audit-provider'
import { AlertCircle, CheckCircle, Clock, FileText } from 'lucide-react'
import React, { useEffect, useState } from 'react'

import type { DashboardStats as DashboardStatsType } from '../types'

interface DashboardStatsProps {
	className?: string
}

interface ScheduledReport {
	id: string
	name: string
	description?: string
	reportType: 'HIPAA_AUDIT_TRAIL' | 'GDPR_PROCESSING_ACTIVITIES' | 'INTEGRITY_VERIFICATION'
	format: 'PDF' | 'CSV' | 'JSON'
	enabled: boolean
	lastRun?: Date
	nextRun: Date
	executionCount: number
	createdAt: Date
	createdBy: string
}

interface ExecutionRecord {
	id: string
	reportId: string
	reportName: string
	reportType: 'HIPAA_AUDIT_TRAIL' | 'GDPR_PROCESSING_ACTIVITIES' | 'INTEGRITY_VERIFICATION'
	status: 'completed' | 'failed' | 'running' | 'pending'
	scheduledTime: Date
	executionTime?: Date
	duration?: number
	recordsProcessed?: number
	outputSize?: number
	outputFormat: 'PDF' | 'CSV' | 'JSON'
	triggeredBy: 'system' | 'user' | 'schedule'
	errorMessage?: string
}

const mockReports: ScheduledReport[] = [
	{
		id: 'report-1',
		name: 'Monthly HIPAA Audit',
		description: 'Comprehensive HIPAA compliance audit report',
		reportType: 'HIPAA_AUDIT_TRAIL',
		format: 'PDF',
		enabled: true,
		lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
		nextRun: new Date(Date.now() + 1000 * 60 * 60 * 24 * 29), // 29 days from now
		executionCount: 12,
		createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365), // 1 year ago
		createdBy: 'admin@example.com',
	},
	{
		id: 'report-2',
		name: 'GDPR Processing Activities',
		description: 'Weekly GDPR processing activities report',
		reportType: 'GDPR_PROCESSING_ACTIVITIES',
		format: 'CSV',
		enabled: true,
		lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 1 week ago
		nextRun: new Date(Date.now() + 1000 * 60 * 60 * 24), // 1 day from now
		executionCount: 52,
		createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365), // 1 year ago
		createdBy: 'compliance@example.com',
	},
	{
		id: 'report-3',
		name: 'Data Integrity Check',
		description: 'Daily data integrity verification report',
		reportType: 'INTEGRITY_VERIFICATION',
		format: 'JSON',
		enabled: false,
		lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
		nextRun: new Date(Date.now() + 1000 * 60 * 60 * 24), // 1 day from now
		executionCount: 90,
		createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180), // 6 months ago
		createdBy: 'security@example.com',
	},
]

const mockExecutions: ExecutionRecord[] = [
	{
		id: 'exec-1',
		reportId: 'report-1',
		reportName: 'Monthly HIPAA Audit',
		reportType: 'HIPAA_AUDIT_TRAIL',
		status: 'completed',
		scheduledTime: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
		executionTime: new Date(Date.now() - 1000 * 60 * 60 * 2 + 1000 * 60 * 2), // started 2 hours ago, ran for 2 minutes
		duration: 120000, // 2 minutes
		recordsProcessed: 1250,
		outputSize: 2048576, // 2MB
		outputFormat: 'PDF',
		triggeredBy: 'schedule',
	},
	{
		id: 'exec-2',
		reportId: 'report-2',
		reportName: 'GDPR Processing Activities',
		reportType: 'GDPR_PROCESSING_ACTIVITIES',
		status: 'completed',
		scheduledTime: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
		executionTime: new Date(Date.now() - 1000 * 60 * 60 * 6 + 1000 * 60 * 3), // started 6 hours ago, ran for 3 minutes
		duration: 180000, // 3 minutes
		recordsProcessed: 890,
		outputSize: 1536000, // 1.5MB
		outputFormat: 'CSV',
		triggeredBy: 'user',
	},
	{
		id: 'exec-3',
		reportId: 'report-3',
		reportName: 'Data Integrity Check',
		reportType: 'INTEGRITY_VERIFICATION',
		status: 'failed',
		scheduledTime: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
		executionTime: new Date(Date.now() - 1000 * 60 * 60 * 12 + 1000 * 30), // started 12 hours ago, failed after 30 seconds
		duration: 30000, // 30 seconds
		outputFormat: 'JSON',
		triggeredBy: 'schedule',
		errorMessage: 'Database connection timeout',
	},
	{
		id: 'exec-4',
		reportId: 'report-1',
		reportName: 'Monthly HIPAA Audit',
		reportType: 'HIPAA_AUDIT_TRAIL',
		status: 'running',
		scheduledTime: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
		executionTime: new Date(Date.now() - 1000 * 60 * 5), // started 5 minutes ago
		outputFormat: 'PDF',
		triggeredBy: 'user',
	},
]

export function DashboardStats({ className }: DashboardStatsProps) {
	const { client, isConnected } = useAuditContext()
	const [stats, setStats] = useState<DashboardStatsType | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const fetchStats = async () => {
		if (!client || !isConnected) {
			setError('Audit client not available')
			setLoading(false)
			return
		}

		try {
			setLoading(true)
			setError(null)

			// Fetch scheduled reports to calculate stats
			/**const reportsResponse = await client.scheduledReports.list({
				page: 1,
				pageSize: 100, // Get all reports for stats calculation
			})

			// Fetch recent executions to calculate success rate
			const executionsResponse = await client.scheduledReports.getExecutions({
				page: 1,
				pageSize: 50, // Get recent executions for success rate
			})

			const reports = reportsResponse.data || []
			const executions = executionsResponse.data || []*/

			const reports = mockReports
			const executions = mockExecutions

			// Calculate stats
			const totalReports = reports.length
			const activeReports = reports.filter((report) => report.enabled).length

			// Calculate success rate from recent executions
			const completedExecutions = executions.filter(
				(exec) => exec.status === 'completed' || exec.status === 'failed'
			)
			const successfulExecutions = executions.filter((exec) => exec.status === 'completed')
			const successRate =
				completedExecutions.length > 0
					? (successfulExecutions.length / completedExecutions.length) * 100
					: 0

			const failureCount = executions.filter((exec) => exec.status === 'failed').length

			setStats({
				totalReports,
				activeReports,
				successRate: Math.round(successRate * 100) / 100, // Round to 2 decimal places
				failureCount,
				lastUpdated: new Date().toISOString(),
			})
		} catch (err) {
			console.error('Failed to fetch dashboard stats:', err)
			setError(err instanceof Error ? err.message : 'Failed to fetch stats')
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		fetchStats()

		// Set up polling for real-time updates every 30 seconds
		const interval = setInterval(fetchStats, 30000)

		return () => clearInterval(interval)
	}, [client, isConnected])

	if (loading) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle>Compliance Statistics</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={i} className="space-y-2">
								<Skeleton className="h-4 w-20" />
								<Skeleton className="h-8 w-16" />
								<Skeleton className="h-3 w-24" />
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		)
	}

	if (error) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<AlertCircle className="h-5 w-5 text-destructive" />
						Compliance Statistics
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<AlertCircle className="h-4 w-4" />
						<span>Failed to load statistics: {error}</span>
					</div>
					<button onClick={fetchStats} className="mt-2 text-sm text-primary hover:underline">
						Retry
					</button>
				</CardContent>
			</Card>
		)
	}

	if (!stats) {
		return null
	}

	const statItems = [
		{
			title: 'Total Reports',
			value: stats.totalReports,
			icon: FileText,
			description: 'Scheduled reports',
			color: 'text-blue-600',
		},
		{
			title: 'Active Reports',
			value: stats.activeReports,
			icon: CheckCircle,
			description: 'Currently enabled',
			color: 'text-green-600',
		},
		{
			title: 'Success Rate',
			value: `${stats.successRate}%`,
			icon: CheckCircle,
			description: 'Recent executions',
			color:
				stats.successRate >= 90
					? 'text-green-600'
					: stats.successRate >= 70
						? 'text-yellow-600'
						: 'text-red-600',
		},
		{
			title: 'Recent Failures',
			value: stats.failureCount,
			icon: AlertCircle,
			description: 'Failed executions',
			color: stats.failureCount === 0 ? 'text-green-600' : 'text-red-600',
		},
	]

	return (
		<Card className={className}>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-base font-medium">Compliance Statistics</CardTitle>
				<Badge variant="outline" className="text-xs">
					<Clock className="mr-1 h-3 w-3" />
					Live
				</Badge>
			</CardHeader>
			<CardContent>
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					{statItems.map((item) => (
						<div key={item.title} className="space-y-2">
							<div className="flex items-center gap-2">
								<item.icon className={`h-4 w-4 ${item.color}`} />
								<span className="text-sm font-medium text-muted-foreground">{item.title}</span>
							</div>
							<div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
							<p className="text-xs text-muted-foreground">{item.description}</p>
						</div>
					))}
				</div>
				<div className="mt-4 text-xs text-muted-foreground">
					Last updated: {new Date(stats.lastUpdated).toLocaleTimeString()}
				</div>
			</CardContent>
		</Card>
	)
}
