import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow } from 'date-fns'
import {
	ActivityIcon,
	AlertCircleIcon,
	AlertTriangleIcon,
	BarChart3Icon,
	CheckCircleIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	ClockIcon,
	CopyIcon,
	DatabaseIcon,
	DownloadIcon,
	FileTextIcon,
	HardDriveIcon,
	InfoIcon,
	PauseIcon,
	PlayIcon,
	ServerIcon,
	SettingsIcon,
	TimerIcon,
	TrendingUpIcon,
	XCircleIcon,
} from 'lucide-react'
import React, { useState } from 'react'

import type { ExecutionDetailsUI, ExecutionStatus } from '../types'

interface ExecutionDetailsProps {
	execution: ExecutionDetailsUI
	onDownload?: (format: string) => void
	onRetry?: () => void
	onCancel?: () => void
	className?: string
	showActions?: boolean
}

interface LogLevel {
	level: 'info' | 'warn' | 'error' | 'debug'
	timestamp: string
	message: string
	details?: Record<string, any>
}

export function ExecutionDetails({
	execution,
	onDownload,
	onRetry,
	onCancel,
	className,
	showActions = true,
}: ExecutionDetailsProps) {
	const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
		overview: true,
		metrics: true,
		logs: false,
		configuration: false,
		errors: execution.status === 'failed',
	})

	// Status configuration
	const statusConfig = {
		completed: {
			icon: CheckCircleIcon,
			color: 'text-green-600',
			bgColor: 'bg-green-100',
			borderColor: 'border-green-200',
		},
		failed: {
			icon: XCircleIcon,
			color: 'text-red-600',
			bgColor: 'bg-red-100',
			borderColor: 'border-red-200',
		},
		running: {
			icon: PlayIcon,
			color: 'text-blue-600',
			bgColor: 'bg-blue-100',
			borderColor: 'border-blue-200',
		},
		pending: {
			icon: ClockIcon,
			color: 'text-yellow-600',
			bgColor: 'bg-yellow-100',
			borderColor: 'border-yellow-200',
		},
		cancelled: {
			icon: PauseIcon,
			color: 'text-gray-600',
			bgColor: 'bg-gray-100',
			borderColor: 'border-gray-200',
		},
		timeout: {
			icon: AlertCircleIcon,
			color: 'text-orange-600',
			bgColor: 'bg-orange-100',
			borderColor: 'border-orange-200',
		},
	}

	const config = statusConfig[execution.status] || statusConfig.pending
	const StatusIcon = config.icon

	// Parse logs into structured format
	const parsedLogs = React.useMemo(() => {
		if (!execution.logs) return []

		return execution.logs.map((log, index) => {
			// Try to parse structured logs
			const timestampMatch = log.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/)
			const levelMatch = log.match(/\[(INFO|WARN|ERROR|DEBUG)\]/)

			let level: LogLevel['level'] = 'info'
			if (log.toLowerCase().includes('error') || log.toLowerCase().includes('failed')) {
				level = 'error'
			} else if (log.toLowerCase().includes('warn')) {
				level = 'warn'
			} else if (log.toLowerCase().includes('debug')) {
				level = 'debug'
			}

			return {
				id: index,
				level,
				timestamp: timestampMatch ? timestampMatch[1] : format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
				message: log.replace(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\s*-?\s*/, ''),
				raw: log,
			}
		})
	}, [execution.logs])

	// Calculate execution progress for running executions
	const executionProgress = React.useMemo(() => {
		if (execution.status !== 'running') return 100

		// Mock progress calculation based on elapsed time
		const startTime = new Date(execution.startedAt).getTime()
		const now = Date.now()
		const elapsed = now - startTime

		// Assume average execution time of 10 minutes for progress calculation
		const estimatedDuration = 10 * 60 * 1000
		const progress = Math.min((elapsed / estimatedDuration) * 100, 95)

		return progress
	}, [execution.status, execution.startedAt])

	// Format helpers
	const formatDuration = (ms: number) => {
		const seconds = Math.floor(ms / 1000)
		const minutes = Math.floor(seconds / 60)
		const hours = Math.floor(minutes / 60)

		if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
		if (minutes > 0) return `${minutes}m ${seconds % 60}s`
		return `${seconds}s`
	}

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

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text)
	}

	const toggleSection = (section: string) => {
		setExpandedSections((prev) => ({
			...prev,
			[section]: !prev[section],
		}))
	}

	// Log level styling
	const getLogLevelStyle = (level: LogLevel['level']) => {
		switch (level) {
			case 'error':
				return 'text-red-600 bg-red-50 border-red-200'
			case 'warn':
				return 'text-yellow-600 bg-yellow-50 border-yellow-200'
			case 'debug':
				return 'text-gray-600 bg-gray-50 border-gray-200'
			default:
				return 'text-blue-600 bg-blue-50 border-blue-200'
		}
	}

	return (
		<div className={cn('space-y-6', className)}>
			{/* Header */}
			<Card className={config.borderColor}>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className={cn('p-2 rounded-full', config.bgColor)}>
								<StatusIcon className={cn('h-5 w-5', config.color)} />
							</div>
							<div>
								<CardTitle className="flex items-center gap-2">
									Execution {execution.id}
									<Badge
										variant={
											execution.status === 'completed'
												? 'default'
												: execution.status === 'failed'
													? 'destructive'
													: 'secondary'
										}
									>
										{execution.status}
									</Badge>
								</CardTitle>
								<CardDescription>
									{execution.metadata?.reportType && (
										<span className="mr-2">{execution.metadata.reportType}</span>
									)}
									Started {formatDistanceToNow(new Date(execution.startedAt), { addSuffix: true })}
								</CardDescription>
							</div>
						</div>

						{showActions && (
							<div className="flex items-center gap-2">
								{execution.status === 'completed' && (
									<Button onClick={() => onDownload?.('pdf')} variant="outline">
										<DownloadIcon className="h-4 w-4 mr-2" />
										Download
									</Button>
								)}

								{execution.status === 'failed' && onRetry && (
									<Button onClick={onRetry} variant="outline">
										<PlayIcon className="h-4 w-4 mr-2" />
										Retry
									</Button>
								)}

								{execution.status === 'running' && onCancel && (
									<Button onClick={onCancel} variant="outline">
										<PauseIcon className="h-4 w-4 mr-2" />
										Cancel
									</Button>
								)}
							</div>
						)}
					</div>

					{/* Progress bar for running executions */}
					{execution.status === 'running' && (
						<div className="mt-4">
							<div className="flex items-center justify-between text-sm mb-2">
								<span>Execution Progress</span>
								<span>{executionProgress.toFixed(0)}%</span>
							</div>
							<Progress value={executionProgress} className="h-2" />
						</div>
					)}
				</CardHeader>
			</Card>

			{/* Main Content Tabs */}
			<Tabs defaultValue="overview" className="w-full">
				<TabsList className="grid w-full grid-cols-4">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="metrics">Metrics</TabsTrigger>
					<TabsTrigger value="logs">Logs</TabsTrigger>
					<TabsTrigger value="configuration">Configuration</TabsTrigger>
				</TabsList>

				{/* Overview Tab */}
				<TabsContent value="overview" className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{/* Basic Information */}
						<Card>
							<CardHeader>
								<CardTitle className="text-base flex items-center gap-2">
									<InfoIcon className="h-4 w-4" />
									Basic Information
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="grid grid-cols-2 gap-2 text-sm">
									<div>
										<span className="text-muted-foreground">Status:</span>
										<div className="mt-1">
											<Badge
												variant={
													execution.status === 'completed'
														? 'default'
														: execution.status === 'failed'
															? 'destructive'
															: 'secondary'
												}
											>
												{execution.status}
											</Badge>
										</div>
									</div>

									<div>
										<span className="text-muted-foreground">Triggered By:</span>
										<p className="mt-1 font-medium">{execution.triggeredBy || 'Unknown'}</p>
									</div>

									<div>
										<span className="text-muted-foreground">Started At:</span>
										<p className="mt-1 font-medium">
											{format(new Date(execution.startedAt), 'PPp')}
										</p>
									</div>

									<div>
										<span className="text-muted-foreground">Completed At:</span>
										<p className="mt-1 font-medium">
											{execution.completedAt
												? format(new Date(execution.completedAt), 'PPp')
												: execution.status === 'running'
													? 'In Progress'
													: 'N/A'}
										</p>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Timing Information */}
						<Card>
							<CardHeader>
								<CardTitle className="text-base flex items-center gap-2">
									<TimerIcon className="h-4 w-4" />
									Timing
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="grid grid-cols-2 gap-2 text-sm">
									<div>
										<span className="text-muted-foreground">Duration:</span>
										<p className="mt-1 font-medium">
											{execution.duration
												? formatDuration(execution.duration)
												: execution.status === 'running'
													? 'In Progress'
													: 'N/A'}
										</p>
									</div>

									<div>
										<span className="text-muted-foreground">Elapsed:</span>
										<p className="mt-1 font-medium">
											{formatDistanceToNow(new Date(execution.startedAt))}
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Error Information */}
					{execution.error && (
						<Card className="border-destructive">
							<CardHeader>
								<CardTitle className="text-base flex items-center gap-2 text-destructive">
									<AlertTriangleIcon className="h-4 w-4" />
									Error Details
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="bg-destructive/10 p-3 rounded-lg">
									<p className="text-sm text-destructive font-medium">{execution.error}</p>
								</div>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				{/* Metrics Tab */}
				<TabsContent value="metrics" className="space-y-4">
					{execution.metrics ? (
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="text-base flex items-center gap-2">
										<DatabaseIcon className="h-4 w-4" />
										Records Processed
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{execution.metrics.recordsProcessed.toLocaleString()}
									</div>
									<p className="text-xs text-muted-foreground mt-1">
										Total records processed during execution
									</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="text-base flex items-center gap-2">
										<HardDriveIcon className="h-4 w-4" />
										Output Size
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{formatFileSize(execution.metrics.fileSize)}
									</div>
									<p className="text-xs text-muted-foreground mt-1">
										Size of generated report file
									</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="text-base flex items-center gap-2">
										<ActivityIcon className="h-4 w-4" />
										Processing Time
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{formatDuration(execution.metrics.processingTime)}
									</div>
									<p className="text-xs text-muted-foreground mt-1">Time spent processing data</p>
								</CardContent>
							</Card>
						</div>
					) : (
						<Card>
							<CardContent className="flex items-center justify-center py-8">
								<div className="text-center">
									<BarChart3Icon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
									<p className="text-muted-foreground">No metrics available</p>
								</div>
							</CardContent>
						</Card>
					)}

					{/* Performance Metrics */}
					{execution.metrics && (
						<Card>
							<CardHeader>
								<CardTitle className="text-base flex items-center gap-2">
									<TrendingUpIcon className="h-4 w-4" />
									Performance Analysis
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									<div className="flex items-center justify-between">
										<span className="text-sm">Records per Second</span>
										<span className="font-medium">
											{execution.duration
												? Math.round(
														execution.metrics.recordsProcessed / (execution.duration / 1000)
													)
												: 'N/A'}
										</span>
									</div>

									<div className="flex items-center justify-between">
										<span className="text-sm">Processing Rate</span>
										<span className="font-medium">
											{execution.duration
												? `${formatFileSize(execution.metrics.fileSize / (execution.duration / 1000))}/s`
												: 'N/A'}
										</span>
									</div>

									<div className="flex items-center justify-between">
										<span className="text-sm">Efficiency</span>
										<span className="font-medium">
											{execution.duration && execution.metrics.processingTime
												? `${((execution.metrics.processingTime / execution.duration) * 100).toFixed(1)}%`
												: 'N/A'}
										</span>
									</div>
								</div>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				{/* Logs Tab */}
				<TabsContent value="logs" className="space-y-4">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle className="text-base flex items-center gap-2">
									<FileTextIcon className="h-4 w-4" />
									Execution Logs
								</CardTitle>
								<Button
									variant="outline"
									size="sm"
									onClick={() => copyToClipboard(execution.logs?.join('\n') || '')}
								>
									<CopyIcon className="h-4 w-4 mr-2" />
									Copy All
								</Button>
							</div>
						</CardHeader>
						<CardContent>
							{parsedLogs.length > 0 ? (
								<div className="space-y-2 max-h-96 overflow-y-auto">
									{parsedLogs.map((log) => (
										<div
											key={log.id}
											className={cn(
												'p-2 rounded border text-sm font-mono',
												getLogLevelStyle(log.level)
											)}
										>
											<div className="flex items-start gap-2">
												<Badge variant="outline" className="text-xs">
													{log.level.toUpperCase()}
												</Badge>
												<span className="text-xs text-muted-foreground">{log.timestamp}</span>
												<span className="flex-1">{log.message}</span>
											</div>
										</div>
									))}
								</div>
							) : (
								<div className="text-center py-8">
									<FileTextIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
									<p className="text-muted-foreground">No logs available</p>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* Configuration Tab */}
				<TabsContent value="configuration" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-base flex items-center gap-2">
								<SettingsIcon className="h-4 w-4" />
								Execution Configuration
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{/* Report Configuration */}
								<div>
									<h4 className="font-medium mb-2">Report Configuration</h4>
									<div className="grid grid-cols-2 gap-4 text-sm">
										<div>
											<span className="text-muted-foreground">Report ID:</span>
											<p className="font-medium">{execution.reportId}</p>
										</div>

										{execution.outputFormat && (
											<div>
												<span className="text-muted-foreground">Output Format:</span>
												<p className="font-medium">{execution.outputFormat.toUpperCase()}</p>
											</div>
										)}

										{execution.metadata?.reportType && (
											<div>
												<span className="text-muted-foreground">Report Type:</span>
												<p className="font-medium">{execution.metadata.reportType}</p>
											</div>
										)}

										{execution.metadata?.version && (
											<div>
												<span className="text-muted-foreground">Version:</span>
												<p className="font-medium">{execution.metadata.version}</p>
											</div>
										)}
									</div>
								</div>

								<Separator />

								{/* Metadata */}
								{execution.metadata && Object.keys(execution.metadata).length > 0 && (
									<div>
										<h4 className="font-medium mb-2">Metadata</h4>
										<div className="bg-muted p-3 rounded-lg">
											<pre className="text-xs overflow-x-auto">
												{JSON.stringify(execution.metadata, null, 2)}
											</pre>
										</div>
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	)
}
