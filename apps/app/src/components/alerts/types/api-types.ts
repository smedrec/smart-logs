/**
 * API integration type definitions
 */

import type { Alert } from '@/lib/collections'
import type { AlertAction, AlertBulkAction, AlertUI } from './alert-types'
import type { AlertFilters, AlertPagination, AlertSort } from './filter-types'

// API request types
export interface AlertListRequest {
	filters?: AlertFilters
	sort?: AlertSort
	pagination?: AlertPagination
	organizationId: string
}

export interface AlertActionRequest {
	alertId: string
	action: AlertAction
	notes?: string
	userId: string
}

export interface AlertBulkActionRequest {
	bulkAction: AlertBulkAction
	organizationId: string
}

// API response types
export interface AlertListResponse {
	alerts: AlertUI[]
	pagination: {
		page: number
		pageSize: number
		total: number
		totalPages: number
	}
	filters: {
		applied: AlertFilters
		available: {
			severities: string[]
			types: string[]
			sources: string[]
			tags: string[]
		}
	}
}

export interface AlertActionResponse {
	success: boolean
	message?: string
	timestamp: Date
}

export interface AlertBulkActionResponse {
	success: boolean
	processed: number
	failed: number
	errors?: Array<{
		alertId: string
		error: string
	}>
	message?: string
}

// WebSocket message types
export interface AlertWebSocketMessage {
	type: 'alert_created' | 'alert_updated' | 'alert_deleted' | 'bulk_action_completed'
	payload: Alert | AlertBulkActionResponse
	timestamp: Date
	organizationId: string
}

// API error types
export interface AlertApiError {
	code: string
	message: string
	details?: Record<string, any>
	timestamp: Date
	requestId?: string
}

// API configuration
export interface AlertApiConfig {
	baseUrl: string
	timeout: number
	retryAttempts: number
	retryDelay: number
	enableWebSocket: boolean
	webSocketUrl?: string
}

// Query keys for TanStack Query
export const alertQueryKeys = {
	all: ['alerts'] as const,
	lists: () => [...alertQueryKeys.all, 'list'] as const,
	list: (filters: AlertFilters) => [...alertQueryKeys.lists(), filters] as const,
	details: () => [...alertQueryKeys.all, 'detail'] as const,
	detail: (id: string) => [...alertQueryKeys.details(), id] as const,
	statistics: () => [...alertQueryKeys.all, 'statistics'] as const,
	notifications: () => [...alertQueryKeys.all, 'notifications'] as const,
} as const
