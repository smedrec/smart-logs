'use client'

import * as React from 'react'

import { createAlertColumns } from './AlertColumns'
import { AlertDataTable } from './AlertDataTable'
import { AlertPagination } from './AlertPagination'
import { SimpleAlertTable } from './SimpleAlertTable'

import type { AlertSeverity, AlertStatus, AlertType } from '@/components/alerts/types'
import type { Alert } from '@/lib/collections'

// Mock data for testing
const mockAlerts: Alert[] = [
	{
		id: '1',
		organization_id: 'org-1',
		title: 'High CPU Usage Detected',
		description: 'Server CPU usage has exceeded 90% for the past 5 minutes',
		severity: 'HIGH' as AlertSeverity,
		type: 'PERFORMANCE' as AlertType,
		status: 'active' as AlertStatus,
		source: 'monitoring-system',
		acknowledged: 'false',
		resolved: 'false',
		metadata: {
			server: 'web-01',
			cpu_usage: '92%',
		},
		tags: ['performance', 'cpu'],
		created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
		updated_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
	},
	{
		id: '2',
		organization_id: 'org-1',
		title: 'Failed Login Attempts',
		description: 'Multiple failed login attempts detected from IP 192.168.1.100',
		severity: 'CRITICAL' as AlertSeverity,
		type: 'SECURITY' as AlertType,
		status: 'active' as AlertStatus,
		source: 'auth-service',
		acknowledged: 'false',
		resolved: 'false',
		metadata: {
			ip_address: '192.168.1.100',
			attempts: 15,
		},
		tags: ['security', 'auth'],
		created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 minutes ago
		updated_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
	},
	{
		id: '3',
		organization_id: 'org-1',
		title: 'Database Connection Pool Full',
		description: 'Database connection pool has reached maximum capacity',
		severity: 'MEDIUM' as AlertSeverity,
		type: 'SYSTEM' as AlertType,
		status: 'acknowledged' as AlertStatus,
		source: 'database-monitor',
		acknowledged: 'true',
		acknowledged_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
		acknowledged_by: 'admin',
		resolved: 'false',
		metadata: {
			pool_size: 100,
			active_connections: 100,
		},
		tags: ['database', 'connections'],
		created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
		updated_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
	},
	{
		id: '4',
		organization_id: 'org-1',
		title: 'Disk Space Low',
		description: 'Available disk space is below 10%',
		severity: 'HIGH' as AlertSeverity,
		type: 'SYSTEM' as AlertType,
		status: 'resolved' as AlertStatus,
		source: 'disk-monitor',
		acknowledged: 'true',
		acknowledged_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
		acknowledged_by: 'admin',
		resolved: 'true',
		resolved_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
		resolved_by: 'admin',
		resolution_notes: 'Cleaned up old log files',
		metadata: {
			disk: '/dev/sda1',
			available_space: '8%',
		},
		tags: ['system', 'disk'],
		created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
		updated_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
	},
	{
		id: '5',
		organization_id: 'org-1',
		title: 'SSL Certificate Expiring',
		description: 'SSL certificate for example.com will expire in 7 days',
		severity: 'MEDIUM' as AlertSeverity,
		type: 'SECURITY' as AlertType,
		status: 'active' as AlertStatus,
		source: 'ssl-monitor',
		acknowledged: 'false',
		resolved: 'false',
		metadata: {
			domain: 'example.com',
			expires_in: '7 days',
		},
		tags: ['security', 'ssl'],
		created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
		updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
	},
]

/**
 * Test component for AlertDataTable and AlertPagination
 * Use this to verify the table works without infinite loops
 */
export function AlertTableTest() {
	const [selectedRows, setSelectedRows] = React.useState<Alert[]>([])
	const [useSimpleTable, setUseSimpleTable] = React.useState(true) // Start with simple table

	const columns = React.useMemo(
		() =>
			createAlertColumns({
				enableSelection: true,
				enableActions: true,
				onViewAlert: (alert) => {
					console.log('View alert:', alert)
				},
				onAcknowledgeAlert: (alert) => {
					console.log('Acknowledge alert:', alert)
				},
				onResolveAlert: (alert) => {
					console.log('Resolve alert:', alert)
				},
				onDismissAlert: (alert) => {
					console.log('Dismiss alert:', alert)
				},
			}),
		[]
	)

	const tableRef = React.useRef<any>(null)

	return (
		<div className="container mx-auto py-8 space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">Alert Table Test</h1>
				<div className="flex items-center space-x-4">
					<label className="flex items-center space-x-2">
						<input
							type="checkbox"
							checked={useSimpleTable}
							onChange={(e) => setUseSimpleTable(e.target.checked)}
						/>
						<span className="text-sm">Use Simple Table</span>
					</label>
					<div className="text-sm text-muted-foreground">
						Selected: {selectedRows.length} alerts
					</div>
				</div>
			</div>

			{useSimpleTable ? (
				<SimpleAlertTable data={mockAlerts} columns={columns} className="w-full" />
			) : (
				<>
					<AlertDataTable
						ref={tableRef}
						data={mockAlerts}
						columns={columns}
						onRowSelectionChange={setSelectedRows}
						enableRowSelection={true}
						enableColumnFiltering={true}
						enableSorting={true}
						className="w-full"
					/>

					<AlertPagination
						table={tableRef.current?.getTable() || null}
						enableUrlState={false} // Disable URL state for testing
						showPageSizeSelector={true}
						showPageInfo={true}
						showRowSelection={true}
						showNavigation={true}
						showFirstLastButtons={true}
					/>
				</>
			)}

			{selectedRows.length > 0 && (
				<div className="mt-4 p-4 bg-muted rounded-lg">
					<h3 className="font-semibold mb-2">Selected Alerts:</h3>
					<ul className="space-y-1">
						{selectedRows.map((alert) => (
							<li key={alert.id} className="text-sm">
								{alert.title} - {alert.severity}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	)
}

export default AlertTableTest
