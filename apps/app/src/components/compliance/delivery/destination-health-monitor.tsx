import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
	AlertCircle,
	AlertTriangle,
	ArrowRight,
	CheckCircle2,
	RefreshCw,
	XCircle,
} from 'lucide-react'
import * as React from 'react'

import type { DeliveryDestination, DestinationHealth } from '@smedrec/audit-client'

interface DestinationHealthItem {
	destination: DeliveryDestination
	health: DestinationHealth
}

interface DestinationHealthMonitorProps {
	destinations: DestinationHealthItem[]
	loading?: boolean
	onRefresh?: () => void
	onViewDestination?: (destinationId: string) => void
	className?: string
}

const getHealthIcon = (status: string) => {
	switch (status) {
		case 'healthy':
			return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
		case 'degraded':
			return <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
		case 'unhealthy':
			return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
		case 'disabled':
			return <XCircle className="h-4 w-4 text-muted-foreground" />
		default:
			return <AlertCircle className="h-4 w-4 text-muted-foreground" />
	}
}

const getHealthColor = (status: string) => {
	switch (status) {
		case 'healthy':
			return 'text-green-600 dark:text-green-400'
		case 'degraded':
			return 'text-yellow-600 dark:text-yellow-400'
		case 'unhealthy':
			return 'text-red-600 dark:text-red-400'
		case 'disabled':
			return 'text-muted-foreground'
		default:
			return 'text-muted-foreground'
	}
}

export function DestinationHealthMonitor({
	destinations,
	loading = false,
	onRefresh,
	onViewDestination,
	className,
}: DestinationHealthMonitorProps) {
	if (loading) {
		return (
			<Card className={className}>
				<CardHeader>
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-4 w-64" />
				</CardHeader>
				<CardContent className="space-y-3">
					{[...Array(3)].map((_, i) => (
						<Skeleton key={i} className="h-16 w-full" />
					))}
				</CardContent>
			</Card>
		)
	}

	const healthyCount = destinations.filter((d) => d.health.status === 'healthy').length
	const degradedCount = destinations.filter((d) => d.health.status === 'degraded').length
	const unhealthyCount = destinations.filter((d) => d.health.status === 'unhealthy').length
	const disabledCount = destinations.filter((d) => d.health.status === 'disabled').length

	// Sort by health status (unhealthy first, then degraded, then healthy)
	const sortedDestinations = [...destinations].sort((a, b) => {
		const statusOrder = { unhealthy: 0, degraded: 1, healthy: 2, disabled: 3 }
		return statusOrder[a.health.status] - statusOrder[b.health.status]
	})

	return (
		<Card className={className}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<AlertCircle className="h-5 w-5" />
							Destination Health
						</CardTitle>
						<CardDescription>Monitor delivery destination status</CardDescription>
					</div>
					{onRefresh && (
						<Button variant="ghost" size="sm" onClick={onRefresh}>
							<RefreshCw className="h-4 w-4" />
						</Button>
					)}
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Health Summary */}
				<div className="grid grid-cols-4 gap-2 text-center text-sm">
					<div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
						<div className="font-bold text-green-600 dark:text-green-400">{healthyCount}</div>
						<div className="text-xs text-muted-foreground">Healthy</div>
					</div>
					<div className="p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
						<div className="font-bold text-yellow-600 dark:text-yellow-400">{degradedCount}</div>
						<div className="text-xs text-muted-foreground">Degraded</div>
					</div>
					<div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
						<div className="font-bold text-red-600 dark:text-red-400">{unhealthyCount}</div>
						<div className="text-xs text-muted-foreground">Unhealthy</div>
					</div>
					<div className="p-2 rounded-lg bg-muted">
						<div className="font-bold text-muted-foreground">{disabledCount}</div>
						<div className="text-xs text-muted-foreground">Disabled</div>
					</div>
				</div>

				{/* Destination List */}
				{destinations.length === 0 ? (
					<div className="text-center py-8 text-muted-foreground">
						<AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
						<p className="text-sm">No destinations to monitor</p>
					</div>
				) : (
					<div className="space-y-2">
						{sortedDestinations.slice(0, 5).map(({ destination, health }) => {
							const successRate = parseFloat(health.successRate)

							return (
								<div
									key={destination.id}
									className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
									onClick={() => onViewDestination?.(destination.id)}
								>
									<div className="flex-shrink-0">{getHealthIcon(health.status)}</div>

									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<span className="font-medium truncate">{destination.label}</span>
											<Badge variant="outline" className="capitalize flex-shrink-0">
												{destination.type}
											</Badge>
										</div>

										<div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
											<span>{health.totalDeliveries} deliveries</span>
											<span className={getHealthColor(health.status)}>
												{successRate.toFixed(0)}% success
											</span>
											{health.consecutiveFailures > 0 && (
												<span className="text-red-600 dark:text-red-400">
													{health.consecutiveFailures} consecutive failures
												</span>
											)}
										</div>

										{health.status !== 'disabled' && (
											<Progress value={successRate} className="h-1 mt-2" />
										)}
									</div>

									{onViewDestination && (
										<ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
									)}
								</div>
							)
						})}

						{destinations.length > 5 && (
							<Button variant="ghost" size="sm" className="w-full" onClick={onRefresh}>
								View All {destinations.length} Destinations
							</Button>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	)
}
