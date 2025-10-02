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
import { useAuditContext } from '@/contexts/audit-provider'
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

import type {
	ExecutionDetailsUI,
	ExecutionHistoryFilters,
	ExecutionStatus,
	PaginationState,
	ReportExecution,
} from '../types'

interface ExecutionHistoryPageProps {
	reportId?: string
}

export function ExecutionHistoryPage({ reportId }: ExecutionHistoryPageProps) {
	const navigate = useNavigate()
	const params = useParams({
		from: '/_authenticated/compliance/scheduled-reports/$reportId/executions',
	})
	const { client, isConnected } = useAuditContext()

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
		if (!client || !isConnected) return

		try {
			setLoading(true)
			setError(null)

			// Build query parameters
			const queryParams = {
				page: pagination.page,
				pageSize: pagination.pageSize,
				...(filters.reportId && { reportId: filters.reportId }),
				...(filters.status && filters.status.length > 0 && { status: filters.status }),
				...(filters.dateRange && {
					startDate: filters.dateRange.startDate,
					endDate: filters.dateRange.endDate,
				}),
				...(searchTerm && { search: searchTerm }),
			}

			// Mock API call - replace with actual client method when available
			// const response = await client.reportExecutions.list(queryParams)

			// Mock data for now
			const mockExecutions: ReportExecution[] = [
				{
					id: '1',
					reportId: filters.reportId || 'report-1',
					status: 'completed' as ExecutionStatus,
					startedAt: new Date(Date.now() - 3600000).toISOString(),
					completedAt: new Date(Date.now() - 3000000).toISOString(),
					duration: 600000,
					recordsProcessed: 1250,
					outputSize: 2048576,
					outputFormat: 'pdf',
					triggeredBy: 'system',
					metadata: {
						reportType: 'HIPAA_AUDIT_TRAIL',
						version: '1.0',
					},
				},
				{
					id: '2',
					reportId: filters.reportId || 'report-1',
					status: 'failed' as ExecutionStatus,
					startedAt: new Date(Date.now() - 7200000).toISOString(),
					completedAt: new Date(Date.now() - 6600000).toISOString(),
					duration: 600000,
					error: 'Database connection timeout',
					triggeredBy: 'user',
					metadata: {
						reportType: 'HIPAA_AUDIT_TRAIL',
						version: '1.0',
					},
				},
				{
					id: '3',
					reportId: filters.reportId || 'report-1',
					status: 'running' as ExecutionStatus,
					startedAt: new Date(Date.now() - 300000).toISOString(),
					triggeredBy: 'schedule',
					metadata: {
						reportType: 'HIPAA_AUDIT_TRAIL',
						version: '1.0',
					},
				},
			]

			setExecutions(mockExecutions)
			setPagination((prev) => ({
				...prev,
				total: mockExecutions.length,
				totalPages: Math.ceil(mockExecutions.length / prev.pageSize),
			}))
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to fetch executions')
		} finally {
			setLoading(false)
		}
	}

	// Load execution details
	const loadExecutionDetails = async (executionId: string) => {
		if (!client || !isConnected) return

		try {
			// Mock API call - replace with actual client method
			// const details = await client.reportExecutions.getDetails(executionId)

			// Mock detailed data
			const mockDetails: ExecutionDetailsUI = {
				...executions.find((e) => e.id === executionId)!,
				logs: [
					'2024-01-15 10:00:00 - Starting report execution',
					'2024-01-15 10:00:05 - Connecting to database',
					'2024-01-15 10:00:10 - Executing query for date range',
					'2024-01-15 10:05:30 - Processing 1250 records',
					'2024-01-15 10:08:45 - Generating PDF report',
					'2024-01-15 10:10:00 - Report generation completed',
				],
				metrics: {
					recordsProcessed: 1250,
					fileSize: 2048576,
					processingTime: 600000,
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
	}, [client, isConnected, filters, pagination.page, pagination.pageSize, searchTerm])

	if (!isConnected) {
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
									selected={dateRange}
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
					<CardTitle>Executions ({pagination.total})</CardTitle>
					<CardDescription>
						Recent report executions with status and performance metrics
					</CardDescription>
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
													Started {format(new Date(execution.startedAt), 'PPp')}
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
											{execution.outputSize && (
												<Badge variant="outline">{formatFileSize(execution.outputSize)}</Badge>
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
											<strong>Error:</strong> {execution.error}
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
										<p className="mt-1">{format(new Date(selectedExecution.startedAt), 'PPp')}</p>
									</div>

									<div>
										<label className="text-sm font-medium">Completed At</label>
										<p className="mt-1">
											{selectedExecution.completedAt
												? format(new Date(selectedExecution.completedAt), 'PPp')
												: 'N/A'}
										</p>
									</div>
								</div>
							</TabsContent>

							<TabsContent value="logs" className="space-y-4">
								<div className="bg-muted p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
									{selectedExecution.logs?.map((log, index) => (
										<div key={index} className="mb-1">
											{log}
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
