import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import * as React from 'react'

import type { DestinationHealth, DestinationHealthStatus } from '@smedrec/audit-client'

interface DestinationHealthIndicatorProps {
	health?: DestinationHealth | null
	showLabel?: boolean
	size?: 'sm' | 'md' | 'lg'
	className?: string
}

const getHealthIcon = (status: DestinationHealthStatus, size: string) => {
	const sizeClass = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'

	switch (status) {
		case 'healthy':
			return <CheckCircle2 className={`${sizeClass} text-green-600 dark:text-green-400`} />
		case 'degraded':
			return <AlertCircle className={`${sizeClass} text-yellow-600 dark:text-yellow-400`} />
		case 'unhealthy':
			return <XCircle className={`${sizeClass} text-red-600 dark:text-red-400`} />
		case 'disabled':
			return <XCircle className={`${sizeClass} text-muted-foreground`} />
		default:
			return <AlertCircle className={`${sizeClass} text-muted-foreground`} />
	}
}

const getHealthColor = (status: DestinationHealthStatus) => {
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

export function DestinationHealthIndicator({
	health,
	showLabel = false,
	size = 'md',
	className,
}: DestinationHealthIndicatorProps) {
	if (!health) {
		return (
			<div className={`flex items-center gap-1 ${className || ''}`}>
				<AlertCircle
					className={`${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} text-muted-foreground`}
				/>
				{showLabel && <span className="text-sm text-muted-foreground">Unknown</span>}
			</div>
		)
	}

	const tooltipContent = (
		<div className="space-y-2 text-xs">
			<div className="font-medium capitalize">{health.status}</div>
			<div className="space-y-1">
				<div>Success Rate: {health.successRate}</div>
				<div>Total Deliveries: {health.totalDeliveries}</div>
				<div>Failures: {health.totalFailures}</div>
				{health.consecutiveFailures > 0 && (
					<div className="text-red-400">Consecutive Failures: {health.consecutiveFailures}</div>
				)}
				{health.averageResponseTime && <div>Avg Response: {health.averageResponseTime}ms</div>}
			</div>
		</div>
	)

	if (showLabel) {
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Badge
							variant={health.status === 'healthy' ? 'default' : 'secondary'}
							className={`${getHealthColor(health.status)} cursor-help ${className || ''}`}
						>
							{getHealthIcon(health.status, size)}
							<span className="ml-1 capitalize">{health.status}</span>
						</Badge>
					</TooltipTrigger>
					<TooltipContent>{tooltipContent}</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		)
	}

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div className={`cursor-help ${className || ''}`}>
						{getHealthIcon(health.status, size)}
					</div>
				</TooltipTrigger>
				<TooltipContent>{tooltipContent}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	)
}
