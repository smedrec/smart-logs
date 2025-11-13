import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { format } from 'date-fns'
import {
	Activity,
	AlertCircle,
	Calendar,
	CheckCircle2,
	Clock,
	TrendingUp,
	XCircle,
} from 'lucide-react'
import * as React from 'react'

import type { DeliveryDestination, DestinationHealth } from '@smedrec/audit-client'

interface DestinationUsageCardProps {
	destination: DeliveryDestination
	health?: DestinationHealth | null
	className?: string
}

export function DestinationUsageCard({
	destination,
	health,
	className,
}: DestinationUsageCardProps) {
	const successRate = health ? parseFloat(health.successRate) : 0
	const hasUsage = destination.countUsage > 0

	const getHealthStatusColor = (status?: string) => {
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

	const getHealthStatusIcon = (status?: string) => {
		switch (status) {
			case 'healthy':
				return <CheckCircle2 className="h-4 w-4" />
			case 'degraded':
				return <AlertCircle className="h-4 w-4" />
			case 'unhealthy':
				return <XCircle className="h-4 w-4" />
			case 'disabled':
				return <XCircle className="h-4 w-4" />
			default:
				return <Activity className="h-4 w-4" />
		}
	}

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle className="flex items-center justify-between">
					<span className="flex items-center gap-2">
						<Activity className="h-5 w-5" />
						Usage & Metrics
					</span>
					{health && (
						<Badge
							variant={health.status === 'healthy' ? 'default' : 'secondary'}
							className={getHealthStatusColor(health.status)}
						>
							{getHealthStatusIcon(health.status)}
							<span className="ml-1 capitalize">{health.status}</span>
						</Badge>
					)}
				</CardTitle>
				<CardDescription>Delivery statistics and health metrics</CardDescription>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Usage Statistics */}
				<div className="space-y-4">
					<h4 className="text-sm font-medium">Usage Statistics</h4>

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-1">
							<div className="text-2xl font-bold">{destination.countUsage.toLocaleString()}</div>
							<div className="text-xs text-muted-foreground">Total Deliveries</div>
						</div>

						{destination.lastUsedAt && (
							<div className="space-y-1">
								<div className="text-sm font-medium">
									{format(new Date(destination.lastUsedAt), 'MMM dd, yyyy')}
								</div>
								<div className="text-xs text-muted-foreground flex items-center gap-1">
									<Clock className="h-3 w-3" />
									Last Used
								</div>
							</div>
						)}
					</div>

					{!hasUsage && (
						<div className="text-sm text-muted-foreground bg-muted rounded-md p-3">
							This destination has not been used yet
						</div>
					)}
				</div>

				{/* Health Metrics */}
				{health && hasUsage && (
					<>
						<Separator />

						<div className="space-y-4">
							<h4 className="text-sm font-medium">Health Metrics</h4>

							{/* Success Rate */}
							<div className="space-y-2">
								<div className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">Success Rate</span>
									<span className="font-medium">{successRate.toFixed(1)}%</span>
								</div>
								<Progress value={successRate} className="h-2" />
							</div>

							{/* Delivery Stats */}
							<div className="grid grid-cols-3 gap-4 text-center">
								<div className="space-y-1">
									<div className="text-lg font-semibold text-green-600 dark:text-green-400">
										{health.totalDeliveries - health.totalFailures}
									</div>
									<div className="text-xs text-muted-foreground">Successful</div>
								</div>
								<div className="space-y-1">
									<div className="text-lg font-semibold text-red-600 dark:text-red-400">
										{health.totalFailures}
									</div>
									<div className="text-xs text-muted-foreground">Failed</div>
								</div>
								<div className="space-y-1">
									<div className="text-lg font-semibold">{health.totalDeliveries}</div>
									<div className="text-xs text-muted-foreground">Total</div>
								</div>
							</div>

							{/* Average Response Time */}
							{health.averageResponseTime !== undefined && (
								<div className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">Avg Response Time</span>
									<span className="font-medium">{health.averageResponseTime}ms</span>
								</div>
							)}

							{/* Consecutive Failures */}
							{health.consecutiveFailures > 0 && (
								<div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-2">
									<AlertCircle className="h-4 w-4" />
									<span>{health.consecutiveFailures} consecutive failures</span>
								</div>
							)}
						</div>
					</>
				)}

				{/* Last Activity */}
				<Separator />

				<div className="space-y-3">
					<h4 className="text-sm font-medium">Activity Timeline</h4>

					<div className="space-y-2 text-sm">
						{destination.lastUsedAt && (
							<div className="flex items-center gap-2 text-muted-foreground">
								<TrendingUp className="h-4 w-4" />
								<span>Last delivery: {format(new Date(destination.lastUsedAt), 'PPp')}</span>
							</div>
						)}

						{health?.lastSuccessAt && (
							<div className="flex items-center gap-2 text-green-600 dark:text-green-400">
								<CheckCircle2 className="h-4 w-4" />
								<span>Last success: {format(new Date(health.lastSuccessAt), 'PPp')}</span>
							</div>
						)}

						{health?.lastFailureAt && (
							<div className="flex items-center gap-2 text-red-600 dark:text-red-400">
								<XCircle className="h-4 w-4" />
								<span>Last failure: {format(new Date(health.lastFailureAt), 'PPp')}</span>
							</div>
						)}

						<div className="flex items-center gap-2 text-muted-foreground">
							<Calendar className="h-4 w-4" />
							<span>Created: {format(new Date(destination.createdAt), 'PPp')}</span>
						</div>
					</div>
				</div>

				{/* Circuit Breaker Status */}
				{health?.circuitBreakerState && health.circuitBreakerState !== 'closed' && (
					<>
						<Separator />

						<div className="space-y-2">
							<h4 className="text-sm font-medium">Circuit Breaker</h4>
							<div className="flex items-center gap-2">
								<Badge
									variant={health.circuitBreakerState === 'open' ? 'destructive' : 'secondary'}
								>
									{health.circuitBreakerState.toUpperCase()}
								</Badge>
								{health.circuitBreakerOpenedAt && (
									<span className="text-xs text-muted-foreground">
										Opened: {format(new Date(health.circuitBreakerOpenedAt), 'PPp')}
									</span>
								)}
							</div>
							{health.circuitBreakerState === 'open' && (
								<p className="text-xs text-muted-foreground">
									The circuit breaker is open due to repeated failures. Deliveries are temporarily
									blocked.
								</p>
							)}
						</div>
					</>
				)}
			</CardContent>
		</Card>
	)
}
