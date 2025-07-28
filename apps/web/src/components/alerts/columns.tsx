'use client'

import { DataTableColumnHeader } from '../ui/data-table-column-header'

import type { ColumnDef } from '@tanstack/react-table'
import type { Alert } from '@repo/audit'

export const createColumns = (): ColumnDef<Alert>[] => {
	const columns: ColumnDef<Alert>[] = [
		{
			accessorKey: 'severity',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Severity" />,
		},
		{
			accessorKey: 'type',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
		},
		{
			accessorKey: 'title',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
		},
		{
			accessorKey: 'description',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
		},
		{
			accessorKey: 'source',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Source" />,
		},
	]

	return columns
}
