import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { format } from 'date-fns'
import { AlertCircle, CheckCircle2, Clock, RefreshCw, XCircle } from 'lucide-react'
import * as React from 'react'

import type { DeliveryStatusResponse } from '@smedrec/audit-client'

interface DeliveryStatusTimelineProps {
	delivery: DeliveryStatusResponse
	className?: string
}

export function DeliveryStatusTimeline({ delivery, className }: DeliveryStatusTimelineProps) {
	const getStatusIcon = (status: string) => {
		switch (status) {
			case 'delivered':
				return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
			case 'failed':
				return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
			case 'retrying':
				return <RefreshCw className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
			case 'pending':
				return <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
			default:
				return <AlertCircle className="h-5 w-5 text-muted-foreground" />
		}
	}

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'delivered':
				return 'border-green-600 dark:border-green-400'
			case 'failed':
				return 'border-red-600 dark:border-red-400'
			case 'retrying':
				return 'border-yellow-600 dark:border-yellow-400'
			case 'pending':
				return 'border-blue-600 dark:border-blue-400'
			default:
				return 'border-muted-foreground'
		}
	}

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>Delivery Timeline</CardTitle>
				<CardDescription>
					Status history for delivery {delivery.deliveryId.substring(0, 12)}...
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-6">
					{/* Overall Status */}
					<div className="flex items-center justify-between">
						<div>
							<div className="text-sm font-medium">Overall Status</div>
							<div className="text-xs text-muted-foreground">
								Last updated {format(new Date(delivery.updatedAt), 'PPp')}
							</div>
						</div>
						<Badge variant={delivery.status === 'completed' ? 'default' : 'secondary'}>
							{delivery.status}
						</Badge>
					</div>

					<Separator />

					{/* Timeline */}
					<div className="space-y-4">
						<div className="text-sm font-medium">Destination Status</div>

						<div className="relative space-y-4">
							{/* Vertical line */}
							<div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

							{delivery.destinations.map((dest, index) => (
								<div key={index} className="relative flex gap-4">
									{/* Icon */}
									<div
										className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-background ${getStatusColor(dest.status)}`}
									>
										{getStatusIcon(dest.status)}
									</div>

									{/* Content */}
									<div className="flex-1 space-y-2 pb-4">
										<div className="flex items-center justify-between">
											<div className="font-medium text-sm">
												Destination {dest.destinationId.substring(0, 12)}...
											</div>
											<Badge variant="outline" className="capitalize">
												{dest.status}
											</Badge>
										</div>

										<div className="space-y-1 text-xs text-muted-foreground">
											<div>Attempts: {dest.attempts}</div>

											{dest.lastAttemptAt && (
												<div>Last attempt: {format(new Date(dest.lastAttemptAt), 'PPp')}</div>
											)}

											{dest.deliveredAt && (
												<div className="text-green-600 dark:text-green-400">
													Delivered: {format(new Date(dest.deliveredAt), 'PPp')}
												</div>
											)}

											{dest.failureReason && (
												<div className="text-red-600 dark:text-red-400">
													Failure: {dest.failureReason}
												</div>
											)}

											{dest.crossSystemReference && (
												<div>Reference: {dest.crossSystemReference}</div>
											)}
										</div>
									</div>
								</div>
							))}
						</div>
					</div>

					<Separator />

					{/* Metadata */}
					{delivery.metadata && Object.keys(delivery.metadata).length > 0 && (
						<div className="space-y-2">
							<div className="text-sm font-medium">Metadata</div>
							<div className="rounded-md bg-muted p-3 text-xs font-mono space-y-1">
								{Object.entries(delivery.metadata).map(([key, value]) => (
									<div key={key} className="flex justify-between">
										<span className="text-muted-foreground">{key}:</span>
										<span>{String(value)}</span>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Timestamps */}
					<div className="grid grid-cols-2 gap-4 text-xs">
						<div>
							<div className="text-muted-foreground">Created</div>
							<div className="font-medium">{format(new Date(delivery.createdAt), 'PPp')}</div>
						</div>
						<div>
							<div className="text-muted-foreground">Last Updated</div>
							<div className="font-medium">{format(new Date(delivery.updatedAt), 'PPp')}</div>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
