'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { ComplianceReportEvent } from '@repo/audit'

export const createColumns = (): ColumnDef<ComplianceReportEvent>[] => {
	const columns: ColumnDef<ComplianceReportEvent>[] = [
		{
			accessorKey: 'timestamp',
			header: 'Timestamp',
		},
		{
			accessorKey: 'action',
			header: 'Action',
		},
		{
			accessorKey: 'targetResourceType',
			header: 'Target Resource',
		},
		{
			accessorKey: 'targetResourceId',
			header: 'Id',
		},
		{
			accessorKey: 'status',
			header: 'Status',
		},
		{
			accessorKey: 'outcomeDescription',
			header: 'Description',
		},
		{
			accessorKey: 'dataClassification',
			header: 'Classification',
		},
		{
			accessorKey: 'integrityStatus',
			header: 'Integrity',
		},
	]

	return columns
}
