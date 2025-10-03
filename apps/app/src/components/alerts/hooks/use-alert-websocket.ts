/**
 * Alert WebSocket Hook
 *
 * React hook for managing real-time alert updates via WebSocket connection.
 * Integrates with TanStack Query for cache updates and provides connection
 * status monitoring.
 *
 * Requirements: 2.1, 2.2, 5.2
 */

import { useAuditContext } from '@/contexts/audit-provider'
import {
	AlertWebSocketManager,
	AlertWebSocketService,
	ConnectionStatus,
} from '@/lib/services/alert-websocket'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { alertQueryKeys } from './use-alert-queries'

import type { AlertUI } from '@/components/alerts/types/alert-types'
import type {
	AlertBulkUpdatePayload,
	AlertWebSocketConfig,
	AlertWebSocketEventHandlers,
} from '@/lib/services/alert-websocket'

/**
 * Hook options for WebSocket connection
 */
interface UseAlertWebSocketOptions {
	enabled?: boolean
	autoConnect?: boolean
	organizationId: string
	onAlertCreated?: (alert: AlertUI) => void
	onAlertUpdated?: (alert: AlertUI) => void
	onAlertDeleted?: (alertId: string) => void
	onBulkActionCompleted?: (payload: AlertBulkUpdatePayload) => void
	onConnectionChange?: (status: ConnectionStatus) => void
	onError?: (error: Error) => void
}

/**
 * WebSocket connection state
 */
interface WebSocketState {
	status: ConnectionStatus
	isConnected: boolean
	isConnecting: boolean
	isReconnecting: boolean
	hasError: boolean
	reconnectAttempts: number
	lastError: Error | null
}

/**
 * Hook return type
 */
interface UseAlertWebSocketReturn extends WebSocketState {
	connect: () => Promise<void>
	disconnect: () => void
	send: (message: any) => void
	stats: ReturnType<AlertWebSocketService['getConnectionStats']> | null
}

/**
 * Hook for managing real-time alert updates via WebSocket
 */
export function useAlertWebSocket(options: UseAlertWebSocketOptions): UseAlertWebSocketReturn {
	const { client } = useAuditContext()
	const queryClient = useQueryClient()
	const serviceRef = useRef<AlertWebSocketService | null>(null)

	const [state, setState] = useState<WebSocketState>({
		status: ConnectionStatus.DISCONNECTED,
		isConnected: false,
		isConnecting: false,
		isReconnecting: false,
		hasError: false,
		reconnectAttempts: 0,
		lastError: null,
	})

	// Build WebSocket URL from environment or default
	const baseUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000'
	const wsUrl = baseUrl.replace(/^http/, 'ws') + '/api/v1/alerts/ws'

	// Initialize WebSocket service
	useEffect(() => {
		if (!options.enabled || !client) {
			return
		}

		const config: AlertWebSocketConfig = {
			url: wsUrl,
			organizationId: options.organizationId,
			reconnectAttempts: 5,
			reconnectDelay: 1000,
			heartbeatInterval: 30000,
			connectionTimeout: 10000,
			enableLogging: process.env.NODE_ENV === 'development',
		}

		// Initialize the service
		AlertWebSocketManager.initialize(config)
		serviceRef.current = AlertWebSocketManager.getInstance()

		if (!serviceRef.current) {
			return
		}

		// Set up event handlers
		const handlers: AlertWebSocketEventHandlers = {
			onAlertCreated: (alert) => {
				// Update query cache with new alert
				queryClient.setQueryData(alertQueryKeys.detail(alert.id), alert)

				// Invalidate alert lists to show the new alert
				queryClient.invalidateQueries({ queryKey: alertQueryKeys.lists() })
				queryClient.invalidateQueries({
					queryKey: alertQueryKeys.statistics(alert.organizationId),
				})

				// Call user handler
				options.onAlertCreated?.(alert)
			},

			onAlertUpdated: (alert) => {
				// Update the specific alert in cache
				queryClient.setQueryData(alertQueryKeys.detail(alert.id), alert)

				// Update alert in list queries
				queryClient.setQueriesData({ queryKey: alertQueryKeys.lists() }, (oldData: any) => {
					if (!oldData?.alerts) return oldData

					return {
						...oldData,
						alerts: oldData.alerts.map((a: AlertUI) => (a.id === alert.id ? alert : a)),
					}
				})

				// Invalidate statistics
				queryClient.invalidateQueries({
					queryKey: alertQueryKeys.statistics(alert.organizationId),
				})

				// Call user handler
				options.onAlertUpdated?.(alert)
			},

			onAlertDeleted: (alertId) => {
				// Remove alert from cache
				queryClient.removeQueries({ queryKey: alertQueryKeys.detail(alertId) })

				// Remove from list queries
				queryClient.setQueriesData({ queryKey: alertQueryKeys.lists() }, (oldData: any) => {
					if (!oldData?.alerts) return oldData

					return {
						...oldData,
						alerts: oldData.alerts.filter((a: AlertUI) => a.id !== alertId),
						pagination: {
							...oldData.pagination,
							total: Math.max(0, oldData.pagination.total - 1),
						},
					}
				})

				// Invalidate statistics
				queryClient.invalidateQueries({ queryKey: alertQueryKeys.all })

				// Call user handler
				options.onAlertDeleted?.(alertId)
			},

			onBulkActionCompleted: (payload) => {
				// Invalidate all alert-related queries after bulk action
				queryClient.invalidateQueries({ queryKey: alertQueryKeys.all })

				// Remove affected alerts from detail cache
				payload.alertIds.forEach((alertId) => {
					queryClient.removeQueries({ queryKey: alertQueryKeys.detail(alertId) })
				})

				// Call user handler
				options.onBulkActionCompleted?.(payload)
			},

			onConnectionStatusChange: (status) => {
				setState((prev) => ({
					...prev,
					status,
					isConnected: status === ConnectionStatus.CONNECTED,
					isConnecting: status === ConnectionStatus.CONNECTING,
					isReconnecting: status === ConnectionStatus.RECONNECTING,
					hasError: status === ConnectionStatus.ERROR,
					lastError: status === ConnectionStatus.ERROR ? prev.lastError : null,
				}))

				// Call user handler
				options.onConnectionChange?.(status)
			},

			onError: (error) => {
				setState((prev) => ({
					...prev,
					hasError: true,
					lastError: error,
				}))

				// Call user handler
				options.onError?.(error)
			},

			onReconnect: () => {
				// Invalidate all queries on reconnect to refresh data
				queryClient.invalidateQueries({ queryKey: alertQueryKeys.all })
			},
		}

		serviceRef.current.on(handlers)

		// Auto-connect if enabled
		if (options.autoConnect) {
			serviceRef.current.connect().catch((error) => {
				console.error('Failed to auto-connect WebSocket:', error)
			})
		}

		// Cleanup on unmount
		return () => {
			if (serviceRef.current) {
				serviceRef.current.disconnect()
			}
			AlertWebSocketManager.cleanup()
		}
	}, [options.enabled, options.organizationId, options.autoConnect, client, wsUrl, queryClient])

	// Update reconnect attempts from service stats
	useEffect(() => {
		if (serviceRef.current && state.status !== ConnectionStatus.DISCONNECTED) {
			const interval = setInterval(() => {
				const stats = serviceRef.current?.getConnectionStats()
				if (stats && stats.reconnectAttempts !== state.reconnectAttempts) {
					setState((prev) => ({
						...prev,
						reconnectAttempts: stats.reconnectAttempts,
					}))
				}
			}, 1000)

			return () => clearInterval(interval)
		}
	}, [state.status, state.reconnectAttempts])

	// Connection methods
	const connect = async (): Promise<void> => {
		if (!serviceRef.current) {
			throw new Error('WebSocket service not initialized')
		}
		await serviceRef.current.connect()
	}

	const disconnect = (): void => {
		if (serviceRef.current) {
			serviceRef.current.disconnect()
		}
	}

	const send = (message: any): void => {
		if (serviceRef.current) {
			serviceRef.current.send(message)
		}
	}

	const stats = serviceRef.current?.getConnectionStats() || null

	return {
		...state,
		connect,
		disconnect,
		send,
		stats,
	}
}

/**
 * Hook for simplified WebSocket connection with automatic setup
 */
export function useAlertRealTimeUpdates(
	organizationId: string,
	options: {
		enabled?: boolean
		onNewAlert?: (alert: AlertUI) => void
		onAlertChange?: (alert: AlertUI) => void
	} = {}
) {
	const [newAlertsCount, setNewAlertsCount] = useState(0)
	const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

	const websocket = useAlertWebSocket({
		enabled: options.enabled ?? true,
		autoConnect: true,
		organizationId,
		onAlertCreated: (alert) => {
			setNewAlertsCount((prev) => prev + 1)
			setLastUpdate(new Date())
			options.onNewAlert?.(alert)
		},
		onAlertUpdated: (alert) => {
			setLastUpdate(new Date())
			options.onAlertChange?.(alert)
		},
		onAlertDeleted: () => {
			setLastUpdate(new Date())
		},
	})

	const clearNewAlertsCount = () => {
		setNewAlertsCount(0)
	}

	return {
		...websocket,
		newAlertsCount,
		lastUpdate,
		clearNewAlertsCount,
	}
}

/**
 * Hook for WebSocket connection status indicator
 */
export function useAlertConnectionStatus() {
	const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED)
	const [lastConnected, setLastConnected] = useState<Date | null>(null)
	const [lastError, setLastError] = useState<Error | null>(null)

	// This would typically get the status from a global WebSocket manager
	// For now, we'll return a basic implementation
	useEffect(() => {
		const service = AlertWebSocketManager.getInstance()
		if (service) {
			const currentStatus = service.getConnectionStatus()
			setStatus(currentStatus)

			if (currentStatus === ConnectionStatus.CONNECTED) {
				setLastConnected(new Date())
				setLastError(null)
			}
		}
	}, [])

	return {
		status,
		isConnected: status === ConnectionStatus.CONNECTED,
		isConnecting: status === ConnectionStatus.CONNECTING,
		isReconnecting: status === ConnectionStatus.RECONNECTING,
		hasError: status === ConnectionStatus.ERROR,
		lastConnected,
		lastError,
	}
}
