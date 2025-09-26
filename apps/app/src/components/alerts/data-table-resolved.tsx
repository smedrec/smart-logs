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
import { Trash, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import { DataTableFacetedFilter } from '../ui/data-table-faceted-filter'
import { DataTablePagination } from '../ui/data-table-pagination'
import { DataTableViewOptions } from '../ui/data-table-view-options'
import { severities, types } from './data'

import type {
	ColumnDef,
	ColumnFiltersState,
	SortingState,
	VisibilityState,
} from '@tanstack/react-table'

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[]
	data: TData[]
	onCleanup: () => void
}

export function DataTable<TData, TValue>({
	columns,
	data,
	onCleanup,
}: DataTableProps<TData, TValue>) {
	const [rowSelection, setRowSelection] = useState({})
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [sorting, setSorting] = useState<SortingState>([])

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

	const handleOnCleanup = () => {
		onCleanup()
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<div className="flex flex-1 items-center gap-2">
					<Input
						placeholder="Filter title..."
						value={(table.getColumn('title')?.getFilterValue() as string) ?? ''}
						onChange={(event) => table.getColumn('title')?.setFilterValue(event.target.value)}
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
						<DataTableFacetedFilter column={table.getColumn('type')} title="Type" options={types} />
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

					<Button
						onClick={handleOnCleanup}
						variant="secondary"
						size="sm"
						className="ml-auto hidden h-8 lg:flex"
					>
						<Trash2 />
						Delete old resolved alerts
					</Button>
				</div>
			</div>
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
