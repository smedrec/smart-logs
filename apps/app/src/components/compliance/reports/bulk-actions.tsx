import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { CheckCircle, ChevronDown, Loader2, Play, Settings, Trash2, XCircle } from 'lucide-react'
import * as React from 'react'

import type { ScheduledReportUI } from '../types'

interface BulkActionsProps {
	selectedReports: ScheduledReportUI[]
	onBulkEnable?: (reportIds: string[]) => Promise<void>
	onBulkDisable?: (reportIds: string[]) => Promise<void>
	onBulkDelete?: (reportIds: string[]) => Promise<void>
	onBulkExecute?: (reportIds: string[]) => Promise<void>
	onClearSelection?: () => void
	className?: string
}

interface BulkActionState {
	type: 'enable' | 'disable' | 'delete' | 'execute' | null
	loading: boolean
	error?: string
}

export function BulkActions({
	selectedReports,
	onBulkEnable,
	onBulkDisable,
	onBulkDelete,
	onBulkExecute,
	onClearSelection,
	className,
}: BulkActionsProps) {
	const [actionState, setActionState] = React.useState<BulkActionState>({
		type: null,
		loading: false,
	})
	const [confirmDialog, setConfirmDialog] = React.useState<{
		open: boolean
		type: 'enable' | 'disable' | 'delete' | 'execute' | null
		title: string
		description: string
		confirmText: string
		variant: 'default' | 'destructive'
	}>({
		open: false,
		type: null,
		title: '',
		description: '',
		confirmText: '',
		variant: 'default',
	})

	const selectedCount = selectedReports.length
	const selectedIds = selectedReports.map((report) => report.id)

	// Calculate action availability
	const enabledCount = selectedReports.filter((report) => report.enabled).length
	const disabledCount = selectedCount - enabledCount
	const canEnable = disabledCount > 0 && onBulkEnable
	const canDisable = enabledCount > 0 && onBulkDisable
	const canDelete = selectedCount > 0 && onBulkDelete
	const canExecute = enabledCount > 0 && onBulkExecute

	const handleAction = async (type: 'enable' | 'disable' | 'delete' | 'execute') => {
		setActionState({ type, loading: true })
		setConfirmDialog({ ...confirmDialog, open: false })

		try {
			switch (type) {
				case 'enable':
					await onBulkEnable?.(selectedIds)
					break
				case 'disable':
					await onBulkDisable?.(selectedIds)
					break
				case 'delete':
					await onBulkDelete?.(selectedIds)
					break
				case 'execute':
					await onBulkExecute?.(selectedIds)
					break
			}
			onClearSelection?.()
		} catch (error) {
			setActionState({
				type,
				loading: false,
				error: error instanceof Error ? error.message : 'An error occurred',
			})
		} finally {
			if (!actionState.error) {
				setActionState({ type: null, loading: false })
			}
		}
	}

	const openConfirmDialog = (type: 'enable' | 'disable' | 'delete' | 'execute') => {
		const configs = {
			enable: {
				title: 'Enable Reports',
				description: `Are you sure you want to enable ${disabledCount} report${
					disabledCount !== 1 ? 's' : ''
				}? This will allow them to run on their scheduled times.`,
				confirmText: 'Enable Reports',
				variant: 'default' as const,
			},
			disable: {
				title: 'Disable Reports',
				description: `Are you sure you want to disable ${enabledCount} report${
					enabledCount !== 1 ? 's' : ''
				}? This will prevent them from running on their scheduled times.`,
				confirmText: 'Disable Reports',
				variant: 'default' as const,
			},
			delete: {
				title: 'Delete Reports',
				description: `Are you sure you want to delete ${selectedCount} report${
					selectedCount !== 1 ? 's' : ''
				}? This action cannot be undone and will permanently remove the reports and their execution history.`,
				confirmText: 'Delete Reports',
				variant: 'destructive' as const,
			},
			execute: {
				title: 'Execute Reports',
				description: `Are you sure you want to manually execute ${enabledCount} report${
					enabledCount !== 1 ? 's' : ''
				}? This will start the report generation process immediately.`,
				confirmText: 'Execute Reports',
				variant: 'default' as const,
			},
		}

		const config = configs[type]
		setConfirmDialog({
			open: true,
			type,
			...config,
		})
	}

	if (selectedCount === 0) {
		return null
	}

	return (
		<>
			<div className={cn('flex items-center gap-2', className)}>
				{/* Selection summary */}
				<div className="flex items-center gap-2">
					<Badge variant="secondary" className="gap-1">
						{selectedCount} selected
					</Badge>
					{enabledCount > 0 && (
						<Badge variant="outline" className="gap-1">
							<CheckCircle className="size-3" />
							{enabledCount} enabled
						</Badge>
					)}
					{disabledCount > 0 && (
						<Badge variant="outline" className="gap-1">
							<XCircle className="size-3" />
							{disabledCount} disabled
						</Badge>
					)}
				</div>

				{/* Bulk actions dropdown */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm" disabled={actionState.loading} className="gap-2">
							{actionState.loading ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Settings className="size-4" />
							)}
							Bulk Actions
							<ChevronDown className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-48">
						{canEnable && (
							<DropdownMenuItem onClick={() => openConfirmDialog('enable')}>
								<CheckCircle className="mr-2 size-4" />
								Enable {disabledCount} report{disabledCount !== 1 ? 's' : ''}
							</DropdownMenuItem>
						)}
						{canDisable && (
							<DropdownMenuItem onClick={() => openConfirmDialog('disable')}>
								<XCircle className="mr-2 size-4" />
								Disable {enabledCount} report{enabledCount !== 1 ? 's' : ''}
							</DropdownMenuItem>
						)}
						{canExecute && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => openConfirmDialog('execute')}>
									<Play className="mr-2 size-4" />
									Execute {enabledCount} report{enabledCount !== 1 ? 's' : ''}
								</DropdownMenuItem>
							</>
						)}
						{canDelete && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => openConfirmDialog('delete')}
									className="text-destructive focus:text-destructive"
								>
									<Trash2 className="mr-2 size-4" />
									Delete {selectedCount} report{selectedCount !== 1 ? 's' : ''}
								</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>

				{/* Clear selection */}
				<Button variant="ghost" size="sm" onClick={onClearSelection} disabled={actionState.loading}>
					Clear Selection
				</Button>

				{/* Error display */}
				{actionState.error && (
					<div className="flex items-center gap-2 text-destructive">
						<XCircle className="size-4" />
						<span className="text-sm">{actionState.error}</span>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setActionState({ type: null, loading: false })}
						>
							Dismiss
						</Button>
					</div>
				)}
			</div>

			{/* Confirmation Dialog */}
			<Dialog
				open={confirmDialog.open}
				onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{confirmDialog.title}</DialogTitle>
						<DialogDescription>{confirmDialog.description}</DialogDescription>
					</DialogHeader>

					{/* Selected reports preview */}
					<div className="max-h-48 overflow-y-auto">
						<div className="space-y-2">
							<p className="text-sm font-medium">Selected reports:</p>
							<div className="space-y-1">
								{selectedReports.slice(0, 5).map((report) => (
									<div
										key={report.id}
										className="flex items-center justify-between rounded-md border p-2 text-sm"
									>
										<div className="flex items-center gap-2">
											<span className="font-medium">{report.name}</span>
											<Badge variant={report.enabled ? 'default' : 'secondary'} className="text-xs">
												{report.enabled ? 'Enabled' : 'Disabled'}
											</Badge>
										</div>
									</div>
								))}
								{selectedReports.length > 5 && (
									<div className="text-muted-foreground text-center text-sm">
										... and {selectedReports.length - 5} more
									</div>
								)}
							</div>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
							disabled={actionState.loading}
						>
							Cancel
						</Button>
						<Button
							variant={confirmDialog.variant}
							onClick={() => confirmDialog.type && handleAction(confirmDialog.type)}
							disabled={actionState.loading}
						>
							{actionState.loading ? (
								<>
									<Loader2 className="mr-2 size-4 animate-spin" />
									Processing...
								</>
							) : (
								confirmDialog.confirmText
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}

/**
 * Hook for managing bulk operations state
 */
export function useBulkActions() {
	const [selectedIds, setSelectedIds] = React.useState<string[]>([])
	const [isProcessing, setIsProcessing] = React.useState(false)

	const selectAll = React.useCallback((ids: string[]) => {
		setSelectedIds(ids)
	}, [])

	const selectNone = React.useCallback(() => {
		setSelectedIds([])
	}, [])

	const toggleSelection = React.useCallback((id: string) => {
		setSelectedIds((prev) =>
			prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id]
		)
	}, [])

	const isSelected = React.useCallback(
		(id: string) => {
			return selectedIds.includes(id)
		},
		[selectedIds]
	)

	const isAllSelected = React.useCallback(
		(ids: string[]) => {
			return ids.length > 0 && ids.every((id) => selectedIds.includes(id))
		},
		[selectedIds]
	)

	const isSomeSelected = React.useCallback(
		(ids: string[]) => {
			return ids.some((id) => selectedIds.includes(id)) && !isAllSelected(ids)
		},
		[selectedIds, isAllSelected]
	)

	return {
		selectedIds,
		isProcessing,
		setIsProcessing,
		selectAll,
		selectNone,
		toggleSelection,
		isSelected,
		isAllSelected,
		isSomeSelected,
		selectedCount: selectedIds.length,
	}
}
