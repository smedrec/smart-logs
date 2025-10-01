import { AlertCircle, CheckCircle, Clock, Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import React from 'react'

import { useOptimisticUpdates, useSyncStatus } from '../../contexts/data-sync-provider'
import { cn } from '../../lib/utils'
import { Badge } from './badge'
import { Button } from './button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

interface SyncStatusProps {
	className?: string
	showDetails?: boolean
	compact?: boolean
}

export function SyncStatus({ className, showDetails = false, compact = false }: SyncStatusProps) {
	const { isOnline, isAnySyncActive, hasAnyErrors, lastSyncTime, forceSync } = useSyncStatus()

	const { hasPendingUpdates } = useOptimisticUpdates()

	const getStatusIcon = () => {
		if (!isOnline) {
			return <WifiOff className="h-4 w-4 text-destructive" />
		}

		if (isAnySyncActive) {
			return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
		}

		if (hasAnyErrors) {
			return <AlertCircle className="h-4 w-4 text-destructive" />
		}

		if (hasPendingUpdates) {
			return <Clock className="h-4 w-4 text-yellow-500" />
		}

		return <CheckCircle className="h-4 w-4 text-green-500" />
	}

	const getStatusText = () => {
		if (!isOnline) {
			return 'Offline'
		}

		if (isAnySyncActive) {
			return 'Syncing...'
		}

		if (hasAnyErrors) {
			return 'Sync Error'
		}

		if (hasPendingUpdates) {
			return 'Pending Updates'
		}

		return 'Up to date'
	}

	const getStatusVariant = (): 'default' | 'secondary' | 'destructive' | 'outline' => {
		if (!isOnline || hasAnyErrors) {
			return 'destructive'
		}

		if (hasPendingUpdates) {
			return 'outline'
		}

		return 'secondary'
	}

	const formatLastSyncTime = (date: Date | null) => {
		if (!date) return 'Never'

		const now = new Date()
		const diffMs = now.getTime() - date.getTime()
		const diffMinutes = Math.floor(diffMs / (1000 * 60))

		if (diffMinutes < 1) return 'Just now'
		if (diffMinutes < 60) return `${diffMinutes}m ago`

		const diffHours = Math.floor(diffMinutes / 60)
		if (diffHours < 24) return `${diffHours}h ago`

		const diffDays = Math.floor(diffHours / 24)
		return `${diffDays}d ago`
	}

	if (compact) {
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							onClick={forceSync}
							disabled={isAnySyncActive}
							className={cn('h-8 w-8 p-0', className)}
						>
							{getStatusIcon()}
							<span className="sr-only">{getStatusText()}</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<div className="text-sm">
							<div className="font-medium">{getStatusText()}</div>
							{lastSyncTime && (
								<div className="text-muted-foreground">
									Last sync: {formatLastSyncTime(lastSyncTime)}
								</div>
							)}
							<div className="text-muted-foreground mt-1">Click to refresh</div>
						</div>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		)
	}

	return (
		<div className={cn('flex items-center gap-2', className)}>
			<Badge variant={getStatusVariant()} className="flex items-center gap-1">
				{getStatusIcon()}
				<span>{getStatusText()}</span>
			</Badge>

			{showDetails && (
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					{lastSyncTime && <span>Last sync: {formatLastSyncTime(lastSyncTime)}</span>}

					<Button
						variant="ghost"
						size="sm"
						onClick={forceSync}
						disabled={isAnySyncActive}
						className="h-6 px-2"
					>
						<RefreshCw className={cn('h-3 w-3', isAnySyncActive && 'animate-spin')} />
						<span className="ml-1">Refresh</span>
					</Button>
				</div>
			)}
		</div>
	)
}

// Connection status indicator
export function ConnectionStatus({ className }: { className?: string }) {
	const { isOnline } = useSyncStatus()

	return (
		<div className={cn('flex items-center gap-2', className)}>
			{isOnline ? (
				<>
					<Wifi className="h-4 w-4 text-green-500" />
					<span className="text-sm text-muted-foreground">Online</span>
				</>
			) : (
				<>
					<WifiOff className="h-4 w-4 text-destructive" />
					<span className="text-sm text-destructive">Offline</span>
				</>
			)}
		</div>
	)
}

// Detailed sync status panel
export function DetailedSyncStatus() {
	const { scheduledReportsSync, executionHistorySync, isOnline, forceSync } = useSyncStatus()

	const { hasPendingUpdates, pendingUpdates } = useOptimisticUpdates()

	const renderSyncItem = (label: string, sync: typeof scheduledReportsSync) => (
		<div className="flex items-center justify-between py-2">
			<div className="flex items-center gap-2">
				<span className="text-sm font-medium">{label}</span>
				{sync.isActive && <Loader2 className="h-3 w-3 animate-spin" />}
			</div>
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				{sync.error ? (
					<span className="text-destructive">{sync.error}</span>
				) : sync.lastSync ? (
					<span>Last: {sync.lastSync.toLocaleTimeString()}</span>
				) : (
					<span>Never synced</span>
				)}
				{sync.pendingOperations > 0 && (
					<Badge variant="outline" className="text-xs">
						{sync.pendingOperations} pending
					</Badge>
				)}
			</div>
		</div>
	)

	return (
		<div className="space-y-4 p-4 border rounded-lg">
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">Sync Status</h3>
				<div className="flex items-center gap-2">
					<ConnectionStatus />
					<Button variant="outline" size="sm" onClick={forceSync} disabled={!isOnline}>
						<RefreshCw className="h-4 w-4 mr-2" />
						Force Sync
					</Button>
				</div>
			</div>

			<div className="space-y-1">
				{renderSyncItem('Scheduled Reports', scheduledReportsSync)}
				{renderSyncItem('Execution History', executionHistorySync)}
			</div>

			{hasPendingUpdates && (
				<div className="pt-2 border-t">
					<div className="flex items-center gap-2 mb-2">
						<Clock className="h-4 w-4 text-yellow-500" />
						<span className="text-sm font-medium">Pending Updates</span>
						<Badge variant="outline">{pendingUpdates.size}</Badge>
					</div>
					<div className="text-sm text-muted-foreground">
						{pendingUpdates.size} update{pendingUpdates.size !== 1 ? 's' : ''} waiting to sync
					</div>
				</div>
			)}
		</div>
	)
}
