import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import {
	AlertCircleIcon,
	CalendarIcon,
	CheckCircleIcon,
	ClockIcon,
	DownloadIcon,
	EyeIcon,
	PauseIcon,
	PlayIcon,
	TrendingDownIcon,
	TrendingUpIcon,
	XCircleIcon,
} from 'lucide-react'
import React, { useState } from 'react'

import type { ExecutionStatus, ReportExecution } from '../types'

interface ExecutionTimelineProps {
	executions: ReportExecution[]
	onExecutionClick?: (execution: ReportExecution) => void
	onDownloadClick?: (execution: ReportExecution) => void
	className?: string
	showMetrics?: boolean
	groupByDate?: boolean
}

interface TimelineGroup {
	date: string
	label: string
	executions: ReportExecution[]
}

export function ExecutionTimeline({
	executions,
	onExecutionClick,
	onDownloadClick,
	className,
	showMetrics = true,
	groupByDate = true,
}: ExecutionTimelineProps) {
	const [hoveredExecution, setHoveredExecution] = useState<string | null>(null)

	// Status configuration for icons and colors
	const statusConfig = {
		completed: {
			icon: CheckCircleIcon,
			color: 'text-green-600',
			bgColor: 'bg-green-100',
			borderColor: 'border-green-200',
			dotColor: 'bg-green-500',
		},
		failed: {
			icon: XCircleIcon,
			color: 'text-red-600',
			bgColor: 'bg-red-100',
			borderColor: 'border-red-200',
			dotColor: 'bg-red-500',
		},
		running: {
			icon: PlayIcon,
			color: 'text-blue-600',
			bgColor: 'bg-blue-100',
			borderColor: 'border-blue-200',
			dotColor: 'bg-blue-500',
		},
		pending: {
			icon: ClockIcon,
			color: 'text-yellow-600',
			bgColor: 'bg-yellow-100',
			borderColor: 'border-yellow-200',
			dotColor: 'bg-yellow-500',
		},
		cancelled: {
			icon: PauseIcon,
			color: 'text-gray-600',
			bgColor: 'bg-gray-100',
			borderColor: 'border-gray-200',
			dotColor: 'bg-gray-500',
		},
		timeout: {
			icon: AlertCircleIcon,
			color: 'text-orange-600',
			bgColor: 'bg-orange-100',
			borderColor: 'border-orange-200',
			dotColor: 'bg-orange-500',
		},
	}

	// Group executions by date if enabled
	const groupedExecutions = React.useMemo(() => {
		if (!groupByDate) {
			return [
				{
					date: 'all',
					label: 'All Executions',
					executions: executions.sort(
						(a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
					),
				},
			]
		}

		const groups: Record<string, ReportExecution[]> = {}

		executions.forEach((execution) => {
			const date = new Date(execution.startedAt)
			const dateKey = format(date, 'yyyy-MM-dd')

			if (!groups[dateKey]) {
				groups[dateKey] = []
			}
			groups[dateKey].push(execution)
		})

		return Object.entries(groups)
			.sort(([a], [b]) => b.localeCompare(a))
			.map(([dateKey, executions]) => {
				const date = new Date(dateKey)
				let label: string

				if (isToday(date)) {
					label = 'Today'
				} else if (isYesterday(date)) {
					label = 'Yesterday'
				} else {
					label = format(date, 'EEEE, MMMM d, yyyy')
				}

				return {
					date: dateKey,
					label,
					executions: executions.sort(
						(a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
					),
				}
			})
	}, [executions, groupByDate])

	// Calculate timeline metrics
	const timelineMetrics = React.useMemo(() => {
		const total = executions.length
		const completed = executions.filter((e) => e.status === 'completed').length
		const failed = executions.filter((e) => e.status === 'failed').length
		const running = executions.filter((e) => e.status === 'running').length

		const successRate = total > 0 ? (completed / total) * 100 : 0
		const avgDuration =
			executions.filter((e) => e.duration).reduce((sum, e) => sum + (e.duration || 0), 0) /
				executions.filter((e) => e.duration).length || 0

		return {
			total,
			completed,
			failed,
			running,
			successRate,
			avgDuration,
		}
	}, [executions])

	// Format duration helper
	const formatDuration = (ms: number) => {
		const seconds = Math.floor(ms / 1000)
		const minutes = Math.floor(seconds / 60)
		const hours = Math.floor(minutes / 60)

		if (hours > 0) return `${hours}h ${minutes % 60}m`
		if (minutes > 0) return `${minutes}m ${seconds % 60}s`
		return `${seconds}s`
	}

	// Format file size helper
	const formatFileSize = (bytes: number) => {
		const units = ['B', 'KB', 'MB', 'GB']
		let size = bytes
		let unitIndex = 0

		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024
			unitIndex++
		}

		return `${size.toFixed(1)} ${units[unitIndex]}`
	}

	// Render execution item
	const renderExecutionItem = (execution: ReportExecution, isLast: boolean) => {
		const config = statusConfig[execution.status] || statusConfig.pending
		const Icon = config.icon
		const isHovered = hoveredExecution === execution.id

		return (
			<div key={execution.id} className="relative">
				{/* Timeline line */}
				{!isLast && <div className="absolute left-4 top-8 w-0.5 h-full bg-border" />}

				{/* Timeline dot */}
				<div
					className={cn(
						'absolute left-2 top-2 w-4 h-4 rounded-full border-2 border-background',
						config.dotColor,
						isHovered && 'scale-125 transition-transform'
					)}
				/>

				{/* Execution card */}
				<div className="ml-10 pb-6">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Card
									className={cn(
										'cursor-pointer transition-all duration-200 hover:shadow-md',
										config.borderColor,
										isHovered && 'shadow-lg scale-[1.02]'
									)}
									onMouseEnter={() => setHoveredExecution(execution.id)}
									onMouseLeave={() => setHoveredExecution(null)}
									onClick={() => onExecutionClick?.(execution)}
								>
									<CardContent className="p-4">
										<div className="flex items-start justify-between">
											<div className="flex items-start gap-3">
												<div className={cn('p-2 rounded-full', config.bgColor)}>
													<Icon className={cn('h-4 w-4', config.color)} />
												</div>

												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2 mb-1">
														<h4 className="font-medium text-sm">Execution {execution.id}</h4>
														<Badge
															variant={
																execution.status === 'completed'
																	? 'default'
																	: execution.status === 'failed'
																		? 'destructive'
																		: 'secondary'
															}
															className="text-xs"
														>
															{execution.status}
														</Badge>
													</div>

													<p className="text-xs text-muted-foreground mb-2">
														{format(new Date(execution.startedAt), 'h:mm a')} •
														{formatDistanceToNow(new Date(execution.startedAt), {
															addSuffix: true,
														})}
													</p>

													{/* Metrics */}
													<div className="flex flex-wrap gap-2 text-xs">
														{execution.duration && (
															<Badge variant="outline" className="text-xs">
																<ClockIcon className="h-3 w-3 mr-1" />
																{formatDuration(execution.duration)}
															</Badge>
														)}

														{execution.recordsProcessed && (
															<Badge variant="outline" className="text-xs">
																{execution.recordsProcessed.toLocaleString()} records
															</Badge>
														)}

														{execution.outputSize && (
															<Badge variant="outline" className="text-xs">
																{formatFileSize(execution.outputSize)}
															</Badge>
														)}

														{execution.triggeredBy && (
															<Badge variant="outline" className="text-xs">
																{execution.triggeredBy}
															</Badge>
														)}
													</div>

													{/* Error message */}
													{execution.error && (
														<div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
															{execution.error}
														</div>
													)}
												</div>
											</div>

											{/* Action buttons */}
											<div className="flex items-center gap-1 ml-2">
												<Button
													variant="ghost"
													size="sm"
													className="h-8 w-8 p-0"
													onClick={(e) => {
														e.stopPropagation()
														onExecutionClick?.(execution)
													}}
												>
													<EyeIcon className="h-3 w-3" />
												</Button>

												{execution.status === 'completed' && (
													<Button
														variant="ghost"
														size="sm"
														className="h-8 w-8 p-0"
														onClick={(e) => {
															e.stopPropagation()
															onDownloadClick?.(execution)
														}}
													>
														<DownloadIcon className="h-3 w-3" />
													</Button>
												)}
											</div>
										</div>
									</CardContent>
								</Card>
							</TooltipTrigger>

							<TooltipContent side="right" className="max-w-xs">
								<div className="space-y-1">
									<p className="font-medium">Execution {execution.id}</p>
									<p className="text-xs">Status: {execution.status}</p>
									<p className="text-xs">Started: {format(new Date(execution.startedAt), 'PPp')}</p>
									{execution.completedAt && (
										<p className="text-xs">
											Completed: {format(new Date(execution.completedAt), 'PPp')}
										</p>
									)}
									{execution.metadata?.reportType && (
										<p className="text-xs">Type: {execution.metadata.reportType}</p>
									)}
								</div>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
			</div>
		)
	}

	if (executions.length === 0) {
		return (
			<Card className={className}>
				<CardContent className="flex flex-col items-center justify-center py-12">
					<CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
					<h3 className="text-lg font-medium mb-2">No Executions</h3>
					<p className="text-muted-foreground text-center">
						No report executions found for the selected criteria.
					</p>
				</CardContent>
			</Card>
		)
	}

	return (
		<div className={cn('space-y-6', className)}>
			{/* Timeline Metrics */}
			{showMetrics && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<TrendingUpIcon className="h-4 w-4" />
							Timeline Overview
						</CardTitle>
						<CardDescription>Execution statistics and performance metrics</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							<div className="text-center">
								<p className="text-2xl font-bold">{timelineMetrics.total}</p>
								<p className="text-xs text-muted-foreground">Total Executions</p>
							</div>

							<div className="text-center">
								<p className="text-2xl font-bold text-green-600">{timelineMetrics.completed}</p>
								<p className="text-xs text-muted-foreground">Completed</p>
							</div>

							<div className="text-center">
								<p className="text-2xl font-bold text-red-600">{timelineMetrics.failed}</p>
								<p className="text-xs text-muted-foreground">Failed</p>
							</div>

							<div className="text-center">
								<p className="text-2xl font-bold">{timelineMetrics.successRate.toFixed(1)}%</p>
								<p className="text-xs text-muted-foreground">Success Rate</p>
							</div>
						</div>

						{timelineMetrics.avgDuration > 0 && (
							<div className="mt-4 pt-4 border-t">
								<div className="flex items-center justify-center gap-2">
									<ClockIcon className="h-4 w-4 text-muted-foreground" />
									<span className="text-sm text-muted-foreground">
										Average Duration: {formatDuration(timelineMetrics.avgDuration)}
									</span>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{/* Timeline */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<CalendarIcon className="h-4 w-4" />
						Execution Timeline
					</CardTitle>
					<CardDescription>
						Chronological view of report executions with status and metrics
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-8">
						{groupedExecutions.map((group) => (
							<div key={group.date}>
								{groupByDate && (
									<div className="flex items-center gap-3 mb-4">
										<h3 className="font-medium text-sm">{group.label}</h3>
										<div className="flex-1 h-px bg-border" />
										<Badge variant="outline" className="text-xs">
											{group.executions.length} execution{group.executions.length !== 1 ? 's' : ''}
										</Badge>
									</div>
								)}

								<div className="relative">
									{group.executions.map((execution, index) =>
										renderExecutionItem(execution, index === group.executions.length - 1)
									)}
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
