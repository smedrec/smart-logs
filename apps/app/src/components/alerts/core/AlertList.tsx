import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from '@/components/ui/drawer'
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
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { ALERT_SHORTCUTS, useAlertFocusManagement } from '../hooks/use-alert-keyboard-navigation'
import AlertDetails from './AlertDetails'

import type { AlertSeverity, AlertStatus } from '@/components/alerts/types/alert-types'
import type { AlertFilters } from '@/components/alerts/types/filter-types'
import type { Alert } from '@/lib/collections'

export interface AlertListProps {
	/** Array of alerts to display */
	alerts: Alert[]
	/** Current filters applied to the list */
	filters: AlertFilters
	/** Callback when filters change */
	onFilterChange: (filters: AlertFilters) => void
	/** Callback when an alert is selected */
	onAlertSelect: (alert: Alert) => void
	/** ID of the alert to focus */
	alertFocusedId?: string | undefined
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
	alertFocusedId,
	loading = false,
	error,
	className,
	virtualScrolling = false,
	maxHeight = '600px',
}: AlertListProps) {
	const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' })
	const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set())
	const [selectedAlertIndex, setSelectedAlertIndex] = useState<number>(-1)

	const { containerRef, focusFirst, focusNext, focusPrevious, handleArrowNavigation } =
		useAlertFocusManagement()

	// Sort alerts based on current sort configuration
	const sortedAlerts = useMemo(() => {
		if (!alerts.length) return []

		return [...alerts].sort((a, b) => {
			const aValue = a[sortConfig.key]
			const bValue = b[sortConfig.key]

			if (!aValue || !bValue) return 0
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

	const handleAlertKeyDown = useCallback(
		(event: React.KeyboardEvent, alert: Alert, index: number) => {
			switch (event.key) {
				case 'Enter':
				case ' ':
					event.preventDefault()
					onAlertSelect(alert)
					break
				case 'ArrowDown':
					event.preventDefault()
					if (index < sortedAlerts.length - 1) {
						const nextAlert = document.querySelector(
							`[data-alert-id="${sortedAlerts[index + 1].id}"]`
						) as HTMLElement
						nextAlert?.focus()
						setSelectedAlertIndex(index + 1)
					}
					break
				case 'ArrowUp':
					event.preventDefault()
					if (index > 0) {
						const prevAlert = document.querySelector(
							`[data-alert-id="${sortedAlerts[index - 1].id}"]`
						) as HTMLElement
						prevAlert?.focus()
						setSelectedAlertIndex(index - 1)
					}
					break
				case 'Home':
					event.preventDefault()
					if (sortedAlerts.length > 0) {
						const firstAlert = document.querySelector(
							`[data-alert-id="${sortedAlerts[0].id}"]`
						) as HTMLElement
						firstAlert?.focus()
						setSelectedAlertIndex(0)
					}
					break
				case 'End':
					event.preventDefault()
					if (sortedAlerts.length > 0) {
						const lastIndex = sortedAlerts.length - 1
						const lastAlert = document.querySelector(
							`[data-alert-id="${sortedAlerts[lastIndex].id}"]`
						) as HTMLElement
						lastAlert?.focus()
						setSelectedAlertIndex(lastIndex)
					}
					break
				case 'Escape':
					event.preventDefault()
					setSelectedAlertIndex(-1)
					const container = containerRef.current
					if (container) {
						container.focus()
					}
					break
			}
		},
		[sortedAlerts, onAlertSelect, containerRef]
	)

	// Focus alert if alertFocusedId prop changes
	useEffect(() => {
		if (alertFocusedId) {
			const alertToFocus = document.querySelector(
				`[data-alert-id="${alertFocusedId}"]`
			) as HTMLElement
			alertToFocus?.focus()
			const index = sortedAlerts.findIndex((alert) => alert.id === alertFocusedId)
			setSelectedAlertIndex(index)
		}
	}, [alertFocusedId, sortedAlerts])

	// Handle keyboard navigation for the container
	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		const handleContainerKeyDown = (event: KeyboardEvent) => {
			handleArrowNavigation(event)

			// Handle specific alert list shortcuts
			switch (event.key) {
				case 'j':
					event.preventDefault()
					focusNext()
					break
				case 'k':
					event.preventDefault()
					focusPrevious()
					break
				case 'Home':
					event.preventDefault()
					focusFirst()
					break
			}
		}

		container.addEventListener('keydown', handleContainerKeyDown)
		return () => container.removeEventListener('keydown', handleContainerKeyDown)
	}, [handleArrowNavigation, focusNext, focusPrevious, focusFirst])

	const getSeverityIcon = (severity: AlertSeverity) => {
		switch (severity) {
			case 'CRITICAL':
				return <AlertTriangle className="h-4 w-4 text-destructive" />
			case 'HIGH':
				return <AlertTriangle className="h-4 w-4 text-orange-500" />
			case 'MEDIUM':
				return <Clock className="h-4 w-4 text-yellow-500" />
			case 'LOW':
				return <Clock className="h-4 w-4 text-blue-500" />
			case 'INFO':
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
			case 'CRITICAL':
				return 'destructive'
			case 'HIGH':
				return 'secondary'
			case 'MEDIUM':
				return 'outline'
			case 'LOW':
				return 'outline'
			case 'INFO':
				return 'outline'
			default:
				return 'outline'
		}
	}

	const formatTimestamp = (date: string) => {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		}).format(new Date(date))
	}

	const formatRelativeTime = (date: string) => {
		const now = new Date()
		const alertTime = new Date(date)
		const diffInMinutes = Math.floor((now.getTime() - alertTime.getTime()) / (1000 * 60))

		if (diffInMinutes < 1) return 'Just now'
		if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`
		if (diffInMinutes < 1440)
			return `${Math.floor(diffInMinutes / 60)} hour${Math.floor(diffInMinutes / 60) !== 1 ? 's' : ''} ago`
		return `${Math.floor(diffInMinutes / 1440)} day${Math.floor(diffInMinutes / 1440) !== 1 ? 's' : ''} ago`
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
		<div className="space-y-2" role="list" aria-label="Alert list">
			{sortedAlerts.map((alert, index) => {
				const isExpanded = expandedAlerts.has(alert.id)
				const isSelected = selectedAlertIndex === index

				return (
					<Card
						key={alert.id}
						className={cn(
							'transition-all duration-200 hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
							alert.severity === 'CRITICAL' && 'border-l-4 border-l-destructive',
							alert.severity === 'HIGH' && 'border-l-4 border-l-orange-500',
							isSelected && 'ring-2 ring-primary ring-offset-2'
						)}
						/**onClick={(e) => {
							e.stopPropagation()
							toggleAlertExpansion(alert.id)
						}}*/
						onKeyDown={(e) => handleAlertKeyDown(e, alert, index)}
						tabIndex={0}
						role="listitem"
						data-alert-id={alert.id}
						data-alert-card
						aria-label={`Alert: ${alert.title}, severity: ${alert.severity}, status: ${alert.status}`}
						aria-expanded={isExpanded}
						aria-describedby={`alert-${alert.id}-description`}
					>
						<CardContent className="p-4">
							<div className="flex items-start space-x-4">
								{/* Severity Icon */}
								<div className="flex-shrink-0 mt-0.5">
									{getSeverityIcon(alert.severity as AlertSeverity)}
								</div>

								{/* Alert Content */}
								<div className="flex-1 min-w-0">
									<div className="flex items-start justify-between mb-2">
										<div className="flex-1 min-w-0">
											<h4 className="text-sm font-medium truncate">{alert.title}</h4>
											<p className="text-xs text-muted-foreground mt-1">
												{alert.source} • {formatRelativeTime(alert.created_at)}
											</p>
										</div>

										<div className="flex items-center space-x-2 ml-4">
											<Badge
												variant={getSeverityBadgeVariant(alert.severity as AlertSeverity)}
												className="text-xs"
											>
												{alert.severity}
											</Badge>
											<div className="flex items-center space-x-1">
												{getStatusIcon(alert.status as AlertStatus)}
												<span className="text-xs text-muted-foreground capitalize">
													{alert.status}
												</span>
											</div>
										</div>
									</div>

									{/* Alert Description */}
									<p
										id={`alert-${alert.id}-description`}
										className={cn('text-sm text-muted-foreground', !isExpanded && 'line-clamp-2')}
									>
										{alert.description}
									</p>

									{/* Tags */}
									{alert.tags && alert.tags.length > 0 && (
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
										<div
											id={`alert-${alert.id}-details`}
											className="mt-4 pt-4 border-t space-y-2"
											role="region"
											aria-label="Alert details"
										>
											{alert.acknowledged_by && (
												<p className="text-xs text-muted-foreground">
													Acknowledged by {alert.acknowledged_by} on{' '}
													{formatTimestamp(alert.acknowledged_at!)}
												</p>
											)}
											{alert.resolved_by && (
												<div className="space-y-1">
													<p className="text-xs text-muted-foreground">
														Resolved by {alert.resolved_by} on {formatTimestamp(alert.resolved_at!)}
													</p>
													{alert.resolution_notes && (
														<p className="text-xs text-muted-foreground">
															<strong>Notes:</strong> {alert.resolution_notes}
														</p>
													)}
												</div>
											)}
											<AlertDetails alert={alert} />
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
									aria-label={isExpanded ? 'Collapse alert details' : 'Expand alert details'}
									aria-expanded={isExpanded}
									aria-controls={`alert-${alert.id}-details`}
									data-alert-action
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
		<div
			ref={containerRef}
			className={className}
			tabIndex={-1}
			role="region"
			aria-label="Alert list with keyboard navigation"
		>
			{/* Sort Controls */}
			<div
				className="flex items-center justify-between mb-4"
				role="toolbar"
				aria-label="Alert list controls"
			>
				<div className="flex items-center space-x-2">
					<Badge
						variant="outline"
						aria-label={`Total of ${sortedAlerts.length} alert${sortedAlerts.length !== 1 ? 's' : ''}`}
					>
						{sortedAlerts.length} alert{sortedAlerts.length !== 1 ? 's' : ''}
					</Badge>
				</div>

				<div className="flex items-center space-x-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => handleSort('created_at')}
						className="text-xs"
					>
						Sort by Date
						{sortConfig.key === 'created_at' &&
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
