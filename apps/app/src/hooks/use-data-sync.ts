import { useCallback, useEffect, useRef, useState } from 'react'

import { useComplianceAudit } from '../contexts/compliance-audit-provider'
import { useErrorHandler } from './use-error-handler'

import type {
	ExecutionHistoryParams,
	ListScheduledReportsParams,
	PaginatedExecutions,
	PaginatedScheduledReports,
	ReportExecution,
	ScheduledReport,
} from '@smedrec/audit-client'

// Cache configuration
interface CacheConfig {
	ttl: number // Time to live in milliseconds
	maxSize: number
	enableOptimisticUpdates: boolean
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
	ttl: 5 * 60 * 1000, // 5 minutes
	maxSize: 100,
	enableOptimisticUpdates: true,
}

// Cache entry structure
interface CacheEntry<T> {
	data: T
	timestamp: number
	key: string
}

// Cache manager for data synchronization
class DataCache {
	private cache = new Map<string, CacheEntry<any>>()
	private config: CacheConfig

	constructor(config: Partial<CacheConfig> = {}) {
		this.config = { ...DEFAULT_CACHE_CONFIG, ...config }
	}

	set<T>(key: string, data: T): void {
		// Remove oldest entries if cache is full
		if (this.cache.size >= this.config.maxSize) {
			const oldestKey = Array.from(this.cache.keys())[0]
			this.cache.delete(oldestKey)
		}

		this.cache.set(key, {
			data,
			timestamp: Date.now(),
			key,
		})
	}

	get<T>(key: string): T | null {
		const entry = this.cache.get(key)
		if (!entry) return null

		// Check if entry is expired
		if (Date.now() - entry.timestamp > this.config.ttl) {
			this.cache.delete(key)
			return null
		}

		return entry.data as T
	}

	invalidate(keyPattern?: string): void {
		if (!keyPattern) {
			this.cache.clear()
			return
		}

		// Remove entries matching pattern
		for (const [key] of this.cache) {
			if (key.includes(keyPattern)) {
				this.cache.delete(key)
			}
		}
	}

	has(key: string): boolean {
		const entry = this.cache.get(key)
		if (!entry) return false

		// Check if entry is expired
		if (Date.now() - entry.timestamp > this.config.ttl) {
			this.cache.delete(key)
			return false
		}

		return true
	}

	size(): number {
		return this.cache.size
	}
}

// Global cache instance
const globalCache = new DataCache()

// Hook for synchronized scheduled reports data
export function useScheduledReportsSync(params?: ListScheduledReportsParams) {
	const { listScheduledReports, connectionStatus } = useComplianceAudit()
	const { handleError } = useErrorHandler()

	const [data, setData] = useState<PaginatedScheduledReports | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

	const paramsRef = useRef(params)
	const refreshIntervalRef = useRef<NodeJS.Timeout>()

	// Generate cache key from parameters
	const getCacheKey = useCallback((params?: ListScheduledReportsParams) => {
		return `scheduled-reports:${JSON.stringify(params || {})}`
	}, [])

	// Fetch data with caching
	const fetchData = useCallback(
		async (
			params?: ListScheduledReportsParams,
			options: { useCache?: boolean; updateCache?: boolean } = {}
		) => {
			const { useCache = true, updateCache = true } = options
			const cacheKey = getCacheKey(params)

			// Try cache first
			if (useCache) {
				const cachedData = globalCache.get<PaginatedScheduledReports>(cacheKey)
				if (cachedData) {
					setData(cachedData)
					setLastUpdated(new Date())
					return cachedData
				}
			}

			setIsLoading(true)
			try {
				const result = await listScheduledReports(params)
				setData(result)
				setLastUpdated(new Date())

				if (updateCache) {
					globalCache.set(cacheKey, result)
				}

				return result
			} catch (error) {
				handleError(error, 'Fetching scheduled reports')
				return null
			} finally {
				setIsLoading(false)
			}
		},
		[listScheduledReports, getCacheKey, handleError]
	)

	// Refresh data
	const refresh = useCallback(async () => {
		return fetchData(paramsRef.current, { useCache: false, updateCache: true })
	}, [fetchData])

	// Optimistic update for create operation
	const optimisticCreate = useCallback((newReport: ScheduledReport) => {
		if (!globalCache.config.enableOptimisticUpdates) return

		setData((prevData) => {
			if (!prevData) return prevData

			return {
				...prevData,
				data: [newReport, ...prevData.data],
				pagination: {
					...prevData.pagination,
					total: prevData.pagination.total + 1,
				},
			}
		})

		// Invalidate cache to force refresh on next fetch
		globalCache.invalidate('scheduled-reports')
	}, [])

	// Optimistic update for update operation
	const optimisticUpdate = useCallback(
		(updatedReport: ScheduledReport) => {
			if (!globalCache.config.enableOptimisticUpdates) return

			setData((prevData) => {
				if (!prevData) return prevData

				return {
					...prevData,
					data: prevData.data.map((report) =>
						report.id === updatedReport.id ? updatedReport : report
					),
				}
			})

			// Update cache
			const cacheKey = getCacheKey(paramsRef.current)
			const cachedData = globalCache.get<PaginatedScheduledReports>(cacheKey)
			if (cachedData) {
				const updatedData = {
					...cachedData,
					data: cachedData.data.map((report) =>
						report.id === updatedReport.id ? updatedReport : report
					),
				}
				globalCache.set(cacheKey, updatedData)
			}
		},
		[getCacheKey]
	)

	// Optimistic update for delete operation
	const optimisticDelete = useCallback((reportId: string) => {
		if (!globalCache.config.enableOptimisticUpdates) return

		setData((prevData) => {
			if (!prevData) return prevData

			return {
				...prevData,
				data: prevData.data.filter((report) => report.id !== reportId),
				pagination: {
					...prevData.pagination,
					total: prevData.pagination.total - 1,
				},
			}
		})

		// Invalidate cache
		globalCache.invalidate('scheduled-reports')
	}, [])

	// Set up real-time updates
	useEffect(() => {
		if (!connectionStatus.isConnected) return

		// Set up periodic refresh
		refreshIntervalRef.current = setInterval(() => {
			refresh()
		}, 30000) // Refresh every 30 seconds

		return () => {
			if (refreshIntervalRef.current) {
				clearInterval(refreshIntervalRef.current)
			}
		}
	}, [connectionStatus.isConnected, refresh])

	// Initial data fetch
	useEffect(() => {
		paramsRef.current = params
		fetchData(params)
	}, [fetchData, params])

	// Invalidate cache when connection is restored
	useEffect(() => {
		if (connectionStatus.isConnected && connectionStatus.retryCount > 0) {
			globalCache.invalidate('scheduled-reports')
			refresh()
		}
	}, [connectionStatus.isConnected, connectionStatus.retryCount, refresh])

	return {
		data,
		isLoading,
		lastUpdated,
		refresh,
		optimisticCreate,
		optimisticUpdate,
		optimisticDelete,
	}
}

// Hook for synchronized execution history data
export function useExecutionHistorySync(reportId: string, params?: ExecutionHistoryParams) {
	const { getExecutionHistory, connectionStatus } = useComplianceAudit()
	const { handleError } = useErrorHandler()

	const [data, setData] = useState<PaginatedExecutions | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

	const paramsRef = useRef(params)
	const refreshIntervalRef = useRef<NodeJS.Timeout>()

	// Generate cache key
	const getCacheKey = useCallback((reportId: string, params?: ExecutionHistoryParams) => {
		return `execution-history:${reportId}:${JSON.stringify(params || {})}`
	}, [])

	// Fetch execution history
	const fetchData = useCallback(
		async (
			reportId: string,
			params?: ExecutionHistoryParams,
			options: { useCache?: boolean; updateCache?: boolean } = {}
		) => {
			const { useCache = true, updateCache = true } = options
			const cacheKey = getCacheKey(reportId, params)

			// Try cache first
			if (useCache) {
				const cachedData = globalCache.get<PaginatedExecutions>(cacheKey)
				if (cachedData) {
					setData(cachedData)
					setLastUpdated(new Date())
					return cachedData
				}
			}

			setIsLoading(true)
			try {
				const result = await getExecutionHistory(reportId, params)
				setData(result)
				setLastUpdated(new Date())

				if (updateCache) {
					globalCache.set(cacheKey, result)
				}

				return result
			} catch (error) {
				handleError(error, 'Fetching execution history')
				return null
			} finally {
				setIsLoading(false)
			}
		},
		[getExecutionHistory, getCacheKey, handleError]
	)

	// Refresh data
	const refresh = useCallback(async () => {
		return fetchData(reportId, paramsRef.current, { useCache: false, updateCache: true })
	}, [fetchData, reportId])

	// Optimistic update for new execution
	const optimisticAddExecution = useCallback(
		(newExecution: ReportExecution) => {
			if (!globalCache.config.enableOptimisticUpdates) return

			setData((prevData) => {
				if (!prevData) return prevData

				return {
					...prevData,
					data: [newExecution, ...prevData.data],
					pagination: {
						...prevData.pagination,
						total: prevData.pagination.total + 1,
					},
				}
			})

			// Invalidate cache
			globalCache.invalidate(`execution-history:${reportId}`)
		},
		[reportId]
	)

	// Update execution status optimistically
	const optimisticUpdateExecution = useCallback(
		(executionId: string, updates: Partial<ReportExecution>) => {
			if (!globalCache.config.enableOptimisticUpdates) return

			setData((prevData) => {
				if (!prevData) return prevData

				return {
					...prevData,
					data: prevData.data.map((execution) =>
						execution.id === executionId ? { ...execution, ...updates } : execution
					),
				}
			})

			// Update cache
			const cacheKey = getCacheKey(reportId, paramsRef.current)
			const cachedData = globalCache.get<PaginatedExecutions>(cacheKey)
			if (cachedData) {
				const updatedData = {
					...cachedData,
					data: cachedData.data.map((execution) =>
						execution.id === executionId ? { ...execution, ...updates } : execution
					),
				}
				globalCache.set(cacheKey, updatedData)
			}
		},
		[reportId, getCacheKey]
	)

	// Set up real-time updates for executions
	useEffect(() => {
		if (!connectionStatus.isConnected || !reportId) return

		// More frequent updates for execution history (every 10 seconds)
		refreshIntervalRef.current = setInterval(() => {
			refresh()
		}, 10000)

		return () => {
			if (refreshIntervalRef.current) {
				clearInterval(refreshIntervalRef.current)
			}
		}
	}, [connectionStatus.isConnected, reportId, refresh])

	// Initial data fetch
	useEffect(() => {
		if (!reportId) return

		paramsRef.current = params
		fetchData(reportId, params)
	}, [fetchData, reportId, params])

	return {
		data,
		isLoading,
		lastUpdated,
		refresh,
		optimisticAddExecution,
		optimisticUpdateExecution,
	}
}

// Hook for cache management
export function useCacheManager() {
	const invalidateAll = useCallback(() => {
		globalCache.invalidate()
	}, [])

	const invalidatePattern = useCallback((pattern: string) => {
		globalCache.invalidate(pattern)
	}, [])

	const getCacheStats = useCallback(() => {
		return {
			size: globalCache.size(),
			maxSize: globalCache.config.maxSize,
			ttl: globalCache.config.ttl,
		}
	}, [])

	return {
		invalidateAll,
		invalidatePattern,
		getCacheStats,
	}
}

// Hook for real-time execution status updates
export function useExecutionStatusSync(executionId?: string) {
	const { connectionStatus } = useComplianceAudit()
	const [status, setStatus] = useState<string | null>(null)
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

	const statusIntervalRef = useRef<NodeJS.Timeout>()

	// Simulate real-time status updates
	// In a real implementation, this would use WebSockets or Server-Sent Events
	const checkStatus = useCallback(async () => {
		if (!executionId || !connectionStatus.isConnected) return

		try {
			// This would be replaced with actual status check API call
			// const statusResult = await client.scheduledReports.getExecutionStatus(executionId)
			// setStatus(statusResult.status)
			setLastUpdated(new Date())
		} catch (error) {
			console.warn('Failed to check execution status:', error)
		}
	}, [executionId, connectionStatus.isConnected])

	useEffect(() => {
		if (!executionId || !connectionStatus.isConnected) return

		// Check status every 5 seconds for active executions
		statusIntervalRef.current = setInterval(checkStatus, 5000)

		return () => {
			if (statusIntervalRef.current) {
				clearInterval(statusIntervalRef.current)
			}
		}
	}, [executionId, connectionStatus.isConnected, checkStatus])

	return {
		status,
		lastUpdated,
		checkStatus,
	}
}
