'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
	AlertTriangle,
	CheckCircle,
	Clock,
	Eye,
	MoreHorizontal,
	Shield,
	XCircle,
} from 'lucide-react'
import * as React from 'react'

import { AlertActions } from '../forms/AlertActions'

import type { AlertSeverity, AlertStatus, AlertType } from '@/components/alerts/types'
import type { Alert } from '@/lib/collections'
import type { ColumnDef } from '@tanstack/react-table'

export interface AlertColumnsConfig {
	/** Enable row selection column */
	enableSelection?: boolean
	/** Enable actions column */
	enableActions?: boolean
	/** Callback when alert is viewed */
	onViewAlert?: (alert: Alert) => void
	/** Callback when alert is acknowledged */
	onAcknowledgeAlert?: (alert: Alert) => void
	/** Callback when alert is resolved */
	onResolveAlert?: (alert: Alert) => void
	/** Callback when alert is dismissed */
	onDismissAlert?: (alert: Alert) => void
	/** Custom column widths */
	columnWidths?: {
		select?: number
		severity?: number
		type?: number
		title?: number
		description?: number
		source?: number
		timestamp?: number
		status?: number
		actions?: number
	}
}

/**
 * Get severity icon based on alert severity
 */
const getSeverityIcon = (severity: AlertSeverity) => {
	switch (severity) {
		case 'CRITICAL':
			return <AlertTriangle className="h-4 w-4 text-destructive" />
		case 'HIGH':
			return <AlertTriangle className="h-4 w-4 text-orange-500" />
		case 'MEDIUM':
			return <Clock className="h-4 w-4 text-yellow-500" />
		case 'LOW':
			return <Clock className="h-4 w-4 text-blue-500" />
		case 'INFO':
			return <Clock className="h-4 w-4 text-gray-500" />
		default:
			return <Clock className="h-4 w-4" />
	}
}

/**
 * Get status icon based on alert status
 */
const getStatusIcon = (status: AlertStatus) => {
	switch (status) {
		case 'active':
			return <AlertTriangle className="h-4 w-4 text-destructive" />
		case 'acknowledged':
			return <Clock className="h-4 w-4 text-yellow-500" />
		case 'resolved':
			return <CheckCircle className="h-4 w-4 text-green-500" />
		case 'dismissed':
			return <XCircle className="h-4 w-4 text-gray-500" />
		default:
			return <Clock className="h-4 w-4" />
	}
}

/**
 * Get type icon based on alert type
 */
const getTypeIcon = (type: AlertType) => {
	switch (type) {
		case 'SECURITY':
			return <Shield className="h-4 w-4 text-red-500" />
		case 'COMPLIANCE':
			return <CheckCircle className="h-4 w-4 text-blue-500" />
		case 'PERFORMANCE':
			return <Clock className="h-4 w-4 text-orange-500" />
		case 'SYSTEM':
			return <AlertTriangle className="h-4 w-4 text-purple-500" />
		case 'CUSTOM':
			return <Clock className="h-4 w-4 text-gray-500" />
		default:
			return <Clock className="h-4 w-4" />
	}
}

/**
 * Get severity badge variant
 */
const getSeverityBadgeVariant = (severity: AlertSeverity) => {
	switch (severity) {
		case 'CRITICAL':
			return 'destructive' as const
		case 'HIGH':
			return 'secondary' as const
		case 'MEDIUM':
			return 'outline' as const
		case 'LOW':
			return 'outline' as const
		case 'INFO':
			return 'outline' as const
		default:
			return 'outline' as const
	}
}

/**
 * Get status badge variant
 */
const getStatusBadgeVariant = (status: AlertStatus) => {
	switch (status) {
		case 'active':
			return 'destructive' as const
		case 'acknowledged':
			return 'secondary' as const
		case 'resolved':
			return 'default' as const
		case 'dismissed':
			return 'outline' as const
		default:
			return 'outline' as const
	}
}

/**
 * Format timestamp for display
 */
const formatTimestamp = (timestamp: Date) => {
	const date = new Date(timestamp)
	const now = new Date()
	const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

	if (diffInHours < 1) {
		const diffInMinutes = Math.floor(diffInHours * 60)
		return `${diffInMinutes}m ago`
	} else if (diffInHours < 24) {
		return `${Math.floor(diffInHours)}h ago`
	} else if (diffInHours < 168) {
		const diffInDays = Math.floor(diffInHours / 24)
		return `${diffInDays}d ago`
	} else {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
		}).format(date)
	}
}

/**
 * Create alert table column definitions with custom renderers
 * Implements severity and status badge columns and action column with dropdown menus
 */
export function createAlertColumns(config: AlertColumnsConfig = {}): ColumnDef<Alert>[] {
	const {
		enableSelection = true,
		enableActions = true,
		onViewAlert,
		onAcknowledgeAlert,
		onResolveAlert,
		onDismissAlert,
		columnWidths = {},
	} = config

	const columns: ColumnDef<Alert>[] = []

	// Selection column
	if (enableSelection) {
		columns.push({
			id: 'select',
			header: ({ table }) => (
				<Checkbox
					checked={
						table.getIsAllPageRowsSelected() ||
						(table.getIsSomePageRowsSelected() && 'indeterminate')
					}
					onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
					aria-label="Select all alerts"
					className="translate-y-[2px]"
				/>
			),
			cell: ({ row }) => (
				<Checkbox
					checked={row.getIsSelected()}
					onCheckedChange={(value) => row.toggleSelected(!!value)}
					aria-label={`Select alert ${row.original.title}`}
					className="translate-y-[2px]"
				/>
			),
			enableSorting: false,
			enableHiding: false,
			size: columnWidths.select || 40,
		})
	}

	// Severity column
	columns.push({
		accessorKey: 'severity',
		header: ({ column }) => <DataTableColumnHeader column={column} title="Severity" />,
		cell: ({ row }) => {
			const severity = row.getValue('severity') as AlertSeverity
			const icon = getSeverityIcon(severity)
			const variant = getSeverityBadgeVariant(severity)

			return (
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="flex items-center space-x-2">
								{icon}
								<Badge variant={variant} className="capitalize">
									{severity}
								</Badge>
							</div>
						</TooltipTrigger>
						<TooltipContent>
							<p>Severity: {severity}</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			)
		},
		filterFn: (row, id, value) => {
			return value.includes(row.getValue(id))
		},
		size: columnWidths.severity || 120,
	})

	// Type column
	columns.push({
		accessorKey: 'type',
		header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
		cell: ({ row }) => {
			const type = row.getValue('type') as AlertType
			const icon = getTypeIcon(type)

			return (
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="flex items-center space-x-2">
								{icon}
								<span className="capitalize text-sm">{type}</span>
							</div>
						</TooltipTrigger>
						<TooltipContent>
							<p>Type: {type}</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			)
		},
		filterFn: (row, id, value) => {
			return value.includes(row.getValue(id))
		},
		size: columnWidths.type || 120,
	})

	// Title column
	columns.push({
		accessorKey: 'title',
		header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
		cell: ({ row }) => {
			const title = row.getValue('title') as string
			return (
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="font-medium max-w-[200px] truncate">{title}</div>
						</TooltipTrigger>
						<TooltipContent>
							<p className="max-w-[300px] break-words">{title}</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			)
		},
		size: columnWidths.title || 200,
	})

	// Description column
	columns.push({
		accessorKey: 'description',
		header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
		cell: ({ row }) => {
			const description = row.getValue('description') as string
			return (
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="max-w-[300px] truncate text-sm text-muted-foreground">
								{description}
							</div>
						</TooltipTrigger>
						<TooltipContent>
							<p className="max-w-[400px] break-words">{description}</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			)
		},
		size: columnWidths.description || 300,
	})

	// Source column
	columns.push({
		accessorKey: 'source',
		header: ({ column }) => <DataTableColumnHeader column={column} title="Source" />,
		cell: ({ row }) => {
			const source = row.getValue('source') as string
			return (
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="text-sm font-mono max-w-[150px] truncate">{source}</div>
						</TooltipTrigger>
						<TooltipContent>
							<p>Source: {source}</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			)
		},
		size: columnWidths.source || 150,
	})

	// Timestamp column
	columns.push({
		accessorKey: 'created_at',
		header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
		cell: ({ row }) => {
			const timestamp = row.getValue('created_at') as string
			const date = new Date(timestamp)
			const formatted = formatTimestamp(date)
			const fullDate = new Intl.DateTimeFormat('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
			}).format(date)

			return (
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="text-sm text-muted-foreground">{formatted}</div>
						</TooltipTrigger>
						<TooltipContent>
							<p>{fullDate}</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			)
		},
		size: columnWidths.timestamp || 100,
	})

	// Status column
	columns.push({
		accessorKey: 'status',
		header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
		cell: ({ row }) => {
			const status = row.getValue('status') as AlertStatus
			const icon = getStatusIcon(status)
			const variant = getStatusBadgeVariant(status)

			return (
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="flex items-center space-x-2">
								{icon}
								<Badge variant={variant} className="capitalize">
									{status}
								</Badge>
							</div>
						</TooltipTrigger>
						<TooltipContent>
							<p>Status: {status}</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			)
		},
		filterFn: (row, id, value) => {
			return value.includes(row.getValue(id))
		},
		size: columnWidths.status || 120,
	})

	// Actions column
	if (enableActions) {
		columns.push({
			id: 'actions',
			header: 'Actions',
			cell: ({ row }) => {
				const alert = row.original
				const canAcknowledge = alert.status === 'active'
				const canResolve = alert.status === 'active' || alert.status === 'acknowledged'
				const canDismiss = alert.status !== 'dismissed'

				return (
					<>
						<AlertActions
							selectedAlerts={[alert]}
							onAcknowledge={function (alertIds: string[]): Promise<void> {
								throw new Error('Function not implemented.')
							}}
							onResolve={function (alertIds: string[], notes: string): Promise<void> {
								throw new Error('Function not implemented.')
							}}
							onDismiss={function (alertIds: string[]): Promise<void> {
								throw new Error('Function not implemented.')
							}}
							mode="dropdown"
						/>
					</>
				)
			},
			enableSorting: false,
			enableHiding: false,
			size: columnWidths.actions || 60,
		})
	}

	return columns
}

/**
 * Default column configuration for alert data table
 */
export const defaultAlertColumns = createAlertColumns()

/**
 * Column configuration without selection for read-only views
 */
export const readOnlyAlertColumns = createAlertColumns({
	enableSelection: false,
	enableActions: false,
})

/**
 * Minimal column configuration for compact views
 */
export const compactAlertColumns = createAlertColumns({
	enableSelection: false,
	columnWidths: {
		severity: 80,
		type: 80,
		title: 150,
		description: 200,
		source: 100,
		timestamp: 80,
		status: 80,
		actions: 50,
	},
})

export default createAlertColumns
