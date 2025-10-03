import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { BarChart3, Filter, LayoutGrid, List, RefreshCw, Settings } from 'lucide-react'
import React, { useState } from 'react'

import type { AlertFilters } from '@/lib/types/alert'

export interface AlertDashboardProps {
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
	initialFilters,
	view = 'list',
	onViewChange,
	className,
	children,
}: AlertDashboardProps) {
	const [currentView, setCurrentView] = useState<'list' | 'board' | 'statistics'>(view)
	const [isRefreshing, setIsRefreshing] = useState(false)

	const handleViewChange = (newView: 'list' | 'board' | 'statistics') => {
		setCurrentView(newView)
		onViewChange?.(newView)
	}

	const handleRefresh = async () => {
		setIsRefreshing(true)
		// Refresh logic will be implemented when API integration is added
		setTimeout(() => setIsRefreshing(false), 1000)
	}

	return (
		<div className={cn('flex flex-col space-y-6 p-6', className)}>
			{/* Dashboard Header */}
			<div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
				<div className="flex flex-col space-y-1">
					<h1 className="text-2xl font-semibold tracking-tight">Alert Management</h1>
					<p className="text-sm text-muted-foreground">
						Monitor and manage system alerts across your organization
					</p>
				</div>

				{/* Dashboard Actions */}
				<div className="flex items-center space-x-2">
					<Button
						variant="outline"
						size="sm"
						onClick={handleRefresh}
						disabled={isRefreshing}
						className="flex items-center space-x-2"
					>
						<RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
						<span className="hidden sm:inline">Refresh</span>
					</Button>

					<Button variant="outline" size="sm" className="flex items-center space-x-2">
						<Filter className="h-4 w-4" />
						<span className="hidden sm:inline">Filters</span>
					</Button>

					<Button variant="outline" size="sm" className="flex items-center space-x-2">
						<Settings className="h-4 w-4" />
						<span className="hidden sm:inline">Settings</span>
					</Button>
				</div>
			</div>

			{/* View Navigation */}
			<Tabs
				value={currentView}
				onValueChange={(value) => handleViewChange(value as 'list' | 'board' | 'statistics')}
				className="w-full"
			>
				<div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
					<TabsList className="grid w-full grid-cols-3 sm:w-auto">
						<TabsTrigger value="list" className="flex items-center space-x-2">
							<List className="h-4 w-4" />
							<span>List</span>
						</TabsTrigger>
						<TabsTrigger value="board" className="flex items-center space-x-2">
							<LayoutGrid className="h-4 w-4" />
							<span>Board</span>
						</TabsTrigger>
						<TabsTrigger value="statistics" className="flex items-center space-x-2">
							<BarChart3 className="h-4 w-4" />
							<span>Statistics</span>
						</TabsTrigger>
					</TabsList>

					{/* Alert Summary Badges */}
					<div className="flex items-center space-x-2">
						<Badge variant="destructive" className="flex items-center space-x-1">
							<span className="h-2 w-2 rounded-full bg-current" />
							<span>5 Critical</span>
						</Badge>
						<Badge variant="secondary" className="flex items-center space-x-1">
							<span className="h-2 w-2 rounded-full bg-orange-500" />
							<span>12 High</span>
						</Badge>
						<Badge variant="outline" className="flex items-center space-x-1">
							<span className="h-2 w-2 rounded-full bg-blue-500" />
							<span>23 Active</span>
						</Badge>
					</div>
				</div>

				{/* Dashboard Content */}
				<div className="mt-6">
					<TabsContent value="list" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center justify-between">
									<span>Alert List</span>
									<Badge variant="outline">40 alerts</Badge>
								</CardTitle>
							</CardHeader>
							<CardContent>
								{/* AlertList component will be rendered here */}
								<div className="text-center py-8 text-muted-foreground">
									Alert list component will be implemented in the next subtask
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="board" className="space-y-4">
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
							{/* Alert status columns */}
							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="text-sm font-medium flex items-center justify-between">
										<span>Active</span>
										<Badge variant="destructive">23</Badge>
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-2">
									{/* AlertCard components will be rendered here */}
									<div className="text-center py-4 text-sm text-muted-foreground">
										Alert cards will be implemented in subtask 3.3
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="text-sm font-medium flex items-center justify-between">
										<span>Acknowledged</span>
										<Badge variant="secondary">12</Badge>
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-2">
									<div className="text-center py-4 text-sm text-muted-foreground">
										Alert cards will be implemented in subtask 3.3
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="text-sm font-medium flex items-center justify-between">
										<span>Resolved</span>
										<Badge variant="outline">45</Badge>
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-2">
									<div className="text-center py-4 text-sm text-muted-foreground">
										Alert cards will be implemented in subtask 3.3
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="text-sm font-medium flex items-center justify-between">
										<span>Dismissed</span>
										<Badge variant="outline">8</Badge>
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-2">
									<div className="text-center py-4 text-sm text-muted-foreground">
										Alert cards will be implemented in subtask 3.3
									</div>
								</CardContent>
							</Card>
						</div>
					</TabsContent>

					<TabsContent value="statistics" className="space-y-4">
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">88</div>
									<p className="text-xs text-muted-foreground">+12% from last week</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold text-destructive">5</div>
									<p className="text-xs text-muted-foreground">-2 from yesterday</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-sm font-medium">Response Time</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">4.2m</div>
									<p className="text-xs text-muted-foreground">Average response time</p>
								</CardContent>
							</Card>
						</div>

						{/* Statistics charts will be implemented in later tasks */}
						<Card>
							<CardHeader>
								<CardTitle>Alert Trends</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-center py-8 text-muted-foreground">
									Statistics charts will be implemented in task 12.4
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				</div>
			</Tabs>

			{/* Custom children content */}
			{children}
		</div>
	)
}

export default AlertDashboard
