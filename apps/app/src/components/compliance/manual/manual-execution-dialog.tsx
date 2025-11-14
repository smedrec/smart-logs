import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useComplianceAudit } from '@/contexts/compliance-audit-provider'
import { AlertCircle, Calendar, Clock, Play, Settings, X } from 'lucide-react'
import React, { useState } from 'react'

import type { ScheduledReportUI } from '../types/ui-types'

interface ManualExecutionDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	report: ScheduledReportUI | null
	onExecutionStart?: (executionId: string) => void
}

interface ExecutionParameters {
	priority: 'low' | 'normal' | 'high'
	timeout: number
	retryAttempts: number
	notifyOnCompletion: boolean
	customCriteria?: {
		startDate?: string
		endDate?: string
		additionalFilters?: string
	}
	notes?: string
}

export function ManualExecutionDialog({
	open,
	onOpenChange,
	report,
	onExecutionStart,
}: ManualExecutionDialogProps) {
	const { executeScheduledReport, connectionStatus } = useComplianceAudit()
	const [isExecuting, setIsExecuting] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [parameters, setParameters] = useState<ExecutionParameters>({
		priority: 'normal',
		timeout: 300, // 5 minutes default
		retryAttempts: 3,
		notifyOnCompletion: true,
	})

	const handleExecute = async () => {
		if (!connectionStatus.isConnected || !report) {
			setError('Audit service not connected or no report selected')
			return
		}

		setIsExecuting(true)
		setError(null)

		try {
			// Execute the scheduled report manually
			const execution = await executeScheduledReport(report.id)

			// Notify parent component about execution start
			onExecutionStart?.(execution.id)

			// Close dialog on successful execution
			onOpenChange(false)

			// Reset form
			setParameters({
				priority: 'normal',
				timeout: 300,
				retryAttempts: 3,
				notifyOnCompletion: true,
			})
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to execute report')
		} finally {
			setIsExecuting(false)
		}
	}

	const handleCancel = () => {
		if (!isExecuting) {
			onOpenChange(false)
			setError(null)
		}
	}

	const updateParameters = (updates: Partial<ExecutionParameters>) => {
		setParameters((prev) => ({ ...prev, ...updates }))
	}

	if (!report) return null

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Play className="h-5 w-5" />
						Manual Report Execution
					</DialogTitle>
					<DialogDescription>
						Execute "{report.name}" immediately with custom parameters
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6">
					{/* Report Information */}
					<div className="space-y-3">
						<h4 className="text-sm font-medium flex items-center gap-2">
							<Settings className="h-4 w-4" />
							Report Details
						</h4>
						<div className="grid grid-cols-2 gap-4 text-sm">
							<div>
								<Label className="text-muted-foreground">Type</Label>
								<p className="font-medium">{report.reportType}</p>
							</div>
							<div>
								<Label className="text-muted-foreground">Format</Label>
								<p className="font-medium">{report.format}</p>
							</div>
							<div>
								<Label className="text-muted-foreground">Next Scheduled</Label>
								<p className="font-medium flex items-center gap-1">
									<Calendar className="h-3 w-3" />
									{report.nextExecutionFormatted || 'Not scheduled'}
								</p>
							</div>
							<div>
								<Label className="text-muted-foreground">Last Execution</Label>
								<p className="font-medium flex items-center gap-1">
									<Clock className="h-3 w-3" />
									{report.lastExecutionStatus || 'Never executed'}
								</p>
							</div>
						</div>
					</div>

					<Separator />

					{/* Execution Parameters */}
					<div className="space-y-4">
						<h4 className="text-sm font-medium">Execution Parameters</h4>

						{/* Priority */}
						<div className="space-y-2">
							<Label>Priority</Label>
							<RadioGroup
								value={parameters.priority}
								onValueChange={(value: 'low' | 'normal' | 'high') =>
									updateParameters({ priority: value })
								}
								className="flex gap-6"
							>
								<div className="flex items-center space-x-2">
									<RadioGroupItem value="low" id="priority-low" />
									<Label htmlFor="priority-low">Low</Label>
								</div>
								<div className="flex items-center space-x-2">
									<RadioGroupItem value="normal" id="priority-normal" />
									<Label htmlFor="priority-normal">Normal</Label>
								</div>
								<div className="flex items-center space-x-2">
									<RadioGroupItem value="high" id="priority-high" />
									<Label htmlFor="priority-high">High</Label>
								</div>
							</RadioGroup>
						</div>

						{/* Timeout */}
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="timeout">Timeout (seconds)</Label>
								<Select
									value={parameters.timeout.toString()}
									onValueChange={(value) => updateParameters({ timeout: parseInt(value) })}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="60">1 minute</SelectItem>
										<SelectItem value="300">5 minutes</SelectItem>
										<SelectItem value="600">10 minutes</SelectItem>
										<SelectItem value="1800">30 minutes</SelectItem>
										<SelectItem value="3600">1 hour</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label htmlFor="retryAttempts">Retry Attempts</Label>
								<Select
									value={parameters.retryAttempts.toString()}
									onValueChange={(value) => updateParameters({ retryAttempts: parseInt(value) })}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="0">No retries</SelectItem>
										<SelectItem value="1">1 retry</SelectItem>
										<SelectItem value="3">3 retries</SelectItem>
										<SelectItem value="5">5 retries</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						{/* Custom Date Range */}
						<div className="space-y-2">
							<Label>Custom Date Range (Optional)</Label>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label htmlFor="startDate" className="text-xs text-muted-foreground">
										Start Date
									</Label>
									<Input
										id="startDate"
										type="datetime-local"
										value={parameters.customCriteria?.startDate || ''}
										onChange={(e) =>
											updateParameters({
												customCriteria: {
													...parameters.customCriteria,
													startDate: e.target.value,
												},
											})
										}
									/>
								</div>
								<div>
									<Label htmlFor="endDate" className="text-xs text-muted-foreground">
										End Date
									</Label>
									<Input
										id="endDate"
										type="datetime-local"
										value={parameters.customCriteria?.endDate || ''}
										onChange={(e) =>
											updateParameters({
												customCriteria: {
													...parameters.customCriteria,
													endDate: e.target.value,
												},
											})
										}
									/>
								</div>
							</div>
						</div>

						{/* Additional Filters */}
						<div className="space-y-2">
							<Label htmlFor="additionalFilters">Additional Filters (Optional)</Label>
							<Textarea
								id="additionalFilters"
								placeholder="Enter additional filter criteria in JSON format..."
								value={parameters.customCriteria?.additionalFilters || ''}
								onChange={(e) =>
									updateParameters({
										customCriteria: {
											...parameters.customCriteria,
											additionalFilters: e.target.value,
										},
									})
								}
								rows={3}
							/>
						</div>

						{/* Notes */}
						<div className="space-y-2">
							<Label htmlFor="notes">Execution Notes (Optional)</Label>
							<Textarea
								id="notes"
								placeholder="Add notes about this manual execution..."
								value={parameters.notes || ''}
								onChange={(e) => updateParameters({ notes: e.target.value })}
								rows={2}
							/>
						</div>
					</div>

					{/* Connection Status Warning */}
					{!isConnected && (
						<div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
							<AlertCircle className="h-4 w-4 text-yellow-600" />
							<span className="text-sm text-yellow-800">
								Audit system is not connected. Execution may fail.
							</span>
						</div>
					)}

					{/* Error Display */}
					{error && (
						<div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
							<AlertCircle className="h-4 w-4 text-red-600" />
							<span className="text-sm text-red-800">{error}</span>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={handleCancel} disabled={isExecuting}>
						<X className="h-4 w-4 mr-2" />
						Cancel
					</Button>
					<Button
						onClick={handleExecute}
						disabled={isExecuting || !isConnected}
						className="min-w-[120px]"
					>
						{isExecuting ? (
							<>
								<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
								Executing...
							</>
						) : (
							<>
								<Play className="h-4 w-4 mr-2" />
								Execute Now
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
