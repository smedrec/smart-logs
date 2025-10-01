import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { DataTablePagination } from '@/components/ui/data-table-pagination'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
	flexRender,
	getCoreRowModel,
	getFacetedRowModel,
	getFacetedUniqueValues,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import {
	Calendar,
	CheckCircle,
	Clock,
	FileText,
	MoreHorizontal,
	Play,
	Search,
	Settings,
	Shield,
	XCircle,
} from 'lucide-react'
import * as React from 'react'

import { useAriaLiveAnnouncer } from '../utils/aria-live-region'
import {
	ARIA_DESCRIPTIONS,
	createTableAttributes,
	formatDateForScreenReader,
	generateAriaLabel,
} from '../utils/screen-reader-utils'
import { VisuallyHidden } from '../utils/visually-hidden'
import { BulkActions } from './bulk-actions'
import { ReportsFilters } from './reports-filters'

import type {
	ColumnDef,
	ColumnFiltersState,
	SortingState,
	VisibilityState,
} from '@tanstack/react-table'
import type { ReportFilters, ReportType, ScheduledReportUI } from '../types'

// Report type options for display
const reportTypeOptions = [
	{
		label: 'HIPAA Audit Trail',
		value: 'HIPAA_AUDIT_TRAIL' as ReportType,
		icon: Shield,
	},
	{
		label: 'GDPR Processing Activities',
		value: 'GDPR_PROCESSING_ACTIVITIES' as ReportType,
		icon: FileText,
	},
	{
		label: 'Integrity Verification',
		value: 'INTEGRITY_VERIFICATION' as ReportType,
		icon: CheckCircle,
	},
]

interface ReportsDataTableProps {
	data: ScheduledReportUI[]
	loading?: boolean
	error?: string
	filters?: ReportFilters
	onSelectionChange?: (selection: string[]) => void
	onFiltersChange?: (filters: ReportFilters) => void
	onReportEdit?: (reportId: string) => void
	onReportExecute?: (reportId: string) => void
	onReportView?: (reportId: string) => void
	// Bulk operations
	onBulkEnable?: (reportIds: string[]) => Promise<void>
	onBulkDisable?: (reportIds: string[]) => Promise<void>
	onBulkDelete?: (reportIds: string[]) => Promise<void>
	onBulkExecute?: (reportIds: string[]) => Promise<void>
	className?: string
}

export function ReportsDataTable({
	data,
	loading = false,
	error,
	filters = {},
	onSelectionChange,
	onFiltersChange,
	onReportEdit,
	onReportExecute,
	onReportView,
	onBulkEnable,
	onBulkDisable,
	onBulkDelete,
	onBulkExecute,
	className,
}: ReportsDataTableProps) {
	const [rowSelection, setRowSelection] = React.useState({})
	const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
	const [sorting, setSorting] = React.useState<SortingState>([])

	// ARIA live announcements for screen readers
	const { announce, LiveRegion } = useAriaLiveAnnouncer()

	// Announce data changes to screen readers
	React.useEffect(() => {
		if (!loading && data.length > 0) {
			announce(`${data.length} compliance reports loaded`)
		}
	}, [data.length, loading, announce])

	// Announce selection changes
	React.useEffect(() => {
		const selectedCount = Object.keys(rowSelection).length
		if (selectedCount > 0) {
			announce(`${selectedCount} reports selected`)
		}
	}, [rowSelection, announce])

	// Define table columns
	const columns: ColumnDef<ScheduledReportUI>[] = React.useMemo(
		() => [
			{
				id: 'select',
				header: ({ table }) => (
					<Checkbox
						checked={
							table.getIsAllPageRowsSelected() ||
							(table.getIsSomePageRowsSelected() && 'indeterminate')
						}
						onCheckedChange={(value) => {
							table.toggleAllPageRowsSelected(!!value)
							const action = value ? 'selected' : 'deselected'
							announce(`All reports ${action}`)
						}}
						aria-label={`Select all ${data.length} reports`}
						className="translate-y-[2px]"
					/>
				),
				cell: ({ row }) => {
					const report = row.original
					return (
						<Checkbox
							checked={row.getIsSelected()}
							onCheckedChange={(value) => {
								row.toggleSelected(!!value)
								const action = value ? 'selected' : 'deselected'
								announce(`Report ${report.name} ${action}`)
							}}
							aria-label={`Select report ${report.name}`}
							className="translate-y-[2px]"
						/>
					)
				},
				enableSorting: false,
				enableHiding: false,
			},
			{
				accessorKey: 'name',
				header: ({ column }) => <DataTableColumnHeader column={column} title="Report Name" />,
				cell: ({ row }) => {
					const report = row.original
					return (
						<div className="flex flex-col gap-1">
							<div className="font-medium" id={`report-name-${report.id}`}>
								{report.name}
							</div>
							{report.description && (
								<div
									className="text-muted-foreground text-sm"
									id={`report-description-${report.id}`}
									aria-describedby={`report-name-${report.id}`}
								>
									{report.description}
								</div>
							)}
						</div>
					)
				},
				enableSorting: true,
				enableHiding: false,
			},
			{
				accessorKey: 'reportType',
				header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
				cell: ({ row }) => {
					const reportType = row.getValue('reportType') as ReportType
					const typeOption = reportTypeOptions.find((option) => option.value === reportType)

					if (!typeOption) return <span className="text-muted-foreground">Unknown</span>

					return (
						<div className="flex items-center gap-2">
							<typeOption.icon className="size-4" />
							<Badge variant="outline">{typeOption.label}</Badge>
						</div>
					)
				},
				filterFn: (row, id, value) => {
					return value.includes(row.getValue(id))
				},
				enableSorting: true,
			},
			{
				accessorKey: 'enabled',
				header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
				cell: ({ row }) => {
					const enabled = row.getValue('enabled') as boolean
					const report = row.original
					return (
						<Badge
							variant={enabled ? 'default' : 'secondary'}
							aria-label={generateAriaLabel.reportStatus(
								enabled ? 'enabled' : 'disabled',
								report.name
							)}
						>
							{enabled ? 'Enabled' : 'Disabled'}
						</Badge>
					)
				},
				filterFn: (row, id, value) => {
					const enabled = row.getValue(id) as boolean
					const status = enabled ? 'enabled' : 'disabled'
					return value.includes(status)
				},
				enableSorting: true,
			},
			{
				accessorKey: 'schedule',
				header: ({ column }) => <DataTableColumnHeader column={column} title="Schedule" />,
				cell: ({ row }) => {
					const schedule = row.original.schedule
					return (
						<div className="flex items-center gap-2">
							<Clock className="size-4" />
							<span className="text-sm">{schedule?.cronExpression || 'Manual'}</span>
						</div>
					)
				},
				enableSorting: false,
			},
			{
				accessorKey: 'nextExecution',
				header: ({ column }) => <DataTableColumnHeader column={column} title="Next Run" />,
				cell: ({ row }) => {
					const nextExecution = row.original.nextExecution
					const report = row.original

					if (!nextExecution) {
						return (
							<span
								className="text-muted-foreground"
								aria-label={`${report.name} is manual execution only`}
							>
								Manual only
							</span>
						)
					}

					const formattedDate = formatDateForScreenReader(nextExecution, { includeTime: true })

					return (
						<div className="flex items-center gap-2">
							<Calendar className="size-4" aria-hidden="true" />
							<span
								className="text-sm"
								aria-label={`Next execution for ${report.name}: ${formattedDate}`}
							>
								{format(new Date(nextExecution), 'MMM dd, yyyy HH:mm')}
							</span>
						</div>
					)
				},
				enableSorting: true,
			},
			{
				accessorKey: 'lastExecutionStatus',
				header: ({ column }) => <DataTableColumnHeader column={column} title="Last Status" />,
				cell: ({ row }) => {
					const status = row.original.lastExecutionStatus
					if (!status) {
						return <span className="text-muted-foreground">Never run</span>
					}

					const statusConfig = {
						completed: { label: 'Completed', variant: 'default' as const, icon: CheckCircle },
						failed: { label: 'Failed', variant: 'destructive' as const, icon: XCircle },
						running: { label: 'Running', variant: 'secondary' as const, icon: Play },
						pending: { label: 'Pending', variant: 'outline' as const, icon: Clock },
						cancelled: { label: 'Cancelled', variant: 'secondary' as const, icon: XCircle },
						timeout: { label: 'Timeout', variant: 'destructive' as const, icon: XCircle },
					}

					const config = statusConfig[status] || statusConfig.pending
					const Icon = config.icon

					return (
						<div className="flex items-center gap-2">
							<Icon className="size-4" />
							<Badge variant={config.variant}>{config.label}</Badge>
						</div>
					)
				},
				filterFn: (row, id, value) => {
					return value.includes(row.getValue(id))
				},
				enableSorting: true,
			},
			{
				accessorKey: 'createdAt',
				header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
				cell: ({ row }) => {
					const createdAt = row.getValue('createdAt') as string
					return <span className="text-sm">{format(new Date(createdAt), 'MMM dd, yyyy')}</span>
				},
				enableSorting: true,
			},
			{
				id: 'actions',
				header: 'Actions',
				cell: ({ row }) => {
					const report = row.original
					return (
						<div
							className="flex items-center gap-2"
							role="group"
							aria-label={`Actions for ${report.name}`}
						>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onReportView?.(report.id)}
								className="h-8 w-8 p-0"
								aria-label={generateAriaLabel.tableAction('View', report.name, 'report')}
							>
								<VisuallyHidden>View report {report.name}</VisuallyHidden>
								<FileText className="size-4" aria-hidden="true" />
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onReportEdit?.(report.id)}
								className="h-8 w-8 p-0"
								aria-label={generateAriaLabel.tableAction('Edit', report.name, 'report')}
							>
								<VisuallyHidden>Edit report {report.name}</VisuallyHidden>
								<Settings className="size-4" aria-hidden="true" />
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									onReportExecute?.(report.id)
									announce(`Executing report ${report.name}`)
								}}
								disabled={!report.enabled}
								className="h-8 w-8 p-0"
								aria-label={generateAriaLabel.tableAction('Execute', report.name, 'report')}
								aria-describedby={!report.enabled ? `${report.id}-disabled-reason` : undefined}
							>
								<VisuallyHidden>Execute report {report.name}</VisuallyHidden>
								<Play className="size-4" aria-hidden="true" />
							</Button>
							{!report.enabled && (
								<VisuallyHidden id={`${report.id}-disabled-reason`}>
									Report is disabled and cannot be executed
								</VisuallyHidden>
							)}
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 p-0"
								aria-label={`More actions for ${report.name}`}
							>
								<VisuallyHidden>More actions for {report.name}</VisuallyHidden>
								<MoreHorizontal className="size-4" aria-hidden="true" />
							</Button>
						</div>
					)
				},
				enableSorting: false,
				enableHiding: false,
			},
		],
		[onReportEdit, onReportExecute, onReportView]
	)

	const table = useReactTable({
		data,
		columns,
		state: {
			sorting,
			columnVisibility,
			rowSelection,
		},
		enableRowSelection: true,
		onRowSelectionChange: setRowSelection,
		onSortingChange: setSorting,
		onColumnVisibilityChange: setColumnVisibility,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
	})

	// Handle selection changes
	React.useEffect(() => {
		const selectedRows = table.getFilteredSelectedRowModel().rows
		const selectedIds = selectedRows.map((row) => row.original.id)
		onSelectionChange?.(selectedIds)
	}, [rowSelection, onSelectionChange, table])

	if (error) {
		return (
			<div className="flex h-24 items-center justify-center rounded-md border border-dashed">
				<div className="text-center">
					<XCircle className="mx-auto size-8 text-muted-foreground" />
					<p className="text-muted-foreground mt-2 text-sm">Error loading reports: {error}</p>
				</div>
			</div>
		)
	}

	// Get selected reports for bulk actions
	const selectedReports = React.useMemo(() => {
		const selectedRows = table.getFilteredSelectedRowModel().rows
		return selectedRows.map((row) => row.original)
	}, [table])

	return (
		<div className={cn('space-y-4', className)}>
			{/* Filters */}
			<ReportsFilters filters={filters} onFiltersChange={onFiltersChange || (() => {})} />

			{/* Bulk Actions */}
			{selectedReports.length > 0 && (
				<BulkActions
					selectedReports={selectedReports}
					onBulkEnable={onBulkEnable}
					onBulkDisable={onBulkDisable}
					onBulkDelete={onBulkDelete}
					onBulkExecute={onBulkExecute}
					onClearSelection={() => table.resetRowSelection()}
				/>
			)}

			{/* Table */}
			<div className="rounded-md border">
				<Table
					{...createTableAttributes(
						ARIA_DESCRIPTIONS.REPORT_TABLE,
						sorting[0]?.id,
						sorting[0]?.desc ? 'desc' : 'asc'
					)}
				>
					<caption className="sr-only">
						{ARIA_DESCRIPTIONS.REPORT_TABLE}.{data.length} reports total.
						{Object.keys(rowSelection).length} selected.
					</caption>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id} className="whitespace-nowrap">
										{header.isPlaceholder
											? null
											: flexRender(header.column.columnDef.header, header.getContext())}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{loading ? (
							<TableRow>
								<TableCell colSpan={columns.length} className="h-24 text-center">
									<div className="flex items-center justify-center">
										<div
											className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"
											aria-hidden="true"
										></div>
										<span className="ml-2" aria-live="polite">
											{generateAriaLabel.loadingState('compliance reports')}
										</span>
									</div>
								</TableCell>
							</TableRow>
						) : table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && 'selected'}
									className="hover:bg-muted/50"
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id} className="whitespace-nowrap">
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell colSpan={columns.length} className="h-24 text-center">
									<div className="flex flex-col items-center justify-center">
										<FileText className="size-8 text-muted-foreground mb-2" aria-hidden="true" />
										<p className="text-muted-foreground" role="status">
											No compliance reports found.
										</p>
										<p className="text-muted-foreground text-sm">
											Create your first compliance report to get started.
										</p>
									</div>
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{/* Pagination */}
			<DataTablePagination table={table} />

			{/* ARIA Live Region for announcements */}
			<LiveRegion />
		</div>
	)
}
