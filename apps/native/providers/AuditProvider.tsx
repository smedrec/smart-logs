import NetInfo from '@react-native-community/netinfo'
import { AuditClient, AuditClientConfig, AuditClientError } from '@smedrec/audit-client'
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import DeviceInfo from 'react-native-device-info'

import { AuditStorage } from '../storage/auditStorage'
import { getDeviceInfo } from '../utils/deviceInfo'

interface AuditContextValue {
	client: AuditClient | null
	isConnected: boolean
	isOnline: boolean
	error: string | null
	queuedEvents: number
	reconnect: () => Promise<void>
	syncOfflineEvents: () => Promise<void>
}

const AuditContext = createContext<AuditContextValue | undefined>(undefined)

interface AuditProviderProps {
	children: ReactNode
	config?: Partial<AuditClientConfig>
}

export function AuditProvider({ children, config }: AuditProviderProps) {
	const [client, setClient] = useState<AuditClient | null>(null)
	const [isConnected, setIsConnected] = useState(false)
	const [isOnline, setIsOnline] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [queuedEvents, setQueuedEvents] = useState(0)
	const [auditStorage] = useState(() => new AuditStorage())

	const defaultConfig: AuditClientConfig = {
		baseUrl: __DEV__ ? 'http://localhost:3001' : 'https://api.example.com',
		apiVersion: 'v1',
		timeout: 30000,
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key-here', // In real app, get from secure storage
			autoRefresh: true,
		},
		retry: {
			enabled: true,
			maxAttempts: 3,
			initialDelayMs: 1000,
			maxDelayMs: 10000,
			backoffMultiplier: 2,
			retryableStatusCodes: [408, 429, 500, 502, 503, 504],
			retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR'],
		},
		cache: {
			enabled: true,
			defaultTtlMs: 300000, // 5 minutes
			maxSize: 50, // Smaller cache for mobile
			storage: 'custom', // Use AsyncStorage
			keyPrefix: 'audit-cache-rn',
			compressionEnabled: true, // Enable compression for mobile
		},
		batching: {
			enabled: true,
			maxBatchSize: 20, // Larger batches for mobile efficiency
			batchTimeoutMs: 5000, // Longer timeout for battery optimization
			batchableEndpoints: ['/audit/events'],
		},
		performance: {
			enableCompression: true,
			enableStreaming: false, // Disable streaming on mobile
			maxConcurrentRequests: 3, // Limit concurrent requests
			requestDeduplication: true,
			responseTransformation: true,
		},
		logging: {
			enabled: __DEV__,
			level: 'info',
			includeRequestBody: false,
			includeResponseBody: false,
			maskSensitiveData: true,
		},
		errorHandling: {
			throwOnError: false,
			includeStackTrace: __DEV__,
			errorTransformation: true,
		},
		environment: __DEV__ ? 'development' : 'production',
		...config,
	}

	const initializeClient = async () => {
		try {
			setError(null)

			// Get device information
			const deviceInfo = await getDeviceInfo()

			// Create client with device-specific headers
			const clientConfig = {
				...defaultConfig,
				customHeaders: {
					'X-Device-ID': deviceInfo.deviceId,
					'X-Device-Type': deviceInfo.deviceType,
					'X-App-Version': deviceInfo.appVersion,
					'X-OS-Version': deviceInfo.osVersion,
					...defaultConfig.customHeaders,
				},
			}

			const auditClient = new AuditClient(clientConfig)

			// Test connection if online
			if (isOnline) {
				await auditClient.health.check()
			}

			setClient(auditClient)
			setIsConnected(true)

			// Log app start event
			await logAppEvent('app.start', {
				deviceInfo,
				isOnline,
			})
		} catch (err) {
			const errorMessage =
				err instanceof AuditClientError ? err.message : 'Failed to initialize audit client'
			setError(errorMessage)
			setIsConnected(false)
			console.error('Audit client initialization failed:', err)
		}
	}

	const reconnect = async () => {
		setIsConnected(false)
		await initializeClient()
	}

	const syncOfflineEvents = async () => {
		if (!client || !isOnline) return

		try {
			const offlineEvents = await auditStorage.getQueuedEvents()
			if (offlineEvents.length === 0) return

			console.log(`Syncing ${offlineEvents.length} offline events`)

			// Send events in batches
			const batchSize = 10
			for (let i = 0; i < offlineEvents.length; i += batchSize) {
				const batch = offlineEvents.slice(i, i + batchSize)

				try {
					await client.events.bulkCreate(batch.map((e) => e.eventData))

					// Remove successfully synced events
					await Promise.all(batch.map((e) => auditStorage.removeQueuedEvent(e.id)))
				} catch (error) {
					console.error('Failed to sync batch:', error)
					// Keep events in queue for next sync attempt
				}
			}

			// Update queued events count
			const remainingEvents = await auditStorage.getQueuedEvents()
			setQueuedEvents(remainingEvents.length)
		} catch (error) {
			console.error('Failed to sync offline events:', error)
		}
	}

	const logAppEvent = async (action: string, details?: Record<string, any>) => {
		if (!client) return

		const eventData = {
			action,
			targetResourceType: 'mobile_app',
			targetResourceId: await DeviceInfo.getBundleId(),
			principalId: 'mobile-user', // Replace with actual user ID
			organizationId: 'mobile-org', // Replace with actual org ID
			status: 'success' as const,
			dataClassification: 'INTERNAL' as const,
			details,
		}

		try {
			if (isOnline) {
				await client.events.create(eventData)
			} else {
				// Queue for offline sync
				await auditStorage.queueEvent(eventData)
				const queuedCount = await auditStorage.getQueuedEventsCount()
				setQueuedEvents(queuedCount)
			}
		} catch (error) {
			console.error('Failed to log app event:', error)

			// Fallback to offline queue
			await auditStorage.queueEvent(eventData)
			const queuedCount = await auditStorage.getQueuedEventsCount()
			setQueuedEvents(queuedCount)
		}
	}

	// Network state monitoring
	useEffect(() => {
		const unsubscribe = NetInfo.addEventListener((state) => {
			const wasOnline = isOnline
			const nowOnline = state.isConnected ?? false

			setIsOnline(nowOnline)

			// If we just came online, sync offline events
			if (!wasOnline && nowOnline && client) {
				syncOfflineEvents()
			}

			// Log network state change
			logAppEvent('network.state_change', {
				isConnected: nowOnline,
				connectionType: state.type,
				isInternetReachable: state.isInternetReachable,
			})
		})

		return unsubscribe
	}, [isOnline, client])

	// App state monitoring
	useEffect(() => {
		const handleAppStateChange = (nextAppState: AppStateStatus) => {
			logAppEvent('app.state_change', {
				state: nextAppState,
				timestamp: new Date().toISOString(),
			})

			// Sync events when app becomes active
			if (nextAppState === 'active' && isOnline && client) {
				syncOfflineEvents()
			}
		}

		const subscription = AppState.addEventListener('change', handleAppStateChange)

		return () => subscription?.remove()
	}, [client, isOnline])

	// Initialize client on mount
	useEffect(() => {
		initializeClient()

		// Load queued events count
		auditStorage.getQueuedEventsCount().then(setQueuedEvents)
	}, [])

	// Periodic sync when online
	useEffect(() => {
		if (!isOnline || !client) return

		const interval = setInterval(() => {
			syncOfflineEvents()
		}, 60000) // Sync every minute when online

		return () => clearInterval(interval)
	}, [isOnline, client])

	const contextValue: AuditContextValue = {
		client,
		isConnected,
		isOnline,
		error,
		queuedEvents,
		reconnect,
		syncOfflineEvents,
	}

	return <AuditContext.Provider value={contextValue}>{children}</AuditContext.Provider>
}

export function useAuditContext(): AuditContextValue {
	const context = useContext(AuditContext)
	if (context === undefined) {
		throw new Error('useAuditContext must be used within an AuditProvider')
	}
	return context
}

// Error Boundary for React Native
interface AuditErrorBoundaryState {
	hasError: boolean
	error: Error | null
}

export class AuditErrorBoundary extends React.Component<
	{ children: ReactNode; fallback?: ReactNode },
	AuditErrorBoundaryState
> {
	constructor(props: { children: ReactNode; fallback?: ReactNode }) {
		super(props)
		this.state = { hasError: false, error: null }
	}

	static getDerivedStateFromError(error: Error): AuditErrorBoundaryState {
		return { hasError: true, error }
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		console.error('Audit Error Boundary caught an error:', error, errorInfo)

		// Log error to audit system if possible
		// This would need to be implemented carefully to avoid infinite loops
	}

	render() {
		if (this.state.hasError) {
			return (
				this.props.fallback || (
					<div style={{ padding: 20, textAlign: 'center' }}>
						<h2>Audit System Error</h2>
						<p>Something went wrong with the audit system.</p>
					</div>
				)
			)
		}

		return this.props.children
	}
}
