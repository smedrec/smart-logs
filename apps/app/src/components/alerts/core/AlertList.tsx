import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
	AlertTriangle,
	CheckCircle,
	ChevronDown,
	ChevronUp,
	Clock,
	Filter,
	Search,
	XCircle,
} from 'lucide-react'
import React, { useMemo, useState } from 'react'

import type { Alert, AlertFilters, AlertSeverity, AlertStatus } from '@/lib/types/alert'

export interface AlertListProps {
	/** Array of alerts to display */
	alerts: Alert[]
	/** Current filters applied to the list */
	filters: AlertFilters
	/** Callback when filters change */
	onFilterChange: (filters: AlertFilters) => void
	/** Callback when an alert is selected */
	onAlertSelect: (alert: Alert) => void
	/** Loading state */
	loading?: boolean
	/** Error state */
	error?: string
	/** Additional CSS classes */
	className?: string
	/** Enable virtual scrolling for large datasets */
	virtualScrolling?: boolean
	/** Maximum height for the list container */
	maxHeight?: string
}

interface SortConfig {
	key: keyof Alert
	direction: 'asc' | 'desc'
}

/**
 * Alert listing component with filtering, sorting, and virtual scrolling
 * Displays alerts in a list format with loading states and error handling
 */
export function AlertList({
	alerts,
	filters,
	onFilterChange,
	onAlertSelect,
	loading = false,
	error,
	className,
	virtualScrolling = false,
	maxHeight = '600px',
}: AlertListProps) {
	const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'timestamp', direction: 'desc' })
	const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set())

	// Sort alerts based on current sort configuration
	const sortedAlerts = useMemo(() => {
		if (!alerts.length) return []

		return [...alerts].sort((a, b) => {
			const aValue = a[sortConfig.key]
			const bValue = b[sortConfig.key]

			if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
			if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
			return 0
		})
	}, [alerts, sortConfig])

	const handleSort = (key: keyof Alert) => {
		setSortConfig((prev) => ({
			key,
			direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
		}))
	}

	const toggleAlertExpansion = (alertId: string) => {
		setExpandedAlerts((prev) => {
			const newSet = new Set(prev)
			if (newSet.has(alertId)) {
				newSet.delete(alertId)
			} else {
				newSet.add(alertId)
			}
			return newSet
		})
	}

	const getSeverityIcon = (severity: AlertSeverity) => {
		switch (severity) {
			case 'critical':
				return <AlertTriangle className="h-4 w-4 text-destructive" />
			case 'high':
				return <AlertTriangle className="h-4 w-4 text-orange-500" />
			case 'medium':
				return <Clock className="h-4 w-4 text-yellow-500" />
			case 'low':
				return <Clock className="h-4 w-4 text-blue-500" />
			case 'info':
				return <Clock className="h-4 w-4 text-gray-500" />
			default:
				return <Clock className="h-4 w-4" />
		}
	}

	const getStatusIcon = (status: AlertStatus) => {
		switch (status) {
			case 'active':
				return <AlertTriangle className="h-4 w-4 text-destructive" />
			case 'acknowledged':
				return <Clock className="h-4 w-4 text-yellow-500" />
			case 'resolved':
				return <CheckCircle className="h-4 w-4 text-green-500" />
			case 'dismissed':
				return <XCircle className="h-4 w-4 text-gray-500" />
			default:
				return <Clock className="h-4 w-4" />
		}
	}

	const getSeverityBadgeVariant = (severity: AlertSeverity) => {
		switch (severity) {
			case 'critical':
				return 'destructive'
			case 'high':
				return 'secondary'
			case 'medium':
				return 'outline'
			case 'low':
				return 'outline'
			case 'info':
				return 'outline'
			default:
				return 'outline'
		}
	}

	const formatTimestamp = (timestamp: Date) => {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		}).format(new Date(timestamp))
	}

	// Loading skeleton
	if (loading) {
		return (
			<div className={cn('space-y-4', className)}>
				{Array.from({ length: 5 }).map((_, index) => (
					<Card key={index}>
						<CardContent className="p-4">
							<div className="flex items-start space-x-4">
								<Skeleton className="h-4 w-4 rounded" />
								<div className="flex-1 space-y-2">
									<Skeleton className="h-4 w-3/4" />
									<Skeleton className="h-3 w-1/2" />
									<div className="flex space-x-2">
										<Skeleton className="h-5 w-16" />
										<Skeleton className="h-5 w-20" />
									</div>
								</div>
								<Skeleton className="h-3 w-16" />
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		)
	}

	// Error state
	if (error) {
		return (
			<Card className={cn('border-destructive', className)}>
				<CardContent className="p-6 text-center">
					<AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
					<h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Alerts</h3>
					<p className="text-sm text-muted-foreground mb-4">{error}</p>
					<Button variant="outline" onClick={() => window.location.reload()}>
						Try Again
					</Button>
				</CardContent>
			</Card>
		)
	}

	// Empty state
	if (!sortedAlerts.length) {
		return (
			<Card className={className}>
				<CardContent className="p-6 text-center">
					<Search className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
					<h3 className="text-lg font-semibold mb-2">No Alerts Found</h3>
					<p className="text-sm text-muted-foreground mb-4">
						{Object.keys(filters).length > 0
							? 'Try adjusting your filters to see more alerts.'
							: 'No alerts have been generated yet.'}
					</p>
					{Object.keys(filters).length > 0 && (
						<Button variant="outline" onClick={() => onFilterChange({})}>
							<Filter className="h-4 w-4 mr-2" />
							Clear Filters
						</Button>
					)}
				</CardContent>
			</Card>
		)
	}

	const AlertListContent = () => (
		<div className="space-y-2">
			{sortedAlerts.map((alert) => {
				const isExpanded = expandedAlerts.has(alert.id)

				return (
					<Card
						key={alert.id}
						className={cn(
							'transition-all duration-200 hover:shadow-md cursor-pointer',
							alert.severity === 'critical' && 'border-l-4 border-l-destructive',
							alert.severity === 'high' && 'border-l-4 border-l-orange-500'
						)}
						onClick={() => onAlertSelect(alert)}
					>
						<CardContent className="p-4">
							<div className="flex items-start space-x-4">
								{/* Severity Icon */}
								<div className="flex-shrink-0 mt-0.5">{getSeverityIcon(alert.severity)}</div>

								{/* Alert Content */}
								<div className="flex-1 min-w-0">
									<div className="flex items-start justify-between mb-2">
										<div className="flex-1 min-w-0">
											<h4 className="text-sm font-medium truncate">{alert.title}</h4>
											<p className="text-xs text-muted-foreground mt-1">
												{alert.source} • {formatTimestamp(alert.timestamp)}
											</p>
										</div>

										<div className="flex items-center space-x-2 ml-4">
											<Badge variant={getSeverityBadgeVariant(alert.severity)} className="text-xs">
												{alert.severity}
											</Badge>
											<div className="flex items-center space-x-1">
												{getStatusIcon(alert.status)}
												<span className="text-xs text-muted-foreground capitalize">
													{alert.status}
												</span>
											</div>
										</div>
									</div>

									{/* Alert Description */}
									<p className={cn('text-sm text-muted-foreground', !isExpanded && 'line-clamp-2')}>
										{alert.description}
									</p>

									{/* Tags */}
									{alert.tags.length > 0 && (
										<div className="flex flex-wrap gap-1 mt-2">
											{alert.tags.slice(0, isExpanded ? undefined : 3).map((tag) => (
												<Badge key={tag} variant="outline" className="text-xs">
													{tag}
												</Badge>
											))}
											{!isExpanded && alert.tags.length > 3 && (
												<Badge variant="outline" className="text-xs">
													+{alert.tags.length - 3} more
												</Badge>
											)}
										</div>
									)}

									{/* Expanded Details */}
									{isExpanded && (
										<div className="mt-4 pt-4 border-t space-y-2">
											{alert.acknowledgedBy && (
												<p className="text-xs text-muted-foreground">
													Acknowledged by {alert.acknowledgedBy} on{' '}
													{formatTimestamp(alert.acknowledgedAt!)}
												</p>
											)}
											{alert.resolvedBy && (
												<div className="space-y-1">
													<p className="text-xs text-muted-foreground">
														Resolved by {alert.resolvedBy} on {formatTimestamp(alert.resolvedAt!)}
													</p>
													{alert.resolutionNotes && (
														<p className="text-xs text-muted-foreground">
															<strong>Notes:</strong> {alert.resolutionNotes}
														</p>
													)}
												</div>
											)}
										</div>
									)}
								</div>

								{/* Expand/Collapse Button */}
								<Button
									variant="ghost"
									size="sm"
									className="flex-shrink-0"
									onClick={(e) => {
										e.stopPropagation()
										toggleAlertExpansion(alert.id)
									}}
								>
									{isExpanded ? (
										<ChevronUp className="h-4 w-4" />
									) : (
										<ChevronDown className="h-4 w-4" />
									)}
								</Button>
							</div>
						</CardContent>
					</Card>
				)
			})}
		</div>
	)

	return (
		<div className={className}>
			{/* Sort Controls */}
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center space-x-2">
					<span className="text-sm text-muted-foreground">
						{sortedAlerts.length} alert{sortedAlerts.length !== 1 ? 's' : ''}
					</span>
				</div>

				<div className="flex items-center space-x-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => handleSort('timestamp')}
						className="text-xs"
					>
						Sort by Date
						{sortConfig.key === 'timestamp' &&
							(sortConfig.direction === 'asc' ? (
								<ChevronUp className="h-3 w-3 ml-1" />
							) : (
								<ChevronDown className="h-3 w-3 ml-1" />
							))}
					</Button>

					<Button
						variant="ghost"
						size="sm"
						onClick={() => handleSort('severity')}
						className="text-xs"
					>
						Sort by Severity
						{sortConfig.key === 'severity' &&
							(sortConfig.direction === 'asc' ? (
								<ChevronUp className="h-3 w-3 ml-1" />
							) : (
								<ChevronDown className="h-3 w-3 ml-1" />
							))}
					</Button>
				</div>
			</div>

			{/* Alert List */}
			{virtualScrolling ? (
				<ScrollArea style={{ height: maxHeight }}>
					<AlertListContent />
				</ScrollArea>
			) : (
				<AlertListContent />
			)}
		</div>
	)
}

export default AlertList
