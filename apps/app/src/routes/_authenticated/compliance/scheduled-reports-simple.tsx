import { useAuditContext } from '@/contexts/audit-provider'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/_authenticated/compliance/scheduled-reports-simple')({
	component: RouteComponent,
})

interface SimpleReport {
	id: string
	name: string
	description?: string
	reportType: string
	format: string
	enabled: boolean
	lastRun?: string
	nextRun: string
	executionCount: number
	successCount: number
	failureCount: number
}

interface SimpleExecution {
	id: string
	scheduledReportId: string
	status: string
	trigger: string
	scheduledTime: string
	executionTime?: string
	duration?: number
}

function RouteComponent() {
	const [reports, setReports] = useState<SimpleReport[]>([])
	const [executions, setExecutions] = useState<SimpleExecution[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const { client } = useAuditContext()

	useEffect(() => {
		async function loadData() {
			if (!client) return

			try {
				setLoading(true)
				setError(null)

				// Simple list call with minimal parameters
				const reportsResponse = await client.scheduledReports.list({
					limit: 10,
					offset: 0,
				})

				console.log('Reports response:', reportsResponse)
				const reportsList = reportsResponse?.data ?? []
				setReports(reportsList)

				// Get execution history for the first report if available
				if (reportsList.length > 0) {
					try {
						const firstReport = reportsList[0]
						const executionsResponse = await client.scheduledReports.getExecutionHistory(
							firstReport.id,
							{
								limit: 5,
								offset: 0,
							}
						)
						console.log('Executions response:', executionsResponse)
						setExecutions(executionsResponse?.data ?? [])
					} catch (execError) {
						console.warn('Could not load execution history:', execError)
						// Don't fail the whole component if executions fail
					}
				}
			} catch (err) {
				console.error('Error loading scheduled reports:', err)
				setError(err instanceof Error ? err.message : 'Failed to load reports')
			} finally {
				setLoading(false)
			}
		}

		loadData()
	}, [client])

	if (loading) {
		return <div className="p-4">Loading scheduled reports...</div>
	}

	if (error) {
		return (
			<div className="p-4">
				<div className="text-red-600 mb-4">Error: {error}</div>
				<button
					onClick={() => window.location.reload()}
					className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
				>
					Retry
				</button>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-6 p-4">
			<h1 className="text-2xl font-bold">Scheduled Reports (Simple)</h1>

			{reports.length === 0 ? (
				<div className="text-gray-500">No scheduled reports found</div>
			) : (
				<div className="space-y-4">
					{reports.map((report) => (
						<div key={report.id} className="border rounded-lg p-4 bg-white shadow-sm">
							<h3 className="font-semibold text-lg">{report.name}</h3>
							{report.description && <p className="text-gray-600 mt-1">{report.description}</p>}
							<div className="mt-2 grid grid-cols-2 gap-4 text-sm">
								<div>
									<span className="font-medium">Type:</span> {report.reportType}
								</div>
								<div>
									<span className="font-medium">Format:</span> {report.format}
								</div>
								<div>
									<span className="font-medium">Last Run:</span>{' '}
									{report.lastRun ? new Date(report.lastRun).toLocaleString() : 'Never'}
								</div>
								<div>
									<span className="font-medium">Next Run:</span>{' '}
									{new Date(report.nextRun).toLocaleString()}
								</div>
								<div>
									<span className="font-medium">Status:</span>{' '}
									<span className={report.enabled ? 'text-green-600' : 'text-red-600'}>
										{report.enabled ? 'Enabled' : 'Disabled'}
									</span>
								</div>
								<div>
									<span className="font-medium">Executions:</span> {report.executionCount}(
									{report.successCount} success, {report.failureCount} failed)
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			{executions.length > 0 && (
				<div className="mt-8">
					<h2 className="text-xl font-semibold mb-4">Recent Executions</h2>
					<div className="space-y-2">
						{executions.map((execution) => (
							<div key={execution.id} className="border rounded p-3 bg-gray-50">
								<div className="flex justify-between items-center">
									<span className="font-medium">Execution {execution.id}</span>
									<span
										className={`px-2 py-1 rounded text-xs font-medium ${
											execution.status === 'completed'
												? 'bg-green-100 text-green-800'
												: execution.status === 'failed'
													? 'bg-red-100 text-red-800'
													: execution.status === 'running'
														? 'bg-blue-100 text-blue-800'
														: 'bg-gray-100 text-gray-800'
										}`}
									>
										{execution.status}
									</span>
								</div>
								<div className="text-sm text-gray-600 mt-1">
									Scheduled: {new Date(execution.scheduledTime).toLocaleString()}
									{execution.executionTime && (
										<> | Executed: {new Date(execution.executionTime).toLocaleString()}</>
									)}
									{execution.duration && <> | Duration: {Math.round(execution.duration / 1000)}s</>}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			<div className="mt-8 p-4 bg-blue-50 rounded-lg">
				<h3 className="font-semibold text-blue-800 mb-2">Testing the Methods</h3>
				<p className="text-blue-700 text-sm">
					This page demonstrates functional versions of the `list()` and `getExecutionHistory()`
					methods. The methods now use simplified parameters that work with the server API.
				</p>
				<div className="mt-2 text-xs text-blue-600">
					<div>• list() method: Uses basic pagination parameters</div>
					<div>• getExecutionHistory() method: Uses simplified query parameters</div>
					<div>• Both methods have fallback error handling</div>
				</div>
			</div>
		</div>
	)
}
