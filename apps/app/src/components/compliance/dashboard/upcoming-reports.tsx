import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuditContext } from '@/contexts/audit-provider'
import { AlertCircle, Calendar, Clock, ExternalLink, Play, RefreshCw } from 'lucide-react'
import React, { useEffect, useState } from 'react'

import type { ScheduledReport } from '@smedrec/audit-client'

interface UpcomingReport extends ScheduledReport {
	nextExecutionTime?: string
	timeUntilExecution?: string
}

interface UpcomingReportsProps {
	className?: string
	maxItems?: number
}

export function UpcomingReports({ className, maxItems = 5 }: UpcomingReportsProps) {
	const { client, isConnected } = useAuditContext()
	const [reports, setReports] = useState<UpcomingReport[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const calculateNextExecution = (cronExpression: string): Date | null => {
		// This is a simplified calculation - in a real implementation,
		// you'd use a proper cron parser library like 'cron-parser'
		try {
			// For demo purposes, we'll simulate next execution times
			const now = new Date()
			const nextHour = new Date(now.getTime() + 60 * 60 * 1000)
			const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000)
			const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

			// Simple heuristic based on cron expression patterns
			if (cronExpression.includes('0 0 *')) return nextDay // Daily
			if (cronExpression.includes('0 0 * * 0')) return nextWeek // Weekly
			if (cronExpression.includes('0 *')) return nextHour // Hourly

			return nextDay // Default to next day
		} catch {
			return null
		}
	}

	const formatTimeUntil = (targetDate: Date): string => {
		const now = new Date()
		const diff = targetDate.getTime() - now.getTime()

		if (diff <= 0) return 'Overdue'

		const minutes = Math.floor(diff / (1000 * 60))
		const hours = Math.floor(minutes / 60)
		const days = Math.floor(hours / 24)

		if (days > 0) return `${days}d ${hours % 24}h`
		if (hours > 0) return `${hours}h ${minutes % 60}m`
		return `${minutes}m`
	}

	const fetchUpcomingReports = async () => {
		if (!client || !isConnected) {
			setError('Audit client not available')
			setLoading(false)
			return
		}

		try {
			setLoading(true)
			setError(null)

			const response = await client.scheduledReports.list({
				limit: 50, // Get more reports to filter enabled ones
				offset: 0,
				enabled: true, // Only get enabled reports
			})

			const enabledReports = (response.data || [])
				.map((report) => {
					const nextExecution = calculateNextExecution(
						report.schedule?.cronExpression || '0 0 * * *'
					)
					return {
						...report,
						nextExecutionTime: nextExecution?.toISOString(),
						timeUntilExecution: nextExecution ? formatTimeUntil(nextExecution) : 'Unknown',
					}
				})
				.sort((a, b) => {
					// Sort by next execution time (earliest first)
					if (!a.nextExecutionTime) return 1
					if (!b.nextExecutionTime) return -1
					return new Date(a.nextExecutionTime).getTime() - new Date(b.nextExecutionTime).getTime()
				})
				.slice(0, maxItems)

			setReports(enabledReports)
		} catch (err) {
			console.error('Failed to fetch upcoming reports:', err)
			setError(err instanceof Error ? err.message : 'Failed to fetch reports')
		} finally {
			setLoading(false)
		}
	}

	const handleManualExecution = async (report: ScheduledReport) => {
		if (!client) return

		try {
			await client.scheduledReports.execute(report.id)
			// Show success notification
			console.log('Manual execution triggered for report:', report.name)
			// Refresh the data
			fetchUpcomingReports()
		} catch (err) {
			console.error('Failed to trigger manual execution:', err)
			// Show error notification
		}
	}

	useEffect(() => {
		fetchUpcomingReports()

		// Update countdown timers every minute
		const interval = setInterval(() => {
			setReports((prevReports) =>
				prevReports.map((report) => ({
					...report,
					timeUntilExecution: report.nextExecutionTime
						? formatTimeUntil(new Date(report.nextExecutionTime))
						: 'Unknown',
				}))
			)
		}, 60000)

		return () => clearInterval(interval)
	}, [client, isConnected, maxItems])

	const getReportTypeBadge = (reportType: string) => {
		const colors = {
			HIPAA_AUDIT_TRAIL: 'bg-blue-100 text-blue-800',
			GDPR_PROCESSING_ACTIVITIES: 'bg-green-100 text-green-800',
			INTEGRITY_VERIFICATION: 'bg-purple-100 text-purple-800',
		}

		return (
			<Badge variant="outline" className={colors[reportType as keyof typeof colors] || ''}>
				{reportType.replace(/_/g, ' ')}
			</Badge>
		)
	}

	if (loading) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle>Upcoming Reports</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{Array.from({ length: maxItems }).map((_, i) => (
							<div key={i} className="flex items-center justify-between space-x-4">
								<div className="flex items-center space-x-3">
									<Skeleton className="h-4 w-4 rounded-full" />
									<div className="space-y-1">
										<Skeleton className="h-4 w-32" />
										<Skeleton className="h-3 w-24" />
									</div>
								</div>
								<div className="flex items-center space-x-2">
									<Skeleton className="h-6 w-16" />
									<Skeleton className="h-8 w-8" />
								</div>
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
						Upcoming Reports
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<AlertCircle className="h-4 w-4" />
						<span>Failed to load reports: {error}</span>
					</div>
					<Button variant="outline" size="sm" onClick={fetchUpcomingReports} className="mt-2">
						<RefreshCw className="mr-2 h-4 w-4" />
						Retry
					</Button>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card className={className}>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-base font-medium">Upcoming Reports</CardTitle>
				<Button variant="ghost" size="sm" onClick={fetchUpcomingReports} className="h-8 w-8 p-0">
					<RefreshCw className="h-4 w-4" />
				</Button>
			</CardHeader>
			<CardContent>
				{reports.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<Calendar className="h-8 w-8 text-muted-foreground mb-2" />
						<p className="text-sm text-muted-foreground">No upcoming reports</p>
						<p className="text-xs text-muted-foreground mt-1">
							Enable scheduled reports to see upcoming executions
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{reports.map((report) => (
							<div
								key={report.id}
								className="flex items-center justify-between space-x-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
							>
								<div className="flex items-center space-x-3 min-w-0 flex-1">
									<Calendar className="h-4 w-4 text-muted-foreground" />
									<div className="min-w-0 flex-1">
										<p className="text-sm font-medium truncate">{report.name}</p>
										<div className="flex items-center space-x-2 mt-1">
											{getReportTypeBadge(report.reportType)}
											<div className="flex items-center text-xs text-muted-foreground">
												<Clock className="h-3 w-3 mr-1" />
												{report.timeUntilExecution}
											</div>
										</div>
									</div>
								</div>
								<div className="flex items-center space-x-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => handleManualExecution(report)}
										className="h-8 w-8 p-0"
										title="Execute now"
									>
										<Play className="h-4 w-4" />
									</Button>
								</div>
							</div>
						))}
					</div>
				)}

				{reports.length > 0 && (
					<div className="mt-4 pt-4 border-t">
						<Button
							variant="outline"
							size="sm"
							className="w-full"
							onClick={() => {
								// Navigate to scheduled reports page
								console.log('Navigate to scheduled reports')
							}}
						>
							View All Scheduled Reports
							<ExternalLink className="ml-2 h-4 w-4" />
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
