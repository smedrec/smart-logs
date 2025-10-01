import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { Grid, List, Table } from 'lucide-react'
import { useState } from 'react'

import { useResponsive } from '../hooks/use-responsive'

import type { ReactNode } from 'react'

export type ViewMode = 'table' | 'cards' | 'list'

export interface ResponsiveDataViewProps {
	children: ReactNode
	className?: string
	defaultView?: ViewMode
	allowedViews?: ViewMode[]
	onViewChange?: (view: ViewMode) => void
	showViewToggle?: boolean
	tableView: ReactNode
	cardsView: ReactNode
	listView?: ReactNode
}

/**
 * Responsive data view component that switches between table, cards, and list views
 */
export function ResponsiveDataView({
	children,
	className,
	defaultView,
	allowedViews = ['table', 'cards', 'list'],
	onViewChange,
	showViewToggle = true,
	tableView,
	cardsView,
	listView,
}: ResponsiveDataViewProps) {
	const { isMobile, isTablet } = useResponsive()

	// Auto-select view based on screen size if no default is provided
	const getDefaultView = (): ViewMode => {
		if (defaultView) return defaultView
		if (isMobile) return 'cards'
		if (isTablet) return 'list'
		return 'table'
	}

	const [currentView, setCurrentView] = useState<ViewMode>(getDefaultView())

	const handleViewChange = (view: ViewMode) => {
		setCurrentView(view)
		onViewChange?.(view)
	}

	const renderCurrentView = () => {
		switch (currentView) {
			case 'table':
				return tableView
			case 'cards':
				return cardsView
			case 'list':
				return listView || cardsView
			default:
				return tableView
		}
	}

	const getViewIcon = (view: ViewMode) => {
		switch (view) {
			case 'table':
				return <Table className="h-4 w-4" />
			case 'cards':
				return <Grid className="h-4 w-4" />
			case 'list':
				return <List className="h-4 w-4" />
		}
	}

	const getViewLabel = (view: ViewMode) => {
		switch (view) {
			case 'table':
				return 'Table'
			case 'cards':
				return 'Cards'
			case 'list':
				return 'List'
		}
	}

	return (
		<div className={cn('space-y-4', className)}>
			{/* View Controls */}
			{showViewToggle && allowedViews.length > 1 && (
				<div className="flex items-center justify-between">
					<div>{children}</div>

					<ToggleGroup
						type="single"
						value={currentView}
						onValueChange={(value) => value && handleViewChange(value as ViewMode)}
						className="border rounded-md"
					>
						{allowedViews.map((view) => (
							<ToggleGroupItem
								key={view}
								value={view}
								aria-label={`Switch to ${getViewLabel(view)} view`}
								className="px-3 py-2"
							>
								{getViewIcon(view)}
								<span className="ml-2 hidden sm:inline">{getViewLabel(view)}</span>
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</div>
			)}

			{/* Current View */}
			<div className="transition-all duration-200">{renderCurrentView()}</div>
		</div>
	)
}

export interface ResponsiveTableWrapperProps {
	children: ReactNode
	className?: string
	horizontalScroll?: boolean
}

/**
 * Wrapper for tables that adds horizontal scrolling on mobile
 */
export function ResponsiveTableWrapper({
	children,
	className,
	horizontalScroll = true,
}: ResponsiveTableWrapperProps) {
	const { isMobile } = useResponsive()

	if (!horizontalScroll || !isMobile) {
		return <div className={className}>{children}</div>
	}

	return (
		<div className={cn('overflow-x-auto', className)}>
			<div className="min-w-full">{children}</div>
		</div>
	)
}

export interface ResponsiveSectionProps {
	children: ReactNode
	className?: string
	title?: string
	description?: string
	actions?: ReactNode
	collapsible?: boolean
	defaultCollapsed?: boolean
}

/**
 * Responsive section component with optional collapsible behavior on mobile
 */
export function ResponsiveSection({
	children,
	className,
	title,
	description,
	actions,
	collapsible = false,
	defaultCollapsed = false,
}: ResponsiveSectionProps) {
	const { isMobile } = useResponsive()
	const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed && isMobile)

	const shouldShowCollapse = collapsible && isMobile

	return (
		<section className={cn('space-y-4', className)}>
			{(title || description || actions) && (
				<div className="flex items-center justify-between">
					<div className="space-y-1">
						{title && (
							<div className="flex items-center gap-2">
								<h2 className={cn('text-lg font-semibold', isMobile && 'text-base')}>{title}</h2>
								{shouldShowCollapse && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setIsCollapsed(!isCollapsed)}
										aria-expanded={!isCollapsed}
										aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
									>
										{isCollapsed ? 'Show' : 'Hide'}
									</Button>
								)}
							</div>
						)}
						{description && (
							<p className={cn('text-muted-foreground', isMobile && 'text-sm')}>{description}</p>
						)}
					</div>
					{actions && !shouldShowCollapse && (
						<div className="flex items-center gap-2">{actions}</div>
					)}
				</div>
			)}

			{(!shouldShowCollapse || !isCollapsed) && (
				<div className="transition-all duration-200">{children}</div>
			)}

			{shouldShowCollapse && actions && (
				<div className="flex items-center gap-2 pt-2 border-t">{actions}</div>
			)}
		</section>
	)
}
