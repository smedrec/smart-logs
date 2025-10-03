# API Integration Guide

## Overview

The Alert Management System integrates with multiple API layers to provide comprehensive alert functionality. This guide covers integration patterns, error handling strategies, and best practices for working with the alert APIs.

## API Architecture

### Integration Layers

```
┌─────────────────────────────────────────────────────────┐
│                Alert Management UI                       │
├─────────────────────────────────────────────────────────┤
│                   API Service Layer                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Audit     │  │  WebSocket  │  │   Client        │  │
│  │   Client    │  │   Service   │  │   Package       │  │
│  │             │  │             │  │                 │  │
│  │ • REST APIs │  │ • Real-time │  │ • Utilities     │  │
│  │ • Auth      │  │ • Updates   │  │ • Helpers       │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                    Backend Services                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Server    │  │  Database   │  │   External      │  │
│  │    APIs     │  │             │  │   Services      │  │
│  │             │  │ • Postgres  │  │                 │  │
│  │ • Hono      │  │ • Redis     │  │ • Monitoring    │  │
│  │ • Express   │  │ • Cache     │  │ • Logging       │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Audit Client Integration

### Service Configuration

The alert system uses the existing Audit Client for API communication:

```typescript
// src/lib/audit-client.ts
import { AuditClient } from '@smedrec/audit-client'

export const auditClient = new AuditClient({
	baseUrl: process.env.VITE_API_BASE_URL,
	apiKey: process.env.VITE_API_KEY,
	timeout: 30000,
	retries: 3,
})

// Alert-specific service methods
export class AlertService {
	constructor(private client: AuditClient) {}

	async getAlerts(filters?: AlertFilters): Promise<AlertResponse> {
		return this.client.get('/alerts', { params: filters })
	}

	async acknowledgeAlert(alertId: string): Promise<Alert> {
		return this.client.patch(`/alerts/${alertId}/acknowledge`)
	}

	async resolveAlert(alertId: string, notes: string): Promise<Alert> {
		return this.client.patch(`/alerts/${alertId}/resolve`, { notes })
	}

	async dismissAlert(alertId: string): Promise<void> {
		return this.client.delete(`/alerts/${alertId}`)
	}
}
```

### Authentication Integration

The alert system leverages existing authentication:

```typescript
// src/hooks/use-alert-queries.ts
import { useAuth } from '@/contexts/auth-context'
import { auditClient } from '@/lib/audit-client'

export function useAlertQueries() {
	const { token, user } = useAuth()

	// Configure client with current auth token
	useEffect(() => {
		if (token) {
			auditClient.setAuthToken(token)
		}
	}, [token])

	const alertsQuery = useQuery({
		queryKey: ['alerts', user?.id],
		queryFn: () => auditClient.alerts.getAlerts(),
		enabled: !!token && !!user,
		retry: (failureCount, error) => {
			// Don't retry on auth errors
			if (error.status === 401 || error.status === 403) {
				return false
			}
			return failureCount < 3
		},
	})

	return { alertsQuery }
}
```

## API Endpoints

### Alert Management Endpoints

```typescript
// GET /api/alerts - Retrieve alerts with filtering
interface GetAlertsRequest {
	severity?: AlertSeverity[]
	status?: AlertStatus[]
	type?: AlertType[]
	source?: string[]
	dateRange?: {
		start: string // ISO date
		end: string // ISO date
	}
	search?: string
	tags?: string[]
	page?: number
	pageSize?: number
	sortBy?: 'timestamp' | 'severity' | 'status'
	sortOrder?: 'asc' | 'desc'
}

interface GetAlertsResponse {
	alerts: Alert[]
	pagination: {
		page: number
		pageSize: number
		total: number
		totalPages: number
	}
	filters: {
		availableSeverities: AlertSeverity[]
		availableTypes: AlertType[]
		availableSources: string[]
		availableTags: string[]
	}
}

// GET /api/alerts/:id - Get specific alert
interface GetAlertResponse {
	alert: Alert
	history: AlertHistoryEntry[]
	relatedAlerts: Alert[]
}

// PATCH /api/alerts/:id/acknowledge - Acknowledge alert
interface AcknowledgeAlertRequest {
	notes?: string
}

// PATCH /api/alerts/:id/resolve - Resolve alert
interface ResolveAlertRequest {
	notes: string
	resolution?: string
}

// DELETE /api/alerts/:id - Dismiss alert
// No request body required

// POST /api/alerts/bulk-action - Bulk operations
interface BulkActionRequest {
	alertIds: string[]
	action: 'acknowledge' | 'resolve' | 'dismiss'
	notes?: string
}
```

### Statistics and Metrics Endpoints

```typescript
// GET /api/alerts/statistics - Alert statistics
interface GetStatisticsResponse {
	summary: {
		total: number
		active: number
		acknowledged: number
		resolved: number
		dismissed: number
	}
	bySeverity: Record<AlertSeverity, number>
	byType: Record<AlertType, number>
	bySource: Record<string, number>
	trends: {
		daily: Array<{ date: string; count: number }>
		weekly: Array<{ week: string; count: number }>
		monthly: Array<{ month: string; count: number }>
	}
}

// GET /api/alerts/metrics - Real-time metrics
interface GetMetricsResponse {
	currentLoad: number
	responseTime: number
	errorRate: number
	activeConnections: number
	lastUpdated: string
}
```

## Error Handling Strategies

### API Error Types

```typescript
export interface AlertApiError {
	type: 'network' | 'authentication' | 'authorization' | 'validation' | 'server' | 'unknown'
	message: string
	code?: string
	details?: Record<string, any>
	retryable: boolean
}

export function handleApiError(error: unknown): AlertApiError {
	// Network errors
	if (error instanceof TypeError && error.message.includes('fetch')) {
		return {
			type: 'network',
			message: 'Network connection failed. Please check your internet connection.',
			retryable: true,
		}
	}

	// HTTP errors
	if (error instanceof Response) {
		switch (error.status) {
			case 400:
				return {
					type: 'validation',
					message: 'Invalid request data. Please check your input.',
					retryable: false,
				}
			case 401:
				return {
					type: 'authentication',
					message: 'Authentication required. Please log in again.',
					retryable: false,
				}
			case 403:
				return {
					type: 'authorization',
					message: 'Access denied. You do not have permission for this action.',
					retryable: false,
				}
			case 404:
				return {
					type: 'validation',
					message: 'The requested alert was not found.',
					retryable: false,
				}
			case 429:
				return {
					type: 'server',
					message: 'Too many requests. Please wait before trying again.',
					retryable: true,
				}
			case 500:
			case 502:
			case 503:
				return {
					type: 'server',
					message: 'Server error occurred. Please try again later.',
					retryable: true,
				}
			default:
				return {
					type: 'unknown',
					message: `Unexpected error occurred (${error.status}).`,
					retryable: true,
				}
		}
	}

	// Unknown errors
	return {
		type: 'unknown',
		message: 'An unexpected error occurred. Please try again.',
		retryable: true,
	}
}
```

### Retry Logic Implementation

```typescript
export function useAlertMutations() {
	const queryClient = useQueryClient()

	const acknowledgeAlert = useMutation({
		mutationFn: async ({ alertId, notes }: { alertId: string; notes?: string }) => {
			return auditClient.alerts.acknowledgeAlert(alertId, notes)
		},
		retry: (failureCount, error) => {
			const apiError = handleApiError(error)
			return apiError.retryable && failureCount < 3
		},
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
		onSuccess: (updatedAlert) => {
			// Optimistically update the cache
			queryClient.setQueryData(['alerts'], (oldData: Alert[]) =>
				oldData?.map((alert) => (alert.id === updatedAlert.id ? updatedAlert : alert))
			)

			// Show success notification
			toast.success('Alert acknowledged successfully')
		},
		onError: (error) => {
			const apiError = handleApiError(error)
			toast.error(apiError.message)

			// Log error for monitoring
			logError('Alert acknowledgment failed', { error: apiError })
		},
	})

	return { acknowledgeAlert }
}
```

### Optimistic Updates

```typescript
export function useOptimisticAlertUpdates() {
	const queryClient = useQueryClient()

	const updateAlertOptimistically = useCallback(
		(alertId: string, updates: Partial<Alert>) => {
			const previousData = queryClient.getQueryData(['alerts'])

			// Optimistically update the cache
			queryClient.setQueryData(['alerts'], (oldData: Alert[]) =>
				oldData?.map((alert) => (alert.id === alertId ? { ...alert, ...updates } : alert))
			)

			return { previousData }
		},
		[queryClient]
	)

	const rollbackOptimisticUpdate = useCallback(
		(previousData: any) => {
			queryClient.setQueryData(['alerts'], previousData)
		},
		[queryClient]
	)

	return { updateAlertOptimistically, rollbackOptimisticUpdate }
}
```

## WebSocket Integration

### Real-time Updates

```typescript
// src/hooks/use-alert-websocket.ts
export function useAlertWebSocket() {
	const queryClient = useQueryClient()
	const { token } = useAuth()
	const [connectionStatus, setConnectionStatus] = useState<WebSocketStatus>('disconnected')

	useEffect(() => {
		if (!token) return

		const wsUrl = `${process.env.VITE_WS_URL}/alerts?token=${token}`
		const ws = new WebSocket(wsUrl)
		let reconnectTimeout: NodeJS.Timeout

		ws.onopen = () => {
			setConnectionStatus('connected')
			console.log('Alert WebSocket connected')
		}

		ws.onmessage = (event) => {
			try {
				const update: AlertWebSocketUpdate = JSON.parse(event.data)
				handleAlertUpdate(update, queryClient)
			} catch (error) {
				console.error('Failed to parse WebSocket message:', error)
			}
		}

		ws.onclose = (event) => {
			setConnectionStatus('disconnected')

			// Attempt to reconnect unless it was a clean close
			if (event.code !== 1000) {
				setConnectionStatus('reconnecting')
				reconnectTimeout = setTimeout(() => {
					// Trigger reconnection by re-running the effect
					setConnectionStatus('disconnected')
				}, 5000)
			}
		}

		ws.onerror = (error) => {
			console.error('Alert WebSocket error:', error)
			setConnectionStatus('error')
		}

		return () => {
			clearTimeout(reconnectTimeout)
			ws.close(1000) // Clean close
		}
	}, [token, queryClient])

	return { connectionStatus }
}

function handleAlertUpdate(update: AlertWebSocketUpdate, queryClient: QueryClient) {
	switch (update.type) {
		case 'alert_created':
			queryClient.setQueryData(['alerts'], (oldData: Alert[]) => [update.alert, ...(oldData || [])])

			// Show notification for new alerts
			if (update.alert.severity === 'critical' || update.alert.severity === 'high') {
				toast.error(`New ${update.alert.severity} alert: ${update.alert.title}`)
			}
			break

		case 'alert_updated':
			queryClient.setQueryData(['alerts'], (oldData: Alert[]) =>
				oldData?.map((alert) => (alert.id === update.alert.id ? update.alert : alert))
			)
			break

		case 'alert_deleted':
			queryClient.setQueryData(['alerts'], (oldData: Alert[]) =>
				oldData?.filter((alert) => alert.id !== update.alertId)
			)
			break

		case 'bulk_update':
			queryClient.setQueryData(['alerts'], (oldData: Alert[]) =>
				oldData?.map((alert) => {
					const updatedAlert = update.alerts.find((a) => a.id === alert.id)
					return updatedAlert || alert
				})
			)
			break
	}

	// Invalidate related queries
	queryClient.invalidateQueries(['alert-statistics'])
	queryClient.invalidateQueries(['alert-metrics'])
}
```

### WebSocket Message Types

```typescript
interface AlertWebSocketUpdate {
	type: 'alert_created' | 'alert_updated' | 'alert_deleted' | 'bulk_update'
	alert?: Alert
	alerts?: Alert[]
	alertId?: string
	timestamp: string
	userId?: string
}

interface WebSocketConnectionConfig {
	url: string
	token: string
	reconnectInterval: number
	maxReconnectAttempts: number
	heartbeatInterval: number
}
```

## Data Transformation

### API Response Transformation

```typescript
// Transform API responses to match UI expectations
export function transformAlertResponse(apiAlert: ApiAlert): Alert {
	return {
		id: apiAlert.id,
		title: apiAlert.title,
		description: apiAlert.description,
		severity: apiAlert.severity as AlertSeverity,
		type: apiAlert.type as AlertType,
		status: apiAlert.status as AlertStatus,
		source: apiAlert.source,
		timestamp: new Date(apiAlert.created_at),
		acknowledgedAt: apiAlert.acknowledged_at ? new Date(apiAlert.acknowledged_at) : undefined,
		acknowledgedBy: apiAlert.acknowledged_by,
		resolvedAt: apiAlert.resolved_at ? new Date(apiAlert.resolved_at) : undefined,
		resolvedBy: apiAlert.resolved_by,
		resolutionNotes: apiAlert.resolution_notes,
		metadata: apiAlert.metadata || {},
		tags: apiAlert.tags || [],
	}
}

// Transform UI data for API requests
export function transformAlertForApi(alert: Partial<Alert>): Partial<ApiAlert> {
	return {
		title: alert.title,
		description: alert.description,
		severity: alert.severity,
		type: alert.type,
		source: alert.source,
		metadata: alert.metadata,
		tags: alert.tags,
	}
}
```

## Caching Strategies

### Query Configuration

```typescript
export const alertQueryConfig = {
	// Alert list queries
	alerts: {
		queryKey: (filters?: AlertFilters) => ['alerts', filters],
		staleTime: 30000, // 30 seconds
		cacheTime: 300000, // 5 minutes
		refetchOnWindowFocus: true,
		refetchOnReconnect: true,
	},

	// Individual alert queries
	alert: {
		queryKey: (id: string) => ['alert', id],
		staleTime: 60000, // 1 minute
		cacheTime: 600000, // 10 minutes
	},

	// Statistics queries
	statistics: {
		queryKey: () => ['alert-statistics'],
		staleTime: 120000, // 2 minutes
		cacheTime: 300000, // 5 minutes
	},
}

// Usage in components
export function useAlerts(filters?: AlertFilters) {
	return useQuery({
		...alertQueryConfig.alerts,
		queryKey: alertQueryConfig.alerts.queryKey(filters),
		queryFn: () => auditClient.alerts.getAlerts(filters),
	})
}
```

### Cache Invalidation

```typescript
export function useAlertCacheInvalidation() {
	const queryClient = useQueryClient()

	const invalidateAlerts = useCallback(() => {
		queryClient.invalidateQueries(['alerts'])
	}, [queryClient])

	const invalidateAlert = useCallback(
		(alertId: string) => {
			queryClient.invalidateQueries(['alert', alertId])
		},
		[queryClient]
	)

	const invalidateStatistics = useCallback(() => {
		queryClient.invalidateQueries(['alert-statistics'])
	}, [queryClient])

	return {
		invalidateAlerts,
		invalidateAlert,
		invalidateStatistics,
	}
}
```

## Performance Optimization

### Request Batching

```typescript
// Batch multiple alert operations
export function useBatchAlertOperations() {
	const [pendingOperations, setPendingOperations] = useState<AlertOperation[]>([])

	const batchOperation = useCallback((operation: AlertOperation) => {
		setPendingOperations((prev) => [...prev, operation])
	}, [])

	// Process batched operations every 100ms
	useEffect(() => {
		if (pendingOperations.length === 0) return

		const timeout = setTimeout(async () => {
			const operations = [...pendingOperations]
			setPendingOperations([])

			try {
				await auditClient.alerts.batchOperation(operations)
			} catch (error) {
				console.error('Batch operation failed:', error)
				// Re-queue failed operations
				setPendingOperations((prev) => [...prev, ...operations])
			}
		}, 100)

		return () => clearTimeout(timeout)
	}, [pendingOperations])

	return { batchOperation }
}
```

### Request Deduplication

```typescript
// Deduplicate identical requests
const requestCache = new Map<string, Promise<any>>()

export function deduplicatedRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
	if (requestCache.has(key)) {
		return requestCache.get(key)!
	}

	const promise = requestFn().finally(() => {
		requestCache.delete(key)
	})

	requestCache.set(key, promise)
	return promise
}

// Usage
export function useAlertWithDeduplication(alertId: string) {
	return useQuery({
		queryKey: ['alert', alertId],
		queryFn: () =>
			deduplicatedRequest(`alert-${alertId}`, () => auditClient.alerts.getAlert(alertId)),
	})
}
```

## Testing API Integration

### Mock API Responses

```typescript
// src/__tests__/mocks/alert-api.ts
export const mockAlertApi = {
	getAlerts: jest.fn().mockResolvedValue({
		alerts: [createMockAlert(), createMockAlert()],
		pagination: { page: 1, pageSize: 25, total: 2, totalPages: 1 },
	}),

	acknowledgeAlert: jest.fn().mockImplementation((alertId: string) =>
		Promise.resolve(
			createMockAlert({
				id: alertId,
				status: 'acknowledged',
				acknowledgedAt: new Date(),
			})
		)
	),

	resolveAlert: jest.fn().mockImplementation((alertId: string, notes: string) =>
		Promise.resolve(
			createMockAlert({
				id: alertId,
				status: 'resolved',
				resolvedAt: new Date(),
				resolutionNotes: notes,
			})
		)
	),
}

// Test setup
beforeEach(() => {
	jest.clearAllMocks()
	auditClient.alerts = mockAlertApi
})
```

### Integration Tests

```typescript
describe('Alert API Integration', () => {
	it('handles alert acknowledgment with optimistic updates', async () => {
		const { result } = renderHook(() => useAlertMutations(), {
			wrapper: createQueryWrapper(),
		})

		const alertId = 'test-alert-1'

		await act(async () => {
			await result.current.acknowledgeAlert.mutateAsync({ alertId })
		})

		expect(mockAlertApi.acknowledgeAlert).toHaveBeenCalledWith(alertId, undefined)
		expect(result.current.acknowledgeAlert.isSuccess).toBe(true)
	})

	it('handles API errors gracefully', async () => {
		mockAlertApi.acknowledgeAlert.mockRejectedValueOnce(
			new Response('Unauthorized', { status: 401 })
		)

		const { result } = renderHook(() => useAlertMutations(), {
			wrapper: createQueryWrapper(),
		})

		await act(async () => {
			try {
				await result.current.acknowledgeAlert.mutateAsync({ alertId: 'test' })
			} catch (error) {
				// Expected to throw
			}
		})

		expect(result.current.acknowledgeAlert.isError).toBe(true)
	})
})
```

This comprehensive API integration guide provides the foundation for reliable, performant, and maintainable alert system integration.
