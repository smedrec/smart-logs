import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useComplianceAudit } from '@/contexts/compliance-audit-provider'
import { cn } from '@/lib/utils'
import { useNavigate, useParams } from '@tanstack/react-router'
import { format } from 'date-fns'
import {
	AlertCircleIcon,
	CalendarIcon,
	CheckCircleIcon,
	ClockIcon,
	DownloadIcon,
	EyeIcon,
	FilterIcon,
	RefreshCwIcon,
	SearchIcon,
	XCircleIcon,
} from 'lucide-react'
import React, { useEffect, useState } from 'react'

import { ExportButton } from '../export'

import type { ReportExecution } from '@smedrec/audit-client'
import type {
	ExecutionDetailsUI,
	ExecutionHistoryFilters,
	ExecutionStatus,
	PaginationState,
} from '../types'

interface ExecutionHistoryPageProps {
	reportId?: string
}

export function ExecutionHistoryPage({ reportId }: ExecutionHistoryPageProps) {
	const navigate = useNavigate()
	const params = useParams({
		from: '/_authenticated/compliance/scheduled-reports/$reportId/executions',
	})
	const { getExecutionHistory, connectionStatus } = useComplianceAudit()

	// State management
	const [executions, setExecutions] = useState<ReportExecution[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [selectedExecution, setSelectedExecution] = useState<ExecutionDetailsUI | null>(null)
	const [showDetailsModal, setShowDetailsModal] = useState(false)

	// Filter state
	const [filters, setFilters] = useState<ExecutionHistoryFilters>({
		status: undefined,
		dateRange: undefined,
		reportId: reportId || params?.reportId,
	})

	// Pagination state
	const [pagination, setPagination] = useState<PaginationState>({
		page: 1,
		pageSize: 20,
		total: 0,
		totalPages: 0,
	})

	// Search state
	const [searchTerm, setSearchTerm] = useState('')
	const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})

	// Fetch executions data
	const fetchExecutions = async () => {
		if (!connectionStatus.isConnected) return
		if (!filters.reportId) {
			setError('Report ID is required')
			setLoading(false)
			return
		}

		try {
			setLoading(true)
			setError(null)

			// Build query parameters
			const queryParams = {
				limit: pagination.pageSize,
				offset: (pagination.page - 1) * pagination.pageSize,
				...(filters.status && filters.status.length > 0 && { status: filters.status as any }),
				...(filters.dateRange && {
					startDate: filters.dateRange.startDate,
					endDate: filters.dateRange.endDate,
				}),
				sortBy: 'scheduled_time' as const,
				sortOrder: 'desc' as const,
			}

			// Fetch execution history from API
			const response = await getExecutionHistory(filters.reportId, queryParams)

			setExecutions(response.data || [])
			setPagination((prev) => ({
				...prev,
				total: response.pagination?.total || 0,
				totalPages: Math.ceil((response.pagination?.total || 0) / prev.pageSize),
			}))
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to fetch executions')
		} finally {
			setLoading(false)
		}
	}

	// Load execution details
	const loadExecutionDetails = async (executionId: string) => {
		try {
			// Find the execution in the current list
			const execution = executions.find((e) => e.id === executionId)
			if (!execution) {
				setError('Execution not found')
				return
			}

			// For now, use the execution data we have
			// In the future, we could fetch more detailed logs from the API
			const mockDetails: ExecutionDetailsUI = {
				...execution,
				logs: execution.logs || [
					{ message: 'Starting report execution', level: 'info', timestamp: '2024-01-15 10:00:00' },
					{ message: 'Connecting to database', level: 'info', timestamp: '2024-01-15 10:00:05' },
					{
						message: 'Executing query for date range',
						level: 'info',
						timestamp: '2024-01-15 10:00:10',
					},
					{ message: 'Processing records', level: 'info', timestamp: '2024-01-15 10:05:30' },
					{ message: 'Generating report', level: 'info', timestamp: '2024-01-15 10:08:45' },
					{
						message: 'Report generation completed',
						level: 'info',
						timestamp: '2024-01-15 10:10:00',
					},
				],
				metrics: {
					recordsProcessed: execution.recordsProcessed || 0,
					fileSize: execution.exportResult?.dataSize || 0,
					processingTime: execution.duration || 0,
				},
			}

			setSelectedExecution(mockDetails)
			setShowDetailsModal(true)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load execution details')
		}
	}

	// Status badge component
	const StatusBadge = ({ status }: { status: ExecutionStatus }) => {
		const statusConfig = {
			completed: { icon: CheckCircleIcon, variant: 'default' as const, color: 'text-green-600' },
			failed: { icon: XCircleIcon, variant: 'destructive' as const, color: 'text-red-600' },
			running: { icon: ClockIcon, variant: 'secondary' as const, color: 'text-blue-600' },
			pending: { icon: ClockIcon, variant: 'outline' as const, color: 'text-yellow-600' },
			cancelled: { icon: XCircleIcon, variant: 'outline' as const, color: 'text-gray-600' },
			timeout: { icon: AlertCircleIcon, variant: 'destructive' as const, color: 'text-orange-600' },
			skipped: { icon: EyeIcon, variant: 'outline' as const, color: 'text-gray-600' },
		}

		const config = statusConfig[status] || statusConfig.pending
		const Icon = config.icon

		return (
			<Badge variant={config.variant} className="flex items-center gap-1">
				<Icon className={cn('h-3 w-3', config.color)} />
				{status.charAt(0).toUpperCase() + status.slice(1)}
			</Badge>
		)
	}

	// Format duration helper
	const formatDuration = (ms: number) => {
		const seconds = Math.floor(ms / 1000)
		const minutes = Math.floor(seconds / 60)
		const hours = Math.floor(minutes / 60)

		if (hours > 0) return `${hours}h ${minutes % 60}m`
		if (minutes > 0) return `${minutes}m ${seconds % 60}s`
		return `${seconds}s`
	}

	// Format file size helper
	const formatFileSize = (bytes: number) => {
		const units = ['B', 'KB', 'MB', 'GB']
		let size = bytes
		let unitIndex = 0

		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024
			unitIndex++
		}

		return `${size.toFixed(1)} ${units[unitIndex]}`
	}

	// Handle filter changes
	const handleStatusFilter = (status: ExecutionStatus[]) => {
		setFilters((prev) => ({ ...prev, status }))
	}

	const handleDateRangeFilter = (range: { from?: Date; to?: Date }) => {
		setDateRange(range)
		setFilters((prev) => ({
			...prev,
			dateRange:
				range.from && range.to
					? {
							startDate: range.from.toISOString(),
							endDate: range.to.toISOString(),
						}
					: undefined,
		}))
	}

	// Effects
	useEffect(() => {
		fetchExecutions()
	}, [connectionStatus.isConnected, filters, pagination.page, pagination.pageSize, searchTerm])

	if (!connectionStatus.isConnected) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center py-8">
					<div className="text-center">
						<AlertCircleIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
						<p className="text-muted-foreground">Not connected to audit system</p>
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Execution History</h1>
					<p className="text-muted-foreground">
						{reportId ? `Report executions for ${reportId}` : 'All report executions'}
					</p>
				</div>
				<Button onClick={fetchExecutions} disabled={loading}>
					<RefreshCwIcon className="h-4 w-4 mr-2" />
					Refresh
				</Button>
			</div>

			{/* Filters */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<FilterIcon className="h-4 w-4" />
						Filters
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
						{/* Search */}
						<div className="relative">
							<SearchIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search executions..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-9"
							/>
						</div>

						{/* Status Filter */}
						<Select
							value={filters.status?.join(',') || ''}
							onValueChange={(value) =>
								handleStatusFilter(value ? (value.split(',') as ExecutionStatus[]) : [])
							}
						>
							<SelectTrigger>
								<SelectValue placeholder="Filter by status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="">All statuses</SelectItem>
								<SelectItem value="completed">Completed</SelectItem>
								<SelectItem value="failed">Failed</SelectItem>
								<SelectItem value="running">Running</SelectItem>
								<SelectItem value="pending">Pending</SelectItem>
								<SelectItem value="cancelled">Cancelled</SelectItem>
								<SelectItem value="timeout">Timeout</SelectItem>
								<SelectItem value="skipped">Skipped</SelectItem>
							</SelectContent>
						</Select>

						{/* Date Range */}
						<Popover>
							<PopoverTrigger asChild>
								<Button variant="outline" className="justify-start text-left font-normal">
									<CalendarIcon className="mr-2 h-4 w-4" />
									{dateRange.from ? (
										dateRange.to ? (
											<>
												{format(dateRange.from, 'LLL dd, y')} - {format(dateRange.to, 'LLL dd, y')}
											</>
										) : (
											format(dateRange.from, 'LLL dd, y')
										)
									) : (
										'Pick a date range'
									)}
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0" align="start">
								<Calendar
									initialFocus
									mode="range"
									defaultMonth={dateRange.from}
									selected={
										dateRange.from && dateRange.to
											? { from: dateRange.from, to: dateRange.to }
											: undefined
									}
									onSelect={(range) => handleDateRangeFilter(range || {})}
									numberOfMonths={2}
								/>
							</PopoverContent>
						</Popover>

						{/* Clear Filters */}
						<Button
							variant="outline"
							onClick={() => {
								setFilters({ reportId: filters.reportId })
								setSearchTerm('')
								setDateRange({})
							}}
						>
							Clear Filters
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Error Display */}
			{error && (
				<Card className="border-destructive">
					<CardContent className="pt-6">
						<div className="flex items-center gap-2 text-destructive">
							<AlertCircleIcon className="h-4 w-4" />
							<span>{error}</span>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Executions List */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Executions ({pagination.total})</CardTitle>
							<CardDescription>
								Recent report executions with status and performance metrics
							</CardDescription>
						</div>
						<ExportButton
							type="executions"
							data={executions}
							availableColumns={[
								{ key: 'id', label: 'Execution ID', description: 'Unique execution identifier' },
								{ key: 'status', label: 'Status', description: 'Execution status' },
								{ key: 'startedAt', label: 'Started At', description: 'When execution started' },
								{
									key: 'completedAt',
									label: 'Completed At',
									description: 'When execution completed',
								},
								{
									key: 'duration',
									label: 'Duration',
									description: 'Execution duration in milliseconds',
								},
								{
									key: 'recordsProcessed',
									label: 'Records Processed',
									description: 'Number of records processed',
								},
								{
									key: 'outputSize',
									label: 'Output Size',
									description: 'Size of generated output in bytes',
								},
								{
									key: 'errorMessage',
									label: 'Error Message',
									description: 'Error message if execution failed',
								},
								{
									key: 'triggeredBy',
									label: 'Triggered By',
									description: 'User or system that triggered execution',
								},
							]}
							onExport={async (options) => {
								console.log('Exporting execution history with options:', options)
								// TODO: Implement actual export logic
							}}
						/>
					</div>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div className="flex items-center justify-center py-8">
							<RefreshCwIcon className="h-6 w-6 animate-spin" />
							<span className="ml-2">Loading executions...</span>
						</div>
					) : executions.length === 0 ? (
						<div className="text-center py-8">
							<ClockIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
							<p className="text-muted-foreground">No executions found</p>
						</div>
					) : (
						<div className="space-y-4">
							{executions.map((execution) => (
								<div
									key={execution.id}
									className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-4">
											<StatusBadge status={execution.status} />
											<div>
												<p className="font-medium">Execution {execution.id}</p>
												<p className="text-sm text-muted-foreground">
													Started {format(new Date(execution.scheduledTime), 'PPp')}
												</p>
											</div>
										</div>

										<div className="flex items-center gap-2">
											{execution.duration && (
												<Badge variant="outline">{formatDuration(execution.duration)}</Badge>
											)}
											{execution.recordsProcessed && (
												<Badge variant="outline">
													{execution.recordsProcessed.toLocaleString()} records
												</Badge>
											)}
											{execution.exportResult?.dataSize && (
												<Badge variant="outline">
													{formatFileSize(execution.exportResult.dataSize)}
												</Badge>
											)}

											<Button
												variant="outline"
												size="sm"
												onClick={() => loadExecutionDetails(execution.id)}
											>
												<EyeIcon className="h-4 w-4 mr-1" />
												Details
											</Button>

											{execution.status === 'completed' && (
												<Button variant="outline" size="sm">
													<DownloadIcon className="h-4 w-4 mr-1" />
													Download
												</Button>
											)}
										</div>
									</div>

									{execution.error && (
										<div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
											<strong>Error:</strong> {JSON.stringify(execution.error)}
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Pagination */}
			{pagination.totalPages > 1 && (
				<div className="flex items-center justify-between">
					<p className="text-sm text-muted-foreground">
						Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
						{Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
						{pagination.total} executions
					</p>

					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={pagination.page <= 1}
							onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
						>
							Previous
						</Button>

						<span className="text-sm">
							Page {pagination.page} of {pagination.totalPages}
						</span>

						<Button
							variant="outline"
							size="sm"
							disabled={pagination.page >= pagination.totalPages}
							onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
						>
							Next
						</Button>
					</div>
				</div>
			)}

			{/* Execution Details Modal */}
			<Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
				<DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Execution Details</DialogTitle>
					</DialogHeader>

					{selectedExecution && (
						<Tabs defaultValue="overview" className="w-full">
							<TabsList>
								<TabsTrigger value="overview">Overview</TabsTrigger>
								<TabsTrigger value="logs">Logs</TabsTrigger>
								<TabsTrigger value="metrics">Metrics</TabsTrigger>
							</TabsList>

							<TabsContent value="overview" className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="text-sm font-medium">Status</label>
										<div className="mt-1">
											<StatusBadge status={selectedExecution.status} />
										</div>
									</div>

									<div>
										<label className="text-sm font-medium">Duration</label>
										<p className="mt-1">
											{selectedExecution.duration
												? formatDuration(selectedExecution.duration)
												: 'N/A'}
										</p>
									</div>

									<div>
										<label className="text-sm font-medium">Started At</label>
										<p className="mt-1">
											{format(new Date(selectedExecution.scheduledTime), 'PPp')}
										</p>
									</div>

									<div>
										<label className="text-sm font-medium">Completed At</label>
										<p className="mt-1">
											{selectedExecution.scheduledTime
												? format(new Date(selectedExecution.scheduledTime), 'PPp')
												: 'N/A'}
										</p>
									</div>
								</div>
							</TabsContent>

							<TabsContent value="logs" className="space-y-4">
								<div className="bg-muted p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
									{selectedExecution.logs?.map((log, index) => (
										<div key={index} className="mb-1">
											[{log.timestamp}] [{log.level.toUpperCase()}] {log.message}
										</div>
									)) || <p>No logs available</p>}
								</div>
							</TabsContent>

							<TabsContent value="metrics" className="space-y-4">
								{selectedExecution.metrics && (
									<div className="grid grid-cols-3 gap-4">
										<Card>
											<CardHeader className="pb-2">
												<CardTitle className="text-sm">Records Processed</CardTitle>
											</CardHeader>
											<CardContent>
												<p className="text-2xl font-bold">
													{selectedExecution.metrics.recordsProcessed.toLocaleString()}
												</p>
											</CardContent>
										</Card>

										<Card>
											<CardHeader className="pb-2">
												<CardTitle className="text-sm">File Size</CardTitle>
											</CardHeader>
											<CardContent>
												<p className="text-2xl font-bold">
													{formatFileSize(selectedExecution.metrics.fileSize)}
												</p>
											</CardContent>
										</Card>

										<Card>
											<CardHeader className="pb-2">
												<CardTitle className="text-sm">Processing Time</CardTitle>
											</CardHeader>
											<CardContent>
												<p className="text-2xl font-bold">
													{formatDuration(selectedExecution.metrics.processingTime)}
												</p>
											</CardContent>
										</Card>
									</div>
								)}
							</TabsContent>
						</Tabs>
					)}
				</DialogContent>
			</Dialog>
		</div>
	)
}
