/**
 * Filter and search type definitions
 */

import type { AlertSeverity, AlertStatus, AlertType } from './alert-types'

// Main filter interface
export interface AlertFilters {
	severity?: AlertSeverity[]
	type?: AlertType[]
	status?: AlertStatus[]
	source?: string[]
	dateRange?: {
		start: Date
		end: Date
	}
	search?: string
	tags?: string[]
	acknowledgedBy?: string[]
	resolvedBy?: string[]
}

// Filter option for dropdowns and multi-selects
export interface FilterOption<T = string> {
	label: string
	value: T
	count?: number
	disabled?: boolean
}

// Filter group for organizing filters in UI
export interface FilterGroup {
	id: string
	label: string
	options: FilterOption[]
	multiple?: boolean
	searchable?: boolean
}

// Saved filter for user preferences
export interface SavedFilter {
	id: string
	name: string
	description?: string
	filters: AlertFilters
	isDefault?: boolean
	userId: string
	createdAt: Date
	updatedAt: Date
}

// Sort configuration
export interface AlertSort {
	field: keyof AlertFilters | 'timestamp' | 'title' | 'severity' | 'status'
	direction: 'asc' | 'desc'
}

// Pagination configuration
export interface AlertPagination {
	page: number
	pageSize: number
	total: number
	hasNext: boolean
	hasPrevious: boolean
}

// Search configuration
export interface AlertSearch {
	query: string
	fields: string[]
	fuzzy?: boolean
	caseSensitive?: boolean
}

// Filter state for URL management
export interface FilterState {
	filters: AlertFilters
	sort: AlertSort
	pagination: AlertPagination
	search?: AlertSearch
}
