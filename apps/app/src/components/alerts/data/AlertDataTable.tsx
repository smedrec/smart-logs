'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
	flexRender,
	getCoreRowModel,
	getFacetedRowModel,
	getFacetedUniqueValues,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from '@tanstack/react-table'
import { Search, X } from 'lucide-react'
import * as React from 'react'

import type { Alert } from '@/lib/collections'
import type {
	ColumnDef,
	ColumnFiltersState,
	PaginationState,
	SortingState,
	VisibilityState,
} from '@tanstack/react-table'

export interface AlertDataTableProps {
	/** Alert data to display */
	data: Alert[]
	/** Column definitions */
	columns: ColumnDef<Alert>[]
	/** Loading state */
	loading?: boolean
	/** Error state */
	error?: string
	/** Callback when row selection changes */
	onRowSelectionChange?: (selectedRows: Alert[]) => void
	/** Callback when pagination changes */
	onPaginationChange?: (pagination: PaginationState) => void
	/** Callback when sorting changes */
	onSortingChange?: (sorting: SortingState) => void
	/** Callback when filters change */
	onFiltersChange?: (filters: ColumnFiltersState) => void
	/** Enable row selection */
	enableRowSelection?: boolean
	/** Enable column resizing */
	enableColumnResizing?: boolean
	/** Enable column filtering */
	enableColumnFiltering?: boolean
	/** Enable sorting */
	enableSorting?: boolean
	/** Initial pagination state */
	initialPagination?: PaginationState
	/** Initial sorting state */
	initialSorting?: SortingState
	/** Initial column filters */
	initialColumnFilters?: ColumnFiltersState
	/** Initial column visibility */
	initialColumnVisibility?: VisibilityState
	/** Additional CSS classes */
	className?: string
	/** Custom empty state message */
	emptyStateMessage?: string
	/** Custom empty state description */
	emptyStateDescription?: string
}

export interface AlertDataTableRef {
	/** Clear all row selections */
	clearRowSelection: () => void
	/** Get selected rows */
	getSelectedRows: () => Alert[]
	/** Reset all filters */
	resetFilters: () => void
	/** Reset sorting */
	resetSorting: () => void
	/** Get table instance */
	getTable: () => ReturnType<typeof useReactTable<Alert>>
}

/**
 * Advanced data table component for displaying alerts with sorting, filtering, and pagination
 * Built using shadcn-ui Table component with responsive design and mobile-friendly layouts
 */
export const AlertDataTable = React.forwardRef<AlertDataTableRef, AlertDataTableProps>(
	(
		{
			data,
			columns,
			loading = false,
			error,
			onRowSelectionChange,
			onPaginationChange,
			onSortingChange,
			onFiltersChange,
			enableRowSelection = true,
			enableColumnResizing = true,
			enableColumnFiltering = true,
			enableSorting = true,
			initialPagination = { pageIndex: 0, pageSize: 25 },
			initialSorting = [],
			initialColumnFilters = [],
			initialColumnVisibility = {},
			className,
			emptyStateMessage = 'No alerts found',
			emptyStateDescription = 'No alerts match your current filters.',
		},
		ref
	) => {
		const [rowSelection, setRowSelection] = React.useState({})
		const [columnVisibility, setColumnVisibility] =
			React.useState<VisibilityState>(initialColumnVisibility)
		const [columnFilters, setColumnFilters] =
			React.useState<ColumnFiltersState>(initialColumnFilters)
		const [sorting, setSorting] = React.useState<SortingState>(initialSorting)
		const [pagination, setPagination] = React.useState<PaginationState>(initialPagination)
		const [globalFilter, setGlobalFilter] = React.useState('')

		const table = useReactTable({
			data,
			columns,
			state: {
				sorting,
				columnVisibility,
				rowSelection,
				columnFilters,
				pagination,
				globalFilter,
			},
			enableRowSelection,
			enableColumnResizing,
			enableSorting,
			onRowSelectionChange: setRowSelection,
			onSortingChange: setSorting,
			onColumnFiltersChange: setColumnFilters,
			onColumnVisibilityChange: setColumnVisibility,
			onPaginationChange: setPagination,
			onGlobalFilterChange: setGlobalFilter,
			getCoreRowModel: getCoreRowModel(),
			getFilteredRowModel: getFilteredRowModel(),
			getPaginationRowModel: getPaginationRowModel(),
			getSortedRowModel: getSortedRowModel(),
			getFacetedRowModel: getFacetedRowModel(),
			getFacetedUniqueValues: getFacetedUniqueValues(),
			globalFilterFn: 'includesString',
		})

		// Handle external callbacks
		React.useEffect(() => {
			if (onRowSelectionChange) {
				const selectedRows = table.getFilteredSelectedRowModel().rows.map((row) => row.original)
				onRowSelectionChange(selectedRows)
			}
		}, [rowSelection, onRowSelectionChange, table])

		React.useEffect(() => {
			if (onPaginationChange) {
				onPaginationChange(pagination)
			}
		}, [pagination, onPaginationChange])

		React.useEffect(() => {
			if (onSortingChange) {
				onSortingChange(sorting)
			}
		}, [sorting, onSortingChange])

		React.useEffect(() => {
			if (onFiltersChange) {
				onFiltersChange(columnFilters)
			}
		}, [columnFilters, onFiltersChange])

		// Expose methods via ref
		React.useImperativeHandle(ref, () => ({
			clearRowSelection: () => setRowSelection({}),
			getSelectedRows: () => table.getFilteredSelectedRowModel().rows.map((row) => row.original),
			resetFilters: () => {
				setColumnFilters([])
				setGlobalFilter('')
			},
			resetSorting: () => setSorting([]),
			getTable: () => table,
		}))

		const isFiltered = table.getState().columnFilters.length > 0 || globalFilter.length > 0

		// Loading state
		if (loading) {
			return (
				<div className={cn('space-y-4', className)}>
					<div className="flex items-center justify-between">
						<div className="flex flex-1 items-center space-x-2">
							<div className="h-8 w-64 bg-muted animate-pulse rounded" />
							<div className="h-8 w-24 bg-muted animate-pulse rounded" />
							<div className="h-8 w-24 bg-muted animate-pulse rounded" />
						</div>
						<div className="h-8 w-32 bg-muted animate-pulse rounded" />
					</div>
					<div className="rounded-md border">
						<div className="h-96 bg-muted/20 animate-pulse" />
					</div>
					<div className="flex items-center justify-between">
						<div className="h-4 w-32 bg-muted animate-pulse rounded" />
						<div className="flex items-center space-x-2">
							<div className="h-8 w-24 bg-muted animate-pulse rounded" />
							<div className="h-8 w-16 bg-muted animate-pulse rounded" />
							<div className="h-8 w-8 bg-muted animate-pulse rounded" />
							<div className="h-8 w-8 bg-muted animate-pulse rounded" />
							<div className="h-8 w-8 bg-muted animate-pulse rounded" />
							<div className="h-8 w-8 bg-muted animate-pulse rounded" />
						</div>
					</div>
				</div>
			)
		}

		// Error state
		if (error) {
			return (
				<div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
					<div className="text-destructive mb-2">
						<X className="h-8 w-8" />
					</div>
					<h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Data</h3>
					<p className="text-sm text-muted-foreground mb-4">{error}</p>
					<Button variant="outline" onClick={() => window.location.reload()}>
						Try Again
					</Button>
				</div>
			)
		}

		return (
			<div className={cn('space-y-4', className)}>
				{/* Global Search */}
				{enableColumnFiltering && (
					<div className="flex items-center justify-between">
						<div className="flex flex-1 items-center space-x-2">
							<div className="relative max-w-sm">
								<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Search alerts..."
									value={globalFilter}
									onChange={(event) => setGlobalFilter(event.target.value)}
									className="pl-8"
								/>
							</div>
							{isFiltered && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										setColumnFilters([])
										setGlobalFilter('')
									}}
									className="h-8 px-2 lg:px-3"
								>
									Reset
									<X className="ml-2 h-4 w-4" />
								</Button>
							)}
						</div>
					</div>
				)}

				{/* Table */}
				<div className="rounded-md border">
					<Table>
						<TableHeader>
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id}>
									{headerGroup.headers.map((header) => {
										return (
											<TableHead
												key={header.id}
												colSpan={header.colSpan}
												style={{
													width: header.getSize() !== 150 ? header.getSize() : undefined,
												}}
												className={cn(
													enableColumnResizing && header.column.getCanResize() && 'resize-x',
													'relative'
												)}
											>
												{header.isPlaceholder
													? null
													: flexRender(header.column.columnDef.header, header.getContext())}
												{/* Column Resizer */}
												{enableColumnResizing && header.column.getCanResize() && (
													<div
														onMouseDown={header.getResizeHandler()}
														onTouchStart={header.getResizeHandler()}
														className={cn(
															'absolute right-0 top-0 h-full w-1 bg-border cursor-col-resize select-none touch-none',
															header.column.getIsResizing() && 'bg-primary'
														)}
													/>
												)}
											</TableHead>
										)
									})}
								</TableRow>
							))}
						</TableHeader>

						<TableBody>
							{table.getRowModel().rows?.length ? (
								table.getRowModel().rows.map((row) => (
									<TableRow
										key={row.id}
										data-state={row.getIsSelected() && 'selected'}
										className="hover:bg-muted/50"
									>
										{row.getVisibleCells().map((cell) => (
											<TableCell
												key={cell.id}
												style={{
													width: cell.column.getSize() !== 150 ? cell.column.getSize() : undefined,
												}}
											>
												{flexRender(cell.column.columnDef.cell, cell.getContext())}
											</TableCell>
										))}
									</TableRow>
								))
							) : (
								<TableRow>
									<TableCell colSpan={columns.length} className="h-24 text-center">
										<div className="flex flex-col items-center justify-center space-y-2">
											<Search className="h-8 w-8 text-muted-foreground" />
											<div>
												<p className="text-sm font-medium">{emptyStateMessage}</p>
												<p className="text-xs text-muted-foreground">{emptyStateDescription}</p>
											</div>
											{isFiltered && (
												<Button
													variant="outline"
													size="sm"
													onClick={() => {
														setColumnFilters([])
														setGlobalFilter('')
													}}
												>
													Clear Filters
												</Button>
											)}
										</div>
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>

				{/* Table Info */}
				<div className="flex items-center justify-between text-sm text-muted-foreground">
					<div className="flex items-center space-x-2">
						{enableRowSelection && (
							<span>
								{table.getFilteredSelectedRowModel().rows.length} of{' '}
								{table.getFilteredRowModel().rows.length} row(s) selected
							</span>
						)}
						{!enableRowSelection && (
							<span>
								Showing {table.getRowModel().rows.length} of {data.length} alert(s)
							</span>
						)}
					</div>
					<div className="flex items-center space-x-2">
						<span>
							Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
						</span>
					</div>
				</div>
			</div>
		)
	}
)

AlertDataTable.displayName = 'AlertDataTable'

export default AlertDataTable
