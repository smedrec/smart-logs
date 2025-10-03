'use client'

import { Button } from '@/components/ui/button'
import { DataTableFacetedFilter } from '@/components/ui/data-table-faceted-filter'
import { DataTableViewOptions } from '@/components/ui/data-table-view-options'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { Download, Filter, MoreHorizontal, RefreshCw, Search, Settings, X } from 'lucide-react'
import * as React from 'react'

import type { AlertSeverity, AlertStatus, AlertType } from '@/lib/types/alert'
import type { Table } from '@tanstack/react-table'

export interface AlertTableToolbarProps<TData> {
	/** TanStack Table instance */
	table: Table<TData>
	/** Enable search functionality */
	enableSearch?: boolean
	/** Enable filtering */
	enableFiltering?: boolean
	/** Enable view options */
	enableViewOptions?: boolean
	/** Enable export functionality */
	enableExport?: boolean
	/** Enable refresh functionality */
	enableRefresh?: boolean
	/** Enable real-time updates toggle */
	enableRealTimeToggle?: boolean
	/** Search placeholder text */
	searchPlaceholder?: string
	/** Callback when search changes */
	onSearchChange?: (value: string) => void
	/** Callback when export is triggered */
	onExport?: (format: 'csv' | 'json' | 'xlsx') => void
	/** Callback when refresh is triggered */
	onRefresh?: () => void
	/** Callback when real-time updates toggle changes */
	onRealTimeToggle?: (enabled: boolean) => void
	/** Real-time updates enabled state */
	realTimeEnabled?: boolean
	/** Loading state */
	loading?: boolean
	/** Additional CSS classes */
	className?: string
	/** Custom filter options */
	filterOptions?: {
		severity?: { label: string; value: AlertSeverity; icon?: React.ComponentType }[]
		type?: { label: string; value: AlertType; icon?: React.ComponentType }[]
		status?: { label: string; value: AlertStatus; icon?: React.ComponentType }[]
		source?: { label: string; value: string }[]
	}
}

// Default filter options
const defaultSeverityOptions = [
	{ label: 'Critical', value: 'critical' as AlertSeverity },
	{ label: 'High', value: 'high' as AlertSeverity },
	{ label: 'Medium', value: 'medium' as AlertSeverity },
	{ label: 'Low', value: 'low' as AlertSeverity },
	{ label: 'Info', value: 'info' as AlertSeverity },
]

const defaultTypeOptions = [
	{ label: 'Security', value: 'security' as AlertType },
	{ label: 'Compliance', value: 'compliance' as AlertType },
	{ label: 'Performance', value: 'performance' as AlertType },
	{ label: 'System', value: 'system' as AlertType },
	{ label: 'Custom', value: 'custom' as AlertType },
]

const defaultStatusOptions = [
	{ label: 'Active', value: 'active' as AlertStatus },
	{ label: 'Acknowledged', value: 'acknowledged' as AlertStatus },
	{ label: 'Resolved', value: 'resolved' as AlertStatus },
	{ label: 'Dismissed', value: 'dismissed' as AlertStatus },
]

/**
 * Toolbar component with search, filters, and view controls for alert data tables
 * Implements export functionality and real-time update controls
 */
export function AlertTableToolbar<TData>({
	table,
	enableSearch = true,
	enableFiltering = true,
	enableViewOptions = true,
	enableExport = true,
	enableRefresh = true,
	enableRealTimeToggle = false,
	searchPlaceholder = 'Search alerts...',
	onSearchChange,
	onExport,
	onRefresh,
	onRealTimeToggle,
	realTimeEnabled = false,
	loading = false,
	className,
	filterOptions,
}: AlertTableToolbarProps<TData>) {
	const [searchValue, setSearchValue] = React.useState('')

	const isFiltered = table.getState().columnFilters.length > 0 || searchValue.length > 0

	// Handle search input change
	const handleSearchChange = (value: string) => {
		setSearchValue(value)
		table.setGlobalFilter(value)
		onSearchChange?.(value)
	}

	// Handle filter reset
	const handleResetFilters = () => {
		table.resetColumnFilters()
		setSearchValue('')
		table.setGlobalFilter('')
		onSearchChange?.('')
	}

	// Handle export
	const handleExport = (format: 'csv' | 'json' | 'xlsx') => {
		onExport?.(format)
	}

	// Handle refresh
	const handleRefresh = () => {
		onRefresh?.()
	}

	// Handle real-time toggle
	const handleRealTimeToggle = () => {
		onRealTimeToggle?.(!realTimeEnabled)
	}

	const severityOptions = filterOptions?.severity || defaultSeverityOptions
	const typeOptions = filterOptions?.type || defaultTypeOptions
	const statusOptions = filterOptions?.status || defaultStatusOptions
	const sourceOptions = filterOptions?.source || []

	return (
		<div className={cn('flex items-center justify-between', className)}>
			<div className="flex flex-1 items-center space-x-2">
				{/* Search */}
				{enableSearch && (
					<div className="relative">
						<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder={searchPlaceholder}
							value={searchValue}
							onChange={(event) => handleSearchChange(event.target.value)}
							className="h-8 w-[150px] lg:w-[250px] pl-8"
						/>
					</div>
				)}

				{/* Filters */}
				{enableFiltering && (
					<>
						{table.getColumn('severity') && (
							<DataTableFacetedFilter
								column={table.getColumn('severity')}
								title="Severity"
								options={severityOptions}
							/>
						)}
						{table.getColumn('type') && (
							<DataTableFacetedFilter
								column={table.getColumn('type')}
								title="Type"
								options={typeOptions}
							/>
						)}
						{table.getColumn('status') && (
							<DataTableFacetedFilter
								column={table.getColumn('status')}
								title="Status"
								options={statusOptions}
							/>
						)}
						{table.getColumn('source') && sourceOptions.length > 0 && (
							<DataTableFacetedFilter
								column={table.getColumn('source')}
								title="Source"
								options={sourceOptions}
							/>
						)}
					</>
				)}

				{/* Reset filters */}
				{isFiltered && (
					<Button variant="ghost" onClick={handleResetFilters} className="h-8 px-2 lg:px-3">
						Reset
						<X className="ml-2 h-4 w-4" />
					</Button>
				)}
			</div>

			<div className="flex items-center space-x-2">
				{/* Refresh button */}
				{enableRefresh && (
					<Button
						variant="outline"
						size="sm"
						onClick={handleRefresh}
						disabled={loading}
						className="h-8"
					>
						<RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
						<span className="sr-only">Refresh</span>
					</Button>
				)}

				{/* Real-time toggle */}
				{enableRealTimeToggle && (
					<Button
						variant={realTimeEnabled ? 'default' : 'outline'}
						size="sm"
						onClick={handleRealTimeToggle}
						className="h-8"
					>
						<div
							className={cn(
								'h-2 w-2 rounded-full mr-2',
								realTimeEnabled ? 'bg-green-500' : 'bg-gray-400'
							)}
						/>
						Live
					</Button>
				)}

				<Separator orientation="vertical" className="h-4" />

				{/* Export dropdown */}
				{enableExport && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm" className="h-8">
								<Download className="h-4 w-4 mr-2" />
								Export
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-[160px]">
							<DropdownMenuLabel>Export Format</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => handleExport('csv')}>
								<Download className="mr-2 h-4 w-4" />
								CSV
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => handleExport('json')}>
								<Download className="mr-2 h-4 w-4" />
								JSON
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => handleExport('xlsx')}>
								<Download className="mr-2 h-4 w-4" />
								Excel
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}

				{/* View options */}
				{enableViewOptions && <DataTableViewOptions table={table} />}

				{/* More options */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm" className="h-8 w-8 p-0">
							<span className="sr-only">Open menu</span>
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-[160px]">
						<DropdownMenuLabel>Options</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={handleResetFilters} disabled={!isFiltered}>
							<Filter className="mr-2 h-4 w-4" />
							Clear Filters
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => table.resetColumnVisibility()}>
							<Settings className="mr-2 h-4 w-4" />
							Reset Columns
						</DropdownMenuItem>
						{enableRefresh && (
							<DropdownMenuItem onClick={handleRefresh} disabled={loading}>
								<RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
								Refresh Data
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	)
}

/**
 * Simplified toolbar for basic use cases
 */
export function SimpleAlertTableToolbar<TData>({
	table,
	onRefresh,
	loading,
	className,
}: {
	table: Table<TData>
	onRefresh?: () => void
	loading?: boolean
	className?: string
}) {
	return (
		<AlertTableToolbar
			table={table}
			enableFiltering={false}
			enableExport={false}
			enableViewOptions={false}
			enableRealTimeToggle={false}
			onRefresh={onRefresh}
			loading={loading}
			className={className}
		/>
	)
}

/**
 * Compact toolbar for mobile views
 */
export function CompactAlertTableToolbar<TData>({
	table,
	onRefresh,
	loading,
	className,
}: {
	table: Table<TData>
	onRefresh?: () => void
	loading?: boolean
	className?: string
}) {
	const [searchValue, setSearchValue] = React.useState('')
	const isFiltered = table.getState().columnFilters.length > 0 || searchValue.length > 0

	const handleSearchChange = (value: string) => {
		setSearchValue(value)
		table.setGlobalFilter(value)
	}

	const handleResetFilters = () => {
		table.resetColumnFilters()
		setSearchValue('')
		table.setGlobalFilter('')
	}

	return (
		<div className={cn('flex items-center justify-between space-x-2', className)}>
			<div className="flex flex-1 items-center space-x-2">
				<div className="relative">
					<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search..."
						value={searchValue}
						onChange={(event) => handleSearchChange(event.target.value)}
						className="h-8 w-full pl-8"
					/>
				</div>
				{isFiltered && (
					<Button variant="ghost" onClick={handleResetFilters} size="sm" className="h-8 px-2">
						<X className="h-4 w-4" />
					</Button>
				)}
			</div>
			{onRefresh && (
				<Button
					variant="outline"
					size="sm"
					onClick={onRefresh}
					disabled={loading}
					className="h-8 w-8 p-0"
				>
					<RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
				</Button>
			)}
		</div>
	)
}

export default AlertTableToolbar
