import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LayoutGrid, List, Table } from 'lucide-react'
import React, { useState } from 'react'

import { useAlertResponsive } from '../hooks/use-alert-responsive'

import type { Alert } from '@/lib/types/alert'

export type AlertViewMode = 'table' | 'cards' | 'list'

export interface AlertResponsiveDataViewProps {
	/** Array of alerts to display */
	alerts: Alert[]
	/** Current view mode */
	viewMode?: AlertViewMode
	/** Callback when view mode changes */
	onViewModeChange?: (mode: AlertViewMode) => void
	/** Whether to auto-select view based on screen size */
	autoSelectView?: boolean
	/** Whether to show view toggle controls */
	showViewToggle?: boolean
	/** Render function for table view */
	renderTable: (alerts: Alert[]) => React.ReactNode
	/** Render function for cards view */
	renderCards: (alerts: Alert[]) => React.ReactNode
	/** Render function for list view */
	renderList: (alerts: Alert[]) => React.ReactNode
	/** Additional CSS classes */
	className?: string
}

/**
 * Responsive data view component that switches between table, cards, and list views
 * Automatically selects the best view based on screen size
 */
export function AlertResponsiveDataView({
	alerts,
	viewMode,
	onViewModeChange,
	autoSelectView = true,
	showViewToggle = true,
	renderTable,
	renderCards,
	renderList,
	className,
}: AlertResponsiveDataViewProps) {
	const { isMobile, isTablet, isDesktop } = useAlertResponsive()
	const [manualViewMode, setManualViewMode] = useState<AlertViewMode | null>(null)

	const getAutoSelectedView = (): AlertViewMode => {
		if (isMobile) return 'cards'
		if (isTablet) return 'list'
		return 'table'
	}

	const getCurrentViewMode = (): AlertViewMode => {
		if (viewMode) return viewMode
		if (manualViewMode) return manualViewMode
		if (autoSelectView) return getAutoSelectedView()
		return 'table'
	}

	const currentView = getCurrentViewMode()

	const handleViewModeChange = (mode: AlertViewMode) => {
		setManualViewMode(mode)
		onViewModeChange?.(mode)
	}

	const getViewToggleButtons = () => {
		const views: Array<{
			mode: AlertViewMode
			icon: React.ReactNode
			label: string
			available: boolean
		}> = [
			{
				mode: 'table',
				icon: <Table className="h-4 w-4" />,
				label: 'Table view',
				available: isDesktop,
			},
			{
				mode: 'list',
				icon: <List className="h-4 w-4" />,
				label: 'List view',
				available: true,
			},
			{
				mode: 'cards',
				icon: <LayoutGrid className="h-4 w-4" />,
				label: 'Cards view',
				available: true,
			},
		]

		return views
			.filter((view) => view.available)
			.map((view) => (
				<Button
					key={view.mode}
					variant={currentView === view.mode ? 'default' : 'outline'}
					size="sm"
					onClick={() => handleViewModeChange(view.mode)}
					className="flex items-center gap-2"
					aria-label={view.label}
					aria-pressed={currentView === view.mode}
				>
					{view.icon}
					<span className="hidden sm:inline">{view.label.split(' ')[0]}</span>
				</Button>
			))
	}

	const renderCurrentView = () => {
		switch (currentView) {
			case 'table':
				return renderTable(alerts)
			case 'cards':
				return renderCards(alerts)
			case 'list':
				return renderList(alerts)
			default:
				return renderTable(alerts)
		}
	}

	return (
		<div className={cn('space-y-4', className)}>
			{/* View Toggle Controls */}
			{showViewToggle && (
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground">
							{alerts.length} alert{alerts.length !== 1 ? 's' : ''}
						</span>
						{autoSelectView && manualViewMode && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setManualViewMode(null)}
								className="text-xs"
							>
								Auto
							</Button>
						)}
					</div>

					<div className="flex items-center gap-1" role="group" aria-label="View options">
						{getViewToggleButtons()}
					</div>
				</div>
			)}

			{/* Current View Content */}
			<div className="min-h-0 flex-1">{renderCurrentView()}</div>

			{/* View Mode Indicator for Screen Readers */}
			<div className="sr-only" aria-live="polite">
				Currently showing alerts in {currentView} view
				{autoSelectView && !manualViewMode && ' (auto-selected based on screen size)'}
			</div>
		</div>
	)
}

/**
 * Hook for managing responsive data view state
 */
export function useAlertResponsiveDataView(initialMode?: AlertViewMode) {
	const { isMobile, isTablet, isDesktop } = useAlertResponsive()
	const [viewMode, setViewMode] = useState<AlertViewMode | null>(initialMode || null)

	const getRecommendedView = (): AlertViewMode => {
		if (isMobile) return 'cards'
		if (isTablet) return 'list'
		return 'table'
	}

	const getCurrentView = (): AlertViewMode => {
		return viewMode || getRecommendedView()
	}

	const isViewAvailable = (mode: AlertViewMode): boolean => {
		switch (mode) {
			case 'table':
				return isDesktop
			case 'list':
				return true
			case 'cards':
				return true
			default:
				return true
		}
	}

	const getAvailableViews = (): AlertViewMode[] => {
		const allViews: AlertViewMode[] = ['table', 'list', 'cards']
		return allViews.filter(isViewAvailable)
	}

	return {
		currentView: getCurrentView(),
		recommendedView: getRecommendedView(),
		viewMode,
		setViewMode,
		isViewAvailable,
		availableViews: getAvailableViews(),
		isMobile,
		isTablet,
		isDesktop,
	}
}

export default AlertResponsiveDataView
