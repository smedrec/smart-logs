/**
 * Compliance URL State Provider
 *
 * Provides centralized URL state management for compliance features
 * with context-based state sharing and synchronization.
 */

import { complianceUrlUtils } from '@/hooks/useComplianceUrlState'
import { urlStateUtils } from '@/lib/url-state-management'
import { useRouterState } from '@tanstack/react-router'
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

import type {
	DashboardUrlState,
	ExecutionHistoryUrlState,
	ReportTemplatesUrlState,
	ScheduledReportsUrlState,
} from '@/hooks/useComplianceUrlState'

interface ComplianceUrlStateContextValue {
	// Current route information
	currentRoute: string
	routeParams: Record<string, string>

	// URL state for different compliance features
	scheduledReportsState: Partial<ScheduledReportsUrlState>
	executionHistoryState: Partial<ExecutionHistoryUrlState>
	reportTemplatesState: Partial<ReportTemplatesUrlState>
	dashboardState: Partial<DashboardUrlState>

	// State update functions
	updateScheduledReportsState: (state: Partial<ScheduledReportsUrlState>) => void
	updateExecutionHistoryState: (state: Partial<ExecutionHistoryUrlState>) => void
	updateReportTemplatesState: (state: Partial<ReportTemplatesUrlState>) => void
	updateDashboardState: (state: Partial<DashboardUrlState>) => void

	// Shareable URL functions
	getShareableUrl: (routeType?: string, state?: Record<string, unknown>) => string
	copyShareableUrl: (routeType?: string, state?: Record<string, unknown>) => Promise<void>

	// Navigation history
	navigationHistory: Array<{ url: string; timestamp: number; title?: string }>
	addToHistory: (url: string, title?: string) => void
	clearHistory: () => void

	// URL parsing utilities
	parseCurrentUrl: () => {
		routeType: string | null
		routeParams: Record<string, string>
		searchParams: Record<string, string>
	}
}

const ComplianceUrlStateContext = createContext<ComplianceUrlStateContextValue | null>(null)

interface ComplianceUrlStateProviderProps {
	children: React.ReactNode
}

export function ComplianceUrlStateProvider({ children }: ComplianceUrlStateProviderProps) {
	const routerState = useRouterState()
	const currentPath = routerState.location.pathname
	const currentSearch = routerState.location.search as Record<string, string>
	const routeParams = (routerState.location as any).params as Record<string, string>

	// State for different compliance features
	const [scheduledReportsState, setScheduledReportsState] = useState<
		Partial<ScheduledReportsUrlState>
	>({})
	const [executionHistoryState, setExecutionHistoryState] = useState<
		Partial<ExecutionHistoryUrlState>
	>({})
	const [reportTemplatesState, setReportTemplatesState] = useState<
		Partial<ReportTemplatesUrlState>
	>({})
	const [dashboardState, setDashboardState] = useState<Partial<DashboardUrlState>>({})

	// Navigation history
	const [navigationHistory, setNavigationHistory] = useState<
		Array<{ url: string; timestamp: number; title?: string }>
	>([])

	// Update state when URL changes
	useEffect(() => {
		const parseAndUpdateState = () => {
			const parsed = complianceUrlUtils.parseComplianceUrl(window.location.href)

			switch (parsed.routeType) {
				case 'scheduled-reports':
				case 'create-report':
				case 'view-report':
				case 'edit-report':
					setScheduledReportsState(parsed.searchParams)
					break
				case 'execution-history':
				case 'report-executions':
					setExecutionHistoryState(parsed.searchParams)
					break
				case 'report-templates':
					setReportTemplatesState(parsed.searchParams)
					break
				case 'dashboard':
					setDashboardState(parsed.searchParams)
					break
			}
		}

		parseAndUpdateState()
	}, [currentPath, currentSearch])

	// Add current URL to history when it changes
	useEffect(() => {
		const currentUrl = window.location.href
		const title = document.title

		setNavigationHistory((prev) => {
			// Don't add duplicate consecutive entries
			if (prev.length > 0 && prev[0].url === currentUrl) {
				return prev
			}

			const newHistory = [
				{ url: currentUrl, timestamp: Date.now(), title },
				...prev.slice(0, 49), // Keep max 50 entries
			]

			return newHistory
		})
	}, [currentPath, currentSearch])

	// State update functions
	const updateScheduledReportsState = useCallback((state: Partial<ScheduledReportsUrlState>) => {
		setScheduledReportsState((prev) => ({ ...prev, ...state }))
	}, [])

	const updateExecutionHistoryState = useCallback((state: Partial<ExecutionHistoryUrlState>) => {
		setExecutionHistoryState((prev) => ({ ...prev, ...state }))
	}, [])

	const updateReportTemplatesState = useCallback((state: Partial<ReportTemplatesUrlState>) => {
		setReportTemplatesState((prev) => ({ ...prev, ...state }))
	}, [])

	const updateDashboardState = useCallback((state: Partial<DashboardUrlState>) => {
		setDashboardState((prev) => ({ ...prev, ...state }))
	}, [])

	// Shareable URL functions
	const getShareableUrl = useCallback(
		(routeType?: string, state?: Record<string, unknown>) => {
			const currentRouteType =
				routeType || complianceUrlUtils.parseComplianceUrl(window.location.href).routeType
			const currentState = state || currentSearch

			switch (currentRouteType) {
				case 'scheduled-reports':
					return complianceUrlUtils.createScheduledReportsUrl(currentState)
				case 'execution-history':
					return complianceUrlUtils.createExecutionHistoryUrl(currentState)
				case 'report-templates':
					return complianceUrlUtils.createReportTemplatesUrl(currentState)
				case 'dashboard':
					return complianceUrlUtils.createDashboardUrl(currentState)
				case 'report-executions':
					if (routeParams.reportId) {
						return complianceUrlUtils.createReportExecutionHistoryUrl(
							routeParams.reportId,
							currentState
						)
					}
					break
			}

			return window.location.href
		},
		[currentSearch, routeParams]
	)

	const copyShareableUrl = useCallback(
		async (routeType?: string, state?: Record<string, unknown>) => {
			const url = getShareableUrl(routeType, state)
			try {
				await navigator.clipboard.writeText(url)
			} catch (error) {
				console.error('Failed to copy URL to clipboard:', error)
				throw error
			}
		},
		[getShareableUrl]
	)

	// History management
	const addToHistory = useCallback((url: string, title?: string) => {
		setNavigationHistory((prev) => [{ url, timestamp: Date.now(), title }, ...prev.slice(0, 49)])
	}, [])

	const clearHistory = useCallback(() => {
		setNavigationHistory([])
	}, [])

	// URL parsing utilities
	const parseCurrentUrl = useCallback(() => {
		return complianceUrlUtils.parseComplianceUrl(window.location.href)
	}, [])

	const contextValue: ComplianceUrlStateContextValue = {
		currentRoute: currentPath,
		routeParams,
		scheduledReportsState,
		executionHistoryState,
		reportTemplatesState,
		dashboardState,
		updateScheduledReportsState,
		updateExecutionHistoryState,
		updateReportTemplatesState,
		updateDashboardState,
		getShareableUrl,
		copyShareableUrl,
		navigationHistory,
		addToHistory,
		clearHistory,
		parseCurrentUrl,
	}

	return (
		<ComplianceUrlStateContext.Provider value={contextValue}>
			{children}
		</ComplianceUrlStateContext.Provider>
	)
}

/**
 * Hook to use compliance URL state context
 */
export function useComplianceUrlStateContext() {
	const context = useContext(ComplianceUrlStateContext)
	if (!context) {
		throw new Error('useComplianceUrlStateContext must be used within a ComplianceUrlStateProvider')
	}
	return context
}

/**
 * Hook for shareable URLs in compliance features
 */
export function useComplianceShareableUrl() {
	const { getShareableUrl, copyShareableUrl } = useComplianceUrlStateContext()
	const [copied, setCopied] = useState(false)

	const copyUrl = useCallback(
		async (routeType?: string, state?: Record<string, unknown>) => {
			try {
				await copyShareableUrl(routeType, state)
				setCopied(true)
				setTimeout(() => setCopied(false), 2000)
			} catch (error) {
				console.error('Failed to copy URL:', error)
			}
		},
		[copyShareableUrl]
	)

	const shareUrl = useCallback(
		async (
			routeType?: string,
			state?: Record<string, unknown>,
			shareData?: { title?: string; text?: string }
		) => {
			const url = getShareableUrl(routeType, state)

			if (navigator.share) {
				try {
					await navigator.share({
						title: shareData?.title || document.title,
						text: shareData?.text,
						url,
					})
				} catch (error) {
					console.error('Failed to share URL:', error)
					// Fallback to copying
					await copyUrl(routeType, state)
				}
			} else {
				// Fallback to copying
				await copyUrl(routeType, state)
			}
		},
		[getShareableUrl, copyUrl]
	)

	return {
		getShareableUrl,
		copyUrl,
		shareUrl,
		copied,
	}
}
