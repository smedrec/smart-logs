/**
 * Compliance Navigation Hook
 *
 * Provides navigation state management and utilities for compliance routes
 */

import { COMPLIANCE_ROUTES, complianceNavigation } from '@/lib/compliance-routes'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'

export interface NavigationState {
	currentPath: string
	isCompliancePage: boolean
	activeSection: string | null
	breadcrumbs: Array<{ label: string; href?: string }>
}

export function useComplianceNavigation() {
	const routerState = useRouterState()
	const navigate = useNavigate()
	const currentPath = routerState.location.pathname
	const params = routerState.location.params as Record<string, string>

	// Determine current navigation state
	const navigationState = useMemo((): NavigationState => {
		const isCompliancePage = currentPath.startsWith('/compliance')

		let activeSection: string | null = null
		if (currentPath === COMPLIANCE_ROUTES.DASHBOARD) {
			activeSection = 'dashboard'
		} else if (currentPath.startsWith('/compliance/scheduled-reports')) {
			activeSection = 'scheduled-reports'
		} else if (currentPath === COMPLIANCE_ROUTES.EXECUTION_HISTORY) {
			activeSection = 'execution-history'
		} else if (currentPath === COMPLIANCE_ROUTES.TEMPLATES) {
			activeSection = 'templates'
		}

		// Generate breadcrumbs
		const breadcrumbs: Array<{ label: string; href?: string }> = []

		if (isCompliancePage) {
			breadcrumbs.push({ label: 'Home', href: '/dashboard' })

			if (currentPath !== COMPLIANCE_ROUTES.DASHBOARD) {
				breadcrumbs.push({ label: 'Compliance', href: COMPLIANCE_ROUTES.DASHBOARD })
			}

			if (currentPath === COMPLIANCE_ROUTES.DASHBOARD) {
				breadcrumbs.push({ label: 'Dashboard' })
			} else if (currentPath === COMPLIANCE_ROUTES.SCHEDULED_REPORTS) {
				breadcrumbs.push({ label: 'Scheduled Reports' })
			} else if (currentPath === COMPLIANCE_ROUTES.CREATE_REPORT) {
				breadcrumbs.push(
					{ label: 'Scheduled Reports', href: COMPLIANCE_ROUTES.SCHEDULED_REPORTS },
					{ label: 'Create Report' }
				)
			} else if (currentPath.includes('/scheduled-reports/') && params.reportId) {
				const reportId = params.reportId
				breadcrumbs.push(
					{ label: 'Scheduled Reports', href: COMPLIANCE_ROUTES.SCHEDULED_REPORTS },
					{ label: `Report ${reportId}`, href: COMPLIANCE_ROUTES.VIEW_REPORT(reportId) }
				)

				if (currentPath.includes('/edit')) {
					breadcrumbs.push({ label: 'Edit' })
				} else if (currentPath.includes('/executions')) {
					breadcrumbs.push({ label: 'Execution History' })
				} else if (currentPath.includes('/execute')) {
					breadcrumbs.push({ label: 'Execute' })
				}
			} else if (currentPath === COMPLIANCE_ROUTES.TEMPLATES) {
				breadcrumbs.push({ label: 'Report Templates' })
			} else if (currentPath === COMPLIANCE_ROUTES.EXECUTION_HISTORY) {
				breadcrumbs.push({ label: 'Execution History' })
			}
		}

		return {
			currentPath,
			isCompliancePage,
			activeSection,
			breadcrumbs,
		}
	}, [currentPath, params])

	// Navigation helpers
	const navigateTo = useCallback(
		{
			dashboard: () => navigate({ to: COMPLIANCE_ROUTES.DASHBOARD }),
			scheduledReports: (searchParams?: Record<string, unknown>) =>
				navigate({
					to: COMPLIANCE_ROUTES.SCHEDULED_REPORTS,
					search: searchParams,
				}),
			createReport: (searchParams?: Record<string, unknown>) =>
				navigate({
					to: COMPLIANCE_ROUTES.CREATE_REPORT,
					search: searchParams,
				}),
			editReport: (reportId: string) => navigate({ to: COMPLIANCE_ROUTES.EDIT_REPORT(reportId) }),
			viewReport: (reportId: string) => navigate({ to: COMPLIANCE_ROUTES.VIEW_REPORT(reportId) }),
			executeReport: (reportId: string) =>
				navigate({ to: COMPLIANCE_ROUTES.EXECUTE_REPORT(reportId) }),
			reportExecutions: (reportId: string, searchParams?: Record<string, unknown>) =>
				navigate({
					to: COMPLIANCE_ROUTES.REPORT_EXECUTIONS(reportId),
					search: searchParams,
				}),
			templates: (searchParams?: Record<string, unknown>) =>
				navigate({
					to: COMPLIANCE_ROUTES.TEMPLATES,
					search: searchParams,
				}),
			executionHistory: (searchParams?: Record<string, unknown>) =>
				navigate({
					to: COMPLIANCE_ROUTES.EXECUTION_HISTORY,
					search: searchParams,
				}),
		},
		[navigate]
	)

	// Route checking helpers
	const isActiveRoute = useCallback(
		(route: string) => {
			if (route === COMPLIANCE_ROUTES.DASHBOARD) {
				return currentPath === route
			}
			return currentPath.startsWith(route)
		},
		[currentPath]
	)

	const isInSection = useCallback(
		(section: string) => {
			return navigationState.activeSection === section
		},
		[navigationState.activeSection]
	)

	// URL state management helpers
	const updateSearchParams = useCallback(
		(newParams: Record<string, unknown>) => {
			navigate({
				search: (prev: Record<string, unknown>) => ({ ...prev, ...newParams }),
			})
		},
		[navigate]
	)

	const clearSearchParams = useCallback(() => {
		navigate({ search: {} })
	}, [navigate])

	const getSearchParam = useCallback(
		(key: string) => {
			return routerState.location.search?.[key]
		},
		[routerState.location.search]
	)

	return {
		// State
		...navigationState,

		// Navigation helpers
		navigateTo,

		// Route checking
		isActiveRoute,
		isInSection,

		// URL state management
		updateSearchParams,
		clearSearchParams,
		getSearchParam,

		// Raw router state for advanced usage
		routerState,
		navigate,
	}
}

/**
 * Hook for managing navigation state in compliance components
 */
export function useComplianceNavigationState() {
	const { currentPath, isCompliancePage, activeSection, isActiveRoute, isInSection } =
		useComplianceNavigation()

	return {
		currentPath,
		isCompliancePage,
		activeSection,
		isActiveRoute,
		isInSection,
	}
}

/**
 * Hook for URL state management in compliance pages
 */
export function useComplianceUrlState<T extends Record<string, unknown>>() {
	const { updateSearchParams, clearSearchParams, getSearchParam, routerState } =
		useComplianceNavigation()

	const searchParams = routerState.location.search as T

	const setSearchParam = useCallback(
		(key: keyof T, value: T[keyof T]) => {
			updateSearchParams({ [key]: value })
		},
		[updateSearchParams]
	)

	const removeSearchParam = useCallback(
		(key: keyof T) => {
			const newParams = { ...searchParams }
			delete newParams[key]
			updateSearchParams(newParams)
		},
		[searchParams, updateSearchParams]
	)

	return {
		searchParams,
		setSearchParam,
		removeSearchParam,
		getSearchParam,
		clearSearchParams,
		updateSearchParams,
	}
}
