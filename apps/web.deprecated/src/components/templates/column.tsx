'use client'

import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'

import type { ReportTemplate } from '@/types/report-templates'
import type { ColumnDef } from '@tanstack/react-table'

interface ColumnActions {
	onEdit?: (data: ReportTemplate) => void
	onDelete?: (id: string) => void
}

export const createColumns = (): ColumnDef<ReportTemplate>[] => {
	const columns: ColumnDef<ReportTemplate>[] = [
		{
			accessorKey: 'name',
			header: 'Name',
		},
		{
			accessorKey: 'description',
			header: 'Description',
		},
		{
			accessorKey: 'reportType',
			header: 'Type',
		},
		{
			accessorKey: 'isActive',
			header: 'Active',
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
							<DropdownMenuItem onClick={() => onDelete(record.id)}>Delete</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			)
		},
	})

	return columns
}
