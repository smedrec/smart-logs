import React from 'react'

import { ComplianceAuditProvider } from '../../contexts/compliance-audit-provider'
import { DataSyncProvider } from '../../contexts/data-sync-provider'
import { useScheduledReportsSync } from '../../hooks/use-data-sync'
import { useErrorHandler } from '../../hooks/use-error-handler'
import { ErrorBoundary } from '../ui/error-boundary'
import { SyncStatus } from '../ui/sync-status'

// Example component showing how to use the audit integration
function ComplianceReportsExample() {
	const { data, isLoading, refresh } = useScheduledReportsSync()
	const { error, handleError, clearError } = useErrorHandler()

	const handleRefresh = async () => {
		try {
			await refresh()
		} catch (err) {
			handleError(err, 'Manual refresh')
		}
	}

	return (
		<div className="p-6 space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-2xl font-bold">Compliance Reports</h2>
				<SyncStatus showDetails />
			</div>

			{error && (
				<div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
					<p className="text-destructive">{error.message}</p>
					<button onClick={clearError} className="mt-2 text-sm underline">
						Dismiss
					</button>
				</div>
			)}

			<div className="border rounded-lg p-4">
				{isLoading ? (
					<div className="flex items-center justify-center py-8">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
						<span className="ml-2">Loading reports...</span>
					</div>
				) : data ? (
					<div>
						<p className="text-sm text-muted-foreground mb-4">
							Found {data.pagination.total} scheduled reports
						</p>
						<div className="space-y-2">
							{data.data.map((report) => (
								<div key={report.id} className="border rounded p-3">
									<h3 className="font-medium">{report.name}</h3>
									<p className="text-sm text-muted-foreground">{report.description}</p>
									<div className="flex items-center gap-2 mt-2">
										<span className="text-xs bg-secondary px-2 py-1 rounded">
											{report.reportType}
										</span>
										<span className="text-xs text-muted-foreground">
											{report.enabled ? 'Enabled' : 'Disabled'}
										</span>
									</div>
								</div>
							))}
						</div>
					</div>
				) : (
					<div className="text-center py-8">
						<p className="text-muted-foreground">No reports found</p>
						<button onClick={handleRefresh} className="mt-2 text-sm underline">
							Try refreshing
						</button>
					</div>
				)}
			</div>
		</div>
	)
}

// Main integration example with all providers
export function ComplianceIntegrationExample() {
	return (
		<ErrorBoundary context="Compliance Integration Example">
			<ComplianceAuditProvider>
				<DataSyncProvider>
					<ComplianceReportsExample />
				</DataSyncProvider>
			</ComplianceAuditProvider>
		</ErrorBoundary>
	)
}
