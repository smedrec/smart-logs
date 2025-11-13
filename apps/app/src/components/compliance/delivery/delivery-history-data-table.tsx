import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import { AlertCircle, CheckCircle2, Clock, Eye, RefreshCw, XCircle } from 'lucide-react'
import * as React from 'react'

import type { DeliveryStatusResponse, DestinationDeliveryStatus } from '@smedrec/audit-client'
import type { ColumnDef, SortingState } from '@tanstack/react-table'

interface DeliveryHistoryDataTableProps {
	data: DeliveryStatusResponse[]
	loading?: boolean
	error?: string
	onRetryDelivery?: (deliveryId: string) => Promise<void>
	onViewDelivery?: (deliveryId: string) => void
	onViewDestination?: (destinationId: string) => void
	className?: string
}

const getStatusIcon = (status: DestinationDeliveryStatus) => {
	switch (status) {
		case 'delivered':
			return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
		case 'failed':
			return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
		case 'retrying':
			return <RefreshCw className="h-4 w-4 text-yellow-600 dark:text-yellow-400 animate-spin" />
		case 'pending':
			return <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
		default:
			return <AlertCircle className="h-4 w-4 text-muted-foreground" />
	}
}

const getStatusVariant = (
	status: DestinationDeliveryStatus
): 'default' | 'secondary' | 'destructive' | 'outline' => {
	switch (status) {
		case 'delivered':
			return 'default'
		case 'failed':
			return 'destructive'
		case 'retrying':
			return 'secondary'
		case 'pending':
			return 'outline'
		default:
			return 'secondary'
	}
}

export function DeliveryHistoryDataTable({
	data,
	loading = false,
	error,
	onRetryDelivery,
	onViewDelivery,
	onViewDestination,
	className,
}: DeliveryHistoryDataTableProps) {
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'createdAt', desc: true }])

	const columns: ColumnDef<DeliveryStatusResponse>[] = React.useMemo(
		() => [
			{
				accessorKey: 'deliveryId',
				header: ({ column }) => <DataTableColumnHeader column={column} title="Delivery ID" />,
				cell: ({ row }) => {
					const deliveryId = row.getValue('deliveryId') as string
					return (
						<div className="font-mono text-sm">
							{deliveryId.substring(0, 8)}...
							{deliveryId.substring(deliveryId.length - 4)}
						</div>
					)
				},
			},
			{
				accessorKey: 'destinations',
				header: 'Destinations',
				cell: ({ row }) => {
					const destinations = row.original.destinations
					return (
						<div className="flex flex-wrap gap-1">
							{destinations.map((dest, index) => (
								<TooltipProvider key={index}>
									<Tooltip>
										<TooltipTrigger asChild>
											<Badge
												variant={getStatusVariant(dest.status)}
												className="cursor-pointer"
												onClick={() => onViewDestination?.(dest.destinationId)}
											>
												{getStatusIcon(dest.status)}
												<span className="ml-1 capitalize">{dest.status}</span>
											</Badge>
										</TooltipTrigger>
										<TooltipContent>
											<div className="space-y-1 text-xs">
												<div>Destination ID: {dest.destinationId.substring(0, 12)}...</div>
												<div>Attempts: {dest.attempts}</div>
												{dest.deliveredAt && (
													<div>Delivered: {format(new Date(dest.deliveredAt), 'PPp')}</div>
												)}
												{dest.failureReason && <div>Reason: {dest.failureReason}</div>}
											</div>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							))}
						</div>
					)
				},
				enableSorting: false,
			},
			{
				accessorKey: 'status',
				header: ({ column }) => <DataTableColumnHeader column={column} title="Overall Status" />,
				cell: ({ row }) => {
					const status = row.getValue('status') as string
					const hasFailures = row.original.destinations.some((d) => d.status === 'failed')
					const allDelivered = row.original.destinations.every((d) => d.status === 'delivered')

					let displayStatus = status
					let variant: 'default' | 'secondary' | 'destructive' = 'secondary'

					if (allDelivered) {
						displayStatus = 'completed'
						variant = 'default'
					} else if (hasFailures) {
						displayStatus = 'failed'
						variant = 'destructive'
					}

					return (
						<Badge variant={variant} className="capitalize">
							{displayStatus}
						</Badge>
					)
				},
			},
			{
				accessorKey: 'createdAt',
				header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
				cell: ({ row }) => {
					const createdAt = row.getValue('createdAt') as string
					return (
						<div className="text-sm">
							<div>{format(new Date(createdAt), 'MMM dd, yyyy')}</div>
							<div className="text-muted-foreground text-xs">
								{format(new Date(createdAt), 'HH:mm:ss')}
							</div>
						</div>
					)
				},
			},
			{
				accessorKey: 'updatedAt',
				header: ({ column }) => <DataTableColumnHeader column={column} title="Last Updated" />,
				cell: ({ row }) => {
					const updatedAt = row.getValue('updatedAt') as string
					return (
						<div className="text-sm">
							<div>{format(new Date(updatedAt), 'MMM dd, yyyy')}</div>
							<div className="text-muted-foreground text-xs">
								{format(new Date(updatedAt), 'HH:mm:ss')}
							</div>
						</div>
					)
				},
			},
			{
				id: 'actions',
				header: 'Actions',
				cell: ({ row }) => {
					const delivery = row.original
					const hasFailures = delivery.destinations.some((d) => d.status === 'failed')

					return (
						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onViewDelivery?.(delivery.deliveryId)}
								className="h-8 w-8 p-0"
							>
								<Eye className="h-4 w-4" />
							</Button>
							{hasFailures && onRetryDelivery && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => onRetryDelivery(delivery.deliveryId)}
									className="h-8 w-8 p-0"
								>
									<RefreshCw className="h-4 w-4" />
								</Button>
							)}
						</div>
					)
				},
				enableSorting: false,
			},
		],
		[onRetryDelivery, onViewDelivery, onViewDestination]
	)

	const table = useReactTable({
		data,
		columns,
		state: {
			sorting,
		},
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
	})

	if (error) {
		return (
			<div className="flex h-24 items-center justify-center rounded-md border border-dashed">
				<div className="text-center">
					<XCircle className="mx-auto size-8 text-muted-foreground" />
					<p className="text-muted-foreground mt-2 text-sm">
						Error loading delivery history: {error}
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className={cn('space-y-4', className)}>
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
						{loading ? (
							<TableRow>
								<TableCell colSpan={columns.length} className="h-24 text-center">
									<div className="flex items-center justify-center">
										<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
										<span className="ml-2">Loading delivery history...</span>
									</div>
								</TableCell>
							</TableRow>
						) : table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow key={row.id}>
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
									<div className="flex flex-col items-center justify-center">
										<Clock className="size-8 text-muted-foreground mb-2" />
										<p className="text-muted-foreground">No delivery history found.</p>
										<p className="text-muted-foreground text-sm">
											Deliveries will appear here once reports are sent.
										</p>
									</div>
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<DataTablePagination table={table} />
		</div>
	)
}
