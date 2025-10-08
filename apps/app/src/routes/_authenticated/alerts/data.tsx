import AlertCard from '@/components/alerts/core/AlertCard'
import AlertList from '@/components/alerts/core/AlertList'
import { DataTable } from '@/components/alerts/data-table'
import {
	ALERT_SHORTCUTS,
	useAlertKeyboardNavigation,
} from '@/components/alerts/hooks/use-alert-keyboard-navigation'
import { useAlertAction } from '@/components/alerts/hooks/use-alert-queries'
import { AlertResponsiveGrid } from '@/components/alerts/layout/alert-responsive-container'
import { AlertResponsiveDataView } from '@/components/alerts/layout/alert-responsive-data-view'
import { AlertStatus } from '@/components/alerts/types/alert-types'
import { PageHeader } from '@/components/navigation'
import { Spinner } from '@/components/ui/spinner'
import { authStateCollection } from '@/lib/auth-client'
import { recentAlertsCollection } from '@/lib/collections'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useRef, useState } from 'react'

import type { DataTableRef } from '@/components/alerts/data-table'
import type { AlertFilters as AlertFiltersType } from '@/components/alerts/types/filter-types'
import type { Alert } from '@/lib/collections'

export const Route = createFileRoute('/_authenticated/alerts/data')({
	component: RouteComponent,
	validateSearch: (search: Record<string, unknown>) => {
		return {
			page: Number(search.page) || 1,
			pageSize: Number(search.pageSize) || 25,
			severity: search.severity as string,
			search: search.search as string,
			source: search.source as string,
			tags: search.tags as string,
			alertId: search.alertId as string,
		}
	},
})

// URL search params validation
const alertsSearchSchema = {
	page: Number,
	pageSize: Number,
	severity: String,
	search: String,
	source: String,
	tags: String,
}

function RouteComponent() {
	const navigate = useNavigate()
	const searchParams = useSearch({ from: '/_authenticated/alerts/data' })
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [showShortcuts, setShowShortcuts] = useState(false)
	const activeOrganizationId = authStateCollection.get('auth')?.session.activeOrganizationId
	const alertsCollection = recentAlertsCollection(activeOrganizationId)
	const dataTableRef = useRef<DataTableRef>(null)
	const { acknowledge, resolve, dismiss } = useAlertAction()
	const {
		data: activeAlerts,
		isLoading,
		isError,
		status,
	} = useLiveQuery((q) => q.from({ alert: alertsCollection }))

	// Convert URL params to filters
	const [filters, setFilters] = useState<AlertFiltersType>(() => {
		const initialFilters: AlertFiltersType = {
			status: [AlertStatus.ACTIVE],
		}

		if (searchParams.severity) {
			initialFilters.severity = searchParams.severity.split(',') as any[]
		}
		if (searchParams.search) {
			initialFilters.search = searchParams.search
		}
		if (searchParams.source) {
			initialFilters.source = searchParams.source.split(',')
		}
		if (searchParams.tags) {
			initialFilters.tags = searchParams.tags.split(',')
		}

		return initialFilters
	})

	const handleFilterChange = (newFilters: AlertFiltersType) => {
		setFilters(newFilters)

		// Update URL with new filters
		const searchQuery: Record<string, string> = {}

		if (newFilters.severity?.length) {
			searchQuery.severity = newFilters.severity.join(',')
		}
		if (newFilters.search) {
			searchQuery.search = newFilters.search
		}
		if (newFilters.source?.length) {
			searchQuery.source = newFilters.source.join(',')
		}
		if (newFilters.tags?.length) {
			searchQuery.tags = newFilters.tags.join(',')
		}

		navigate({
			to: '/alerts/data',
			search: {
				...searchParams,
				...searchQuery,
				page: 1, // Reset to first page when filters change
			},
		})
	}

	const handleAlertSelect = (alert: Alert) => {
		navigate({
			to: '/alerts/data',
			search: {
				...searchParams,
				alertId: alert.id,
			},
		})
	}

	const handleSearchFocus = () => {
		const searchInput = document.querySelector('[data-alert-search]') as HTMLInputElement
		if (searchInput) {
			searchInput.focus()
		}
	}

	const handleFilterFocus = () => {
		const filterButton = document.querySelector('[data-alert-filters]') as HTMLButtonElement
		if (filterButton) {
			filterButton.focus()
		}
	}

	// Keyboard shortcuts
	const shortcuts = [
		{
			...ALERT_SHORTCUTS.SEARCH_ALERTS,
			action: handleSearchFocus,
		},
		{
			...ALERT_SHORTCUTS.FILTER_ALERTS,
			action: handleFilterFocus,
		},
		{
			...ALERT_SHORTCUTS.SHOW_SHORTCUTS,
			action: () => setShowShortcuts(true),
		},
	]

	const handleResolveAlert = async (id: string, note: string) => {
		resolve.mutate({ alertId: id, action: 'resolve', notes: note })
	}

	const handleAcknowledgeAlert = async (id: string) => {
		acknowledge.mutate({ alertId: id, action: 'acknowledge' })
	}

	const handleDismissAlert = async (id: string) => {
		dismiss.mutate({ alertId: id, action: 'dismiss' })
	}

	const renderTable = (alerts: Alert[]) => {
		return (
			<DataTable
				ref={dataTableRef}
				data={alerts}
				loading={isLoading}
				error={isError ? status : undefined}
				onResolveAlert={handleResolveAlert}
				onAcknowledgeAlert={handleAcknowledgeAlert}
				onDismissAlert={handleDismissAlert}
			/>
		)
	}

	const renderList = (alerts: Alert[]) => {
		return (
			<AlertList
				alerts={alerts || []}
				filters={filters}
				virtualScrolling={true}
				onFilterChange={handleFilterChange}
				onAlertSelect={handleAlertSelect}
				alertFocusedId={searchParams.alertId || undefined}
				loading={isLoading}
				error={isError ? status : undefined}
				className="flex-1"
			/>
		)
	}

	const renderCards = (alerts: Alert[]) => {
		function handleAlertAction(
			alertId: string,
			action: 'resolve' | 'acknowledge' | 'dismiss'
		): void {
			throw new Error('Function not implemented.')
		}

		return (
			<AlertResponsiveGrid>
				{alerts.map((alert) => (
					<AlertCard alert={alert} onAlertAction={handleAlertAction} key={alert.id} />
				))}
			</AlertResponsiveGrid>
		)
	}

	return (
		<div className="flex flex-1 flex-col gap-4 p-4">
			{/* Page Header */}
			<PageHeader
				title="All Alerts"
				description="Manage and respond to system alerts"
				shortcuts={shortcuts}
			/>

			<div className="min-h-[100vh] flex-1 rounded-xl md:min-h-min">
				{isLoading ? (
					<div className="flex flex-1 items-center justify-center">
						<Spinner variant="bars" size={64} />
					</div>
				) : (
					<AlertResponsiveDataView
						alerts={activeAlerts || []}
						renderTable={renderTable}
						renderCards={renderCards}
						renderList={renderList}
					/>
				)}
			</div>
		</div>
	)
}
