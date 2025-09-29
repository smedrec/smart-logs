'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'

import type { AuditPreset } from '@smedrec/audit-client'
import type { ColumnDef } from '@tanstack/react-table'

interface ColumnActions {
	onEdit?: (data: AuditPreset) => void
	onDelete?: (id: string) => void
}

export const createColumns = (): ColumnDef<AuditPreset>[] => {
	const columns: ColumnDef<AuditPreset>[] = [
		{
			accessorKey: 'name',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
		},
		{
			accessorKey: 'description',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
		},
		{
			accessorKey: 'action',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Action" />,
		},

		{
			accessorKey: 'dataClassification',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Classification" />,
		},
		{
			accessorKey: 'requiredFields',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Required Fields" />,
			cell: ({ row }) => {
				const value = row.getValue('requiredFields') as string[]
				return (
					<div className="flex flex-wrap gap-2">
						{value.map((field) => (
							<Badge key={field}>{field}</Badge>
						))}
					</div>
				)
			},
		},
	]

	columns.push({
		id: 'actions',
		cell: ({ row, table }) => {
			const record = row.original
			const { onEdit, onDelete } = table.options.meta as ColumnActions

			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="h-8 w-8 p-0">
							<span className="sr-only">Open menu</span>
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuLabel>Actions</DropdownMenuLabel>

						{onEdit && <DropdownMenuItem onClick={() => onEdit(record)}>Edit</DropdownMenuItem>}

						{onDelete && (
							<DropdownMenuItem onClick={() => onDelete(record.name)}>Delete</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			)
		},
	})

	return columns
}
