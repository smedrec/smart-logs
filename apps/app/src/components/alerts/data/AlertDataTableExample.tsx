'use client'

import * as React from 'react'

import { createAlertColumns } from './AlertColumns'
import { AlertDataTable } from './AlertDataTable'
import { AlertPagination } from './AlertPagination'
import { AlertTableToolbar } from './AlertTableToolbar'

import type { Alert } from '@/lib/types/alert'

export interface AlertDataTableExampleProps {
	/** Alert data to display */
	data: Alert[]
	/** Loading state */
	loading?: boolean
	/** Error state */
	error?: string
	/** Callback when alert is viewed */
	onViewAlert?: (alert: Alert) => void
	/** Callback when alert is acknowledged */
	onAcknowledgeAlert?: (alert: Alert) => void
	/** Callback when alert is resolved */
	onResolveAlert?: (alert: Alert) => void
	/** Callback when alert is dismissed */
	onDismissAlert?: (alert: Alert) => void
	/** Callback when data should be refreshed */
	onRefresh?: () => void
	/** Callback when data should be exported */
	onExport?: (format: 'csv' | 'json' | 'xlsx') => void
	/** Real-time updates enabled */
	realTimeEnabled?: boolean
	/** Callback when real-time updates toggle changes */
	onRealTimeToggle?: (enabled: boolean) => void
}

/**
 * Complete example of AlertDataTable with toolbar and pagination
 * Demonstrates how to use all the advanced data table components together
 */
export function AlertDataTableExample({
	data,
	loading = false,
	error,
	onViewAlert,
	onAcknowledgeAlert,
	onResolveAlert,
	onDismissAlert,
	onRefresh,
	onExport,
	realTimeEnabled = false,
	onRealTimeToggle,
}: AlertDataTableExampleProps) {
	const tableRef = React.useRef<any>(null)
	const [selectedRows, setSelectedRows] = React.useState<Alert[]>([])

	// Create columns with action handlers
	const columns = React.useMemo(
		() =>
			createAlertColumns({
				enableSelection: true,
				enableActions: true,
				onViewAlert,
				onAcknowledgeAlert,
				onResolveAlert,
				onDismissAlert,
			}),
		[onViewAlert, onAcknowledgeAlert, onResolveAlert, onDismissAlert]
	)

	// Handle row selection changes
	const handleRowSelectionChange = (rows: Alert[]) => {
		setSelectedRows(rows)
	}

	// Handle bulk actions
	const handleBulkAcknowledge = () => {
		if (selectedRows.length > 0 && onAcknowledgeAlert) {
			selectedRows.forEach(onAcknowledgeAlert)
			tableRef.current?.clearRowSelection()
		}
	}

	const handleBulkResolve = () => {
		if (selectedRows.length > 0 && onResolveAlert) {
			selectedRows.forEach(onResolveAlert)
			tableRef.current?.clearRowSelection()
		}
	}

	const handleBulkDismiss = () => {
		if (selectedRows.length > 0 && onDismissAlert) {
			selectedRows.forEach(onDismissAlert)
			tableRef.current?.clearRowSelection()
		}
	}

	return (
		<div className="space-y-4">
			{/* Toolbar */}
			<AlertTableToolbar
				table={tableRef.current?.getTable()}
				enableSearch={true}
				enableFiltering={true}
				enableViewOptions={true}
				enableExport={true}
				enableRefresh={true}
				enableRealTimeToggle={true}
				onRefresh={onRefresh}
				onExport={onExport}
				realTimeEnabled={realTimeEnabled}
				onRealTimeToggle={onRealTimeToggle}
				loading={loading}
			/>

			{/* Bulk Actions */}
			{selectedRows.length > 0 && (
				<div className="flex items-center space-x-2 p-2 bg-muted rounded-md">
					<span className="text-sm font-medium">
						{selectedRows.length} alert{selectedRows.length !== 1 ? 's' : ''} selected
					</span>
					<div className="flex items-center space-x-2 ml-auto">
						{onAcknowledgeAlert && (
							<button
								onClick={handleBulkAcknowledge}
								className="text-sm text-blue-600 hover:text-blue-800"
							>
								Acknowledge All
							</button>
						)}
						{onResolveAlert && (
							<button
								onClick={handleBulkResolve}
								className="text-sm text-green-600 hover:text-green-800"
							>
								Resolve All
							</button>
						)}
						{onDismissAlert && (
							<button
								onClick={handleBulkDismiss}
								className="text-sm text-red-600 hover:text-red-800"
							>
								Dismiss All
							</button>
						)}
					</div>
				</div>
			)}

			{/* Data Table */}
			<AlertDataTable
				ref={tableRef}
				data={data}
				columns={columns}
				loading={loading}
				error={error}
				onRowSelectionChange={handleRowSelectionChange}
				enableRowSelection={true}
				enableColumnResizing={true}
				enableColumnFiltering={true}
				enableSorting={true}
			/>

			{/* Pagination */}
			{tableRef.current?.getTable() && (
				<AlertPagination
					table={tableRef.current.getTable()}
					enableUrlState={true}
					showPageSizeSelector={true}
					showPageInfo={true}
					showRowSelection={true}
					showNavigation={true}
					showFirstLastButtons={true}
				/>
			)}
		</div>
	)
}

export default AlertDataTableExample
