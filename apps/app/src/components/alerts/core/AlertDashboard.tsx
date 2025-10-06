import { PageHeader } from '@/components/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { BarChart3, Filter, LayoutGrid, List, RefreshCw, Settings } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { AlertStatistics } from '../data/AlertStatistics'
import { ALERT_SHORTCUTS, useAlertKeyboardNavigation } from '../hooks/use-alert-keyboard-navigation'
import { useAlertAction } from '../hooks/use-alert-queries'
import { useAlertDashboardLayout, useAlertTouchFriendly } from '../hooks/use-alert-responsive'
import { AlertResponsiveContainer, AlertResponsiveGrid } from '../layout/alert-responsive-container'
import AlertKeyboardShortcutsDialog from '../navigation/alert-keyboard-shortcuts-dialog'
import AlertSkipLinks, { AlertSkipTarget } from '../navigation/alert-skip-links'
import AlertCard from './AlertCard'
import AlertList from './AlertList'

import type { AlertFilters } from '@/components/alerts/types/filter-types'
import type { Alert } from '@/lib/collections'
import type { AlertStatistics as AlertStatisticsType } from '@smedrec/audit-client'

export interface AlertDashboardProps {
	/** Alerts */
	alerts: Alert[]
	/** Alert statistics data */
	statistics?: AlertStatisticsType
	/** isLoading */
	loading?: boolean
	/** Error status */
	error?: string
	/** Initial filters to apply to the dashboard */
	initialFilters?: AlertFilters
	/** Initial view mode for the dashboard */
	view?: 'list' | 'board' | 'statistics'
	/** Callback when view changes */
	onViewChange?: (view: 'list' | 'board' | 'statistics') => void
	/** Additional CSS classes */
	className?: string
	/** Children components to render in the dashboard */
	children?: React.ReactNode
}

/**
 * Main dashboard container component for alert management
 * Provides navigation, view switching, and responsive grid layout
 */
export function AlertDashboard({
	alerts,
	statistics,
	loading = false,
	error,
	initialFilters,
	view = 'list',
	onViewChange,
	className,
	children,
}: AlertDashboardProps) {
	const [currentView, setCurrentView] = useState<'list' | 'board' | 'statistics'>(view)
	const [showShortcuts, setShowShortcuts] = useState(false)
	const [filters, setFilters] = useState<AlertFilters>(initialFilters ?? {})
	const { acknowledge, resolve, dismiss } = useAlertAction()

	// Responsive layout hooks
	const { headerLayout, actionButtonsLayout, spacing, isMobile, isTablet } =
		useAlertDashboardLayout()

	const { getTouchTargetSize, getAlertButtonTouchClasses } = useAlertTouchFriendly()

	const handleViewChange = (newView: 'list' | 'board' | 'statistics') => {
		setCurrentView(newView)
		onViewChange?.(newView)
	}

	const handleSearchFocus = () => {
		const searchInput = document.querySelector('[data-alert-search]') as HTMLInputElement
		if (searchInput) {
			searchInput.focus()
		}
	}

	const handleFilterFocus = () => {
		const filterButton = document.querySelector('[data-alert-filters]') as HTMLButtonElement
		if (filterButton) {
			filterButton.focus()
		}
	}

	const handleAlertAction = (alertId: string, action: string) => {
		switch (action) {
			case 'acknowledge':
				acknowledge.mutate({ alertId, action })
				break
			case 'resolve':
				resolve.mutate({ alertId, action })
				break
			case 'dismiss':
				dismiss.mutate({ alertId, action })
				break
			default:
				toast.error('Invalid action')
				break
		}
	}

	// Keyboard shortcuts for the dashboard
	const shortcuts = [
		{
			...ALERT_SHORTCUTS.SEARCH_ALERTS,
			action: handleSearchFocus,
		},
		{
			...ALERT_SHORTCUTS.FILTER_ALERTS,
			action: handleFilterFocus,
		},
		{
			...ALERT_SHORTCUTS.LIST_VIEW,
			action: () => handleViewChange('list'),
		},
		{
			...ALERT_SHORTCUTS.BOARD_VIEW,
			action: () => handleViewChange('board'),
		},
		{
			...ALERT_SHORTCUTS.STATISTICS_VIEW,
			action: () => handleViewChange('statistics'),
		},
		{
			...ALERT_SHORTCUTS.SHOW_SHORTCUTS,
			action: () => setShowShortcuts(true),
		},
	]

	const { ref } = useAlertKeyboardNavigation({
		shortcuts,
		enabled: true,
		scope: 'local',
	})

	return (
		<div ref={ref as React.RefObject<HTMLDivElement>}>
			<AlertResponsiveContainer
				className={cn('flex flex-col', spacing, className)}
				padding={{
					sm: 'px-4 py-3',
					md: 'px-6 py-4',
					lg: 'px-8 py-6',
				}}
			>
				{/* Skip Links for Accessibility */}
				<AlertSkipLinks />

				{/* Dashboard Header
				<AlertSkipTarget
					id="alert-main-content"
					as="div"
					className={cn(
						'flex items-center justify-between',
						headerLayout === 'stacked' && 'flex-col space-y-4',
						headerLayout === 'wrapped' && 'flex-wrap gap-4',
						headerLayout === 'inline' && 'flex-row'
					)}
				>
					<div className="flex flex-col space-y-1">
						<h1 className={cn('font-semibold tracking-tight', isMobile ? 'text-xl' : 'text-2xl')}>
							Alert Management
						</h1>
						<p className={cn('text-muted-foreground', isMobile ? 'text-xs' : 'text-sm')}>
							Monitor and manage system alerts across your organization
						</p>
					</div>  */}

				{/* Dashboard Actions 
					<AlertSkipTarget
						id="alert-actions"
						as="div"
						className={cn(
							'flex items-center',
							actionButtonsLayout === 'dropdown' && 'justify-end',
							actionButtonsLayout === 'compact' && 'space-x-1',
							actionButtonsLayout === 'full' && 'space-x-2'
						)}
					>
						<Button
							variant="outline"
							size={isMobile ? 'sm' : 'sm'}
							className={cn(
								'flex items-center space-x-2',
								getTouchTargetSize('md'),
								getAlertButtonTouchClasses()
							)}
							data-alert-filters
							aria-label="Open alert filters"
							title="Ctrl+F to open filters"
						>
							<Filter className="h-4 w-4" />
							{actionButtonsLayout === 'full' && <span className="hidden sm:inline">Filters</span>}
						</Button>

						{actionButtonsLayout !== 'dropdown' && (
							<Button
								variant="outline"
								size={isMobile ? 'sm' : 'sm'}
								className={cn(
									'flex items-center space-x-2',
									getTouchTargetSize('md'),
									getAlertButtonTouchClasses()
								)}
							>
								<Settings className="h-4 w-4" />
								{actionButtonsLayout === 'full' && (
									<span className="hidden sm:inline">Settings</span>
								)}
							</Button>
						)}

						<AlertKeyboardShortcutsDialog
							triggerVariant="ghost"
							triggerSize={isMobile ? 'sm' : 'sm'}
						/>
					</AlertSkipTarget>
				</AlertSkipTarget> */}

				{/* Page Header */}
				<PageHeader
					title="Alert Management"
					description="Monitor and manage system alerts across your organization"
					actions={[
						{
							label: 'Filters',
							href: `/settings/alerts`,
							variant: 'outline',
							icon: Filter,
						},
						{
							label: 'Settings',
							href: `/settings/alerts`,
							variant: 'outline',
							icon: Settings,
						},
					]}
					shortcuts={shortcuts}
				/>

				{/* View Navigation */}
				<Tabs
					value={currentView}
					onValueChange={(value) => handleViewChange(value as 'list' | 'board' | 'statistics')}
					className="w-full"
				>
					<div
						className={cn(
							'flex items-center justify-between',
							isMobile && 'flex-col space-y-4',
							isTablet && 'flex-wrap gap-4'
						)}
					>
						<TabsList
							className={cn('grid grid-cols-3', isMobile ? 'w-full' : 'w-auto')}
							role="tablist"
							aria-label="Alert view options"
						>
							<TabsTrigger
								value="list"
								className="flex items-center space-x-2"
								aria-label="List view (Press 1)"
								title="Press 1 for list view"
							>
								<List className="h-4 w-4" />
								<span>List</span>
							</TabsTrigger>
							<TabsTrigger
								value="board"
								className="flex items-center space-x-2"
								aria-label="Board view (Press 2)"
								title="Press 2 for board view"
							>
								<LayoutGrid className="h-4 w-4" />
								<span>Board</span>
							</TabsTrigger>
							<TabsTrigger
								value="statistics"
								className="flex items-center space-x-2"
								aria-label="Statistics view (Press 3)"
								title="Press 3 for statistics view"
							>
								<BarChart3 className="h-4 w-4" />
								<span>Statistics</span>
							</TabsTrigger>
						</TabsList>

						{/* Alert Summary Badges */}
						<div className="flex items-center space-x-2" role="status" aria-label="Alert summary">
							<Badge
								variant="destructive"
								className="flex items-center space-x-1"
								aria-label="5 critical alerts"
							>
								<span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
								<span>{statistics?.bySeverity.CRITICAL} Critical</span>
							</Badge>
							<Badge
								variant="secondary"
								className="flex items-center space-x-1"
								aria-label="12 high priority alerts"
							>
								<span className="h-2 w-2 rounded-full bg-orange-500" aria-hidden="true" />
								<span>{statistics?.bySeverity.HIGH} High</span>
							</Badge>
							<Badge
								variant="outline"
								className="flex items-center space-x-1"
								aria-label="23 active alerts"
							>
								<span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />
								<span>{statistics?.active} Active</span>
							</Badge>
						</div>
					</div>

					{/* Dashboard Content */}
					<div className="mt-6">
						<TabsContent
							value="list"
							className="space-y-4"
							role="tabpanel"
							aria-labelledby="list-tab"
						>
							<AlertSkipTarget id="alert-list">
								<Card>
									<CardContent>
										{/* AlertList component will be rendered here */}
										<div className="text-center py-8 text-muted-foreground">
											<AlertList
												alerts={alerts}
												filters={filters}
												loading={loading}
												error={error}
												onFilterChange={function (filters: AlertFilters): void {
													throw new Error('Function not implemented.')
												}}
												onAlertSelect={function (alert: Alert): void {
													throw new Error('Function not implemented.')
												}}
											/>
										</div>
									</CardContent>
								</Card>
							</AlertSkipTarget>
						</TabsContent>

						<TabsContent
							value="board"
							className="space-y-4"
							role="tabpanel"
							aria-labelledby="board-tab"
						>
							<AlertResponsiveGrid
								columns={{
									sm: 1,
									md: 2,
									lg: 4,
									xl: 4,
								}}
								gap={{
									sm: 'gap-3',
									md: 'gap-4',
									lg: 'gap-4',
								}}
							>
								{/* Alert status columns */}
								<Card>
									<CardHeader className="pb-3">
										<CardTitle className="text-sm font-medium flex items-center justify-between">
											<span>Active</span>
											<Badge variant="destructive">{statistics?.active}</Badge>
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-2">
										{/* AlertCard components will be rendered here */}
										<div className="text-center py-4 text-sm text-muted-foreground">
											{alerts
												.filter(
													(alert) => alert.resolved === 'false' && alert.acknowledged === 'false'
												)
												.map((alert) => (
													<AlertCard
														alert={alert}
														onAlertAction={handleAlertAction}
														key={alert.id}
													/>
												))}
										</div>
									</CardContent>
								</Card>

								<Card>
									<CardHeader className="pb-3">
										<CardTitle className="text-sm font-medium flex items-center justify-between">
											<span>Acknowledged</span>
											<Badge variant="secondary">{statistics?.acknowledged}</Badge>
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-2">
										<div className="text-center py-4 text-sm text-muted-foreground">
											{alerts
												.filter(
													(alert) => alert.acknowledged === 'true' && alert.resolved === 'false'
												)
												.map((alert) => (
													<AlertCard
														alert={alert}
														onAlertAction={handleAlertAction}
														key={alert.id}
													/>
												))}
										</div>
									</CardContent>
								</Card>

								<Card>
									<CardHeader className="pb-3">
										<CardTitle className="text-sm font-medium flex items-center justify-between">
											<span>Resolved</span>
											<Badge variant="outline">{statistics?.resolved}</Badge>
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-2">
										<div className="text-center py-4 text-sm text-muted-foreground">
											{alerts
												.filter((alert) => alert.resolved === 'true' && alert.status === 'resolved')
												.map((alert) => (
													<AlertCard
														alert={alert}
														onAlertAction={handleAlertAction}
														key={alert.id}
													/>
												))}
										</div>
									</CardContent>
								</Card>

								<Card>
									<CardHeader className="pb-3">
										<CardTitle className="text-sm font-medium flex items-center justify-between">
											<span>Dismissed</span>
											<Badge variant="outline">{statistics?.dismissed}</Badge>
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-2">
										<div className="text-center py-4 text-sm text-muted-foreground">
											{alerts
												.filter((alert) => alert.status === 'dismissed')
												.map((alert) => (
													<AlertCard
														alert={alert}
														onAlertAction={handleAlertAction}
														key={alert.id}
													/>
												))}
										</div>
									</CardContent>
								</Card>
							</AlertResponsiveGrid>
						</TabsContent>

						<TabsContent
							value="statistics"
							className="space-y-4"
							role="tabpanel"
							aria-labelledby="statistics-tab"
						>
							{/* Statistics charts will be implemented in later tasks */}
							<Card>
								<CardHeader>
									<CardTitle>Alert Trends</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-center py-8 text-muted-foreground">
										<AlertStatistics alerts={alerts} />
									</div>
								</CardContent>
							</Card>
						</TabsContent>
					</div>
				</Tabs>

				{/* Custom children content */}
				{children}
			</AlertResponsiveContainer>
		</div>
	)
}

export default AlertDashboard
