/**
 * Global Execution History Page Component
 *
 * Shows execution history for all reports with advanced filtering and search
 */

import { CompliancePageHeader } from '@/components/compliance/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { useExecutionHistoryUrlState } from '@/hooks/useComplianceUrlState'
import { Link } from '@tanstack/react-router'
import {
	AlertCircle,
	Calendar,
	CheckCircle,
	Clock,
	Download,
	Eye,
	Filter,
	RefreshCw,
	Search,
	XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'

interface ExecutionRecord {
	id: string
	reportId: string
	reportName: string
	reportType: 'HIPAA_AUDIT_TRAIL' | 'GDPR_PROCESSING_ACTIVITIES' | 'INTEGRITY_VERIFICATION'
	status: 'completed' | 'failed' | 'running' | 'pending'
	scheduledTime: Date
	executionTime?: Date
	duration?: number
	recordsProcessed?: number
	outputSize?: number
	outputFormat: 'PDF' | 'CSV' | 'JSON'
	triggeredBy: 'system' | 'user' | 'schedule'
	errorMessage?: string
}

interface GlobalExecutionHistoryPageProps {
	searchParams: {
		page?: number
		limit?: number
		reportId?: string
		status?: 'completed' | 'failed' | 'running' | 'pending'
		reportType?: 'hipaa' | 'gdpr' | 'custom'
		dateFrom?: string
		dateTo?: string
		sortBy?: 'scheduledTime' | 'executionTime' | 'duration' | 'status' | 'reportName'
		sortOrder?: 'asc' | 'desc'
	}
}

export function GlobalExecutionHistoryPage({ searchParams }: GlobalExecutionHistoryPageProps) {
	const { state, setParam } = useExecutionHistoryUrlState()
	const [executions, setExecutions] = useState<ExecutionRecord[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	// Mock data - in real implementation, this would come from API
	useEffect(() => {
		const mockExecutions: ExecutionRecord[] = [
			{
				id: 'exec-1',
				reportId: 'report-1',
				reportName: 'Monthly HIPAA Audit',
				reportType: 'HIPAA_AUDIT_TRAIL',
				status: 'completed',
				scheduledTime: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
				executionTime: new Date(Date.now() - 1000 * 60 * 60 * 2 + 1000 * 60 * 2), // started 2 hours ago, ran for 2 minutes
				duration: 120000, // 2 minutes
				recordsProcessed: 1250,
				outputSize: 2048576, // 2MB
				outputFormat: 'PDF',
				triggeredBy: 'schedule',
			},
			{
				id: 'exec-2',
				reportId: 'report-2',
				reportName: 'GDPR Processing Activities',
				reportType: 'GDPR_PROCESSING_ACTIVITIES',
				status: 'completed',
				scheduledTime: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
				executionTime: new Date(Date.now() - 1000 * 60 * 60 * 6 + 1000 * 60 * 3), // started 6 hours ago, ran for 3 minutes
				duration: 180000, // 3 minutes
				recordsProcessed: 890,
				outputSize: 1536000, // 1.5MB
				outputFormat: 'CSV',
				triggeredBy: 'user',
			},
			{
				id: 'exec-3',
				reportId: 'report-3',
				reportName: 'Data Integrity Check',
				reportType: 'INTEGRITY_VERIFICATION',
				status: 'failed',
				scheduledTime: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
				executionTime: new Date(Date.now() - 1000 * 60 * 60 * 12 + 1000 * 30), // started 12 hours ago, failed after 30 seconds
				duration: 30000, // 30 seconds
				outputFormat: 'JSON',
				triggeredBy: 'schedule',
				errorMessage: 'Database connection timeout',
			},
			{
				id: 'exec-4',
				reportId: 'report-1',
				reportName: 'Monthly HIPAA Audit',
				reportType: 'HIPAA_AUDIT_TRAIL',
				status: 'running',
				scheduledTime: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
				executionTime: new Date(Date.now() - 1000 * 60 * 5), // started 5 minutes ago
				outputFormat: 'PDF',
				triggeredBy: 'user',
			},
		]

		// Simulate API call
		setTimeout(() => {
			setExecutions(mockExecutions)
			setLoading(false)
		}, 1000)
	}, [])

	const getReportTypeLabel = (type: ExecutionRecord['reportType']) => {
		switch (type) {
			case 'HIPAA_AUDIT_TRAIL':
				return 'HIPAA Audit'
			case 'GDPR_PROCESSING_ACTIVITIES':
				return 'GDPR Processing'
			case 'INTEGRITY_VERIFICATION':
				return 'Integrity Check'
			default:
				return type
		}
	}

	const getStatusIcon = (status: ExecutionRecord['status']) => {
		switch (status) {
			case 'completed':
				return CheckCircle
			case 'failed':
				return XCircle
			case 'running':
				return Clock
			case 'pending':
				return Clock
			default:
				return Clock
		}
	}

	const getStatusColor = (status: ExecutionRecord['status']) => {
		switch (status) {
			case 'completed':
				return 'text-green-600'
			case 'failed':
				return 'text-red-600'
			case 'running':
				return 'text-blue-600'
			case 'pending':
				return 'text-yellow-600'
			default:
				return 'text-gray-600'
		}
	}

	const formatDate = (date: Date) => {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		}).format(date)
	}

	const formatDuration = (ms: number) => {
		const seconds = Math.floor(ms / 1000)
		const minutes = Math.floor(seconds / 60)
		const remainingSeconds = seconds % 60
		return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`
	}

	const formatFileSize = (bytes: number) => {
		const mb = bytes / (1024 * 1024)
		return `${mb.toFixed(1)} MB`
	}

	const handleSearch = (value: string) => {
		setParam('reportId', value || undefined)
		setParam('page', 1)
	}

	const handleStatusFilter = (value: string) => {
		setParam('status', value === 'all' ? undefined : (value as any))
		setParam('page', 1)
	}

	const handleReportTypeFilter = (value: string) => {
		setParam('reportType', value === 'all' ? undefined : (value as any))
		setParam('page', 1)
	}

	const handleRefresh = () => {
		setLoading(true)
		// Simulate refresh
		setTimeout(() => {
			setLoading(false)
		}, 1000)
	}

	if (loading) {
		return (
			<div className="flex flex-col gap-6 p-6">
				<CompliancePageHeader
					title="Execution History"
					description="Loading execution history..."
				/>
				<div className="flex items-center justify-center h-64">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex flex-col gap-6 p-6">
				<CompliancePageHeader
					title="Execution History"
					description="Error loading execution history"
				/>
				<Card>
					<CardContent className="pt-6">
						<div className="text-center text-red-600">
							<AlertCircle className="h-12 w-12 mx-auto mb-4" />
							<p>Error: {error}</p>
						</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-6 p-6">
			<CompliancePageHeader
				title="Execution History"
				description="View execution history for all compliance reports across your organization"
				actions={[
					{
						label: 'Refresh',
						onClick: handleRefresh,
						icon: RefreshCw,
						variant: 'outline',
					},
				]}
			/>

			{/* Summary Cards */}
			<div className="grid gap-4 md:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Executions</CardTitle>
						<Calendar className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{executions.length}</div>
						<p className="text-xs text-muted-foreground">Last 30 days</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Success Rate</CardTitle>
						<CheckCircle className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{Math.round(
								(executions.filter((e) => e.status === 'completed').length / executions.length) *
									100
							)}
							%
						</div>
						<p className="text-xs text-muted-foreground">
							{executions.filter((e) => e.status === 'completed').length} successful
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Running</CardTitle>
						<Clock className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{executions.filter((e) => e.status === 'running').length}
						</div>
						<p className="text-xs text-muted-foreground">Currently executing</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Failed</CardTitle>
						<XCircle className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{executions.filter((e) => e.status === 'failed').length}
						</div>
						<p className="text-xs text-muted-foreground">Need attention</p>
					</CardContent>
				</Card>
			</div>

			{/* Filters */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Filter className="h-4 w-4" />
						Filters
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col gap-4 md:flex-row md:items-center">
						<div className="flex-1">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Search by report name or ID..."
									value={state.reportId || ''}
									onChange={(e) => handleSearch(e.target.value)}
									className="pl-10"
								/>
							</div>
						</div>

						<Select value={state.status || 'all'} onValueChange={handleStatusFilter}>
							<SelectTrigger className="w-48">
								<SelectValue placeholder="Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="completed">Completed</SelectItem>
								<SelectItem value="failed">Failed</SelectItem>
								<SelectItem value="running">Running</SelectItem>
								<SelectItem value="pending">Pending</SelectItem>
							</SelectContent>
						</Select>

						<Select value={state.reportType || 'all'} onValueChange={handleReportTypeFilter}>
							<SelectTrigger className="w-48">
								<SelectValue placeholder="Report Type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Types</SelectItem>
								<SelectItem value="hipaa">HIPAA Audit</SelectItem>
								<SelectItem value="gdpr">GDPR Processing</SelectItem>
								<SelectItem value="custom">Integrity Check</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>

			{/* Executions Table */}
			<Card>
				<CardHeader>
					<CardTitle>Recent Executions ({executions.length})</CardTitle>
					<CardDescription>Latest report execution results across all reports</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Report</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Scheduled</TableHead>
								<TableHead>Duration</TableHead>
								<TableHead>Records</TableHead>
								<TableHead>Triggered By</TableHead>
								<TableHead>Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{executions.map((execution) => {
								const StatusIcon = getStatusIcon(execution.status)
								return (
									<TableRow key={execution.id}>
										<TableCell>
											<div>
												<Link
													to="/compliance/scheduled-reports/$reportId"
													params={{ reportId: execution.reportId }}
													className="font-medium hover:underline"
												>
													{execution.reportName}
												</Link>
												<p className="text-sm text-muted-foreground">ID: {execution.reportId}</p>
											</div>
										</TableCell>
										<TableCell>
											<Badge variant="outline">{getReportTypeLabel(execution.reportType)}</Badge>
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-2">
												<StatusIcon className={`h-4 w-4 ${getStatusColor(execution.status)}`} />
												<Badge
													variant={
														execution.status === 'completed'
															? 'default'
															: execution.status === 'failed'
																? 'destructive'
																: 'secondary'
													}
												>
													{execution.status}
												</Badge>
											</div>
											{execution.errorMessage && (
												<p className="text-xs text-red-600 mt-1">{execution.errorMessage}</p>
											)}
										</TableCell>
										<TableCell>
											<div>
												<p className="text-sm">{formatDate(execution.scheduledTime)}</p>
												{execution.executionTime && (
													<p className="text-xs text-muted-foreground">
														Started: {formatDate(execution.executionTime)}
													</p>
												)}
											</div>
										</TableCell>
										<TableCell>
											{execution.duration ? formatDuration(execution.duration) : '-'}
										</TableCell>
										<TableCell>
											{execution.recordsProcessed
												? execution.recordsProcessed.toLocaleString()
												: '-'}
										</TableCell>
										<TableCell>
											<Badge variant="outline" className="capitalize">
												{execution.triggeredBy}
											</Badge>
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-2">
												<Link
													to="/compliance/scheduled-reports/$reportId/executions"
													params={{ reportId: execution.reportId }}
												>
													<Button variant="ghost" size="sm">
														<Eye className="h-4 w-4" />
													</Button>
												</Link>

												{execution.status === 'completed' && execution.outputSize && (
													<Button variant="ghost" size="sm" title="Download report">
														<Download className="h-4 w-4" />
													</Button>
												)}
											</div>
										</TableCell>
									</TableRow>
								)
							})}
						</TableBody>
					</Table>

					{executions.length === 0 && (
						<div className="text-center py-8">
							<Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
							<p className="text-muted-foreground">No executions found</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
