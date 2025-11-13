import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import * as React from 'react'

import { ErrorAlert } from '../error/error-alert'
import { CompliancePage } from '../layout/compliance-page'
import { DeliveryHistoryDataTable } from './delivery-history-data-table'
import { DeliveryHistoryFilters } from './delivery-history-filters'
import { DeliveryMetricsCards } from './delivery-metrics-cards'

import type { DeliveryStatusResponse } from '@smedrec/audit-client'
import type { DeliveryHistoryFilters as Filters } from './delivery-history-filters'

interface DeliveryHistoryPageProps {
	onRetryDelivery?: (deliveryId: string) => Promise<void>
	onViewDelivery?: (deliveryId: string) => void
	onViewDestination?: (destinationId: string) => void
}

export function DeliveryHistoryPage({
	onRetryDelivery,
	onViewDelivery,
	onViewDestination,
}: DeliveryHistoryPageProps) {
	const [deliveries, setDeliveries] = React.useState<DeliveryStatusResponse[]>([])
	const [loading, setLoading] = React.useState(false)
	const [error, setError] = React.useState<string | undefined>()
	const [filters, setFilters] = React.useState<Filters>({})
	const [refreshing, setRefreshing] = React.useState(false)

	// Load deliveries
	React.useEffect(() => {
		loadDeliveries()
	}, [filters])

	const loadDeliveries = async () => {
		setLoading(true)
		setError(undefined)

		try {
			// TODO: Replace with real API call
			// const response = await auditClient.delivery.listDeliveries({
			//   status: filters.status,
			//   destinationId: filters.destinationId,
			//   startDate: filters.dateRange?.from,
			//   endDate: filters.dateRange?.to,
			//   limit: 50,
			//   sortBy: 'createdAt',
			//   sortOrder: 'desc',
			// })
			// setDeliveries(response.data)

			// Mock data for demonstration
			await new Promise((resolve) => setTimeout(resolve, 500))
			setDeliveries([])
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load delivery history')
		} finally {
			setLoading(false)
		}
	}

	const handleRefresh = async () => {
		setRefreshing(true)
		await loadDeliveries()
		setRefreshing(false)
	}

	// Filter deliveries based on search
	const filteredDeliveries = React.useMemo(() => {
		let filtered = deliveries

		if (filters.search) {
			const searchLower = filters.search.toLowerCase()
			filtered = filtered.filter((delivery) =>
				delivery.deliveryId.toLowerCase().includes(searchLower)
			)
		}

		if (filters.status) {
			filtered = filtered.filter((delivery) =>
				delivery.destinations.some((dest) => dest.status === filters.status)
			)
		}

		if (filters.destinationId) {
			filtered = filtered.filter((delivery) =>
				delivery.destinations.some((dest) => dest.destinationId === filters.destinationId)
			)
		}

		if (filters.dateRange?.from) {
			filtered = filtered.filter(
				(delivery) => new Date(delivery.createdAt) >= filters.dateRange!.from!
			)
		}

		if (filters.dateRange?.to) {
			filtered = filtered.filter(
				(delivery) => new Date(delivery.createdAt) <= filters.dateRange!.to!
			)
		}

		return filtered
	}, [deliveries, filters])

	return (
		<CompliancePage
			title="Delivery History"
			description="Monitor and track delivery status for compliance reports"
			actions={
				<Button onClick={handleRefresh} disabled={refreshing} variant="outline">
					<RefreshCw className={`mr-2 size-4 ${refreshing ? 'animate-spin' : ''}`} />
					Refresh
				</Button>
			}
		>
			<div className="space-y-6">
				{error && (
					<ErrorAlert
						error={{ code: 'LOAD_ERROR', message: error }}
						dismissible
						onDismiss={() => setError(undefined)}
						actions={[
							{
								label: 'Retry',
								onClick: loadDeliveries,
							},
						]}
					/>
				)}

				{/* Metrics Cards */}
				<DeliveryMetricsCards deliveries={filteredDeliveries} loading={loading} />

				{/* Filters */}
				<DeliveryHistoryFilters filters={filters} onFiltersChange={setFilters} />

				{/* Delivery History Table */}
				<DeliveryHistoryDataTable
					data={filteredDeliveries}
					loading={loading}
					error={error}
					onRetryDelivery={onRetryDelivery}
					onViewDelivery={onViewDelivery}
					onViewDestination={onViewDestination}
				/>
			</div>
		</CompliancePage>
	)
}
