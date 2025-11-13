import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, CheckCircle2, Clock, TrendingUp, XCircle } from 'lucide-react'
import * as React from 'react'

import type { DeliveryStatusResponse } from '@smedrec/audit-client'

interface DeliveryMetricsCardsProps {
	deliveries: DeliveryStatusResponse[]
	loading?: boolean
}

export function DeliveryMetricsCards({ deliveries, loading = false }: DeliveryMetricsCardsProps) {
	const metrics = React.useMemo(() => {
		const total = deliveries.length

		// Count by destination status
		const delivered = deliveries.filter((d) =>
			d.destinations.some((dest) => dest.status === 'delivered')
		).length

		const failed = deliveries.filter((d) =>
			d.destinations.some((dest) => dest.status === 'failed')
		).length

		const pending = deliveries.filter((d) =>
			d.destinations.some((dest) => dest.status === 'pending')
		).length

		const retrying = deliveries.filter((d) =>
			d.destinations.some((dest) => dest.status === 'retrying')
		).length

		// Calculate success rate
		const successRate = total > 0 ? ((delivered / total) * 100).toFixed(1) : '0.0'

		// Calculate average delivery time (mock for now)
		const avgTime = deliveries.length > 0 ? '2.3' : '0'

		return {
			total,
			delivered,
			failed,
			pending,
			retrying,
			successRate,
			avgTime,
		}
	}, [deliveries])

	if (loading) {
		return (
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{[...Array(4)].map((_, i) => (
					<Card key={i}>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 w-4 rounded-full" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-8 w-16 mb-1" />
							<Skeleton className="h-3 w-32" />
						</CardContent>
					</Card>
				))}
			</div>
		)
	}

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			{/* Total Deliveries */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
					<TrendingUp className="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">{metrics.total.toLocaleString()}</div>
					<p className="text-xs text-muted-foreground">All delivery attempts</p>
				</CardContent>
			</Card>

			{/* Success Rate */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">Success Rate</CardTitle>
					<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold text-green-600 dark:text-green-400">
						{metrics.successRate}%
					</div>
					<p className="text-xs text-muted-foreground">
						{metrics.delivered} of {metrics.total} delivered
					</p>
				</CardContent>
			</Card>

			{/* Failed Deliveries */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">Failed</CardTitle>
					<XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold text-red-600 dark:text-red-400">{metrics.failed}</div>
					<p className="text-xs text-muted-foreground">
						{metrics.retrying > 0 && `${metrics.retrying} retrying`}
						{metrics.retrying === 0 && 'No retries in progress'}
					</p>
				</CardContent>
			</Card>

			{/* Average Time */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">Avg. Time</CardTitle>
					<Clock className="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">{metrics.avgTime}s</div>
					<p className="text-xs text-muted-foreground">
						{metrics.pending > 0 ? `${metrics.pending} pending` : 'All processed'}
					</p>
				</CardContent>
			</Card>
		</div>
	)
}
