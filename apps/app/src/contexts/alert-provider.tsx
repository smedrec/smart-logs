/**
 * Alert Context Provider
 *
 * React context for global alert state management with notification state,
 * real-time update handling, and integration with existing AuditProvider.
 *
 * Requirements: 2.1, 5.1, 5.2
 */

import {
	useAlertRealTimeUpdates,
	useAlertWebSocket,
} from '@/components/alerts/hooks/use-alert-websocket'
import { AlertApiService } from '@/lib/services/alert-api'
import { ConnectionStatus } from '@/lib/services/alert-websocket'
import { useQueryClient } from '@tanstack/react-query'
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

import { useAuditContext } from './audit-provider'

import type { AlertAction, AlertStatistics, AlertUI } from '@/components/alerts/types/alert-types'
import type { AlertListRequest } from '@/components/alerts/types/api-types'
import type { AlertFilters } from '@/components/alerts/types/filter-types'
import type { ReactNode } from 'react'

/**
 * Notification state for alert notifications
 */
export interface AlertNotification {
	id: string
	alertId: string
	title: string
	message: string
	severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
	timestamp: Date
	read: boolean
	actionUrl?: string
}

/**
 * Alert context state
 */
interface AlertContextState {
	// Connection state
	isConnected: boolean
	connectionStatus: ConnectionStatus
	lastUpdate: Date | null

	// Notification state
	notifications: AlertNotification[]
	unreadCount: number
	newAlertsCount: number

	// Statistics
	statistics: AlertStatistics | null
	statisticsLoading: boolean

	// Current organization
	organizationId: string | null

	// Error state
	error: string | null
}

/**
 * Alert context actions
 */
interface AlertContextActions {
	// Connection management
	connect: () => Promise<void>
	disconnect: () => void

	// Notification management
	markNotificationAsRead: (notificationId: string) => void
	markAllNotificationsAsRead: () => void
	dismissNotification: (notificationId: string) => void
	clearNewAlertsCount: () => void

	// Statistics
	refreshStatistics: () => Promise<void>

	// Organization management
	setOrganizationId: (organizationId: string) => void

	// Error handling
	clearError: () => void
}

/**
 * Combined alert context value
 */
interface AlertContextValue extends AlertContextState, AlertContextActions {}

/**
 * Alert provider props
 */
interface AlertProviderProps {
	children: ReactNode
	organizationId?: string
	enableRealTime?: boolean
	enableNotifications?: boolean
	maxNotifications?: number
}

/**
 * Default state values
 */
const DEFAULT_STATE: AlertContextState = {
	isConnected: false,
	connectionStatus: ConnectionStatus.DISCONNECTED,
	lastUpdate: null,
	notifications: [],
	unreadCount: 0,
	newAlertsCount: 0,
	statistics: null,
	statisticsLoading: false,
	organizationId: null,
	error: null,
}

/**
 * Alert context
 */
const AlertContext = createContext<AlertContextValue | undefined>(undefined)

/**
 * Alert Provider Component
 */
export function AlertProvider({
	children,
	organizationId: initialOrganizationId,
	enableRealTime = true,
	enableNotifications = true,
	maxNotifications = 50,
}: AlertProviderProps) {
	const { client, isConnected: auditConnected } = useAuditContext()
	const queryClient = useQueryClient()

	// State management
	const [state, setState] = useState<AlertContextState>({
		...DEFAULT_STATE,
		organizationId: initialOrganizationId || null,
	})

	// Service references
	const apiServiceRef = useRef<AlertApiService | null>(null)

	// Initialize API service when audit client is available
	useEffect(() => {
		if (client && auditConnected) {
			apiServiceRef.current = new AlertApiService(client, {
				enableCache: true,
				cacheTtl: 60000,
				retryAttempts: 3,
			})
		} else {
			apiServiceRef.current = null
		}
	}, [client, auditConnected])

	// Real-time WebSocket connection
	const realTimeUpdates = useAlertRealTimeUpdates(state.organizationId || '', {
		enabled: enableRealTime && !!state.organizationId && auditConnected,
		onNewAlert: (alert) => {
			if (enableNotifications) {
				addNotification(alert)
			}
		},
		onAlertChange: (alert) => {
			// Update existing notification if it exists
			updateNotificationForAlert(alert)
		},
	})

	// Update connection state from WebSocket
	useEffect(() => {
		setState((prev) => ({
			...prev,
			isConnected: realTimeUpdates.isConnected,
			connectionStatus: realTimeUpdates.status,
			lastUpdate: realTimeUpdates.lastUpdate,
			newAlertsCount: realTimeUpdates.newAlertsCount,
		}))
	}, [
		realTimeUpdates.isConnected,
		realTimeUpdates.status,
		realTimeUpdates.lastUpdate,
		realTimeUpdates.newAlertsCount,
	])

	// Load statistics when organization changes
	useEffect(() => {
		if (state.organizationId && apiServiceRef.current) {
			refreshStatistics()
		}
	}, [state.organizationId])

	/**
	 * Add a notification for a new alert
	 */
	const addNotification = useCallback(
		(alert: AlertUI) => {
			const notification: AlertNotification = {
				id: `notif-${alert.id}-${Date.now()}`,
				alertId: alert.id,
				title: alert.title,
				message: alert.description,
				severity: alert.severity,
				timestamp: new Date(),
				read: false,
				actionUrl: `/alerts/${alert.id}`,
			}

			setState((prev) => {
				const newNotifications = [notification, ...prev.notifications].slice(0, maxNotifications) // Limit notifications

				return {
					...prev,
					notifications: newNotifications,
					unreadCount: prev.unreadCount + 1,
				}
			})
		},
		[maxNotifications]
	)

	/**
	 * Update notification when alert changes
	 */
	const updateNotificationForAlert = useCallback((alert: AlertUI) => {
		setState((prev) => ({
			...prev,
			notifications: prev.notifications.map((notif) =>
				notif.alertId === alert.id
					? {
							...notif,
							title: alert.title,
							message: alert.description,
							severity: alert.severity,
						}
					: notif
			),
		}))
	}, [])

	/**
	 * Mark a notification as read
	 */
	const markNotificationAsRead = useCallback((notificationId: string) => {
		setState((prev) => {
			const notification = prev.notifications.find((n) => n.id === notificationId)
			if (!notification || notification.read) {
				return prev
			}

			return {
				...prev,
				notifications: prev.notifications.map((n) =>
					n.id === notificationId ? { ...n, read: true } : n
				),
				unreadCount: Math.max(0, prev.unreadCount - 1),
			}
		})
	}, [])

	/**
	 * Mark all notifications as read
	 */
	const markAllNotificationsAsRead = useCallback(() => {
		setState((prev) => ({
			...prev,
			notifications: prev.notifications.map((n) => ({ ...n, read: true })),
			unreadCount: 0,
		}))
	}, [])

	/**
	 * Dismiss a notification
	 */
	const dismissNotification = useCallback((notificationId: string) => {
		setState((prev) => {
			const notification = prev.notifications.find((n) => n.id === notificationId)
			const wasUnread = notification && !notification.read

			return {
				...prev,
				notifications: prev.notifications.filter((n) => n.id !== notificationId),
				unreadCount: wasUnread ? Math.max(0, prev.unreadCount - 1) : prev.unreadCount,
			}
		})
	}, [])

	/**
	 * Clear new alerts count
	 */
	const clearNewAlertsCount = useCallback(() => {
		realTimeUpdates.clearNewAlertsCount()
	}, [realTimeUpdates])

	/**
	 * Refresh statistics
	 */
	const refreshStatistics = useCallback(async () => {
		if (!state.organizationId || !apiServiceRef.current) {
			return
		}

		setState((prev) => ({ ...prev, statisticsLoading: true, error: null }))

		try {
			const statistics = await apiServiceRef.current.getAlertStatistics(state.organizationId)
			setState((prev) => ({
				...prev,
				statistics,
				statisticsLoading: false,
			}))
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to load statistics'
			setState((prev) => ({
				...prev,
				error: errorMessage,
				statisticsLoading: false,
			}))
		}
	}, [state.organizationId])

	/**
	 * Set organization ID
	 */
	const setOrganizationId = useCallback((organizationId: string) => {
		setState((prev) => ({
			...prev,
			organizationId,
			// Clear notifications when switching organizations
			notifications: [],
			unreadCount: 0,
			newAlertsCount: 0,
			statistics: null,
			error: null,
		}))
	}, [])

	/**
	 * Connection management
	 */
	const connect = useCallback(async () => {
		try {
			await realTimeUpdates.connect()
			setState((prev) => ({ ...prev, error: null }))
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Connection failed'
			setState((prev) => ({ ...prev, error: errorMessage }))
		}
	}, [realTimeUpdates])

	const disconnect = useCallback(() => {
		realTimeUpdates.disconnect()
	}, [realTimeUpdates])

	/**
	 * Clear error
	 */
	const clearError = useCallback(() => {
		setState((prev) => ({ ...prev, error: null }))
	}, [])

	// Context value
	const contextValue: AlertContextValue = {
		// State
		...state,

		// Actions
		connect,
		disconnect,
		markNotificationAsRead,
		markAllNotificationsAsRead,
		dismissNotification,
		clearNewAlertsCount,
		refreshStatistics,
		setOrganizationId,
		clearError,
	}

	return <AlertContext.Provider value={contextValue}>{children}</AlertContext.Provider>
}

/**
 * Hook to use alert context
 */
export function useAlertContext(): AlertContextValue {
	const context = useContext(AlertContext)
	if (context === undefined) {
		throw new Error('useAlertContext must be used within an AlertProvider')
	}
	return context
}

/**
 * Hook for notification management
 */
export function useAlertNotifications() {
	const {
		notifications,
		unreadCount,
		newAlertsCount,
		markNotificationAsRead,
		markAllNotificationsAsRead,
		dismissNotification,
		clearNewAlertsCount,
	} = useAlertContext()

	return {
		notifications,
		unreadCount,
		newAlertsCount,
		markAsRead: markNotificationAsRead,
		markAllAsRead: markAllNotificationsAsRead,
		dismiss: dismissNotification,
		clearNewCount: clearNewAlertsCount,
	}
}

/**
 * Hook for alert statistics
 */
export function useAlertStatistics() {
	const { statistics, statisticsLoading, refreshStatistics } = useAlertContext()

	return {
		statistics,
		loading: statisticsLoading,
		refresh: refreshStatistics,
	}
}

/**
 * Hook for connection status
 */
export function useAlertConnection() {
	const { isConnected, connectionStatus, lastUpdate, connect, disconnect, error, clearError } =
		useAlertContext()

	return {
		isConnected,
		status: connectionStatus,
		lastUpdate,
		connect,
		disconnect,
		error,
		clearError,
	}
}

/**
 * Error Boundary for alert operations
 */
interface AlertErrorBoundaryState {
	hasError: boolean
	error: Error | null
}

export class AlertErrorBoundary extends React.Component<
	{ children: ReactNode; fallback?: ReactNode },
	AlertErrorBoundaryState
> {
	constructor(props: { children: ReactNode; fallback?: ReactNode }) {
		super(props)
		this.state = { hasError: false, error: null }
	}

	static getDerivedStateFromError(error: Error): AlertErrorBoundaryState {
		return { hasError: true, error }
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		console.error('Alert Error Boundary caught an error:', error, errorInfo)
	}

	render() {
		if (this.state.hasError) {
			return (
				this.props.fallback || (
					<div className="alert-error-boundary p-4 border border-red-200 rounded-lg bg-red-50">
						<h2 className="text-lg font-semibold text-red-800 mb-2">Alert System Error</h2>
						<p className="text-red-600 mb-4">Something went wrong with the alert system.</p>
						<details className="mb-4">
							<summary className="cursor-pointer text-red-700 font-medium">Error Details</summary>
							<pre className="mt-2 p-2 bg-red-100 rounded text-sm text-red-800 overflow-auto">
								{this.state.error?.message}
							</pre>
						</details>
						<button
							onClick={() => this.setState({ hasError: false, error: null })}
							className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
						>
							Try Again
						</button>
					</div>
				)
			)
		}

		return this.props.children
	}
}
