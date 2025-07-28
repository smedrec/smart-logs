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
import { CheckCheck } from 'lucide-react'
import { forwardRef, useImperativeHandle, useState } from 'react'

import { DataTablePagination } from '../ui/data-table-pagination'
import { DataTableViewOptions } from '../ui/data-table-view-options'

import type { ColumnDef, ColumnFiltersState, SortingState } from '@tanstack/react-table'

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[]
	data: TData[]
	onmultiResolve: (data: TData[]) => void
}

export interface DataTableRef {
	clearRowSelection: () => void
}

export const DataTable = forwardRef<DataTableRef, DataTableProps<any, any>>(function DataTable<
	TData,
	TValue,
>({ columns, data, onmultiResolve }: DataTableProps<TData, TValue>, ref) {
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [rowSelection, setRowSelection] = useState({})

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		onColumnFiltersChange: setColumnFilters,
		getFilteredRowModel: getFilteredRowModel(),
		onRowSelectionChange: setRowSelection,
		state: {
			columnFilters,
			rowSelection,
		},
	})

	useImperativeHandle(ref, () => ({
		clearRowSelection: () => setRowSelection({}),
	}))

	const handlemultiDelete = () => {
		const selectedItems = table
			.getFilteredSelectedRowModel()
			.rows.map((row) => row.original as TData)
		onmultiResolve(selectedItems)
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<Input
					placeholder="Filter..."
					// value={(table.getColumn("name_4603829743")?.getFilterValue() as string) ?? ""}
					// onChange={(event) =>
					//   table.getColumn("name_4603829743")?.setFilterValue(event.target.value)
					// }
					className="max-w-sm"
				/>
				<div className="flex items-center gap-4">
					{Object.keys(rowSelection).length > 0 && (
						<Button
							onClick={handlemultiDelete}
							variant="secondary"
							size="sm"
							className="ml-auto hidden h-8 lg:flex"
						>
							<CheckCheck />
							Resolve Selected ({Object.keys(rowSelection).length})
						</Button>
					)}

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
})
