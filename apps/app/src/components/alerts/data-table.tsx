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
import { CheckCheck, X } from 'lucide-react'
import * as React from 'react'

import { DataTableFacetedFilter } from '../ui/data-table-faceted-filter'
import { DataTablePagination } from '../ui/data-table-pagination'
import { DataTableViewOptions } from '../ui/data-table-view-options'
import { severities, types } from './data'
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
	/** Callback when alert is viewed */
	onViewAlert?: (alert: Alert) => void
	/** Callback when alert is acknowledged */
	onAcknowledgeAlert?: (alertId: string) => Promise<void>
	/** Callback when alert is resolved */
	onResolveAlert?: (alertId: string, note: string) => Promise<void>
	/** Callback when alert is dismissed */
	onDismissAlert?: (alertId: string) => Promise<void>
}

export interface DataTableRef {
	clearRowSelection: () => void
}

export const DataTable = React.forwardRef<DataTableRef, DataTableProps<any, any>>(
	function DataTable<TData, TValue>(
		{
			columns,
			data,
			onViewAlert,
			onAcknowledgeAlert,
			onResolveAlert,
			onDismissAlert,
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

		return (
			<div className="flex flex-col gap-4">
				<div className="flex items-center justify-between">
					<div className="flex flex-1 items-center gap-2">
						<Input
							placeholder="Filter..."
							// value={(table.getColumn("name_4603829743")?.getFilterValue() as string) ?? ""}
							// onChange={(event) =>
							//   table.getColumn("name_4603829743")?.setFilterValue(event.target.value)
							// }
							className="max-w-sm"
						/>
						{table.getColumn('severity') && (
							<DataTableFacetedFilter
								column={table.getColumn('severity')}
								title="Severity"
								options={severities}
							/>
						)}
						{table.getColumn('type') && (
							<DataTableFacetedFilter
								column={table.getColumn('type')}
								title="Type"
								options={types}
							/>
						)}
						{isFiltered && (
							<Button variant="ghost" size="sm" onClick={() => table.resetColumnFilters()}>
								Reset
								<X />
							</Button>
						)}
					</div>
					<div className="flex items-center gap-2">
						<DataTableViewOptions table={table} />

						{Object.keys(rowSelection).length > 0 && (
							<AlertActions
								selectedAlerts={table
									.getFilteredSelectedRowModel()
									.rows.map((row) => row.original as Alert)}
								onAcknowledge={handleBulkAcknowledge}
								onResolve={handleBulkResolve}
								onDismiss={handleBulkDismiss}
							/>
						)}
					</div>
				</div>
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
