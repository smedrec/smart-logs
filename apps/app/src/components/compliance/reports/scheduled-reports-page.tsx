/**
 * Scheduled Reports Page Component
 *
 * Main page for managing scheduled compliance reports with filtering,
 * pagination, and CRUD operations.
 */

import { CompliancePageHeader } from '@/components/compliance/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { useComplianceAudit } from '@/contexts/compliance-audit-provider'
import { useScheduledReportsUrlState } from '@/hooks/useComplianceUrlState'
import { Link } from '@tanstack/react-router'
import {
	AlertCircle,
	Calendar,
	Clock,
	Edit,
	Eye,
	MoreHorizontal,
	Play,
	Plus,
	RefreshCw,
	Search,
	Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { ExportButton } from '../export'

import type { ScheduledReport } from '@smedrec/audit-client'

interface ScheduledReportsPageProps {
	searchParams: {
		page?: number
		limit?: number
		search?: string
		reportType?: 'hipaa' | 'gdpr' | 'custom'
		status?: 'enabled' | 'disabled'
		sortBy?: 'name' | 'reportType' | 'lastRun' | 'nextRun' | 'createdAt'
		sortOrder?: 'asc' | 'desc'
	}
}

export function ScheduledReportsPage({ searchParams }: ScheduledReportsPageProps) {
	const { state, setParam } = useScheduledReportsUrlState()
	const { listScheduledReports, deleteScheduledReport, executeScheduledReport, connectionStatus } =
		useComplianceAudit()
	const [reports, setReports] = useState<ScheduledReport[]>([])
	const [totalCount, setTotalCount] = useState(0)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set())

	const fetchReports = async () => {
		if (!connectionStatus.isConnected) {
			setError('Audit service not connected')
			setLoading(false)
			return
		}

		try {
			setLoading(true)
			setError(null)

			// Map sortBy values to API field names
			const sortByMap: Record<string, string> = {
				name: 'name',
				reportType: 'name', // API doesn't support sorting by reportType
				lastRun: 'last_run',
				nextRun: 'next_run',
				createdAt: 'created_at',
			}

			const response = await listScheduledReports({
				limit: searchParams.limit || 10,
				offset: ((searchParams.page || 1) - 1) * (searchParams.limit || 10),
				search: searchParams.search,
				enabled:
					searchParams.status === 'enabled'
						? true
						: searchParams.status === 'disabled'
							? false
							: undefined,
				sortBy: searchParams.sortBy ? (sortByMap[searchParams.sortBy] as any) : undefined,
				sortOrder: searchParams.sortOrder,
			})

			setReports(response.data || [])
			setTotalCount(response.pagination?.total || 0)
		} catch (err) {
			console.error('Failed to fetch scheduled reports:', err)
			setError(err instanceof Error ? err.message : 'Failed to fetch reports')
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		fetchReports()
	}, [
		searchParams.page,
		searchParams.limit,
		searchParams.search,
		searchParams.reportType,
		searchParams.status,
		searchParams.sortBy,
		searchParams.sortOrder,
		connectionStatus.isConnected,
	])

	const getReportTypeLabel = (type: string) => {
		switch (type) {
			case 'HIPAA_AUDIT_TRAIL':
				return 'HIPAA Audit'
			case 'GDPR_PROCESSING_ACTIVITIES':
				return 'GDPR Processing'
			case 'INTEGRITY_VERIFICATION':
				return 'Integrity Check'
			case 'GENERAL_COMPLIANCE':
				return 'General Compliance'
			default:
				return type
		}
	}

	const getReportTypeBadgeVariant = (type: string) => {
		switch (type) {
			case 'HIPAA_AUDIT_TRAIL':
				return 'default' as const
			case 'GDPR_PROCESSING_ACTIVITIES':
				return 'secondary' as const
			case 'INTEGRITY_VERIFICATION':
				return 'outline' as const
			case 'GENERAL_COMPLIANCE':
				return 'destructive' as const
			default:
				return 'default' as const
		}
	}

	const formatDate = (date: string | Date) => {
		const dateObj = typeof date === 'string' ? new Date(date) : date
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		}).format(dateObj)
	}

	const handleSearch = (value: string) => {
		setParam('search', value || undefined)
		setParam('page', 1) // Reset to first page when searching
	}

	const handleReportTypeFilter = (value: string) => {
		setParam('reportType', value === 'all' ? undefined : (value as any))
		setParam('page', 1)
	}

	const handleStatusFilter = (value: string) => {
		setParam('status', value === 'all' ? undefined : (value as any))
		setParam('page', 1)
	}

	const handleExecuteReport = async (reportId: string) => {
		try {
			await executeScheduledReport(reportId)
			console.log('Report execution triggered:', reportId)
			// Refresh the reports list
			fetchReports()
		} catch (err) {
			console.error('Failed to execute report:', err)
			setError(err instanceof Error ? err.message : 'Failed to execute report')
		}
	}

	const handleDeleteReport = async (reportId: string) => {
		if (!confirm('Are you sure you want to delete this report?')) {
			return
		}

		try {
			await deleteScheduledReport(reportId)
			console.log('Report deleted:', reportId)
			// Refresh the reports list
			fetchReports()
		} catch (err) {
			console.error('Failed to delete report:', err)
			setError(err instanceof Error ? err.message : 'Failed to delete report')
		}
	}

	const handleBulkDelete = async () => {
		if (selectedReports.size === 0) return
		if (!confirm(`Are you sure you want to delete ${selectedReports.size} report(s)?`)) {
			return
		}

		try {
			await Promise.all(Array.from(selectedReports).map((id) => deleteScheduledReport(id)))
			console.log('Bulk delete completed')
			setSelectedReports(new Set())
			fetchReports()
		} catch (err) {
			console.error('Failed to bulk delete reports:', err)
			setError(err instanceof Error ? err.message : 'Failed to delete reports')
		}
	}

	if (loading) {
		return (
			<div className="flex flex-col gap-6 p-6">
				<CompliancePageHeader title="Scheduled Reports" description="Loading reports..." />
				<div className="flex items-center justify-center h-64">
					<RefreshCw className="h-8 w-8 animate-spin text-primary" />
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex flex-col gap-6 p-6">
				<CompliancePageHeader title="Scheduled Reports" description="Error loading reports" />
				<Card>
					<CardContent className="pt-6">
						<div className="flex flex-col items-center gap-4">
							<AlertCircle className="h-12 w-12 text-destructive" />
							<div className="text-center">
								<p className="text-destructive font-medium">Error: {error}</p>
								<Button variant="outline" onClick={fetchReports} className="mt-4">
									<RefreshCw className="h-4 w-4 mr-2" />
									Retry
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-6 p-6">
			<div className="flex items-center justify-between">
				<CompliancePageHeader
					title="Scheduled Reports"
					description="Manage automated compliance reports and their execution schedules"
					actions={[
						{
							label: 'Create Report',
							href: '/compliance/scheduled-reports/create',
							icon: Plus,
						},
					]}
				/>
				<ExportButton
					type="reports"
					data={reports}
					availableColumns={[
						{ key: 'name', label: 'Report Name', description: 'Name of the scheduled report' },
						{ key: 'reportType', label: 'Report Type', description: 'Type of compliance report' },
						{ key: 'status', label: 'Status', description: 'Report status (enabled/disabled)' },
						{ key: 'schedule', label: 'Schedule', description: 'Cron expression for scheduling' },
						{ key: 'nextRun', label: 'Next Run', description: 'Next scheduled execution time' },
						{ key: 'lastRun', label: 'Last Run', description: 'Last execution time' },
						{ key: 'lastStatus', label: 'Last Status', description: 'Status of last execution' },
						{ key: 'createdBy', label: 'Created By', description: 'User who created the report' },
						{ key: 'createdAt', label: 'Created Date', description: 'When the report was created' },
						{
							key: 'updatedAt',
							label: 'Updated Date',
							description: 'When the report was last updated',
						},
					]}
					onExport={async (options) => {
						console.log('Exporting scheduled reports with options:', options)
						// TODO: Implement actual export logic
					}}
				/>
			</div>

			{/* Filters */}
			<Card>
				<CardHeader>
					<CardTitle>Filters</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col gap-4 md:flex-row md:items-center">
						<div className="flex-1">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Search reports..."
									value={state.search || ''}
									onChange={(e) => handleSearch(e.target.value)}
									className="pl-10"
								/>
							</div>
						</div>

						<Select value={state.reportType || 'all'} onValueChange={handleReportTypeFilter}>
							<SelectTrigger className="w-48">
								<SelectValue placeholder="Report Type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Types</SelectItem>
								<SelectItem value="hipaa">HIPAA Audit</SelectItem>
								<SelectItem value="gdpr">GDPR Processing</SelectItem>
								<SelectItem value="integrity">Integrity Check</SelectItem>
								<SelectItem value="custom">Custom Reports</SelectItem>
							</SelectContent>
						</Select>

						<Select value={state.status || 'all'} onValueChange={handleStatusFilter}>
							<SelectTrigger className="w-32">
								<SelectValue placeholder="Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="enabled">Enabled</SelectItem>
								<SelectItem value="disabled">Disabled</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>

			{/* Reports Table */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle>Reports ({totalCount})</CardTitle>
						<CardDescription>Manage your scheduled compliance reports</CardDescription>
					</div>
					{selectedReports.size > 0 && (
						<div className="flex items-center gap-2">
							<span className="text-sm text-muted-foreground">{selectedReports.size} selected</span>
							<Button variant="destructive" size="sm" onClick={handleBulkDelete}>
								<Trash2 className="h-4 w-4 mr-2" />
								Delete Selected
							</Button>
						</div>
					)}
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Last Run</TableHead>
								<TableHead>Next Run</TableHead>
								<TableHead>Executions</TableHead>
								<TableHead className="w-[70px]">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{reports.map((report) => (
								<TableRow key={report.id}>
									<TableCell>
										<div>
											<Link
												to="/compliance/scheduled-reports/$reportId"
												params={{ reportId: report.id }}
												className="font-medium hover:underline"
											>
												{report.name}
											</Link>
											{report.description && (
												<p className="text-sm text-muted-foreground">{report.description}</p>
											)}
										</div>
									</TableCell>
									<TableCell>
										<Badge variant={getReportTypeBadgeVariant(report.reportType)}>
											{getReportTypeLabel(report.reportType)}
										</Badge>
									</TableCell>
									<TableCell>
										<Badge variant={report.enabled ? 'default' : 'secondary'}>
											{report.enabled ? 'Enabled' : 'Disabled'}
										</Badge>
									</TableCell>
									<TableCell>{report.lastRun ? formatDate(report.lastRun) : 'Never'}</TableCell>
									<TableCell>
										{report.nextRun ? formatDate(report.nextRun) : 'Not scheduled'}
									</TableCell>
									<TableCell>{report.executionCount || 0}</TableCell>
									<TableCell>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant="ghost" className="h-8 w-8 p-0">
													<MoreHorizontal className="h-4 w-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuLabel>Actions</DropdownMenuLabel>
												<DropdownMenuItem asChild>
													<Link
														to="/compliance/scheduled-reports/$reportId"
														params={{ reportId: report.id }}
														className="flex items-center gap-2"
													>
														<Eye className="h-4 w-4" />
														View Details
													</Link>
												</DropdownMenuItem>
												<DropdownMenuItem asChild>
													<Link
														to="/compliance/scheduled-reports/$reportId/edit"
														params={{ reportId: report.id }}
														className="flex items-center gap-2"
													>
														<Edit className="h-4 w-4" />
														Edit
													</Link>
												</DropdownMenuItem>
												<DropdownMenuItem asChild>
													<Link
														to="/compliance/scheduled-reports/$reportId/executions"
														params={{ reportId: report.id }}
														className="flex items-center gap-2"
													>
														<Clock className="h-4 w-4" />
														View Executions
													</Link>
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													onClick={() => handleExecuteReport(report.id)}
													className="flex items-center gap-2"
												>
													<Play className="h-4 w-4" />
													Execute Now
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													onClick={() => handleDeleteReport(report.id)}
													className="flex items-center gap-2 text-red-600"
												>
													<Trash2 className="h-4 w-4" />
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>

					{reports.length === 0 && (
						<div className="text-center py-8">
							<p className="text-muted-foreground">No reports found</p>
							<Link to="/compliance/scheduled-reports/create">
								<Button className="mt-4">
									<Plus className="h-4 w-4 mr-2" />
									Create Your First Report
								</Button>
							</Link>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
