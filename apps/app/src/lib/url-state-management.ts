/**
 * URL State Management Utilities
 *
 * Provides utilities for managing application state through URL search parameters,
 * enabling shareable URLs and browser history management.
 */

import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'
import { z } from 'zod'

/**
 * URL state configuration
 */
export interface UrlStateConfig<T extends Record<string, unknown>> {
	schema: z.ZodSchema<T>
	defaults: Partial<T>
	serialize?: (value: T) => Record<string, string>
	deserialize?: (params: Record<string, string>) => Partial<T>
}

/**
 * Generic URL state management hook
 */
export function useUrlState<T extends Record<string, unknown>>(config: UrlStateConfig<T>) {
	const navigate = useNavigate()
	const routerState = useRouterState()
	const currentSearch = routerState.location.search as Record<string, unknown>

	// Parse current URL state
	const urlState = useMemo(() => {
		try {
			const deserializedState = config.deserialize
				? config.deserialize(currentSearch as Record<string, string>)
				: currentSearch

			const mergedState = { ...config.defaults, ...deserializedState }
			return config.schema.parse(mergedState)
		} catch (error) {
			console.warn('Failed to parse URL state, using defaults:', error)
			return config.schema.parse(config.defaults)
		}
	}, [currentSearch, config])

	// Update URL state
	const setUrlState = useCallback(
		(
			newState: Partial<T> | ((prev: T) => Partial<T>),
			options: { replace?: boolean; merge?: boolean } = {}
		) => {
			const { replace = false, merge = true } = options

			const stateUpdate = typeof newState === 'function' ? newState(urlState) : newState

			const nextState = merge
				? { ...urlState, ...stateUpdate }
				: { ...config.defaults, ...stateUpdate }

			const serializedState = config.serialize
				? config.serialize(nextState as T)
				: (nextState as Record<string, unknown>)

			navigate({
				search: serializedState,
				replace,
			})
		},
		[urlState, navigate, config]
	)

	// Clear URL state
	const clearUrlState = useCallback(
		(options: { replace?: boolean } = {}) => {
			navigate({
				search: config.serialize
					? config.serialize(config.defaults as T)
					: (config.defaults as Record<string, unknown>),
				replace: options.replace,
			})
		},
		[navigate, config]
	)

	// Update single parameter
	const setParam = useCallback(
		<K extends keyof T>(key: K, value: T[K], options: { replace?: boolean } = {}) => {
			setUrlState({ [key]: value } as unknown as Partial<T>, options)
		},
		[setUrlState]
	)

	// Remove single parameter
	const removeParam = useCallback(
		<K extends keyof T>(key: K, options: { replace?: boolean } = {}) => {
			const newState = { ...urlState }
			delete newState[key]
			setUrlState(newState, { ...options, merge: false })
		},
		[urlState, setUrlState]
	)

	// Get shareable URL
	const getShareableUrl = useCallback(
		(baseUrl?: string) => {
			const url = new URL(baseUrl || window.location.href)
			const serializedState = config.serialize
				? config.serialize(urlState)
				: (urlState as Record<string, string>)

			Object.entries(serializedState).forEach(([key, value]) => {
				if (value !== undefined && value !== null && value !== '') {
					url.searchParams.set(key, String(value))
				}
			})

			return url.toString()
		},
		[urlState, config]
	)

	return {
		state: urlState,
		setState: setUrlState,
		clearState: clearUrlState,
		setParam,
		removeParam,
		getShareableUrl,
	}
}

/**
 * Pagination URL state management
 */
export interface PaginationState {
	page: number
	limit: number
	total?: number
}

const paginationSchema = z.object({
	page: z.number().min(1).default(1),
	limit: z.number().min(1).max(100).default(10),
	total: z.number().optional(),
})

export function usePaginationUrlState(defaults: Partial<PaginationState> = {}) {
	return useUrlState({
		schema: paginationSchema,
		defaults: { page: 1, limit: 10, ...defaults },
		serialize: (state) => ({
			page: String(state.page),
			limit: String(state.limit),
			...(state.total && { total: String(state.total) }),
		}),
		deserialize: (params) => ({
			page: params.page ? parseInt(params.page, 10) : undefined,
			limit: params.limit ? parseInt(params.limit, 10) : undefined,
			total: params.total ? parseInt(params.total, 10) : undefined,
		}),
	})
}

/**
 * Filter URL state management
 */
export interface FilterState {
	search?: string
	sortBy?: string
	sortOrder?: 'asc' | 'desc'
	[key: string]: unknown
}

export function useFilterUrlState<T extends FilterState>(
	schema: z.ZodSchema<T>,
	defaults: Partial<T> = {}
) {
	return useUrlState({
		schema,
		defaults: { sortOrder: 'asc' as const, ...defaults },
		serialize: (state) => {
			const serialized: Record<string, string> = {}
			Object.entries(state).forEach(([key, value]) => {
				if (value !== undefined && value !== null && value !== '') {
					if (Array.isArray(value)) {
						serialized[key] = value.join(',')
					} else {
						serialized[key] = String(value)
					}
				}
			})
			return serialized
		},
		deserialize: (params) => {
			const deserialized: Partial<T> = {}
			Object.entries(params).forEach(([key, value]) => {
				if (value && typeof value === 'string') {
					// Handle comma-separated arrays
					if (value.includes(',')) {
						deserialized[key as keyof T] = value.split(',') as T[keyof T]
					} else {
						deserialized[key as keyof T] = value as T[keyof T]
					}
				}
			})
			return deserialized
		},
	})
}

/**
 * Combined pagination and filter state management
 */
export interface PaginatedFilterState extends PaginationState, FilterState {}

export function usePaginatedFilterUrlState<T extends PaginatedFilterState>(
	schema: z.ZodSchema<T>,
	defaults: Partial<T> = {}
) {
	const combinedDefaults = {
		page: 1,
		limit: 10,
		sortOrder: 'asc' as const,
		...defaults,
	}

	return useUrlState({
		schema,
		defaults: combinedDefaults,
		serialize: (state) => {
			const serialized: Record<string, string> = {}
			Object.entries(state).forEach(([key, value]) => {
				if (value !== undefined && value !== null && value !== '') {
					if (Array.isArray(value)) {
						serialized[key] = value.join(',')
					} else {
						serialized[key] = String(value)
					}
				}
			})
			return serialized
		},
		deserialize: (params) => {
			const deserialized: Partial<T> = {}
			Object.entries(params).forEach(([key, value]) => {
				if (value && typeof value === 'string') {
					// Handle numeric fields
					if (['page', 'limit', 'total'].includes(key)) {
						const numValue = parseInt(value, 10)
						if (!isNaN(numValue)) {
							deserialized[key as keyof T] = numValue as T[keyof T]
						}
					}
					// Handle comma-separated arrays
					else if (value.includes(',')) {
						deserialized[key as keyof T] = value.split(',') as T[keyof T]
					}
					// Handle regular strings
					else {
						deserialized[key as keyof T] = value as T[keyof T]
					}
				}
			})
			return deserialized
		},
	})
}

/**
 * Browser history management utilities
 */
export class UrlStateHistory {
	private static instance: UrlStateHistory
	private history: Array<{ url: string; timestamp: number; title?: string }> = []
	private maxHistorySize = 50

	static getInstance(): UrlStateHistory {
		if (!UrlStateHistory.instance) {
			UrlStateHistory.instance = new UrlStateHistory()
		}
		return UrlStateHistory.instance
	}

	addToHistory(url: string, title?: string) {
		this.history.unshift({
			url,
			timestamp: Date.now(),
			title,
		})

		// Keep history size manageable
		if (this.history.length > this.maxHistorySize) {
			this.history = this.history.slice(0, this.maxHistorySize)
		}
	}

	getHistory() {
		return [...this.history]
	}

	clearHistory() {
		this.history = []
	}

	getRecentUrls(limit = 10) {
		return this.history.slice(0, limit).map((entry) => entry.url)
	}
}

/**
 * Hook for managing URL state history
 */
export function useUrlStateHistory() {
	const history = UrlStateHistory.getInstance()
	const routerState = useRouterState()

	// Add current URL to history when it changes
	useMemo(() => {
		const currentUrl = window.location.href
		history.addToHistory(currentUrl, document.title)
	}, [routerState.location.pathname, routerState.location.search, history])

	return {
		addToHistory: history.addToHistory.bind(history),
		getHistory: history.getHistory.bind(history),
		clearHistory: history.clearHistory.bind(history),
		getRecentUrls: history.getRecentUrls.bind(history),
	}
}

/**
 * Utility functions for URL state management
 */
export const urlStateUtils = {
	/**
	 * Create a shareable URL with current state
	 */
	createShareableUrl: (baseUrl: string, state: Record<string, unknown>) => {
		const url = new URL(baseUrl)
		Object.entries(state).forEach(([key, value]) => {
			if (value !== undefined && value !== null && value !== '') {
				if (Array.isArray(value)) {
					url.searchParams.set(key, value.join(','))
				} else {
					url.searchParams.set(key, String(value))
				}
			}
		})
		return url.toString()
	},

	/**
	 * Parse URL search parameters into typed object
	 */
	parseUrlParams: <T>(
		searchParams: URLSearchParams | Record<string, string>,
		schema: z.ZodSchema<T>
	): T | null => {
		try {
			const params =
				searchParams instanceof URLSearchParams
					? Object.fromEntries(searchParams.entries())
					: searchParams

			return schema.parse(params)
		} catch {
			return null
		}
	},

	/**
	 * Serialize object to URL search parameters
	 */
	serializeToUrlParams: (obj: Record<string, unknown>): URLSearchParams => {
		const params = new URLSearchParams()
		Object.entries(obj).forEach(([key, value]) => {
			if (value !== undefined && value !== null && value !== '') {
				if (Array.isArray(value)) {
					params.set(key, value.join(','))
				} else {
					params.set(key, String(value))
				}
			}
		})
		return params
	},

	/**
	 * Deep merge URL state objects
	 */
	mergeUrlState: <T extends Record<string, unknown>>(current: T, updates: Partial<T>): T => {
		const merged = { ...current }
		Object.entries(updates).forEach(([key, value]) => {
			if (value !== undefined) {
				merged[key as keyof T] = value as T[keyof T]
			}
		})
		return merged
	},
}
