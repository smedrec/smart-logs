import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { useAuditContext } from '@/contexts/audit-provider'
import {
	AlertCircle,
	CheckCircle,
	Clock,
	Download,
	Pause,
	Play,
	Square,
	Timer,
	XCircle,
} from 'lucide-react'
import React, { useEffect, useState } from 'react'

import type { ExecutionStatus, ReportExecution } from '../types/ui-types'

interface ExecutionProgressTrackerProps {
	executionId: string
	onExecutionComplete?: (execution: ReportExecution) => void
	onExecutionCancelled?: (executionId: string) => void
	className?: string
}

interface ExecutionProgress {
	percentage: number
	currentStep: string
	estimatedTimeRemaining?: number
	recordsProcessed?: number
	totalRecords?: number
	throughputPerSecond?: number
}

const STATUS_CONFIG: Record<
	ExecutionStatus,
	{
		icon: React.ComponentType<{ className?: string }>
		color: string
		bgColor: string
		label: string
	}
> = {
	pending: {
		icon: Clock,
		color: 'text-yellow-600',
		bgColor: 'bg-yellow-50 border-yellow-200',
		label: 'Pending',
	},
	running: {
		icon: Play,
		color: 'text-blue-600',
		bgColor: 'bg-blue-50 border-blue-200',
		label: 'Running',
	},
	completed: {
		icon: CheckCircle,
		color: 'text-green-600',
		bgColor: 'bg-green-50 border-green-200',
		label: 'Completed',
	},
	failed: {
		icon: XCircle,
		color: 'text-red-600',
		bgColor: 'bg-red-50 border-red-200',
		label: 'Failed',
	},
	cancelled: {
		icon: Square,
		color: 'text-gray-600',
		bgColor: 'bg-gray-50 border-gray-200',
		label: 'Cancelled',
	},
	timeout: {
		icon: Timer,
		color: 'text-orange-600',
		bgColor: 'bg-orange-50 border-orange-200',
		label: 'Timeout',
	},
}

export function ExecutionProgressTracker({
	executionId,
	onExecutionComplete,
	onExecutionCancelled,
	className,
}: ExecutionProgressTrackerProps) {
	const { client, isConnected } = useAuditContext()
	const [execution, setExecution] = useState<ReportExecution | null>(null)
	const [progress, setProgress] = useState<ExecutionProgress>({
		percentage: 0,
		currentStep: 'Initializing...',
	})
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [isCancelling, setIsCancelling] = useState(false)

	// Polling interval for execution status updates
	useEffect(() => {
		if (!client || !executionId) return

		const pollExecution = async () => {
			try {
				// In a real implementation, you would fetch execution details
				// For now, we'll simulate the execution progress
				const mockExecution: ReportExecution = {
					id: executionId,
					scheduledReportId: 'report-123',
					status: 'running' as ExecutionStatus,
					trigger: 'manual',
					scheduledTime: new Date().toISOString(),
					executionTime: new Date().toISOString(),
					deliveryAttempts: [],
				}

				setExecution(mockExecution)
				setIsLoading(false)

				// Simulate progress updates
				if (mockExecution.status === 'running') {
					updateProgress(mockExecution)
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to fetch execution status')
				setIsLoading(false)
			}
		}

		// Initial fetch
		pollExecution()

		// Set up polling interval
		const interval = setInterval(pollExecution, 2000) // Poll every 2 seconds

		return () => clearInterval(interval)
	}, [client, executionId])

	// Simulate progress updates for running executions
	const updateProgress = (currentExecution: ReportExecution) => {
		if (currentExecution.status !== 'running') return

		// Simulate progress based on time elapsed
		const startTime = new Date(currentExecution.executionTime || currentExecution.scheduledTime)
		const elapsed = Date.now() - startTime.getTime()
		const estimatedTotal = 60000 // 1 minute estimated total time

		let percentage = Math.min((elapsed / estimatedTotal) * 100, 95) // Cap at 95% until completion
		let currentStep = 'Initializing...'
		let recordsProcessed = 0
		let totalRecords = 1000
		let throughputPerSecond = 0

		if (percentage > 10) {
			currentStep = 'Collecting audit events...'
			recordsProcessed = Math.floor((percentage / 100) * totalRecords)
			throughputPerSecond = Math.floor(recordsProcessed / (elapsed / 1000))
		}
		if (percentage > 40) {
			currentStep = 'Processing compliance rules...'
		}
		if (percentage > 70) {
			currentStep = 'Generating report...'
		}
		if (percentage > 90) {
			currentStep = 'Finalizing and preparing delivery...'
		}

		const estimatedTimeRemaining = Math.max(0, estimatedTotal - elapsed)

		setProgress({
			percentage,
			currentStep,
			estimatedTimeRemaining,
			recordsProcessed,
			totalRecords,
			throughputPerSecond,
		})

		// Simulate completion after estimated time
		if (elapsed > estimatedTotal) {
			const completedExecution: ReportExecution = {
				...currentExecution,
				status: 'completed',
				duration: elapsed,
				recordsProcessed: totalRecords,
			}
			setExecution(completedExecution)
			setProgress({
				percentage: 100,
				currentStep: 'Completed successfully',
				recordsProcessed: totalRecords,
				totalRecords,
			})
			onExecutionComplete?.(completedExecution)
		}
	}

	const handleCancelExecution = async () => {
		if (!client || !execution || isCancelling) return

		setIsCancelling(true)
		try {
			// In a real implementation, you would call the cancel API
			// await client.scheduledReports.cancelExecution(executionId)

			// Simulate cancellation
			const cancelledExecution: ReportExecution = {
				...execution,
				status: 'cancelled',
			}
			setExecution(cancelledExecution)
			onExecutionCancelled?.(executionId)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to cancel execution')
		} finally {
			setIsCancelling(false)
		}
	}

	const formatDuration = (milliseconds: number) => {
		const seconds = Math.floor(milliseconds / 1000)
		const minutes = Math.floor(seconds / 60)
		const hours = Math.floor(minutes / 60)

		if (hours > 0) {
			return `${hours}h ${minutes % 60}m ${seconds % 60}s`
		}
		if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s`
		}
		return `${seconds}s`
	}

	const formatTimeRemaining = (milliseconds: number) => {
		const seconds = Math.ceil(milliseconds / 1000)
		const minutes = Math.ceil(seconds / 60)

		if (minutes > 1) {
			return `~${minutes} minutes remaining`
		}
		return `~${seconds} seconds remaining`
	}

	if (isLoading) {
		return (
			<Card className={className}>
				<CardContent className="p-6">
					<div className="flex items-center justify-center">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
						<span className="ml-3 text-sm text-muted-foreground">Loading execution status...</span>
					</div>
				</CardContent>
			</Card>
		)
	}

	if (!execution) {
		return (
			<Card className={className}>
				<CardContent className="p-6">
					<div className="flex items-center justify-center text-muted-foreground">
						<AlertCircle className="h-5 w-5 mr-2" />
						Execution not found
					</div>
				</CardContent>
			</Card>
		)
	}

	const statusConfig = STATUS_CONFIG[execution.status]
	const StatusIcon = statusConfig.icon
	const isActive = execution.status === 'running'
	const canCancel = isActive && !isCancelling

	return (
		<Card className={`${className} ${statusConfig.bgColor} border`}>
			<CardHeader className="pb-3">
				<CardTitle className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<StatusIcon className={`h-5 w-5 ${statusConfig.color}`} />
						<span>Execution Progress</span>
						<Badge variant="outline" className={statusConfig.color}>
							{statusConfig.label}
						</Badge>
					</div>
					{canCancel && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleCancelExecution}
							disabled={isCancelling}
							className="text-red-600 hover:text-red-700"
						>
							{isCancelling ? (
								<>
									<div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600 mr-2" />
									Cancelling...
								</>
							) : (
								<>
									<Square className="h-3 w-3 mr-2" />
									Cancel
								</>
							)}
						</Button>
					)}
				</CardTitle>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Progress Bar */}
				{isActive && (
					<div className="space-y-2">
						<div className="flex justify-between text-sm">
							<span className="font-medium">{progress.currentStep}</span>
							<span className="text-muted-foreground">{Math.round(progress.percentage)}%</span>
						</div>
						<Progress value={progress.percentage} className="h-2" />
						{progress.estimatedTimeRemaining && progress.estimatedTimeRemaining > 0 && (
							<p className="text-xs text-muted-foreground">
								{formatTimeRemaining(progress.estimatedTimeRemaining)}
							</p>
						)}
					</div>
				)}

				{/* Execution Details */}
				<div className="grid grid-cols-2 gap-4 text-sm">
					<div>
						<span className="text-muted-foreground">Execution ID:</span>
						<p className="font-mono text-xs break-all">{execution.id}</p>
					</div>
					<div>
						<span className="text-muted-foreground">Trigger:</span>
						<p className="capitalize">{execution.trigger}</p>
					</div>
					{execution.executionTime && (
						<div>
							<span className="text-muted-foreground">Started:</span>
							<p>{new Date(execution.executionTime).toLocaleString()}</p>
						</div>
					)}
					{execution.duration && (
						<div>
							<span className="text-muted-foreground">Duration:</span>
							<p>{formatDuration(execution.duration)}</p>
						</div>
					)}
				</div>

				{/* Processing Statistics */}
				{isActive && progress.recordsProcessed !== undefined && (
					<>
						<Separator />
						<div className="grid grid-cols-3 gap-4 text-sm">
							<div>
								<span className="text-muted-foreground">Records Processed:</span>
								<p className="font-medium">
									{progress.recordsProcessed?.toLocaleString()} /{' '}
									{progress.totalRecords?.toLocaleString()}
								</p>
							</div>
							<div>
								<span className="text-muted-foreground">Throughput:</span>
								<p className="font-medium">{progress.throughputPerSecond}/sec</p>
							</div>
							<div>
								<span className="text-muted-foreground">Progress:</span>
								<p className="font-medium">{Math.round(progress.percentage)}%</p>
							</div>
						</div>
					</>
				)}

				{/* Error Display */}
				{execution.error && (
					<>
						<Separator />
						<div className="p-3 bg-red-50 border border-red-200 rounded-md">
							<div className="flex items-start gap-2">
								<XCircle className="h-4 w-4 text-red-600 mt-0.5" />
								<div className="flex-1">
									<p className="text-sm font-medium text-red-800">Execution Failed</p>
									<p className="text-sm text-red-700 mt-1">{execution.error.message}</p>
									{execution.error.code && (
										<p className="text-xs text-red-600 mt-1 font-mono">
											Error Code: {execution.error.code}
										</p>
									)}
								</div>
							</div>
						</div>
					</>
				)}

				{/* Success Actions */}
				{execution.status === 'completed' && execution.exportResult && (
					<>
						<Separator />
						<div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
							<div className="flex items-center gap-2">
								<CheckCircle className="h-4 w-4 text-green-600" />
								<span className="text-sm font-medium text-green-800">
									Report generated successfully
								</span>
							</div>
							<Button size="sm" variant="outline" className="text-green-700 hover:text-green-800">
								<Download className="h-3 w-3 mr-2" />
								Download
							</Button>
						</div>
					</>
				)}

				{/* General Error Display */}
				{error && (
					<div className="p-3 bg-red-50 border border-red-200 rounded-md">
						<div className="flex items-center gap-2">
							<AlertCircle className="h-4 w-4 text-red-600" />
							<span className="text-sm text-red-800">{error}</span>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
