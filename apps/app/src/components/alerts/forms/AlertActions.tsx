'use client'

import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AlertStatus } from '@/lib/types/alert'
import { cn } from '@/lib/utils'
import { Check, CheckCircle, Eye, EyeIcon, MoreHorizontal, X, XCircle } from 'lucide-react'
import React, { useState } from 'react'

import { AlertActionDialog } from './AlertActionDialog'

import type { Alert } from '@/lib/collections'

interface AlertActionsProps {
	/** Selected alerts to perform actions on */
	selectedAlerts: Alert[]
	/** Callback when view action is triggered */
	onView: (alert: Alert) => void
	/** Callback when acknowledge action is triggered */
	onAcknowledge: (alertIds: string[]) => Promise<void>
	/** Callback when resolve action is triggered */
	onResolve: (alertIds: string[], notes: string) => Promise<void>
	/** Callback when dismiss action is triggered */
	onDismiss: (alertIds: string[]) => Promise<void>
	/** Whether actions are disabled */
	disabled?: boolean
	/** Display mode - inline buttons or dropdown menu */
	mode?: 'inline' | 'dropdown'
	/** Size of the action buttons */
	size?: 'sm' | 'default' | 'lg'
	/** Additional CSS classes */
	className?: string
}

type ActionType = 'view' | 'acknowledge' | 'resolve' | 'dismiss'

/**
 * Action buttons for individual and bulk alert operations
 * Supports acknowledge, resolve, and dismiss operations with confirmation dialogs
 */
export function AlertActions({
	selectedAlerts,
	onView,
	onAcknowledge,
	onResolve,
	onDismiss,
	disabled = false,
	mode = 'inline',
	size = 'default',
	className,
}: AlertActionsProps) {
	const [pendingAction, setPendingAction] = useState<ActionType | null>(null)
	const [dialogOpen, setDialogOpen] = useState(false)
	const [isLoading, setIsLoading] = useState(false)

	const alertIds = selectedAlerts.map((alert) => alert.id)
	const hasSelectedAlerts = selectedAlerts.length > 0

	// Determine which actions are available based on alert statuses
	const availableActions = {
		view: selectedAlerts.length === 1,
		acknowledge: selectedAlerts.some((alert) => alert.status === AlertStatus.ACTIVE),
		resolve: selectedAlerts.some(
			(alert) => alert.status === AlertStatus.ACTIVE || alert.status === AlertStatus.ACKNOWLEDGED
		),
		dismiss: selectedAlerts.some((alert) => alert.status !== AlertStatus.DISMISSED),
	}

	const handleActionClick = (action: ActionType) => {
		if (disabled || !hasSelectedAlerts) return

		setPendingAction(action)

		// For acknowledge and dismiss, execute immediately
		// For resolve, show dialog for notes
		if (action === 'resolve') {
			setDialogOpen(true)
		} else {
			executeAction(action)
		}
	}

	const executeAction = async (action: ActionType, notes?: string) => {
		if (!hasSelectedAlerts) return

		setIsLoading(true)
		try {
			switch (action) {
				case 'view':
					onView(selectedAlerts[0])
					break
				case 'acknowledge':
					await onAcknowledge(alertIds)
					break
				case 'resolve':
					await onResolve(alertIds, notes || '')
					break
				case 'dismiss':
					await onDismiss(alertIds)
					break
			}
		} catch (error) {
			console.error(`Failed to ${action} alerts:`, error)
			// Error handling is managed by parent component
		} finally {
			setIsLoading(false)
			setPendingAction(null)
			setDialogOpen(false)
		}
	}

	const handleDialogConfirm = (notes: string) => {
		if (pendingAction) {
			executeAction(pendingAction, notes)
		}
	}

	const handleDialogCancel = () => {
		setPendingAction(null)
		setDialogOpen(false)
	}

	const getActionLabel = (action: ActionType) => {
		const count = selectedAlerts.length
		const suffix = count > 1 ? ` (${count})` : ''

		switch (action) {
			case 'view':
				return `View Details`
			case 'acknowledge':
				return `Acknowledge${suffix}`
			case 'resolve':
				return `Resolve${suffix}`
			case 'dismiss':
				return `Dismiss${suffix}`
		}
	}

	const getActionIcon = (action: ActionType) => {
		switch (action) {
			case 'view':
				return <Eye className="h-4 w-4" />
			case 'acknowledge':
				return <Check className="h-4 w-4" />
			case 'resolve':
				return <CheckCircle className="h-4 w-4" />
			case 'dismiss':
				return <XCircle className="h-4 w-4" />
		}
	}

	const getActionVariant = (action: ActionType) => {
		switch (action) {
			case 'view':
				return 'outline' as const
			case 'acknowledge':
				return 'default' as const
			case 'resolve':
				return 'default' as const
			case 'dismiss':
				return 'destructive' as const
		}
	}

	if (mode === 'dropdown') {
		return (
			<>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="outline"
							size={size}
							disabled={disabled || !hasSelectedAlerts}
							className={className}
						>
							<MoreHorizontal className="h-4 w-4" />
							<span className="sr-only">Open actions menu</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-48">
						{availableActions.view && (
							<DropdownMenuItem onClick={() => handleActionClick('view')} disabled={isLoading}>
								{getActionIcon('view')}
								{getActionLabel('view')}
							</DropdownMenuItem>
						)}
						{availableActions.acknowledge && (
							<DropdownMenuItem
								onClick={() => handleActionClick('acknowledge')}
								disabled={isLoading}
							>
								{getActionIcon('acknowledge')}
								{getActionLabel('acknowledge')}
							</DropdownMenuItem>
						)}
						{availableActions.resolve && (
							<DropdownMenuItem onClick={() => handleActionClick('resolve')} disabled={isLoading}>
								{getActionIcon('resolve')}
								{getActionLabel('resolve')}
							</DropdownMenuItem>
						)}
						{(availableActions.acknowledge || availableActions.resolve) &&
							availableActions.dismiss && <DropdownMenuSeparator />}
						{availableActions.dismiss && (
							<DropdownMenuItem
								onClick={() => handleActionClick('dismiss')}
								disabled={isLoading}
								className="text-destructive focus:text-destructive"
							>
								{getActionIcon('dismiss')}
								{getActionLabel('dismiss')}
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>

				<AlertActionDialog
					open={dialogOpen}
					onOpenChange={setDialogOpen}
					action={pendingAction}
					alertCount={selectedAlerts.length}
					onConfirm={handleDialogConfirm}
					onCancel={handleDialogCancel}
					isLoading={isLoading}
				/>
			</>
		)
	}

	return (
		<>
			<div className={cn('flex items-center gap-2', className)}>
				{availableActions.view && (
					<Button
						variant="outline"
						size={size}
						onClick={() => handleActionClick('view')}
						disabled={disabled || !hasSelectedAlerts || isLoading}
						className="whitespace-nowrap"
					>
						{isLoading && pendingAction === 'view' ? (
							<div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
						) : (
							getActionIcon('view')
						)}
						{getActionLabel('view')}
					</Button>
				)}

				{availableActions.acknowledge && (
					<Button
						variant={getActionVariant('acknowledge')}
						size={size}
						onClick={() => handleActionClick('acknowledge')}
						disabled={disabled || !hasSelectedAlerts || isLoading}
						className="whitespace-nowrap"
					>
						{isLoading && pendingAction === 'acknowledge' ? (
							<div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
						) : (
							getActionIcon('acknowledge')
						)}
						{getActionLabel('acknowledge')}
					</Button>
				)}

				{availableActions.resolve && (
					<Button
						variant={getActionVariant('resolve')}
						size={size}
						onClick={() => handleActionClick('resolve')}
						disabled={disabled || !hasSelectedAlerts || isLoading}
						className="whitespace-nowrap"
					>
						{isLoading && pendingAction === 'resolve' ? (
							<div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
						) : (
							getActionIcon('resolve')
						)}
						{getActionLabel('resolve')}
					</Button>
				)}

				{availableActions.dismiss && (
					<Button
						variant={getActionVariant('dismiss')}
						size={size}
						onClick={() => handleActionClick('dismiss')}
						disabled={disabled || !hasSelectedAlerts || isLoading}
						className="whitespace-nowrap"
					>
						{isLoading && pendingAction === 'dismiss' ? (
							<div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
						) : (
							getActionIcon('dismiss')
						)}
						{getActionLabel('dismiss')}
					</Button>
				)}

				{!hasSelectedAlerts && (
					<p className="text-sm text-muted-foreground">Select alerts to perform actions</p>
				)}
			</div>

			<AlertActionDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				action={pendingAction}
				alertCount={selectedAlerts.length}
				onConfirm={handleDialogConfirm}
				onCancel={handleDialogCancel}
				isLoading={isLoading}
			/>
		</>
	)
}
