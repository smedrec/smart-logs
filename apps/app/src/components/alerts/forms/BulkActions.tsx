'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { Check, Loader2, X } from 'lucide-react'
import React, { useCallback, useState } from 'react'

import { AlertActions } from './AlertActions'

import type { Alert } from '@/lib/types/alert'

interface BulkActionsProps {
	/** All available alerts for selection */
	alerts: Alert[]
	/** Currently selected alert IDs */
	selectedAlertIds: string[]
	/** Callback when selection changes */
	onSelectionChange: (selectedIds: string[]) => void
	/** Callback when acknowledge action is triggered */
	onAcknowledge: (alertIds: string[]) => Promise<void>
	/** Callback when resolve action is triggered */
	onResolve: (alertIds: string[], notes: string) => Promise<void>
	/** Callback when dismiss action is triggered */
	onDismiss: (alertIds: string[]) => Promise<void>
	/** Whether bulk actions are disabled */
	disabled?: boolean
	/** Additional CSS classes */
	className?: string
}

interface BulkOperationProgress {
	total: number
	completed: number
	failed: number
	isRunning: boolean
	errors: string[]
}

/**
 * Bulk selection and operation controls for multiple alerts
 * Provides checkbox selection, progress indicators, and bulk operations
 */
export function BulkActions({
	alerts,
	selectedAlertIds,
	onSelectionChange,
	onAcknowledge,
	onResolve,
	onDismiss,
	disabled = false,
	className,
}: BulkActionsProps) {
	const [progress, setProgress] = useState<BulkOperationProgress | null>(null)

	const selectedAlerts = alerts.filter((alert) => selectedAlertIds.includes(alert.id))
	const isAllSelected = alerts.length > 0 && selectedAlertIds.length === alerts.length
	const isPartiallySelected = selectedAlertIds.length > 0 && selectedAlertIds.length < alerts.length

	const handleSelectAll = useCallback(() => {
		if (isAllSelected) {
			onSelectionChange([])
		} else {
			onSelectionChange(alerts.map((alert) => alert.id))
		}
	}, [alerts, isAllSelected, onSelectionChange])

	const handleSelectAlert = useCallback(
		(alertId: string, checked: boolean) => {
			if (checked) {
				onSelectionChange([...selectedAlertIds, alertId])
			} else {
				onSelectionChange(selectedAlertIds.filter((id) => id !== alertId))
			}
		},
		[selectedAlertIds, onSelectionChange]
	)

	const executeBulkOperation = async (
		operation: (alertIds: string[], notes: string) => Promise<void>,
		alertIds: string[],
		notes: string = ''
	) => {
		if (alertIds.length === 0) return

		setProgress({
			total: alertIds.length,
			completed: 0,
			failed: 0,
			isRunning: true,
			errors: [],
		})

		// Process alerts in batches to avoid overwhelming the API
		const batchSize = 5
		const batches = []
		for (let i = 0; i < alertIds.length; i += batchSize) {
			batches.push(alertIds.slice(i, i + batchSize))
		}

		let completed = 0
		let failed = 0
		const errors: string[] = []

		for (const batch of batches) {
			try {
				await operation(batch, notes)
				completed += batch.length
			} catch (error) {
				failed += batch.length
				errors.push(
					`Failed to process batch: ${error instanceof Error ? error.message : 'Unknown error'}`
				)
			}

			setProgress((prev) =>
				prev
					? {
							...prev,
							completed,
							failed,
							errors,
						}
					: null
			)

			// Small delay between batches to prevent API rate limiting
			if (batches.indexOf(batch) < batches.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, 100))
			}
		}

		// Keep progress visible for a moment before clearing
		setTimeout(() => {
			setProgress(null)
			// Clear selection after successful bulk operation
			if (failed === 0) {
				onSelectionChange([])
			}
		}, 2000)
	}

	const handleBulkAcknowledge = async (alertIds: string[]) => {
		await executeBulkOperation(onAcknowledge, alertIds)
	}

	const handleBulkResolve = async (alertIds: string[], notes: string) => {
		await executeBulkOperation(onResolve, alertIds, notes)
	}

	const handleBulkDismiss = async (alertIds: string[]) => {
		await executeBulkOperation(onDismiss, alertIds)
	}

	const cancelBulkOperation = () => {
		setProgress(null)
	}

	if (progress?.isRunning) {
		const progressPercentage =
			progress.total > 0 ? ((progress.completed + progress.failed) / progress.total) * 100 : 0

		return (
			<div className={cn('space-y-4 p-4 border rounded-lg bg-muted/50', className)}>
				<div className="flex items-center justify-between">
					<div className="space-y-1">
						<h3 className="font-medium">Processing bulk operation...</h3>
						<p className="text-sm text-muted-foreground">
							{progress.completed} completed, {progress.failed} failed,{' '}
							{progress.total - progress.completed - progress.failed} remaining
						</p>
					</div>
					<Button variant="outline" size="sm" onClick={cancelBulkOperation} className="shrink-0">
						<X className="h-4 w-4" />
						Cancel
					</Button>
				</div>

				<Progress value={progressPercentage} className="w-full" />

				{progress.errors.length > 0 && (
					<div className="space-y-1">
						<p className="text-sm font-medium text-destructive">Errors:</p>
						<ul className="text-sm text-destructive space-y-1">
							{progress.errors.slice(0, 3).map((error, index) => (
								<li key={index} className="flex items-start gap-2">
									<X className="h-3 w-3 mt-0.5 shrink-0" />
									{error}
								</li>
							))}
							{progress.errors.length > 3 && (
								<li className="text-muted-foreground">
									...and {progress.errors.length - 3} more errors
								</li>
							)}
						</ul>
					</div>
				)}
			</div>
		)
	}

	return (
		<div className={cn('space-y-4', className)}>
			{/* Selection Controls */}
			<div className="flex items-center justify-between gap-4 p-4 border rounded-lg">
				<div className="flex items-center gap-3">
					<Checkbox
						checked={isAllSelected}
						ref={(el) => {
							if (el && 'indeterminate' in el) {
								;(el as any).indeterminate = isPartiallySelected
							}
						}}
						onCheckedChange={handleSelectAll}
						disabled={disabled || alerts.length === 0}
						aria-label={isAllSelected ? 'Deselect all alerts' : 'Select all alerts'}
					/>
					<div className="space-y-1">
						<p className="text-sm font-medium">
							{selectedAlertIds.length === 0
								? 'Select alerts'
								: `${selectedAlertIds.length} of ${alerts.length} selected`}
						</p>
						{selectedAlertIds.length > 0 && (
							<p className="text-xs text-muted-foreground">
								Use the actions below to perform bulk operations
							</p>
						)}
					</div>
				</div>

				{selectedAlertIds.length > 0 && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => onSelectionChange([])}
						disabled={disabled}
					>
						Clear selection
					</Button>
				)}
			</div>

			{/* Individual Alert Selection */}
			{alerts.length > 0 && (
				<div className="space-y-2 max-h-60 overflow-y-auto">
					{alerts.map((alert) => (
						<div
							key={alert.id}
							className="flex items-center gap-3 p-2 rounded border hover:bg-muted/50"
						>
							<Checkbox
								checked={selectedAlertIds.includes(alert.id)}
								onCheckedChange={(checked) => handleSelectAlert(alert.id, checked as boolean)}
								disabled={disabled}
								aria-label={`Select alert: ${alert.title}`}
							/>
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium truncate">{alert.title}</p>
								<p className="text-xs text-muted-foreground truncate">
									{alert.source} • {alert.severity} • {alert.status}
								</p>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Bulk Actions */}
			{selectedAlertIds.length > 0 && (
				<div className="border-t pt-4">
					<AlertActions
						selectedAlerts={selectedAlerts}
						onAcknowledge={handleBulkAcknowledge}
						onResolve={handleBulkResolve}
						onDismiss={handleBulkDismiss}
						disabled={disabled || progress?.isRunning}
						mode="inline"
						size="sm"
					/>
				</div>
			)}

			{/* Empty State */}
			{alerts.length === 0 && (
				<div className="text-center py-8 text-muted-foreground">
					<p>No alerts available for selection</p>
				</div>
			)}
		</div>
	)
}
