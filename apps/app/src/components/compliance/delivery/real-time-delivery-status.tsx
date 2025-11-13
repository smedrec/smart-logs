import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { AlertCircle, CheckCircle2, Clock, RefreshCw, XCircle } from 'lucide-react'
import * as React from 'react'

import type { DeliveryStatusResponse, DestinationDeliveryStatus } from '@smedrec/audit-client'

interface RealTimeDeliveryStatusProps {
	deliveries: DeliveryStatusResponse[]
	loading?: boolean
	onRefresh?: () => void
	onViewDelivery?: (deliveryId: string) => void
	maxItems?: number
	className?: string
}

const getStatusIcon = (status: DestinationDeliveryStatus) => {
	switch (status) {
		case 'delivered':
			return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
		case 'failed':
			return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
		case 'retrying':
			return <RefreshCw className="h-4 w-4 text-yellow-600 dark:text-yellow-400 animate-spin" />
		case 'pending':
			return <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
		default:
			return <AlertCircle className="h-4 w-4 text-muted-foreground" />
	}
}

const getStatusColor = (status: DestinationDeliveryStatus) => {
	switch (status) {
		case 'delivered':
			return 'text-green-600 dark:text-green-400'
		case 'failed':
			return 'text-red-600 dark:text-red-400'
		case 'retrying':
			return 'text-yellow-600 dark:text-yellow-400'
		case 'pending':
			return 'text-blue-600 dark:text-blue-400'
		default:
			return 'text-muted-foreground'
	}
}

export function RealTimeDeliveryStatus({
	deliveries,
	loading = false,
	onRefresh,
	onViewDelivery,
	maxItems = 10,
	className,
}: RealTimeDeliveryStatusProps) {
	if (loading) {
		return (
			<Card className={className}>
				<CardHeader>
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-4 w-64" />
				</CardHeader>
				<CardContent className="space-y-3">
					{[...Array(5)].map((_, i) => (
						<Skeleton key={i} className="h-16 w-full" />
					))}
				</CardContent>
			</Card>
		)
	}

	// Sort by most recent first
	const sortedDeliveries = [...deliveries]
		.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
		.slice(0, maxItems)

	return (
		<Card className={className}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<Clock className="h-5 w-5" />
							Recent Deliveries
						</CardTitle>
						<CardDescription>Real-time delivery status updates</CardDescription>
					</div>
					{onRefresh && (
						<Button variant="ghost" size="sm" onClick={onRefresh}>
							<RefreshCw className="h-4 w-4" />
						</Button>
					)}
				</div>
			</CardHeader>

			<CardContent>
				{deliveries.length === 0 ? (
					<div className="text-center py-8 text-muted-foreground">
						<Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
						<p className="text-sm">No recent deliveries</p>
						<p className="text-xs mt-1">Deliveries will appear here in real-time</p>
					</div>
				) : (
					<ScrollArea className="h-[400px] pr-4">
						<div className="space-y-3">
							{sortedDeliveries.map((delivery) => {
								const allDelivered = delivery.destinations.every((d) => d.status === 'delivered')
								const hasFailures = delivery.destinations.some((d) => d.status === 'failed')
								const isPending = delivery.destinations.some((d) => d.status === 'pending')
								const isRetrying = delivery.destinations.some((d) => d.status === 'retrying')

								let overallStatus: DestinationDeliveryStatus = 'delivered'
								if (hasFailures) overallStatus = 'failed'
								else if (isRetrying) overallStatus = 'retrying'
								else if (isPending) overallStatus = 'pending'

								return (
									<div
										key={delivery.deliveryId}
										className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
										onClick={() => onViewDelivery?.(delivery.deliveryId)}
									>
										<div className="flex-shrink-0 mt-1">{getStatusIcon(overallStatus)}</div>

										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<span className="font-mono text-sm truncate">
													{delivery.deliveryId.substring(0, 12)}...
												</span>
												<Badge
													variant={
														allDelivered ? 'default' : hasFailures ? 'destructive' : 'secondary'
													}
													className="capitalize flex-shrink-0"
												>
													{overallStatus}
												</Badge>
											</div>

											<div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
												<span>{format(new Date(delivery.createdAt), 'MMM dd, HH:mm')}</span>
												<span>•</span>
												<span>{delivery.destinations.length} destinations</span>
											</div>

											{/* Destination Status Summary */}
											<div className="flex flex-wrap gap-1 mt-2">
												{delivery.destinations.map((dest, index) => (
													<div
														key={index}
														className={`flex items-center gap-1 text-xs ${getStatusColor(dest.status)}`}
													>
														{getStatusIcon(dest.status)}
														<span className="capitalize">{dest.status}</span>
													</div>
												))}
											</div>
										</div>
									</div>
								)
							})}
						</div>
					</ScrollArea>
				)}
			</CardContent>
		</Card>
	)
}
