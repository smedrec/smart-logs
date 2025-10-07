'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from '@tanstack/react-table'
import { Search, X } from 'lucide-react'
import * as React from 'react'

import type { Alert } from '@/lib/collections'
import type { ColumnDef } from '@tanstack/react-table'

export interface SimpleAlertTableProps {
	/** Alert data to display */
	data: Alert[]
	/** Column definitions */
	columns: ColumnDef<Alert>[]
	/** Loading state */
	loading?: boolean
	/** Error state */
	error?: string
	/** Additional CSS classes */
	className?: string
	/** Custom empty state message */
	emptyStateMessage?: string
}

/**
 * Simplified alert data table without complex state management
 * Focuses on displaying data without infinite loop issues
 */
export function SimpleAlertTable({
	data,
	columns,
	loading = false,
	error,
	className,
	emptyStateMessage = 'No alerts found',
}: SimpleAlertTableProps) {
	const [globalFilter, setGlobalFilter] = React.useState('')

	const table = useReactTable({
		data,
		columns,
		state: {
			globalFilter,
		},
		onGlobalFilterChange: setGlobalFilter,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		globalFilterFn: 'includesString',
		initialState: {
			pagination: {
				pageSize: 10,
			},
		},
	})

	// Loading state
	if (loading) {
		return (
			<div className={cn('space-y-4', className)}>
				<div className="h-8 w-64 bg-muted animate-pulse rounded" />
				<div className="rounded-md border">
					<div className="h-96 bg-muted/20 animate-pulse" />
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

	const isFiltered = globalFilter.length > 0

	return (
		<div className={cn('space-y-4', className)}>
			{/* Global Search */}
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
							onClick={() => setGlobalFilter('')}
							className="h-8 px-2 lg:px-3"
						>
							Reset
							<X className="ml-2 h-4 w-4" />
						</Button>
					)}
				</div>
			</div>

			{/* Table */}
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
										{header.isPlaceholder
											? null
											: flexRender(header.column.columnDef.header, header.getContext())}
									</TableHead>
								))}
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
										<TableCell key={cell.id}>
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
											<p className="text-xs text-muted-foreground">
												{isFiltered ? 'No alerts match your search.' : 'No alerts available.'}
											</p>
										</div>
										{isFiltered && (
											<Button variant="outline" size="sm" onClick={() => setGlobalFilter('')}>
												Clear Search
											</Button>
										)}
									</div>
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{/* Simple Pagination */}
			<div className="flex items-center justify-between px-2">
				<div className="flex-1 text-sm text-muted-foreground">
					Showing {table.getRowModel().rows.length} of {data.length} alert(s)
				</div>
				<div className="flex items-center space-x-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						Previous
					</Button>
					<div className="flex items-center space-x-1">
						<span className="text-sm font-medium">
							Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
						</span>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						Next
					</Button>
				</div>
			</div>
		</div>
	)
}

export default SimpleAlertTable
