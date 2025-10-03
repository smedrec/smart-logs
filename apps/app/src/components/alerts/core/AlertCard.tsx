import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
	AlertCircle,
	AlertTriangle,
	Check,
	CheckCircle,
	Clock,
	Eye,
	MoreVertical,
	X,
	XCircle,
} from 'lucide-react'
import React, { useState } from 'react'

import type { Alert, AlertSeverity, AlertStatus } from '@/lib/types/alert'

export interface AlertCardProps {
	/** Alert data to display */
	alert: Alert
	/** Callback when alert is clicked */
	onAlertClick?: (alert: Alert) => void
	/** Callback when alert action is triggered */
	onAlertAction?: (alertId: string, action: 'acknowledge' | 'resolve' | 'dismiss') => void
	/** Whether the card is in a compact layout */
	compact?: boolean
	/** Whether to show quick actions */
	showActions?: boolean
	/** Additional CSS classes */
	className?: string
	/** Whether the card is draggable (for board view) */
	draggable?: boolean
}

/**
 * Individual alert display card with severity indicators and quick actions
 * Supports both compact and expanded layouts with responsive design
 */
export function AlertCard({
	alert,
	onAlertClick,
	onAlertAction,
	compact = false,
	showActions = true,
	className,
	draggable = false,
}: AlertCardProps) {
	const [isExpanded, setIsExpanded] = useState(false)

	const getSeverityColor = (severity: AlertSeverity) => {
		switch (severity) {
			case 'critical':
				return 'border-l-destructive bg-destructive/5'
			case 'high':
				return 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/20'
			case 'medium':
				return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
			case 'low':
				return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20'
			case 'info':
				return 'border-l-gray-500 bg-gray-50 dark:bg-gray-950/20'
			default:
				return 'border-l-gray-300'
		}
	}

	const getSeverityIcon = (severity: AlertSeverity) => {
		const iconClass = 'h-4 w-4'
		switch (severity) {
			case 'critical':
				return <AlertTriangle className={cn(iconClass, 'text-destructive')} />
			case 'high':
				return <AlertTriangle className={cn(iconClass, 'text-orange-500')} />
			case 'medium':
				return <AlertCircle className={cn(iconClass, 'text-yellow-500')} />
			case 'low':
				return <Clock className={cn(iconClass, 'text-blue-500')} />
			case 'info':
				return <Clock className={cn(iconClass, 'text-gray-500')} />
			default:
				return <Clock className={iconClass} />
		}
	}

	const getStatusIcon = (status: AlertStatus) => {
		const iconClass = 'h-3 w-3'
		switch (status) {
			case 'active':
				return <AlertTriangle className={cn(iconClass, 'text-destructive')} />
			case 'acknowledged':
				return <Clock className={cn(iconClass, 'text-yellow-500')} />
			case 'resolved':
				return <CheckCircle className={cn(iconClass, 'text-green-500')} />
			case 'dismissed':
				return <XCircle className={cn(iconClass, 'text-gray-500')} />
			default:
				return <Clock className={iconClass} />
		}
	}

	const getSeverityBadgeVariant = (severity: AlertSeverity) => {
		switch (severity) {
			case 'critical':
				return 'destructive'
			case 'high':
				return 'secondary'
			default:
				return 'outline'
		}
	}

	const formatTimestamp = (timestamp: Date) => {
		const now = new Date()
		const alertTime = new Date(timestamp)
		const diffInMinutes = Math.floor((now.getTime() - alertTime.getTime()) / (1000 * 60))

		if (diffInMinutes < 1) return 'Just now'
		if (diffInMinutes < 60) return `${diffInMinutes}m ago`
		if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
		return `${Math.floor(diffInMinutes / 1440)}d ago`
	}

	const handleCardClick = () => {
		if (onAlertClick) {
			onAlertClick(alert)
		} else {
			setIsExpanded(!isExpanded)
		}
	}

	const handleAction = (action: 'acknowledge' | 'resolve' | 'dismiss') => {
		onAlertAction?.(alert.id, action)
	}

	return (
		<Card
			className={cn(
				'transition-all duration-200 hover:shadow-md border-l-4',
				getSeverityColor(alert.severity),
				onAlertClick && 'cursor-pointer',
				draggable && 'cursor-move',
				className
			)}
			onClick={handleCardClick}
			draggable={draggable}
		>
			{!compact && (
				<CardHeader className="pb-2">
					<div className="flex items-start justify-between">
						<div className="flex items-center space-x-2">
							{getSeverityIcon(alert.severity)}
							<Badge variant={getSeverityBadgeVariant(alert.severity)} className="text-xs">
								{alert.severity.toUpperCase()}
							</Badge>
						</div>

						{showActions && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										className="h-6 w-6 p-0"
										onClick={(e) => e.stopPropagation()}
									>
										<MoreVertical className="h-3 w-3" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-40">
									<DropdownMenuItem onClick={() => handleAction('acknowledge')}>
										<Eye className="h-3 w-3 mr-2" />
										View Details
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									{alert.status === 'active' && (
										<DropdownMenuItem onClick={() => handleAction('acknowledge')}>
											<Check className="h-3 w-3 mr-2" />
											Acknowledge
										</DropdownMenuItem>
									)}
									{(alert.status === 'active' || alert.status === 'acknowledged') && (
										<DropdownMenuItem onClick={() => handleAction('resolve')}>
											<CheckCircle className="h-3 w-3 mr-2" />
											Resolve
										</DropdownMenuItem>
									)}
									<DropdownMenuItem
										onClick={() => handleAction('dismiss')}
										className="text-destructive focus:text-destructive"
									>
										<X className="h-3 w-3 mr-2" />
										Dismiss
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</div>
				</CardHeader>
			)}

			<CardContent className={cn(compact ? 'p-3' : 'pt-0')}>
				{/* Alert Title and Status */}
				<div className="flex items-start justify-between mb-2">
					<div className="flex-1 min-w-0">
						<h4 className={cn('font-medium truncate', compact ? 'text-sm' : 'text-base')}>
							{alert.title}
						</h4>

						{compact && (
							<div className="flex items-center space-x-2 mt-1">
								{getSeverityIcon(alert.severity)}
								<Badge variant={getSeverityBadgeVariant(alert.severity)} className="text-xs">
									{alert.severity}
								</Badge>
							</div>
						)}
					</div>

					<div className="flex items-center space-x-1 ml-2">
						{getStatusIcon(alert.status)}
						<span className="text-xs text-muted-foreground capitalize">{alert.status}</span>
					</div>
				</div>

				{/* Alert Description */}
				<p
					className={cn(
						'text-muted-foreground mb-3',
						compact ? 'text-xs line-clamp-2' : 'text-sm line-clamp-3'
					)}
				>
					{alert.description}
				</p>

				{/* Alert Metadata */}
				<div className="space-y-2">
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<span className="truncate">{alert.source}</span>
						<span>{formatTimestamp(alert.timestamp)}</span>
					</div>

					{/* Tags */}
					{alert.tags.length > 0 && (
						<div className="flex flex-wrap gap-1">
							{alert.tags.slice(0, compact ? 2 : 4).map((tag) => (
								<Badge key={tag} variant="outline" className="text-xs">
									{tag}
								</Badge>
							))}
							{alert.tags.length > (compact ? 2 : 4) && (
								<Badge variant="outline" className="text-xs">
									+{alert.tags.length - (compact ? 2 : 4)}
								</Badge>
							)}
						</div>
					)}

					{/* Expanded Details */}
					{isExpanded && !compact && (
						<div className="pt-3 border-t space-y-2">
							{alert.acknowledgedBy && (
								<div className="text-xs text-muted-foreground">
									<strong>Acknowledged:</strong> {alert.acknowledgedBy} on{' '}
									{new Intl.DateTimeFormat('en-US', {
										month: 'short',
										day: 'numeric',
										hour: '2-digit',
										minute: '2-digit',
									}).format(new Date(alert.acknowledgedAt!))}
								</div>
							)}

							{alert.resolvedBy && (
								<div className="space-y-1">
									<div className="text-xs text-muted-foreground">
										<strong>Resolved:</strong> {alert.resolvedBy} on{' '}
										{new Intl.DateTimeFormat('en-US', {
											month: 'short',
											day: 'numeric',
											hour: '2-digit',
											minute: '2-digit',
										}).format(new Date(alert.resolvedAt!))}
									</div>
									{alert.resolutionNotes && (
										<div className="text-xs text-muted-foreground">
											<strong>Notes:</strong> {alert.resolutionNotes}
										</div>
									)}
								</div>
							)}

							{/* Metadata */}
							{Object.keys(alert.metadata).length > 0 && (
								<div className="text-xs text-muted-foreground">
									<strong>Metadata:</strong>
									<div className="mt-1 space-y-1">
										{Object.entries(alert.metadata)
											.slice(0, 3)
											.map(([key, value]) => (
												<div key={key} className="flex justify-between">
													<span className="font-medium">{key}:</span>
													<span className="truncate ml-2">{String(value)}</span>
												</div>
											))}
									</div>
								</div>
							)}
						</div>
					)}
				</div>

				{/* Quick Actions for Compact Mode */}
				{compact && showActions && (
					<div className="flex justify-end space-x-1 mt-3 pt-2 border-t">
						{alert.status === 'active' && (
							<Button
								variant="ghost"
								size="sm"
								className="h-6 px-2 text-xs"
								onClick={(e) => {
									e.stopPropagation()
									handleAction('acknowledge')
								}}
							>
								<Check className="h-3 w-3 mr-1" />
								Ack
							</Button>
						)}

						{(alert.status === 'active' || alert.status === 'acknowledged') && (
							<Button
								variant="ghost"
								size="sm"
								className="h-6 px-2 text-xs"
								onClick={(e) => {
									e.stopPropagation()
									handleAction('resolve')
								}}
							>
								<CheckCircle className="h-3 w-3 mr-1" />
								Resolve
							</Button>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	)
}

export default AlertCard
