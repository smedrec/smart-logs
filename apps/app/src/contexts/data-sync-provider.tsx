import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

import { useErrorHandler } from '../hooks/use-error-handler'
import { useComplianceAudit } from './compliance-audit-provider'

// Sync status for different data types
interface SyncStatus {
	isActive: boolean
	lastSync: Date | null
	error: string | null
	pendingOperations: number
}

// Global sync state
interface DataSyncContextValue {
	// Sync status for different data types
	scheduledReportsSync: SyncStatus
	executionHistorySync: SyncStatus

	// Global sync controls
	startSync: () => void
	stopSync: () => void
	forceSync: () => Promise<void>

	// Optimistic update queue
	pendingUpdates: Map<string, any>
	addPendingUpdate: (key: string, update: any) => void
	removePendingUpdate: (key: string) => void

	// Connection-aware sync
	isOnline: boolean
	syncOnReconnect: boolean
	setSyncOnReconnect: (enabled: boolean) => void
}

const DataSyncContext = createContext<DataSyncContextValue | undefined>(undefined)

interface DataSyncProviderProps {
	children: React.ReactNode
	syncInterval?: number // milliseconds
	enableOfflineQueue?: boolean
}

export function DataSyncProvider({
	children,
	syncInterval = 30000, // 30 seconds
	enableOfflineQueue = true,
}: DataSyncProviderProps) {
	const { connectionStatus, listScheduledReports } = useComplianceAudit()
	const { handleError } = useErrorHandler()

	// Sync status states
	const [scheduledReportsSync, setScheduledReportsSync] = useState<SyncStatus>({
		isActive: false,
		lastSync: null,
		error: null,
		pendingOperations: 0,
	})

	const [executionHistorySync, setExecutionHistorySync] = useState<SyncStatus>({
		isActive: false,
		lastSync: null,
		error: null,
		pendingOperations: 0,
	})

	// Global sync state
	const [isOnline, setIsOnline] = useState(navigator.onLine)
	const [syncOnReconnect, setSyncOnReconnect] = useState(true)
	const [pendingUpdates] = useState(new Map<string, any>())

	// Refs for intervals and queues
	const syncIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined)
	const offlineQueueRef = useRef<Array<() => Promise<void>>>([])

	// Sync scheduled reports data
	const syncScheduledReports = useCallback(async () => {
		if (!connectionStatus.isConnected || !isOnline) return

		setScheduledReportsSync((prev) => ({
			...prev,
			isActive: true,
			error: null,
			pendingOperations: prev.pendingOperations + 1,
		}))

		try {
			// Fetch latest data
			await listScheduledReports()

			setScheduledReportsSync((prev) => ({
				...prev,
				isActive: false,
				lastSync: new Date(),
				pendingOperations: Math.max(0, prev.pendingOperations - 1),
			}))
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Sync failed'

			setScheduledReportsSync((prev) => ({
				...prev,
				isActive: false,
				error: errorMessage,
				pendingOperations: Math.max(0, prev.pendingOperations - 1),
			}))

			handleError(error, 'Syncing scheduled reports')
		}
	}, [connectionStatus.isConnected, isOnline, listScheduledReports, handleError])

	// Sync execution history data
	const syncExecutionHistory = useCallback(async () => {
		if (!connectionStatus.isConnected || !isOnline) return

		setExecutionHistorySync((prev) => ({
			...prev,
			isActive: true,
			error: null,
			pendingOperations: prev.pendingOperations + 1,
		}))

		try {
			// This would sync execution history for active reports
			// Implementation would depend on specific requirements

			setExecutionHistorySync((prev) => ({
				...prev,
				isActive: false,
				lastSync: new Date(),
				pendingOperations: Math.max(0, prev.pendingOperations - 1),
			}))
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Sync failed'

			setExecutionHistorySync((prev) => ({
				...prev,
				isActive: false,
				error: errorMessage,
				pendingOperations: Math.max(0, prev.pendingOperations - 1),
			}))

			handleError(error, 'Syncing execution history')
		}
	}, [connectionStatus.isConnected, isOnline, handleError])

	// Force sync all data
	const forceSync = useCallback(async () => {
		await Promise.all([syncScheduledReports(), syncExecutionHistory()])

		// Process offline queue if enabled
		if (enableOfflineQueue && offlineQueueRef.current.length > 0) {
			const queue = [...offlineQueueRef.current]
			offlineQueueRef.current = []

			for (const operation of queue) {
				try {
					await operation()
				} catch (error) {
					handleError(error, 'Processing offline queue')
					// Re-queue failed operations
					offlineQueueRef.current.push(operation)
				}
			}
		}
	}, [syncScheduledReports, syncExecutionHistory, enableOfflineQueue, handleError])

	// Start periodic sync
	const startSync = useCallback(() => {
		if (syncIntervalRef.current) return // Already started

		syncIntervalRef.current = setInterval(() => {
			if (connectionStatus.isConnected && isOnline) {
				forceSync()
			}
		}, syncInterval)

		// Initial sync
		forceSync()
	}, [connectionStatus.isConnected, isOnline, forceSync, syncInterval])

	// Stop periodic sync
	const stopSync = useCallback(() => {
		if (syncIntervalRef.current) {
			clearInterval(syncIntervalRef.current)
			syncIntervalRef.current = undefined
		}
	}, [])

	// Network status monitoring
	useEffect(() => {
		const handleOnline = () => {
			setIsOnline(true)
			if (syncOnReconnect) {
				forceSync()
			}
		}

		const handleOffline = () => {
			setIsOnline(false)
		}

		window.addEventListener('online', handleOnline)
		window.addEventListener('offline', handleOffline)

		return () => {
			window.removeEventListener('online', handleOnline)
			window.removeEventListener('offline', handleOffline)
		}
	}, [syncOnReconnect, forceSync])

	// Optimistic update management
	const addPendingUpdate = useCallback(
		(key: string, update: any) => {
			pendingUpdates.set(key, update)

			// If offline and offline queue is enabled, queue the update
			if (!isOnline && enableOfflineQueue) {
				offlineQueueRef.current.push(async () => {
					// This would be the actual API call to persist the update
					console.log('Processing queued update:', key, update)
				})
			}
		},
		[pendingUpdates, isOnline, enableOfflineQueue]
	)

	const removePendingUpdate = useCallback(
		(key: string) => {
			pendingUpdates.delete(key)
		},
		[pendingUpdates]
	)

	// Auto-start sync when connection is established
	useEffect(() => {
		if (connectionStatus.isConnected && isOnline) {
			startSync()
		} else {
			stopSync()
		}

		return () => stopSync()
	}, [connectionStatus.isConnected, isOnline, startSync, stopSync])

	// Sync on reconnection
	useEffect(() => {
		if (connectionStatus.isConnected && connectionStatus.retryCount > 0 && syncOnReconnect) {
			forceSync()
		}
	}, [connectionStatus.isConnected, connectionStatus.retryCount, syncOnReconnect, forceSync])

	const contextValue: DataSyncContextValue = {
		scheduledReportsSync,
		executionHistorySync,
		startSync,
		stopSync,
		forceSync,
		pendingUpdates,
		addPendingUpdate,
		removePendingUpdate,
		isOnline,
		syncOnReconnect,
		setSyncOnReconnect,
	}

	return <DataSyncContext.Provider value={contextValue}>{children}</DataSyncContext.Provider>
}

export function useDataSync(): DataSyncContextValue {
	const context = useContext(DataSyncContext)
	if (context === undefined) {
		throw new Error('useDataSync must be used within a DataSyncProvider')
	}
	return context
}

// Hook for monitoring sync status
export function useSyncStatus() {
	const { scheduledReportsSync, executionHistorySync, isOnline, forceSync } = useDataSync()

	const isAnySyncActive = scheduledReportsSync.isActive || executionHistorySync.isActive
	const hasAnyErrors = scheduledReportsSync.error || executionHistorySync.error
	const lastSyncTime = Math.max(
		scheduledReportsSync.lastSync?.getTime() || 0,
		executionHistorySync.lastSync?.getTime() || 0
	)

	return {
		isOnline,
		isAnySyncActive,
		hasAnyErrors,
		lastSyncTime: lastSyncTime > 0 ? new Date(lastSyncTime) : null,
		scheduledReportsSync,
		executionHistorySync,
		forceSync,
	}
}

// Hook for optimistic updates
export function useOptimisticUpdates() {
	const { pendingUpdates, addPendingUpdate, removePendingUpdate, isOnline } = useDataSync()

	const hasPendingUpdates = pendingUpdates.size > 0

	const createOptimisticUpdate = useCallback(
		(key: string, update: any, onSuccess?: () => void, onError?: (error: Error) => void) => {
			addPendingUpdate(key, update)

			// If online, try to sync immediately
			if (isOnline) {
				// This would be replaced with actual API call
				setTimeout(() => {
					try {
						removePendingUpdate(key)
						onSuccess?.()
					} catch (error) {
						onError?.(error as Error)
					}
				}, 1000) // Simulate API call delay
			}
		},
		[addPendingUpdate, removePendingUpdate, isOnline]
	)

	return {
		hasPendingUpdates,
		pendingUpdates,
		createOptimisticUpdate,
	}
}
