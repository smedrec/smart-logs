import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useComplianceAudit } from '@/contexts/compliance-audit-provider'
import { AlertCircle, CheckCircle, Clock, ExternalLink, RefreshCw, XCircle } from 'lucide-react'
import React, { useEffect, useState } from 'react'

import type { ReportExecution } from '@smedrec/audit-client'
import type { ExecutionStatus } from '../types'

interface RecentExecutionsProps {
	className?: string
	maxItems?: number
}

export function RecentExecutions({ className, maxItems = 5 }: RecentExecutionsProps) {
	const { listScheduledReports, getExecutionHistory, connectionStatus } = useComplianceAudit()
	const [executions, setExecutions] = useState<ReportExecution[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const fetchRecentExecutions = async () => {
		if (!connectionStatus.isConnected) {
			setError('Audit service not connected')
			setLoading(false)
			return
		}

		try {
			setLoading(true)
			setError(null)

			// Get all scheduled reports first, then get their execution history
			const reportsResponse = await listScheduledReports({
				limit: 10,
				offset: 0,
			})

			// Get execution history for each report and flatten
			const allExecutions: ReportExecution[] = []
			for (const report of reportsResponse.data || []) {
				try {
					const executionResponse = await getExecutionHistory(report.id, {
						limit: 5,
						offset: 0,
						sortBy: 'scheduled_time',
						sortOrder: 'desc',
					})
					allExecutions.push(...(executionResponse.data || []))
				} catch (err) {
					// Skip reports that fail to fetch execution history
					console.warn(`Failed to fetch execution history for report ${report.id}:`, err)
				}
			}

			// Sort all executions by scheduled time and take the most recent
			const sortedExecutions = allExecutions
				.sort((a, b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime())
				.slice(0, maxItems)

			setExecutions(sortedExecutions)
		} catch (err) {
			console.error('Failed to fetch recent executions:', err)
			setError(err instanceof Error ? err.message : 'Failed to fetch executions')
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		fetchRecentExecutions()

		// Set up polling for real-time updates every 15 seconds
		const interval = setInterval(fetchRecentExecutions, 15000)

		return () => clearInterval(interval)
	}, [connectionStatus.isConnected, maxItems])

	const getStatusIcon = (status: ExecutionStatus) => {
		switch (status) {
			case 'completed':
				return <CheckCircle className="h-4 w-4 text-green-600" />
			case 'failed':
				return <XCircle className="h-4 w-4 text-red-600" />
			case 'running':
				return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
			case 'pending':
				return <Clock className="h-4 w-4 text-yellow-600" />
			case 'cancelled':
				return <XCircle className="h-4 w-4 text-gray-600" />
			case 'timeout':
				return <AlertCircle className="h-4 w-4 text-orange-600" />
			default:
				return <Clock className="h-4 w-4 text-gray-600" />
		}
	}

	const getStatusBadge = (status: ExecutionStatus) => {
		const variants = {
			completed: 'default' as const,
			failed: 'destructive' as const,
			running: 'secondary' as const,
			pending: 'outline' as const,
			cancelled: 'outline' as const,
			timeout: 'destructive' as const,
		}

		return (
			<Badge variant={variants[status] || 'outline'} className="text-xs">
				{status.charAt(0).toUpperCase() + status.slice(1)}
			</Badge>
		)
	}

	const handleViewDetails = (execution: ReportExecution) => {
		// Navigate to execution details page
		// This would typically use router navigation
		console.log('Navigate to execution details:', execution.id)
	}

	if (loading) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle>Recent Executions</CardTitle>
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
								<Skeleton className="h-6 w-16" />
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
						Recent Executions
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<AlertCircle className="h-4 w-4" />
						<span>Failed to load executions: {error}</span>
					</div>
					<Button variant="outline" size="sm" onClick={fetchRecentExecutions} className="mt-2">
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
				<CardTitle className="text-base font-medium">Recent Executions</CardTitle>
				<Button variant="ghost" size="sm" onClick={fetchRecentExecutions} className="h-8 w-8 p-0">
					<RefreshCw className="h-4 w-4" />
				</Button>
			</CardHeader>
			<CardContent>
				{executions.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<Clock className="h-8 w-8 text-muted-foreground mb-2" />
						<p className="text-sm text-muted-foreground">No recent executions</p>
						<p className="text-xs text-muted-foreground mt-1">
							Executions will appear here once reports start running
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{executions.map((execution) => (
							<div
								key={execution.id}
								className="flex items-center justify-between space-x-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
								onClick={() => handleViewDetails(execution)}
							>
								<div className="flex items-center space-x-3 min-w-0 flex-1">
									{getStatusIcon(execution.status as ExecutionStatus)}
									<div className="min-w-0 flex-1">
										<p className="text-sm font-medium truncate">
											{`Report ${execution.scheduledReportId}`}
										</p>
										<p className="text-xs text-muted-foreground">
											{new Date(execution.scheduledTime).toLocaleString()}
										</p>
									</div>
								</div>
								<div className="flex items-center space-x-2">
									{getStatusBadge(execution.status as ExecutionStatus)}
									<ExternalLink className="h-4 w-4 text-muted-foreground" />
								</div>
							</div>
						))}
					</div>
				)}

				{executions.length > 0 && (
					<div className="mt-4 pt-4 border-t">
						<Button
							variant="outline"
							size="sm"
							className="w-full"
							onClick={() => {
								// Navigate to full execution history
								console.log('Navigate to execution history')
							}}
						>
							View All Executions
							<ExternalLink className="ml-2 h-4 w-4" />
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
