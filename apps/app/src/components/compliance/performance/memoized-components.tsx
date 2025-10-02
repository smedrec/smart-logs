/**
 * Memoized Components for Performance Optimization
 *
 * Optimized versions of common compliance components with React.memo and useMemo
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
	AlertCircle,
	Calendar,
	CheckCircle,
	Clock,
	FileText,
	Minus,
	Pause,
	Play,
	TrendingDown,
	TrendingUp,
	User,
	XCircle,
} from 'lucide-react'
import React, { memo, useMemo } from 'react'

import type { ExecutionStatus, ReportType } from '../types'

// Memoized Status Badge Component
interface StatusBadgeProps {
	status: ExecutionStatus
	size?: 'sm' | 'default' | 'lg'
	showIcon?: boolean
	className?: string
}

export const MemoizedStatusBadge = memo<StatusBadgeProps>(
	({ status, size = 'default', showIcon = true, className }) => {
		const config = useMemo(() => {
			const configs = {
				completed: {
					icon: CheckCircle,
					variant: 'default' as const,
					color: 'text-green-600',
					bgColor: 'bg-green-50 border-green-200',
				},
				failed: {
					icon: XCircle,
					variant: 'destructive' as const,
					color: 'text-red-600',
					bgColor: 'bg-red-50 border-red-200',
				},
				running: {
					icon: Clock,
					variant: 'secondary' as const,
					color: 'text-blue-600',
					bgColor: 'bg-blue-50 border-blue-200',
				},
				pending: {
					icon: Clock,
					variant: 'outline' as const,
					color: 'text-yellow-600',
					bgColor: 'bg-yellow-50 border-yellow-200',
				},
				cancelled: {
					icon: XCircle,
					variant: 'outline' as const,
					color: 'text-gray-600',
					bgColor: 'bg-gray-50 border-gray-200',
				},
				timeout: {
					icon: AlertCircle,
					variant: 'destructive' as const,
					color: 'text-orange-600',
					bgColor: 'bg-orange-50 border-orange-200',
				},
			}
			return configs[status] || configs.pending
		}, [status])

		const Icon = config.icon
		const sizeClasses = {
			sm: 'text-xs px-2 py-1',
			default: 'text-sm px-2.5 py-1.5',
			lg: 'text-base px-3 py-2',
		}

		return (
			<Badge
				variant={config.variant}
				className={cn(
					'flex items-center gap-1 capitalize',
					sizeClasses[size],
					config.bgColor,
					className
				)}
			>
				{showIcon && <Icon className={cn('h-3 w-3', config.color)} />}
				{status}
			</Badge>
		)
	}
)

MemoizedStatusBadge.displayName = 'MemoizedStatusBadge'

// Memoized Report Type Badge Component
interface ReportTypeBadgeProps {
	reportType: ReportType
	size?: 'sm' | 'default' | 'lg'
	className?: string
}

export const MemoizedReportTypeBadge = memo<ReportTypeBadgeProps>(
	({ reportType, size = 'default', className }) => {
		const config = useMemo(() => {
			const configs = {
				HIPAA_AUDIT_TRAIL: {
					label: 'HIPAA Audit',
					variant: 'default' as const,
					color: 'bg-blue-50 text-blue-700 border-blue-200',
				},
				GDPR_PROCESSING_ACTIVITIES: {
					label: 'GDPR Processing',
					variant: 'secondary' as const,
					color: 'bg-purple-50 text-purple-700 border-purple-200',
				},
				INTEGRITY_VERIFICATION: {
					label: 'Integrity Check',
					variant: 'outline' as const,
					color: 'bg-green-50 text-green-700 border-green-200',
				},
			}
			return configs[reportType] || configs.HIPAA_AUDIT_TRAIL
		}, [reportType])

		const sizeClasses = {
			sm: 'text-xs px-2 py-1',
			default: 'text-sm px-2.5 py-1.5',
			lg: 'text-base px-3 py-2',
		}

		return (
			<Badge variant={config.variant} className={cn(sizeClasses[size], config.color, className)}>
				{config.label}
			</Badge>
		)
	}
)

MemoizedReportTypeBadge.displayName = 'MemoizedReportTypeBadge'

// Memoized Metric Card Component
interface MetricCardProps {
	title: string
	value: string | number
	description?: string
	trend?: 'up' | 'down' | 'neutral'
	trendValue?: string
	icon?: React.ComponentType<{ className?: string }>
	loading?: boolean
	className?: string
}

export const MemoizedMetricCard = memo<MetricCardProps>(
	({ title, value, description, trend, trendValue, icon: Icon, loading = false, className }) => {
		const trendConfig = useMemo(() => {
			const configs = {
				up: { icon: TrendingUp, color: 'text-green-600', bgColor: 'bg-green-50' },
				down: { icon: TrendingDown, color: 'text-red-600', bgColor: 'bg-red-50' },
				neutral: { icon: Minus, color: 'text-gray-600', bgColor: 'bg-gray-50' },
			}
			return trend ? configs[trend] : null
		}, [trend])

		const formattedValue = useMemo(() => {
			if (typeof value === 'number') {
				return value.toLocaleString()
			}
			return value
		}, [value])

		if (loading) {
			return (
				<Card className={className}>
					<CardContent className="p-6">
						<div className="animate-pulse">
							<div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
							<div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
							<div className="h-3 bg-gray-200 rounded w-full"></div>
						</div>
					</CardContent>
				</Card>
			)
		}

		return (
			<Card className={className}>
				<CardContent className="p-6">
					<div className="flex items-center justify-between">
						<div className="flex-1">
							<p className="text-sm font-medium text-muted-foreground">{title}</p>
							<p className="text-2xl font-bold">{formattedValue}</p>
							{description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
						</div>

						<div className="flex items-center gap-2">
							{Icon && (
								<div className="p-2 bg-muted rounded-lg">
									<Icon className="h-4 w-4" />
								</div>
							)}

							{trendConfig && trendValue && (
								<div
									className={cn(
										'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
										trendConfig.bgColor
									)}
								>
									<trendConfig.icon className={cn('h-3 w-3', trendConfig.color)} />
									<span className={trendConfig.color}>{trendValue}</span>
								</div>
							)}
						</div>
					</div>
				</CardContent>
			</Card>
		)
	}
)

MemoizedMetricCard.displayName = 'MemoizedMetricCard'

// Memoized Progress Card Component
interface ProgressCardProps {
	title: string
	progress: number
	total?: number
	current?: number
	status?: 'active' | 'completed' | 'error'
	description?: string
	className?: string
}

export const MemoizedProgressCard = memo<ProgressCardProps>(
	({ title, progress, total, current, status = 'active', description, className }) => {
		const statusConfig = useMemo(() => {
			const configs = {
				active: { color: 'bg-blue-500', icon: Play },
				completed: { color: 'bg-green-500', icon: CheckCircle },
				error: { color: 'bg-red-500', icon: XCircle },
			}
			return configs[status]
		}, [status])

		const progressText = useMemo(() => {
			if (total && current !== undefined) {
				return `${current.toLocaleString()} / ${total.toLocaleString()}`
			}
			return `${Math.round(progress)}%`
		}, [progress, total, current])

		return (
			<Card className={className}>
				<CardContent className="p-6">
					<div className="flex items-center justify-between mb-4">
						<div>
							<p className="text-sm font-medium">{title}</p>
							{description && <p className="text-xs text-muted-foreground">{description}</p>}
						</div>
						<div className="flex items-center gap-2">
							<statusConfig.icon
								className={cn(
									'h-4 w-4',
									status === 'active'
										? 'text-blue-500'
										: status === 'completed'
											? 'text-green-500'
											: 'text-red-500'
								)}
							/>
							<span className="text-sm font-medium">{progressText}</span>
						</div>
					</div>

					<Progress
						value={progress}
						className="h-2"
						// Custom color based on status
						style={
							{
								'--progress-background': statusConfig.color,
							} as React.CSSProperties
						}
					/>
				</CardContent>
			</Card>
		)
	}
)

MemoizedProgressCard.displayName = 'MemoizedProgressCard'

// Memoized Execution Summary Component
interface ExecutionSummaryProps {
	execution: {
		id: string
		status: ExecutionStatus
		startedAt: string
		completedAt?: string
		duration?: number
		recordsProcessed?: number
		outputSize?: number
		errorMessage?: string
	}
	onViewDetails?: (executionId: string) => void
	className?: string
}

export const MemoizedExecutionSummary = memo<ExecutionSummaryProps>(
	({ execution, onViewDetails, className }) => {
		const formattedDuration = useMemo(() => {
			if (!execution.duration) return 'N/A'

			const seconds = Math.floor(execution.duration / 1000)
			const minutes = Math.floor(seconds / 60)
			const hours = Math.floor(minutes / 60)

			if (hours > 0) return `${hours}h ${minutes % 60}m`
			if (minutes > 0) return `${minutes}m ${seconds % 60}s`
			return `${seconds}s`
		}, [execution.duration])

		const formattedFileSize = useMemo(() => {
			if (!execution.outputSize) return 'N/A'

			const units = ['B', 'KB', 'MB', 'GB']
			let size = execution.outputSize
			let unitIndex = 0

			while (size >= 1024 && unitIndex < units.length - 1) {
				size /= 1024
				unitIndex++
			}

			return `${size.toFixed(1)} ${units[unitIndex]}`
		}, [execution.outputSize])

		const formattedDate = useMemo(() => {
			return new Intl.DateTimeFormat('en-US', {
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
			}).format(new Date(execution.startedAt))
		}, [execution.startedAt])

		return (
			<Card className={cn('hover:shadow-md transition-shadow', className)}>
				<CardContent className="p-4">
					<div className="flex items-center justify-between mb-3">
						<div className="flex items-center gap-3">
							<MemoizedStatusBadge status={execution.status} size="sm" />
							<div>
								<p className="font-medium text-sm">Execution {execution.id}</p>
								<p className="text-xs text-muted-foreground flex items-center gap-1">
									<Calendar className="h-3 w-3" />
									{formattedDate}
								</p>
							</div>
						</div>

						{onViewDetails && (
							<Button variant="outline" size="sm" onClick={() => onViewDetails(execution.id)}>
								View Details
							</Button>
						)}
					</div>

					<div className="grid grid-cols-3 gap-4 text-xs">
						<div>
							<p className="text-muted-foreground">Duration</p>
							<p className="font-medium">{formattedDuration}</p>
						</div>
						<div>
							<p className="text-muted-foreground">Records</p>
							<p className="font-medium">{execution.recordsProcessed?.toLocaleString() || 'N/A'}</p>
						</div>
						<div>
							<p className="text-muted-foreground">Output Size</p>
							<p className="font-medium">{formattedFileSize}</p>
						</div>
					</div>

					{execution.errorMessage && (
						<div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
							{execution.errorMessage}
						</div>
					)}
				</CardContent>
			</Card>
		)
	}
)

MemoizedExecutionSummary.displayName = 'MemoizedExecutionSummary'

// Memoized Report Summary Component
interface ReportSummaryProps {
	report: {
		id: string
		name: string
		reportType: ReportType
		status: 'enabled' | 'disabled'
		nextRun?: string
		lastRun?: string
		lastStatus?: ExecutionStatus
		createdBy: string
	}
	onEdit?: (reportId: string) => void
	onExecute?: (reportId: string) => void
	className?: string
}

export const MemoizedReportSummary = memo<ReportSummaryProps>(
	({ report, onEdit, onExecute, className }) => {
		const nextRunFormatted = useMemo(() => {
			if (!report.nextRun) return 'Not scheduled'

			const date = new Date(report.nextRun)
			const now = new Date()
			const diffMs = date.getTime() - now.getTime()
			const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
			const diffDays = Math.floor(diffHours / 24)

			if (diffDays > 0) return `In ${diffDays} day${diffDays > 1 ? 's' : ''}`
			if (diffHours > 0) return `In ${diffHours} hour${diffHours > 1 ? 's' : ''}`
			return 'Soon'
		}, [report.nextRun])

		const lastRunFormatted = useMemo(() => {
			if (!report.lastRun) return 'Never'

			return new Intl.DateTimeFormat('en-US', {
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
			}).format(new Date(report.lastRun))
		}, [report.lastRun])

		return (
			<Card className={cn('hover:shadow-md transition-shadow', className)}>
				<CardContent className="p-4">
					<div className="flex items-start justify-between mb-3">
						<div className="flex-1">
							<div className="flex items-center gap-2 mb-1">
								<h3 className="font-medium text-sm">{report.name}</h3>
								<Badge
									variant={report.status === 'enabled' ? 'default' : 'secondary'}
									className="text-xs"
								>
									{report.status}
								</Badge>
							</div>
							<MemoizedReportTypeBadge reportType={report.reportType} size="sm" />
						</div>

						<div className="flex gap-1">
							{onExecute && (
								<Button variant="outline" size="sm" onClick={() => onExecute(report.id)}>
									<Play className="h-3 w-3" />
								</Button>
							)}
							{onEdit && (
								<Button variant="outline" size="sm" onClick={() => onEdit(report.id)}>
									Edit
								</Button>
							)}
						</div>
					</div>

					<div className="space-y-2 text-xs">
						<div className="flex justify-between">
							<span className="text-muted-foreground">Next Run:</span>
							<span className="font-medium">{nextRunFormatted}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Last Run:</span>
							<div className="flex items-center gap-1">
								{report.lastStatus && (
									<MemoizedStatusBadge status={report.lastStatus} size="sm" showIcon={false} />
								)}
								<span className="font-medium">{lastRunFormatted}</span>
							</div>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Created By:</span>
							<span className="font-medium flex items-center gap-1">
								<User className="h-3 w-3" />
								{report.createdBy}
							</span>
						</div>
					</div>
				</CardContent>
			</Card>
		)
	}
)

MemoizedReportSummary.displayName = 'MemoizedReportSummary'
