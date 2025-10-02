/**
 * Performance Optimization Hooks
 *
 * Custom hooks for optimizing performance in compliance components
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Debounced value hook
export function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState<T>(value)

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedValue(value)
		}, delay)

		return () => {
			clearTimeout(handler)
		}
	}, [value, delay])

	return debouncedValue
}

// Throttled callback hook
export function useThrottle<T extends (...args: any[]) => any>(callback: T, delay: number): T {
	const lastRun = useRef(Date.now())

	return useCallback(
		((...args) => {
			if (Date.now() - lastRun.current >= delay) {
				callback(...args)
				lastRun.current = Date.now()
			}
		}) as T,
		[callback, delay]
	)
}

// Memoized expensive calculations
export function useExpensiveCalculation<T>(
	calculate: () => T,
	dependencies: React.DependencyList
): T {
	return useMemo(() => {
		const start = performance.now()
		const result = calculate()
		const end = performance.now()

		if (process.env.NODE_ENV === 'development') {
			console.log(`[Performance] Expensive calculation took ${(end - start).toFixed(2)}ms`)
		}

		return result
	}, dependencies)
}

// Intersection observer hook for lazy loading
export function useIntersectionObserver(
	elementRef: React.RefObject<Element>,
	options: IntersectionObserverInit = {}
) {
	const [isIntersecting, setIsIntersecting] = useState(false)
	const [hasIntersected, setHasIntersected] = useState(false)

	useEffect(() => {
		const element = elementRef.current
		if (!element) return

		const observer = new IntersectionObserver(
			([entry]) => {
				setIsIntersecting(entry.isIntersecting)
				if (entry.isIntersecting && !hasIntersected) {
					setHasIntersected(true)
				}
			},
			{
				threshold: 0.1,
				rootMargin: '50px',
				...options,
			}
		)

		observer.observe(element)

		return () => {
			observer.unobserve(element)
		}
	}, [elementRef, options, hasIntersected])

	return { isIntersecting, hasIntersected }
}

// Virtual scrolling hook
export function useVirtualScrolling<T>({
	items,
	itemHeight,
	containerHeight,
	overscan = 5,
}: {
	items: T[]
	itemHeight: number
	containerHeight: number
	overscan?: number
}) {
	const [scrollTop, setScrollTop] = useState(0)

	const visibleRange = useMemo(() => {
		const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
		const endIndex = Math.min(
			items.length - 1,
			Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
		)

		return { startIndex, endIndex }
	}, [scrollTop, itemHeight, containerHeight, items.length, overscan])

	const visibleItems = useMemo(() => {
		return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1).map((item, index) => ({
			item,
			index: visibleRange.startIndex + index,
		}))
	}, [items, visibleRange])

	const totalHeight = items.length * itemHeight
	const offsetY = visibleRange.startIndex * itemHeight

	const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
		setScrollTop(event.currentTarget.scrollTop)
	}, [])

	return {
		visibleItems,
		totalHeight,
		offsetY,
		handleScroll,
		visibleRange,
	}
}

// Optimized search hook with debouncing
export function useOptimizedSearch<T>(items: T[], searchFields: (keyof T)[], delay: number = 300) {
	const [searchTerm, setSearchTerm] = useState('')
	const [filteredItems, setFilteredItems] = useState<T[]>(items)
	const debouncedSearchTerm = useDebounce(searchTerm, delay)

	const searchFunction = useCallback(
		(items: T[], term: string) => {
			if (!term.trim()) return items

			const lowercaseTerm = term.toLowerCase()
			return items.filter((item) =>
				searchFields.some((field) => {
					const value = item[field]
					return value && String(value).toLowerCase().includes(lowercaseTerm)
				})
			)
		},
		[searchFields]
	)

	useEffect(() => {
		const filtered = searchFunction(items, debouncedSearchTerm)
		setFilteredItems(filtered)
	}, [items, debouncedSearchTerm, searchFunction])

	return {
		searchTerm,
		setSearchTerm,
		filteredItems,
		isSearching: searchTerm !== debouncedSearchTerm,
	}
}

// Pagination hook with performance optimizations
export function useOptimizedPagination<T>(items: T[], pageSize: number = 10) {
	const [currentPage, setCurrentPage] = useState(0)

	const paginatedData = useMemo(() => {
		const startIndex = currentPage * pageSize
		const endIndex = startIndex + pageSize
		return items.slice(startIndex, endIndex)
	}, [items, currentPage, pageSize])

	const totalPages = Math.ceil(items.length / pageSize)
	const hasNextPage = currentPage < totalPages - 1
	const hasPreviousPage = currentPage > 0

	const goToPage = useCallback(
		(page: number) => {
			setCurrentPage(Math.max(0, Math.min(page, totalPages - 1)))
		},
		[totalPages]
	)

	const nextPage = useCallback(() => {
		if (hasNextPage) {
			setCurrentPage((prev) => prev + 1)
		}
	}, [hasNextPage])

	const previousPage = useCallback(() => {
		if (hasPreviousPage) {
			setCurrentPage((prev) => prev - 1)
		}
	}, [hasPreviousPage])

	// Reset to first page when items change
	useEffect(() => {
		setCurrentPage(0)
	}, [items.length])

	return {
		currentPage,
		totalPages,
		pageSize,
		hasNextPage,
		hasPreviousPage,
		paginatedData,
		goToPage,
		nextPage,
		previousPage,
		totalItems: items.length,
	}
}

// Sorting hook with performance optimizations
export function useOptimizedSorting<T>(
	items: T[],
	defaultSortKey?: keyof T,
	defaultSortDirection: 'asc' | 'desc' = 'asc'
) {
	const [sortKey, setSortKey] = useState<keyof T | undefined>(defaultSortKey)
	const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection)

	const sortedItems = useMemo(() => {
		if (!sortKey) return items

		return [...items].sort((a, b) => {
			const aValue = a[sortKey]
			const bValue = b[sortKey]

			// Handle null/undefined values
			if (aValue == null && bValue == null) return 0
			if (aValue == null) return 1
			if (bValue == null) return -1

			// Handle different data types
			let comparison = 0
			if (typeof aValue === 'string' && typeof bValue === 'string') {
				comparison = aValue.localeCompare(bValue)
			} else if (typeof aValue === 'number' && typeof bValue === 'number') {
				comparison = aValue - bValue
			} else if (aValue instanceof Date && bValue instanceof Date) {
				comparison = aValue.getTime() - bValue.getTime()
			} else {
				comparison = String(aValue).localeCompare(String(bValue))
			}

			return sortDirection === 'asc' ? comparison : -comparison
		})
	}, [items, sortKey, sortDirection])

	const handleSort = useCallback(
		(key: keyof T) => {
			if (sortKey === key) {
				setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
			} else {
				setSortKey(key)
				setSortDirection('asc')
			}
		},
		[sortKey]
	)

	return {
		sortedItems,
		sortKey,
		sortDirection,
		handleSort,
		setSortKey,
		setSortDirection,
	}
}

// Combined hook for search, sort, and pagination
export function useOptimizedDataTable<T>(
	items: T[],
	searchFields: (keyof T)[],
	defaultSortKey?: keyof T,
	pageSize: number = 10
) {
	const { searchTerm, setSearchTerm, filteredItems, isSearching } = useOptimizedSearch(
		items,
		searchFields
	)

	const { sortedItems, sortKey, sortDirection, handleSort } = useOptimizedSorting(
		filteredItems,
		defaultSortKey
	)

	const {
		currentPage,
		totalPages,
		hasNextPage,
		hasPreviousPage,
		paginatedData,
		goToPage,
		nextPage,
		previousPage,
	} = useOptimizedPagination(sortedItems, pageSize)

	return {
		// Search
		searchTerm,
		setSearchTerm,
		isSearching,

		// Sort
		sortKey,
		sortDirection,
		handleSort,

		// Pagination
		currentPage,
		totalPages,
		hasNextPage,
		hasPreviousPage,
		goToPage,
		nextPage,
		previousPage,

		// Data
		data: paginatedData,
		totalItems: sortedItems.length,
		filteredItems: sortedItems,
	}
}

// Performance monitoring hook
export function usePerformanceMonitor(componentName: string) {
	const renderCount = useRef(0)
	const lastRenderTime = useRef(Date.now())

	useEffect(() => {
		renderCount.current += 1
		const now = Date.now()
		const timeSinceLastRender = now - lastRenderTime.current
		lastRenderTime.current = now

		if (process.env.NODE_ENV === 'development') {
			console.log(
				`[Performance] ${componentName} render #${renderCount.current} (${timeSinceLastRender}ms since last render)`
			)
		}
	})

	return {
		renderCount: renderCount.current,
	}
}

// Memory usage monitoring hook
export function useMemoryMonitor() {
	const [memoryInfo, setMemoryInfo] = useState<{
		usedJSHeapSize?: number
		totalJSHeapSize?: number
		jsHeapSizeLimit?: number
	}>({})

	useEffect(() => {
		const updateMemoryInfo = () => {
			if ('memory' in performance) {
				const memory = (performance as any).memory
				setMemoryInfo({
					usedJSHeapSize: memory.usedJSHeapSize,
					totalJSHeapSize: memory.totalJSHeapSize,
					jsHeapSizeLimit: memory.jsHeapSizeLimit,
				})
			}
		}

		updateMemoryInfo()
		const interval = setInterval(updateMemoryInfo, 5000) // Update every 5 seconds

		return () => clearInterval(interval)
	}, [])

	return memoryInfo
}
