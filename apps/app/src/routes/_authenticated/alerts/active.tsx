import { AlertDetails } from '@/components/alerts'
import { AlertDashboard } from '@/components/alerts/core/AlertDashboard'
import { AlertList } from '@/components/alerts/core/AlertList'
import { AlertErrorBoundary } from '@/components/alerts/error/AlertErrorBoundary'
import { AlertFilters } from '@/components/alerts/forms/AlertFilters'
import { useAlertQueries } from '@/components/alerts/hooks/use-alert-queries'
import { AlertPage } from '@/components/alerts/layout/AlertPage'
import { AlertStatus } from '@/components/alerts/types/alert-types'
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb'
import { authStateCollection } from '@/lib/auth-client'
import { recentAlertsCollection } from '@/lib/collections'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useState } from 'react'

import type { AlertFilters as AlertFiltersType } from '@/components/alerts/types/filter-types'
import type { Alert } from '@/lib/collections'

// URL search params validation
const activeAlertsSearchSchema = {
	page: Number,
	pageSize: Number,
	severity: String,
	search: String,
	source: String,
	tags: String,
}

export const Route = createFileRoute('/_authenticated/alerts/active')({
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

function RouteComponent() {
	const navigate = useNavigate()
	const searchParams = useSearch({ from: '/_authenticated/alerts/active' })
	const activeOrganizationId = authStateCollection.get('auth')?.session.activeOrganizationId
	const alertsCollection = recentAlertsCollection(activeOrganizationId)
	const {
		data: alerts,
		isLoading,
		isError,
		status,
	} = useLiveQuery((q) =>
		q
			.from({ alert: alertsCollection })
			.where(({ alert }) => eq(alert.resolved, 'false'))
			.orderBy(({ alert }) => alert.created_at, 'desc')
	)

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

	// Use alert queries hook for data fetching
	/**const { alerts, isLoading, error, refetch } = useAlertQueries({
		filters,
		pagination: {
			page: searchParams.page,
			pageSize: searchParams.pageSize,
			total: 0,
			hasNext: false,
			hasPrevious: false,
		},
	})*/

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
			to: '/alerts/active',
			search: {
				...searchParams,
				...searchQuery,
				page: 1, // Reset to first page when filters change
			},
		})
	}

	const handleAlertSelect = (alert: Alert) => {
		navigate({
			to: '/alerts/active',
			search: {
				...searchParams,
				alertId: alert.id,
			},
		})
	}

	return (
		<AlertErrorBoundary>
			<AlertPage>
				<div className="flex flex-1 flex-col gap-4 p-4">
					<PageBreadcrumb link="Alerts" page="Active" />

					{/* Filters 
					<AlertFilters
						filters={filters}
						onFiltersChange={handleFilterChange}
						availableFilters={[]}
						onReset={() => handleFilterChange({ status: [AlertStatus.ACTIVE] })}
					/> */}

					{/**searchParams.alertId && (
						<AlertDetails alert={alerts.find((i) => i.id === searchParams.alertId)} />
					)*/}
					{/* Alert List */}
					<AlertList
						alerts={alerts || []}
						filters={filters}
						onFilterChange={handleFilterChange}
						onAlertSelect={handleAlertSelect}
						loading={isLoading}
						error={isError ? status : undefined}
						className="flex-1"
					/>
				</div>
			</AlertPage>
		</AlertErrorBoundary>
	)
}
