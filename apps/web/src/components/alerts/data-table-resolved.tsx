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
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from '@tanstack/react-table'
import { Trash, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { DataTablePagination } from '../ui/data-table-pagination'
import { DataTableViewOptions } from '../ui/data-table-view-options'

import type { ColumnDef, ColumnFiltersState, SortingState } from '@tanstack/react-table'

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
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		onColumnFiltersChange: setColumnFilters,
		getFilteredRowModel: getFilteredRowModel(),
		state: {
			columnFilters,
		},
	})

	const handleOnCleanup = () => {
		onCleanup()
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
					<Button
						onClick={handleOnCleanup}
						variant="secondary"
						size="sm"
						className="ml-auto hidden h-8 lg:flex"
					>
						<Trash2 />
						Delete old resolved alerts
					</Button>

					<DataTableViewOptions table={table} />
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

			<div className="flex items-center justify-center space-x-2 py-4">
				<DataTablePagination table={table} />
			</div>
		</div>
	)
}
