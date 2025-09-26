'use client'

import { Checkbox } from '../ui/checkbox'
import { DataTableColumnHeader } from '../ui/data-table-column-header'
import { severities, types } from './data'

import type { Alert } from '@/lib/collections'
import type { ColumnDef } from '@tanstack/react-table'

export const createColumns = (): ColumnDef<Alert>[] => {
	const columns: ColumnDef<Alert>[] = [
		{
			id: 'select',
			header: ({ table }) => (
				<Checkbox
					checked={
						table.getIsAllPageRowsSelected() ||
						(table.getIsSomePageRowsSelected() && 'indeterminate')
					}
					onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
					aria-label="Select all"
					className="translate-y-[2px]"
				/>
			),
			cell: ({ row }) => (
				<Checkbox
					checked={row.getIsSelected()}
					onCheckedChange={(value) => row.toggleSelected(!!value)}
					aria-label="Select row"
					className="translate-y-[2px]"
				/>
			),
			enableSorting: false,
			enableHiding: false,
		},
		{
			accessorKey: 'severity',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Severity" />,
			cell: ({ row }) => {
				const severity = severities.find((severity) => severity.value === row.getValue('severity'))

				if (!severity) {
					return null
				}

				return (
					<div className="flex w-[60px] items-center gap-2">
						<span>{severity.label}</span>
					</div>
				)
			},
			filterFn: (row, id, value) => {
				return value.includes(row.getValue(id))
			},
		},
		{
			accessorKey: 'type',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
			cell: ({ row }) => {
				const type = types.find((type) => type.value === row.getValue('type'))

				if (!type) {
					return null
				}

				return (
					<div className="flex w-[60px] items-center gap-2">
						<span>{type.label}</span>
					</div>
				)
			},
			filterFn: (row, id, value) => {
				return value.includes(row.getValue(id))
			},
		},
		{
			accessorKey: 'title',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
		},
		{
			accessorKey: 'description',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
			cell: ({ row }) => {
				return (
					<div className="flex gap-2">
						<span className="max-w-[500px] truncate font-medium">
							{row.getValue('description')}
						</span>
					</div>
				)
			},
		},
		{
			accessorKey: 'source',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Source" />,
		},
	]

	return columns
}
