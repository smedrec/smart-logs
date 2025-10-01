import { useNavigate, useSearch } from '@tanstack/react-router'
import * as React from 'react'

import type { ReportFilters } from '../types'

interface UseReportsFiltersOptions {
	defaultFilters?: ReportFilters
	persistInUrl?: boolean
}

interface UseReportsFiltersReturn {
	filters: ReportFilters
	setFilters: (filters: ReportFilters) => void
	clearFilters: () => void
	hasActiveFilters: boolean
	activeFilterCount: number
}

/**
 * Hook for managing report filters with URL persistence
 */
export function useReportsFilters({
	defaultFilters = {},
	persistInUrl = true,
}: UseReportsFiltersOptions = {}): UseReportsFiltersReturn {
	const navigate = useNavigate()
	const search = useSearch({ strict: false }) as Record<string, any>

	// Parse filters from URL search params
	const parseFiltersFromUrl = React.useCallback((): ReportFilters => {
		if (!persistInUrl) return defaultFilters

		const filters: ReportFilters = {}

		// Parse search
		if (search.search && typeof search.search === 'string') {
			filters.search = search.search
		}

		// Parse report types
		if (search.reportType) {
			if (Array.isArray(search.reportType)) {
				filters.reportType = search.reportType
			} else if (typeof search.reportType === 'string') {
				filters.reportType = [search.reportType]
			}
		}

		// Parse status
		if (search.status) {
			if (Array.isArray(search.status)) {
				filters.status = search.status
			} else if (typeof search.status === 'string') {
				filters.status = [search.status]
			}
		}

		// Parse date range
		if (search.startDate || search.endDate) {
			filters.dateRange = {}
			if (search.startDate && typeof search.startDate === 'string') {
				filters.dateRange.startDate = search.startDate
			}
			if (search.endDate && typeof search.endDate === 'string') {
				filters.dateRange.endDate = search.endDate
			}
		}

		// Parse created by
		if (search.createdBy) {
			if (Array.isArray(search.createdBy)) {
				filters.createdBy = search.createdBy
			} else if (typeof search.createdBy === 'string') {
				filters.createdBy = [search.createdBy]
			}
		}

		// Parse tags
		if (search.tags) {
			if (Array.isArray(search.tags)) {
				filters.tags = search.tags
			} else if (typeof search.tags === 'string') {
				filters.tags = [search.tags]
			}
		}

		return { ...defaultFilters, ...filters }
	}, [search, defaultFilters, persistInUrl])

	// Initialize filters from URL or defaults
	const [filters, setFiltersState] = React.useState<ReportFilters>(parseFiltersFromUrl)

	// Update filters and optionally persist to URL
	const setFilters = React.useCallback(
		(newFilters: ReportFilters) => {
			setFiltersState(newFilters)

			if (!persistInUrl) return

			// Convert filters to URL search params
			const searchParams: Record<string, any> = { ...search }

			// Clear existing filter params
			delete searchParams.search
			delete searchParams.reportType
			delete searchParams.status
			delete searchParams.startDate
			delete searchParams.endDate
			delete searchParams.createdBy
			delete searchParams.tags

			// Add new filter params
			if (newFilters.search) {
				searchParams.search = newFilters.search
			}

			if (newFilters.reportType && newFilters.reportType.length > 0) {
				searchParams.reportType = newFilters.reportType
			}

			if (newFilters.status && newFilters.status.length > 0) {
				searchParams.status = newFilters.status
			}

			if (newFilters.dateRange) {
				if (newFilters.dateRange.startDate) {
					searchParams.startDate = newFilters.dateRange.startDate
				}
				if (newFilters.dateRange.endDate) {
					searchParams.endDate = newFilters.dateRange.endDate
				}
			}

			if (newFilters.createdBy && newFilters.createdBy.length > 0) {
				searchParams.createdBy = newFilters.createdBy
			}

			if (newFilters.tags && newFilters.tags.length > 0) {
				searchParams.tags = newFilters.tags
			}

			// Navigate with new search params
			navigate({
				search: searchParams,
				replace: true,
			})
		},
		[navigate, search, persistInUrl]
	)

	// Clear all filters
	const clearFilters = React.useCallback(() => {
		setFilters(defaultFilters)
	}, [setFilters, defaultFilters])

	// Calculate if there are active filters
	const hasActiveFilters = React.useMemo(() => {
		return Boolean(
			filters.search ||
				(filters.reportType && filters.reportType.length > 0) ||
				(filters.status && filters.status.length > 0) ||
				filters.dateRange ||
				(filters.createdBy && filters.createdBy.length > 0) ||
				(filters.tags && filters.tags.length > 0)
		)
	}, [filters])

	// Calculate active filter count
	const activeFilterCount = React.useMemo(() => {
		let count = 0
		if (filters.search) count++
		if (filters.reportType && filters.reportType.length > 0) count++
		if (filters.status && filters.status.length > 0) count++
		if (filters.dateRange) count++
		if (filters.createdBy && filters.createdBy.length > 0) count++
		if (filters.tags && filters.tags.length > 0) count++
		return count
	}, [filters])

	// Update filters when URL changes
	React.useEffect(() => {
		const urlFilters = parseFiltersFromUrl()
		setFiltersState(urlFilters)
	}, [parseFiltersFromUrl])

	return {
		filters,
		setFilters,
		clearFilters,
		hasActiveFilters,
		activeFilterCount,
	}
}

/**
 * Hook for debouncing filter changes
 */
export function useDebouncedFilters(filters: ReportFilters, delay: number = 300): ReportFilters {
	const [debouncedFilters, setDebouncedFilters] = React.useState(filters)

	React.useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedFilters(filters)
		}, delay)

		return () => clearTimeout(timer)
	}, [filters, delay])

	return debouncedFilters
}

/**
 * Hook for managing filter presets
 */
export function useFilterPresets() {
	const commonPresets: Record<string, ReportFilters> = {
		all: {},
		enabled: {
			status: ['enabled'],
		},
		disabled: {
			status: ['disabled'],
		},
		hipaa: {
			reportType: ['HIPAA_AUDIT_TRAIL'],
		},
		gdpr: {
			reportType: ['GDPR_PROCESSING_ACTIVITIES'],
		},
		integrity: {
			reportType: ['INTEGRITY_VERIFICATION'],
		},
		recent: {
			dateRange: {
				startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
				endDate: new Date().toISOString().split('T')[0],
			},
		},
	}

	return {
		presets: commonPresets,
		getPreset: (name: string) => commonPresets[name] || {},
	}
}
