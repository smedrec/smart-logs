import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { DataTablePagination } from '@/components/ui/data-table-pagination'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import {
	Cloud,
	Copy,
	Database,
	Download,
	Mail,
	MoreHorizontal,
	Power,
	PowerOff,
	Server,
	Settings,
	TestTube,
	Trash2,
	Webhook,
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

import type { DeliveryDestination, DeliveryDestinationType } from '@smedrec/audit-client'
import type { ColumnDef, SortingState, VisibilityState } from '@tanstack/react-table'

// Destination type options for display
const destinationTypeOptions = [
	{
		label: 'Email',
		value: 'email' as DeliveryDestinationType,
		icon: Mail,
	},
	{
		label: 'Webhook',
		value: 'webhook' as DeliveryDestinationType,
		icon: Webhook,
	},
	{
		label: 'Storage',
		value: 'storage' as DeliveryDestinationType,
		icon: Database,
	},
	{
		label: 'SFTP',
		value: 'sftp' as DeliveryDestinationType,
		icon: Server,
	},
	{
		label: 'Download',
		value: 'download' as DeliveryDestinationType,
		icon: Download,
	},
]

interface DeliveryDestinationsDataTableProps {
	data: DeliveryDestination[]
	loading?: boolean
	error?: string
	onSelectionChange?: (selection: string[]) => void
	onDestinationEdit?: (destinationId: string) => void
	onDestinationTest?: (destinationId: string) => void
	onDestinationDelete?: (destinationId: string) => void
	onDestinationDuplicate?: (destinationId: string) => void
	onDestinationEnable?: (destinationId: string) => void
	onDestinationDisable?: (destinationId: string) => void
	onDestinationView?: (destinationId: string) => void
	// Bulk operations
	onBulkEnable?: (destinationIds: string[]) => Promise<void>
	onBulkDisable?: (destinationIds: string[]) => Promise<void>
	onBulkDelete?: (destinationIds: string[]) => Promise<void>
	className?: string
}

export function DeliveryDestinationsDataTable({
	data,
	loading = false,
	error,
	onSelectionChange,
	onDestinationEdit,
	onDestinationTest,
	onDestinationDelete,
	onDestinationDuplicate,
	onDestinationEnable,
	onDestinationDisable,
	onDestinationView,
	onBulkEnable,
	onBulkDisable,
	onBulkDelete,
	className,
}: DeliveryDestinationsDataTableProps) {
	const [rowSelection, setRowSelection] = React.useState({})
	const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
	const [sorting, setSorting] = React.useState<SortingState>([])

	// ARIA live announcements for screen readers
	const { announce, LiveRegion } = useAriaLiveAnnouncer()

	// Announce data changes to screen readers
	React.useEffect(() => {
		if (!loading && data.length > 0) {
			announce(`${data.length} delivery destinations loaded`)
		}
	}, [data.length, loading, announce])

	// Announce selection changes
	React.useEffect(() => {
		const selectedCount = Object.keys(rowSelection).length
		if (selectedCount > 0) {
			announce(`${selectedCount} destinations selected`)
		}
	}, [rowSelection, announce])

	// Define table columns
	const columns: ColumnDef<DeliveryDestination>[] = React.useMemo(
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
							announce(`All destinations ${action}`)
						}}
						aria-label={`Select all ${data.length} destinations`}
						className="translate-y-[2px]"
					/>
				),
				cell: ({ row }) => {
					const destination = row.original
					return (
						<Checkbox
							checked={row.getIsSelected()}
							onCheckedChange={(value) => {
								row.toggleSelected(!!value)
								const action = value ? 'selected' : 'deselected'
								announce(`Destination ${destination.label} ${action}`)
							}}
							aria-label={`Select destination ${destination.label}`}
							className="translate-y-[2px]"
						/>
					)
				},
				enableSorting: false,
				enableHiding: false,
			},
			{
				accessorKey: 'label',
				header: ({ column }) => <DataTableColumnHeader column={column} title="Label" />,
				cell: ({ row }) => {
					const destination = row.original
					return (
						<div className="flex flex-col gap-1">
							<div className="font-medium" id={`destination-label-${destination.id}`}>
								{destination.label}
							</div>
							{destination.description && (
								<div
									className="text-muted-foreground text-sm"
									id={`destination-description-${destination.id}`}
									aria-describedby={`destination-label-${destination.id}`}
								>
									{destination.description}
								</div>
							)}
						</div>
					)
				},
				enableSorting: true,
				enableHiding: false,
			},
			{
				accessorKey: 'type',
				header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
				cell: ({ row }) => {
					const type = row.getValue('type') as DeliveryDestinationType
					const typeOption = destinationTypeOptions.find((option) => option.value === type)

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
				accessorKey: 'disabled',
				header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
				cell: ({ row }) => {
					const disabled = row.getValue('disabled') as boolean
					const destination = row.original
					return (
						<Badge
							variant={disabled ? 'secondary' : 'default'}
							aria-label={generateAriaLabel.reportStatus(
								disabled ? 'disabled' : 'enabled',
								destination.label
							)}
						>
							{disabled ? 'Disabled' : 'Enabled'}
						</Badge>
					)
				},
				filterFn: (row, id, value) => {
					const disabled = row.getValue(id) as boolean
					const status = disabled ? 'disabled' : 'enabled'
					return value.includes(status)
				},
				enableSorting: true,
			},
			{
				accessorKey: 'countUsage',
				header: ({ column }) => <DataTableColumnHeader column={column} title="Usage Count" />,
				cell: ({ row }) => {
					const count = row.getValue('countUsage') as number
					return (
						<div className="flex items-center gap-2">
							<Cloud className="size-4" />
							<span className="text-sm">{count.toLocaleString()}</span>
						</div>
					)
				},
				enableSorting: true,
			},
			{
				accessorKey: 'lastUsedAt',
				header: ({ column }) => <DataTableColumnHeader column={column} title="Last Used" />,
				cell: ({ row }) => {
					const lastUsedAt = row.original.lastUsedAt
					const destination = row.original

					if (!lastUsedAt) {
						return (
							<span
								className="text-muted-foreground"
								aria-label={`${destination.label} has never been used`}
							>
								Never used
							</span>
						)
					}

					const formattedDate = formatDateForScreenReader(lastUsedAt, { includeTime: true })

					return (
						<span
							className="text-sm"
							aria-label={`Last used for ${destination.label}: ${formattedDate}`}
						>
							{format(new Date(lastUsedAt), 'MMM dd, yyyy HH:mm')}
						</span>
					)
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
					const destination = row.original
					return (
						<div
							className="flex items-center gap-2"
							role="group"
							aria-label={`Actions for ${destination.label}`}
						>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onDestinationTest?.(destination.id)}
								className="h-8 w-8 p-0"
								aria-label={generateAriaLabel.tableAction('Test', destination.label, 'destination')}
							>
								<VisuallyHidden>Test destination {destination.label}</VisuallyHidden>
								<TestTube className="size-4" aria-hidden="true" />
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onDestinationEdit?.(destination.id)}
								className="h-8 w-8 p-0"
								aria-label={generateAriaLabel.tableAction('Edit', destination.label, 'destination')}
							>
								<VisuallyHidden>Edit destination {destination.label}</VisuallyHidden>
								<Settings className="size-4" aria-hidden="true" />
							</Button>

							{/* More Actions Dropdown */}
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										className="h-8 w-8 p-0"
										aria-label={`More actions for ${destination.label}`}
									>
										<VisuallyHidden>More actions for {destination.label}</VisuallyHidden>
										<MoreHorizontal className="size-4" aria-hidden="true" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									{destination.disabled ? (
										<DropdownMenuItem
											onClick={() => {
												onDestinationEnable?.(destination.id)
												announce(`Enabling destination ${destination.label}`)
											}}
										>
											<Power className="mr-2 h-4 w-4" />
											Enable
										</DropdownMenuItem>
									) : (
										<DropdownMenuItem
											onClick={() => {
												onDestinationDisable?.(destination.id)
												announce(`Disabling destination ${destination.label}`)
											}}
										>
											<PowerOff className="mr-2 h-4 w-4" />
											Disable
										</DropdownMenuItem>
									)}
									<DropdownMenuItem
										onClick={() => {
											onDestinationDuplicate?.(destination.id)
											announce(`Duplicating destination ${destination.label}`)
										}}
									>
										<Copy className="mr-2 h-4 w-4" />
										Duplicate
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										onClick={() => {
											onDestinationDelete?.(destination.id)
											announce(`Deleting destination ${destination.label}`)
										}}
										className="text-destructive"
									>
										<Trash2 className="mr-2 h-4 w-4" />
										Delete
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					)
				},
				enableSorting: false,
				enableHiding: false,
			},
		],
		[
			onDestinationEdit,
			onDestinationTest,
			onDestinationDelete,
			onDestinationDuplicate,
			onDestinationEnable,
			onDestinationDisable,
			announce,
			data.length,
		]
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
		getFilteredRowModel: getFilteredRowModel(),
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
					<p className="text-muted-foreground mt-2 text-sm">Error loading destinations: {error}</p>
				</div>
			</div>
		)
	}

	return (
		<div className={cn('space-y-4', className)}>
			{/* Table */}
			<div className="rounded-md border">
				<Table>
					<caption className="sr-only">
						Delivery destinations table. {data.length} destinations total.
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
											{generateAriaLabel.loadingState('delivery destinations')}
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
										<Database className="size-8 text-muted-foreground mb-2" aria-hidden="true" />
										<p className="text-muted-foreground" role="status">
											No delivery destinations found.
										</p>
										<p className="text-muted-foreground text-sm">
											Create your first delivery destination to get started.
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
