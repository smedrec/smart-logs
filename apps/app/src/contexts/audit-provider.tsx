import { AuditClient, AuditClientError } from '@smedrec/audit-client'
import React, { createContext, useContext, useEffect, useState } from 'react'

import type { AuditClientConfig, PartialAuditClientConfig } from '@smedrec/audit-client'
import type { ReactNode } from 'react'

interface AuditContextValue {
	client: AuditClient | null
	isConnected: boolean
	error: string | null
	reconnect: () => Promise<void>
}

const AuditContext = createContext<AuditContextValue | undefined>(undefined)

interface AuditProviderProps {
	children: ReactNode
	config?: Partial<AuditClientConfig>
}

export function AuditProvider({ children, config }: AuditProviderProps) {
	const [client, setClient] = useState<AuditClient | null>(null)
	const [isConnected, setIsConnected] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const defaultConfig: PartialAuditClientConfig = {
		baseUrl: import.meta.env.VITE_SERVER_URL || 'http://localhost:3000',
		apiVersion: 'v1',
		timeout: 30000,
		authentication: {
			// Use cookie authentication for Better Auth compatibility
			type: 'cookie',
			includeBrowserCookies: true,
			// Fallback to API key if VITE_USE_API_KEY is set
			...(import.meta.env.VITE_USE_API_KEY && {
				type: 'apiKey' as const,
				apiKey: import.meta.env.VITE_API_KEY || 'test-api-key',
			}),
			autoRefresh: false,
		},
		retry: {
			enabled: false,
			maxAttempts: 3,
			initialDelayMs: 1000,
			maxDelayMs: 10000,
			backoffMultiplier: 2,
			retryableStatusCodes: [408, 429, 500, 502, 503, 504],
			retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR'],
		},
		cache: {
			enabled: false,
			defaultTtlMs: 300000, // 5 minutes
			maxSize: 100,
			storage: 'localStorage',
			keyPrefix: 'audit-cache',
			compressionEnabled: false,
		},
		batching: {
			enabled: true,
			maxBatchSize: 10,
			batchTimeoutMs: 1000,
			batchableEndpoints: ['/audit/events'],
		},
		performance: {
			enableCompression: true,
			enableStreaming: true,
			maxConcurrentRequests: 5,
			requestDeduplication: true,
			responseTransformation: true,
		},
		logging: {
			enabled: process.env.NODE_ENV === 'development',
			level: 'info',
			includeRequestBody: false,
			includeResponseBody: false,
			maskSensitiveData: true,
		},
		errorHandling: {
			throwOnError: true,
			includeStackTrace: true, //process.env.NODE_ENV === 'development',
			//errorTransformation: true,
		},
		environment: process.env.NODE_ENV as 'development' | 'production',
		...config,
	}

	const initializeClient = async () => {
		try {
			setError(null)
			const auditClient = new AuditClient(defaultConfig)

			// Test connection
			//await auditClient.health.check()

			setClient(auditClient)
			setIsConnected(true)
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

	useEffect(() => {
		initializeClient()
	}, [])

	// Handle client errors globally
	useEffect(() => {
		if (!client) return

		const handleError = (error: AuditClientError) => {
			console.error('Audit client error:', error)
			if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
				setError('Authentication failed. Please check your API key.')
				setIsConnected(false)
			}
		}

		// Note: In a real implementation, you'd set up error event listeners
		// client.on('error', handleError)

		return () => {
			// client.off('error', handleError)
		}
	}, [client])

	const contextValue: AuditContextValue = {
		client,
		isConnected,
		error,
		reconnect,
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

// Error Boundary for audit operations
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
	}

	render() {
		if (this.state.hasError) {
			return (
				this.props.fallback || (
					<div className="audit-error-boundary">
						<h2>Audit System Error</h2>
						<p>Something went wrong with the audit system.</p>
						<details>
							<summary>Error Details</summary>
							<pre>{this.state.error?.message}</pre>
						</details>
						<button onClick={() => this.setState({ hasError: false, error: null })}>
							Try Again
						</button>
					</div>
				)
			)
		}

		return this.props.children
	}
}
