'use client'

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
import { AlertTriangle } from 'lucide-react'
import * as React from 'react'

import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import { DataTablePagination } from '../ui/data-table-pagination'
import { Skeleton } from '../ui/skeleton'
import AlertTableToolbar from './data/AlertTableToolbar'
import { AlertActions } from './forms/AlertActions'

import type { Alert } from '@/lib/collections'
import type {
	ColumnDef,
	ColumnFiltersState,
	SortingState,
	VisibilityState,
} from '@tanstack/react-table'

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[]
	data: TData[]
	/** Loading state */
	loading?: boolean
	/** Error state */
	error?: string
	/** Callback when alert is viewed */
	onViewAlert?: (alert: Alert) => void
	/** Callback when alert is acknowledged */
	onAcknowledgeAlert?: (alertId: string) => Promise<void>
	/** Callback when alert is resolved */
	onResolveAlert?: (alertId: string, note: string) => Promise<void>
	/** Callback when alert is dismissed */
	onDismissAlert?: (alertId: string) => Promise<void>
	/** Additional CSS classes */
	className?: string
}

export interface DataTableRef {
	clearRowSelection: () => void
}

export const DataTable = React.forwardRef<DataTableRef, DataTableProps<any, any>>(
	function DataTable<TData, TValue>(
		{
			columns,
			data,
			loading = false,
			error,
			onViewAlert,
			onAcknowledgeAlert,
			onResolveAlert,
			onDismissAlert,
			className,
		}: DataTableProps<TData, TValue>,
		ref: any
	) {
		const [rowSelection, setRowSelection] = React.useState({})
		const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
		const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
		const [sorting, setSorting] = React.useState<SortingState>([])
		const [selectedRows, setSelectedRows] = React.useState<Alert[]>([])

		const table = useReactTable({
			data,
			columns,
			state: {
				sorting,
				columnVisibility,
				rowSelection,
				columnFilters,
			},
			initialState: {
				pagination: {
					pageSize: 25,
				},
			},
			enableRowSelection: true,
			onRowSelectionChange: setRowSelection,
			onSortingChange: setSorting,
			onColumnFiltersChange: setColumnFilters,
			onColumnVisibilityChange: setColumnVisibility,
			getCoreRowModel: getCoreRowModel(),
			getFilteredRowModel: getFilteredRowModel(),
			getPaginationRowModel: getPaginationRowModel(),
			getSortedRowModel: getSortedRowModel(),
			getFacetedRowModel: getFacetedRowModel(),
			getFacetedUniqueValues: getFacetedUniqueValues(),
		})

		const isFiltered = table.getState().columnFilters.length > 0

		React.useImperativeHandle(ref, () => ({
			clearRowSelection: () => setRowSelection({}),
		}))

		// Handle bulk actions
		const handleBulkAcknowledge = async (alertIds: string[]) => {
			if (alertIds.length && onAcknowledgeAlert) {
				alertIds.forEach(onAcknowledgeAlert)
				//selectedRows.forEach(onAcknowledgeAlert)
				ref.current?.clearRowSelection?.()
			}
		}

		const handleBulkResolve = async (alertIds: string[], note: string) => {
			if (alertIds.length > 0 && onResolveAlert) {
				alertIds.forEach((alertId) => onResolveAlert(alertId, note))
				ref.current?.clearRowSelection?.()
			}
		}

		const handleBulkDismiss = async (alertIds: string[]) => {
			if (alertIds.length > 0 && onDismissAlert) {
				alertIds.forEach(onDismissAlert)
				ref.current?.clearRowSelection?.()
			}
		}

		function onRefresh(): void {
			throw new Error('Function not implemented.')
		}
		function onExport(): void {
			throw new Error('Function not implemented.')
		}
		function onRealTimeToggle(enabled: boolean): void {
			throw new Error('Function not implemented.')
		}
		const realTimeEnabled = false

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

		return (
			<div className="flex flex-col gap-4">
				<div className="flex items-center justify-between">
					{/* Toolbar */}
					<AlertTableToolbar
						table={table}
						enableSearch={true}
						enableFiltering={true}
						enableViewOptions={true}
						enableExport={true}
						enableRefresh={false}
						enableRealTimeToggle={false}
						onRefresh={onRefresh}
						onExport={onExport}
						realTimeEnabled={realTimeEnabled}
						onRealTimeToggle={onRealTimeToggle}
						loading={loading}
					/>
				</div>
				{Object.keys(rowSelection).length > 0 && (
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<AlertActions
								selectedAlerts={table
									.getFilteredSelectedRowModel()
									.rows.map((row) => row.original as Alert)}
								onAcknowledge={handleBulkAcknowledge}
								onResolve={handleBulkResolve}
								onDismiss={handleBulkDismiss}
							/>
						</div>
					</div>
				)}
				<div className="rounded-md border">
					<Table>
						<TableHeader>
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id}>
									{headerGroup.headers.map((header) => {
										return (
											<TableHead key={header.id} colSpan={header.colSpan}>
												{header.isPlaceholder
													? null
													: flexRender(header.column.columnDef.header, header.getContext())}
											</TableHead>
										)
									})}
								</TableRow>
							))}
						</TableHeader>

						<TableBody>
							{table.getRowModel().rows?.length ? (
								table.getRowModel().rows.map((row) => (
									<TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
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
										No results.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
				<DataTablePagination table={table} />
			</div>
		)
	}
)
