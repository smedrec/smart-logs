import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, X, XCircle } from 'lucide-react'
import * as React from 'react'

import type { DeliveryDestination, DestinationHealth } from '@smedrec/audit-client'

interface DestinationAlert {
	destination: DeliveryDestination
	health: DestinationHealth
	severity: 'warning' | 'error'
	message: string
}

interface DestinationFailureAlertsProps {
	destinations: Array<{ destination: DeliveryDestination; health: DestinationHealth }>
	onDismiss?: (destinationId: string) => void
	onViewDestination?: (destinationId: string) => void
	className?: string
}

export function DestinationFailureAlerts({
	destinations,
	onDismiss,
	onViewDestination,
	className,
}: DestinationFailureAlertsProps) {
	const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(new Set())

	// Generate alerts from destinations
	const alerts: DestinationAlert[] = React.useMemo(() => {
		const result: DestinationAlert[] = []

		destinations.forEach(({ destination, health }) => {
			// Skip dismissed alerts
			if (dismissedIds.has(destination.id)) return

			// Unhealthy destinations
			if (health.status === 'unhealthy') {
				result.push({
					destination,
					health,
					severity: 'error',
					message: `Destination is unhealthy with ${health.consecutiveFailures} consecutive failures`,
				})
			}
			// Degraded destinations
			else if (health.status === 'degraded') {
				result.push({
					destination,
					health,
					severity: 'warning',
					message: `Destination performance is degraded (${health.successRate} success rate)`,
				})
			}
			// Circuit breaker open
			else if (health.circuitBreakerState === 'open') {
				result.push({
					destination,
					health,
					severity: 'error',
					message: 'Circuit breaker is open - deliveries are blocked',
				})
			}
			// High consecutive failures
			else if (health.consecutiveFailures >= 3) {
				result.push({
					destination,
					health,
					severity: 'warning',
					message: `${health.consecutiveFailures} consecutive failures detected`,
				})
			}
		})

		return result
	}, [destinations, dismissedIds])

	const handleDismiss = (destinationId: string) => {
		setDismissedIds(new Set(dismissedIds).add(destinationId))
		onDismiss?.(destinationId)
	}

	if (alerts.length === 0) {
		return null
	}

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
					Destination Alerts
				</CardTitle>
				<CardDescription>
					{alerts.length} {alerts.length === 1 ? 'destination requires' : 'destinations require'}{' '}
					attention
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-3">
				{alerts.map(({ destination, health, severity, message }) => (
					<Alert
						key={destination.id}
						variant={severity === 'error' ? 'destructive' : 'default'}
						className={severity === 'warning' ? 'border-yellow-200 dark:border-yellow-900/50' : ''}
					>
						<div className="flex items-start gap-3">
							{severity === 'error' ? (
								<XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
							) : (
								<AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-yellow-600 dark:text-yellow-400" />
							)}

							<div className="flex-1 min-w-0">
								<AlertTitle className="flex items-center gap-2">
									<span className="truncate">{destination.label}</span>
									<Badge variant="outline" className="capitalize flex-shrink-0">
										{destination.type}
									</Badge>
								</AlertTitle>
								<AlertDescription className="mt-1">
									<p>{message}</p>
									<div className="flex items-center gap-2 mt-2 text-xs">
										<span>Total Failures: {health.totalFailures}</span>
										<span>•</span>
										<span>Success Rate: {health.successRate}</span>
										{health.lastFailureAt && (
											<>
												<span>•</span>
												<span>Last Failure: {new Date(health.lastFailureAt).toLocaleString()}</span>
											</>
										)}
									</div>
								</AlertDescription>

								<div className="flex gap-2 mt-3">
									{onViewDestination && (
										<Button
											variant="outline"
											size="sm"
											onClick={() => onViewDestination(destination.id)}
										>
											View Details
										</Button>
									)}
									{onDismiss && (
										<Button variant="ghost" size="sm" onClick={() => handleDismiss(destination.id)}>
											Dismiss
										</Button>
									)}
								</div>
							</div>

							<Button
								variant="ghost"
								size="sm"
								className="h-6 w-6 p-0 flex-shrink-0"
								onClick={() => handleDismiss(destination.id)}
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					</Alert>
				))}
			</CardContent>
		</Card>
	)
}
