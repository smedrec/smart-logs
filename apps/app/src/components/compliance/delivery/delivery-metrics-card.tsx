import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowRight, CheckCircle2, TrendingUp, XCircle } from 'lucide-react'
import * as React from 'react'

import type { DeliveryMetrics } from '@smedrec/audit-client'

interface DeliveryMetricsCardProps {
	metrics?: DeliveryMetrics | null
	loading?: boolean
	onViewDetails?: () => void
	className?: string
}

export function DeliveryMetricsCard({
	metrics,
	loading = false,
	onViewDetails,
	className,
}: DeliveryMetricsCardProps) {
	if (loading) {
		return (
			<Card className={className}>
				<CardHeader>
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-4 w-64" />
				</CardHeader>
				<CardContent className="space-y-4">
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-3/4" />
				</CardContent>
			</Card>
		)
	}

	if (!metrics) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<TrendingUp className="h-5 w-5" />
						Delivery Metrics
					</CardTitle>
					<CardDescription>Monitor delivery performance and health</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-center py-8 text-muted-foreground">
						<p className="text-sm">No delivery metrics available</p>
						<p className="text-xs mt-1">Metrics will appear once reports are delivered</p>
					</div>
				</CardContent>
			</Card>
		)
	}

	const successRate = parseFloat(metrics.successRate)
	const hasFailures = metrics.failedDeliveries > 0

	return (
		<Card className={className}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<TrendingUp className="h-5 w-5" />
							Delivery Metrics
						</CardTitle>
						<CardDescription>
							{metrics.timeRange.start} to {metrics.timeRange.end}
						</CardDescription>
					</div>
					{onViewDetails && (
						<Button variant="ghost" size="sm" onClick={onViewDetails}>
							View Details
							<ArrowRight className="ml-2 h-4 w-4" />
						</Button>
					)}
				</div>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Overall Stats */}
				<div className="grid grid-cols-3 gap-4 text-center">
					<div>
						<div className="text-2xl font-bold">{metrics.totalDeliveries.toLocaleString()}</div>
						<div className="text-xs text-muted-foreground">Total</div>
					</div>
					<div>
						<div className="text-2xl font-bold text-green-600 dark:text-green-400">
							{metrics.successfulDeliveries.toLocaleString()}
						</div>
						<div className="text-xs text-muted-foreground">Successful</div>
					</div>
					<div>
						<div
							className={`text-2xl font-bold ${hasFailures ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}
						>
							{metrics.failedDeliveries.toLocaleString()}
						</div>
						<div className="text-xs text-muted-foreground">Failed</div>
					</div>
				</div>

				{/* Success Rate */}
				<div className="space-y-2">
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">Success Rate</span>
						<span className="font-medium">{successRate.toFixed(1)}%</span>
					</div>
					<Progress value={successRate} className="h-2" />
				</div>

				{/* Average Delivery Time */}
				<div className="flex items-center justify-between p-3 rounded-lg bg-muted">
					<span className="text-sm text-muted-foreground">Avg. Delivery Time</span>
					<span className="text-sm font-medium">{metrics.averageDeliveryTime.toFixed(2)}s</span>
				</div>

				{/* Status Indicators */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						{successRate >= 95 ? (
							<>
								<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
								<span className="text-sm text-green-600 dark:text-green-400">Healthy</span>
							</>
						) : hasFailures ? (
							<>
								<XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
								<span className="text-sm text-red-600 dark:text-red-400">Issues Detected</span>
							</>
						) : (
							<>
								<CheckCircle2 className="h-4 w-4 text-muted-foreground" />
								<span className="text-sm text-muted-foreground">Normal</span>
							</>
						)}
					</div>
					<Badge variant={successRate >= 95 ? 'default' : 'secondary'}>
						{metrics.totalDeliveries} deliveries
					</Badge>
				</div>
			</CardContent>
		</Card>
	)
}
