/**
 * Alert WebSocket Service
 *
 * Implements WebSocket connection for real-time alert updates with connection
 * status monitoring, reconnection logic, and update handlers for alert
 * creation, modification, and deletion.
 *
 * Requirements: 2.1, 2.2, 5.2
 */

import type { AlertUI } from '@/components/alerts/types/alert-types'

/**
 * WebSocket message types for alert updates
 */
export interface AlertWebSocketMessage {
	type:
		| 'alert_created'
		| 'alert_updated'
		| 'alert_deleted'
		| 'bulk_action_completed'
		| 'ping'
		| 'pong'
	payload?: AlertUI | AlertBulkUpdatePayload | PingPayload
	timestamp: string
	organizationId: string
	correlationId?: string
}

/**
 * Bulk update payload for multiple alert changes
 */
export interface AlertBulkUpdatePayload {
	alertIds: string[]
	action: 'acknowledge' | 'resolve' | 'dismiss'
	affectedCount: number
	userId: string
}

/**
 * Ping/Pong payload for connection health
 */
export interface PingPayload {
	timestamp: string
	clientId: string
}

/**
 * Connection status enum
 */
export enum ConnectionStatus {
	DISCONNECTED = 'disconnected',
	CONNECTING = 'connecting',
	CONNECTED = 'connected',
	RECONNECTING = 'reconnecting',
	ERROR = 'error',
}

/**
 * WebSocket configuration options
 */
export interface AlertWebSocketConfig {
	url: string
	organizationId: string
	reconnectAttempts?: number
	reconnectDelay?: number
	heartbeatInterval?: number
	connectionTimeout?: number
	enableLogging?: boolean
}

/**
 * Event handlers for WebSocket events
 */
export interface AlertWebSocketEventHandlers {
	onAlertCreated?: (alert: AlertUI) => void
	onAlertUpdated?: (alert: AlertUI) => void
	onAlertDeleted?: (alertId: string) => void
	onBulkActionCompleted?: (payload: AlertBulkUpdatePayload) => void
	onConnectionStatusChange?: (status: ConnectionStatus) => void
	onError?: (error: Error) => void
	onReconnect?: () => void
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
	reconnectAttempts: 5,
	reconnectDelay: 1000,
	heartbeatInterval: 30000, // 30 seconds
	connectionTimeout: 10000, // 10 seconds
	enableLogging: process.env.NODE_ENV === 'development',
}

/**
 * Alert WebSocket Service
 *
 * Manages real-time WebSocket connection for alert updates with automatic
 * reconnection, heartbeat monitoring, and event handling.
 */
export class AlertWebSocketService {
	private ws: WebSocket | null = null
	private config: Required<AlertWebSocketConfig>
	private handlers: AlertWebSocketEventHandlers = {}
	private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED
	private reconnectAttempts = 0
	private heartbeatTimer: NodeJS.Timeout | null = null
	private connectionTimer: NodeJS.Timeout | null = null
	private lastPingTime = 0
	private clientId: string

	constructor(config: AlertWebSocketConfig) {
		this.config = { ...DEFAULT_CONFIG, ...config }
		this.clientId = `alert-client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
	}

	/**
	 * Connect to the WebSocket server
	 */
	async connect(): Promise<void> {
		if (
			this.connectionStatus === ConnectionStatus.CONNECTED ||
			this.connectionStatus === ConnectionStatus.CONNECTING
		) {
			return
		}

		this.setConnectionStatus(ConnectionStatus.CONNECTING)
		this.log('Connecting to WebSocket...', { url: this.config.url })

		try {
			await this.createWebSocketConnection()
		} catch (error) {
			this.handleConnectionError(error as Error)
			throw error
		}
	}

	/**
	 * Disconnect from the WebSocket server
	 */
	disconnect(): void {
		this.log('Disconnecting from WebSocket...')

		this.clearTimers()

		if (this.ws) {
			this.ws.close(1000, 'Client disconnect')
			this.ws = null
		}

		this.setConnectionStatus(ConnectionStatus.DISCONNECTED)
		this.reconnectAttempts = 0
	}

	/**
	 * Register event handlers
	 */
	on(handlers: AlertWebSocketEventHandlers): void {
		this.handlers = { ...this.handlers, ...handlers }
	}

	/**
	 * Remove event handlers
	 */
	off(handlerKeys: (keyof AlertWebSocketEventHandlers)[]): void {
		handlerKeys.forEach((key) => {
			delete this.handlers[key]
		})
	}

	/**
	 * Get current connection status
	 */
	getConnectionStatus(): ConnectionStatus {
		return this.connectionStatus
	}

	/**
	 * Get connection statistics
	 */
	getConnectionStats(): {
		status: ConnectionStatus
		reconnectAttempts: number
		lastPingTime: number
		clientId: string
		uptime: number
	} {
		return {
			status: this.connectionStatus,
			reconnectAttempts: this.reconnectAttempts,
			lastPingTime: this.lastPingTime,
			clientId: this.clientId,
			uptime:
				this.connectionStatus === ConnectionStatus.CONNECTED ? Date.now() - this.lastPingTime : 0,
		}
	}

	/**
	 * Send a message to the server (for testing or custom messages)
	 */
	send(message: Partial<AlertWebSocketMessage>): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			const fullMessage: AlertWebSocketMessage = {
				type: message.type || 'ping',
				payload: message.payload,
				timestamp: new Date().toISOString(),
				organizationId: this.config.organizationId,
				correlationId: message.correlationId,
			}

			this.ws.send(JSON.stringify(fullMessage))
			this.log('Sent message', fullMessage)
		} else {
			this.log('Cannot send message - WebSocket not connected')
		}
	}

	/**
	 * Create WebSocket connection with proper event handlers
	 */
	private async createWebSocketConnection(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				// Build WebSocket URL with query parameters
				const wsUrl = new URL(this.config.url)
				wsUrl.searchParams.set('organizationId', this.config.organizationId)
				wsUrl.searchParams.set('clientId', this.clientId)

				this.ws = new WebSocket(wsUrl.toString())

				// Set connection timeout
				this.connectionTimer = setTimeout(() => {
					if (this.ws?.readyState === WebSocket.CONNECTING) {
						this.ws.close()
						reject(new Error('Connection timeout'))
					}
				}, this.config.connectionTimeout)

				this.ws.onopen = () => {
					this.clearTimers()
					this.setConnectionStatus(ConnectionStatus.CONNECTED)
					this.reconnectAttempts = 0
					this.startHeartbeat()
					this.log('WebSocket connected successfully')
					resolve()
				}

				this.ws.onmessage = (event) => {
					this.handleMessage(event)
				}

				this.ws.onclose = (event) => {
					this.handleClose(event)
				}

				this.ws.onerror = (event) => {
					this.handleError(event)
					reject(new Error('WebSocket connection failed'))
				}
			} catch (error) {
				reject(error)
			}
		})
	}

	/**
	 * Handle incoming WebSocket messages
	 */
	private handleMessage(event: MessageEvent): void {
		try {
			const message: AlertWebSocketMessage = JSON.parse(event.data)
			this.log('Received message', message)

			// Update last ping time for connection health
			this.lastPingTime = Date.now()

			switch (message.type) {
				case 'alert_created':
					if (message.payload && this.handlers.onAlertCreated) {
						this.handlers.onAlertCreated(message.payload as AlertUI)
					}
					break

				case 'alert_updated':
					if (message.payload && this.handlers.onAlertUpdated) {
						this.handlers.onAlertUpdated(message.payload as AlertUI)
					}
					break

				case 'alert_deleted':
					if (message.payload && this.handlers.onAlertDeleted) {
						// For delete events, payload might just be the alert ID
						const alertId =
							typeof message.payload === 'string'
								? message.payload
								: (message.payload as AlertUI).id
						this.handlers.onAlertDeleted(alertId)
					}
					break

				case 'bulk_action_completed':
					if (message.payload && this.handlers.onBulkActionCompleted) {
						this.handlers.onBulkActionCompleted(message.payload as AlertBulkUpdatePayload)
					}
					break

				case 'ping':
					// Respond to server ping with pong
					this.send({
						type: 'pong',
						payload: {
							timestamp: new Date().toISOString(),
							clientId: this.clientId,
						} as PingPayload,
					})
					break

				case 'pong':
					// Server responded to our ping
					this.log('Received pong from server')
					break

				default:
					this.log('Unknown message type', message.type)
			}
		} catch (error) {
			this.log('Error parsing WebSocket message', error)
			this.handleError(error as Error)
		}
	}

	/**
	 * Handle WebSocket close event
	 */
	private handleClose(event: CloseEvent): void {
		this.log('WebSocket closed', { code: event.code, reason: event.reason })

		this.clearTimers()
		this.ws = null

		// Don't reconnect if it was a normal close
		if (event.code === 1000) {
			this.setConnectionStatus(ConnectionStatus.DISCONNECTED)
			return
		}

		// Attempt reconnection for abnormal closes
		this.attemptReconnection()
	}

	/**
	 * Handle WebSocket error event
	 */
	private handleError(error: Event | Error): void {
		const errorMessage = error instanceof Error ? error.message : 'WebSocket error'
		this.log('WebSocket error', errorMessage)

		this.setConnectionStatus(ConnectionStatus.ERROR)

		if (this.handlers.onError) {
			this.handlers.onError(error instanceof Error ? error : new Error(errorMessage))
		}
	}

	/**
	 * Handle connection errors during initial connection
	 */
	private handleConnectionError(error: Error): void {
		this.log('Connection error', error.message)
		this.setConnectionStatus(ConnectionStatus.ERROR)

		if (this.handlers.onError) {
			this.handlers.onError(error)
		}
	}

	/**
	 * Attempt to reconnect with exponential backoff
	 */
	private attemptReconnection(): void {
		if (this.reconnectAttempts >= this.config.reconnectAttempts) {
			this.log('Max reconnection attempts reached')
			this.setConnectionStatus(ConnectionStatus.ERROR)
			return
		}

		this.reconnectAttempts++
		this.setConnectionStatus(ConnectionStatus.RECONNECTING)

		const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
		this.log(
			`Attempting reconnection ${this.reconnectAttempts}/${this.config.reconnectAttempts} in ${delay}ms`
		)

		setTimeout(async () => {
			try {
				await this.createWebSocketConnection()
				this.log('Reconnection successful')

				if (this.handlers.onReconnect) {
					this.handlers.onReconnect()
				}
			} catch (error) {
				this.log('Reconnection failed', error)
				this.attemptReconnection()
			}
		}, delay)
	}

	/**
	 * Start heartbeat to keep connection alive
	 */
	private startHeartbeat(): void {
		this.heartbeatTimer = setInterval(() => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				this.send({
					type: 'ping',
					payload: {
						timestamp: new Date().toISOString(),
						clientId: this.clientId,
					} as PingPayload,
				})
			}
		}, this.config.heartbeatInterval)
	}

	/**
	 * Clear all timers
	 */
	private clearTimers(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer)
			this.heartbeatTimer = null
		}

		if (this.connectionTimer) {
			clearTimeout(this.connectionTimer)
			this.connectionTimer = null
		}
	}

	/**
	 * Set connection status and notify handlers
	 */
	private setConnectionStatus(status: ConnectionStatus): void {
		if (this.connectionStatus !== status) {
			this.connectionStatus = status
			this.log('Connection status changed', status)

			if (this.handlers.onConnectionStatusChange) {
				this.handlers.onConnectionStatusChange(status)
			}
		}
	}

	/**
	 * Log messages if logging is enabled
	 */
	private log(message: string, data?: any): void {
		if (this.config.enableLogging) {
			console.log(`[AlertWebSocket] ${message}`, data || '')
		}
	}
}

/**
 * Factory function to create AlertWebSocketService instance
 */
export function createAlertWebSocketService(config: AlertWebSocketConfig): AlertWebSocketService {
	return new AlertWebSocketService(config)
}

/**
 * Hook-friendly WebSocket service manager
 */
export class AlertWebSocketManager {
	private static instance: AlertWebSocketService | null = null
	private static config: AlertWebSocketConfig | null = null

	/**
	 * Initialize the WebSocket service
	 */
	static initialize(config: AlertWebSocketConfig): void {
		if (this.instance) {
			this.instance.disconnect()
		}

		this.config = config
		this.instance = new AlertWebSocketService(config)
	}

	/**
	 * Get the current WebSocket service instance
	 */
	static getInstance(): AlertWebSocketService | null {
		return this.instance
	}

	/**
	 * Connect to WebSocket if not already connected
	 */
	static async connect(): Promise<void> {
		if (!this.instance || !this.config) {
			throw new Error('AlertWebSocketManager not initialized')
		}

		await this.instance.connect()
	}

	/**
	 * Disconnect from WebSocket
	 */
	static disconnect(): void {
		if (this.instance) {
			this.instance.disconnect()
		}
	}

	/**
	 * Clean up the service instance
	 */
	static cleanup(): void {
		if (this.instance) {
			this.instance.disconnect()
			this.instance = null
		}
		this.config = null
	}
}
