'use client'

import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'

import type { ComplianceReportEvent } from '@smedrec/audit-client'
import type { ColumnDef } from '@tanstack/react-table'

export const createColumns = (): ColumnDef<ComplianceReportEvent>[] => {
	const columns: ColumnDef<ComplianceReportEvent>[] = [
		{
			accessorKey: 'timestamp',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Timestamp" />,
		},
		{
			accessorKey: 'action',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Action" />,
		},
		{
			accessorKey: 'targetResourceType',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Resource" />,
		},
		{
			accessorKey: 'targetResourceId',
			header: ({ column }) => <DataTableColumnHeader column={column} title="ID" />,
		},
		{
			accessorKey: 'status',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
			cell: ({ row }) => {
				const status = row.getValue('status') as string

				return <div className={`text-${status} font-medium`}>{status.toUpperCase()}</div>
			},
		},
		{
			accessorKey: 'outcomeDescription',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
		},
		{
			accessorKey: 'dataClassification',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Classification" />,
		},
		{
			accessorKey: 'integrityStatus',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Integrity" />,
			cell: ({ row }) => {
				const integrity = row.getValue('integrityStatus') as string

				return <div className="font-medium">{integrity.toUpperCase()}</div>
			},
		},
	]

	return columns
}
