import { AlertDashboard } from '@/components/alerts/core/AlertDashboard'
import { AlertErrorBoundary } from '@/components/alerts/error/AlertErrorBoundary'
import { useAlertStatistics } from '@/components/alerts/hooks'
import { AlertPage } from '@/components/alerts/layout/AlertPage'
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb'
import { authStateCollection } from '@/lib/auth-client'
import { recentAlertsCollection } from '@/lib/collections'
import { AlertStatus } from '@/lib/types/alert'
import { useLiveQuery } from '@tanstack/react-db'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useState } from 'react'

import type { AlertFilters as AlertFiltersType } from '@/components/alerts/types/filter-types'

export const Route = createFileRoute('/_authenticated/alerts/')({
	component: RouteComponent,
	validateSearch: (search: Record<string, unknown>) => {
		return {
			view: (search.view as string) || 'board',
			severity: search.severity as string,
			search: search.search as string,
			source: search.source as string,
			tags: search.tags as string,
		}
	},
})

function RouteComponent() {
	const navigate = useNavigate()
	const searchParams = useSearch({ from: '/_authenticated/alerts/' })
	const activeOrganizationId = authStateCollection.get('auth')?.session.activeOrganizationId
	const alertsCollection = recentAlertsCollection(activeOrganizationId)
	const { data: statistics } = useAlertStatistics(activeOrganizationId)
	const {
		data: alerts,
		isLoading,
		isError,
		status,
	} = useLiveQuery((q) =>
		q.from({ alert: alertsCollection }).orderBy(({ alert }) => alert.created_at, 'desc')
	)

	const handleViewChange = (view: 'list' | 'board' | 'statistics') => {
		navigate({
			to: '/alerts',
			search: {
				...searchParams,
				view,
			},
		})
	}

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

	return (
		<AlertErrorBoundary>
			<AlertPage>
				<div className="flex flex-1 flex-col gap-4 p-4">
					<PageBreadcrumb link="Alerts" page="Board" />

					<AlertDashboard
						alerts={alerts}
						statistics={statistics}
						loading={isLoading}
						error={isError ? status : undefined}
						initialFilters={filters}
						view={searchParams.view as 'list' | 'board' | 'statistics'}
						onViewChange={handleViewChange}
						className="flex-1"
					/>
				</div>
			</AlertPage>
		</AlertErrorBoundary>
	)
}
