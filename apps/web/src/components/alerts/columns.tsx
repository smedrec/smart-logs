'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { Alert, AlertType } from '@repo/audit'

export const createColumns = (): ColumnDef<Alert>[] => {
	const columns: ColumnDef<Alert>[] = [
		{
			accessorKey: 'severity',
			header: 'Severity',
		},
		{
			accessorKey: 'type',
			header: 'Type',
		},
		{
			accessorKey: 'title',
			header: 'Title',
		},
		{
			accessorKey: 'description',
			header: 'Description',
		},
		{
			accessorKey: 'source',
			header: 'Source',
		},
	]

	return columns
}
