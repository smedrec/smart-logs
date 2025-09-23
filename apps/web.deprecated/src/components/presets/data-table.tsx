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
import {
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from '@tanstack/react-table'
import { ArrowDownUp, ArrowDownWideNarrow, ArrowUpNarrowWide, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { DataTablePagination } from '../ui/data-table-pagination'
import { DataTableViewOptions } from '../ui/data-table-view-options'

import type { ColumnDef, ColumnFiltersState, SortingState } from '@tanstack/react-table'

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[]
	data: TData[]
	onAdd: () => void
	onEdit: (data: TData) => void
	onDelete: (id: string) => void
	onmultiDelete: (data: TData[]) => void
}

export function DataTable<TData, TValue>({
	columns,
	data,
	onAdd,
	onEdit,
	onDelete,
	onmultiDelete,
}: DataTableProps<TData, TValue>) {
	const [sorting, setSorting] = useState<SortingState>([])
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [rowSelection, setRowSelection] = useState({})

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		onSortingChange: setSorting,
		getSortedRowModel: getSortedRowModel(),
		onColumnFiltersChange: setColumnFilters,
		getFilteredRowModel: getFilteredRowModel(),
		onRowSelectionChange: setRowSelection,
		state: {
			sorting,
			columnFilters,
			rowSelection,
		},
		meta: {
			onEdit,
			onDelete,
		},
	})

	const handlemultiDelete = () => {
		const selectedItems = table
			.getFilteredSelectedRowModel()
			.rows.map((row) => row.original as TData)
		onmultiDelete(selectedItems)
	}

	return (
		<div className="space-y-4">
			<h1 className="font-bold text-2xl leading-tight">Audit Presets</h1>
			<div className="flex items-center justify-between">
				<Input
					placeholder="Filter..."
					value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
					onChange={(event) => table.getColumn('name')?.setFilterValue(event.target.value)}
					className="max-w-sm"
				/>
				<div className="flex items-center gap-4">
					{Object.keys(rowSelection).length > 0 && (
						<Button
							onClick={handlemultiDelete}
							variant="destructive"
							size="sm"
							className="ml-auto hidden h-8 lg:flex"
						>
							<Trash2 />
							Delete Selected ({Object.keys(rowSelection).length})
						</Button>
					)}

					<Button
						onClick={onAdd}
						variant="outline"
						size="sm"
						className="ml-auto hidden h-8 lg:flex"
					>
						<Plus />
						Add Preset
					</Button>

					<DataTableViewOptions table={table} />
				</div>
			</div>
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								<TableHead className="w-[50px]">
									<Checkbox
										checked={table.getIsAllPageRowsSelected()}
										onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
										aria-label="Select all"
									/>
								</TableHead>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
										{header.isPlaceholder ? null : (
											<div className="flex items-center">
												{flexRender(header.column.columnDef.header, header.getContext())}
												{header.column.getCanSort() && (
													<Button variant="ghost" onClick={header.column.getToggleSortingHandler()}>
														{header.column.getIsSorted() ? (
															header.column.getIsSorted() === 'desc' ? (
																<ArrowDownWideNarrow className="ml-2 h-4 w-4" />
															) : (
																<ArrowUpNarrowWide className="ml-2 h-4 w-4" />
															)
														) : (
															<ArrowDownUp className="ml-2 h-4 w-4" />
														)}
													</Button>
												)}
											</div>
										)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>

					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
									<TableCell className="w-[50px]">
										<Checkbox
											checked={row.getIsSelected()}
											onCheckedChange={(value) => row.toggleSelected(!!value)}
											aria-label="Select row"
										/>
									</TableCell>
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

			<div className="flex items-center justify-center space-x-2 py-4">
				<DataTablePagination table={table} />
			</div>
		</div>
	)
}
