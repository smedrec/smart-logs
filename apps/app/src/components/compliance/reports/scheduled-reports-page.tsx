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
import { useScheduledReportsUrlState } from '@/hooks/useComplianceUrlState'
import { Link } from '@tanstack/react-router'
import {
	Calendar,
	Clock,
	Edit,
	Eye,
	MoreHorizontal,
	Play,
	Plus,
	Search,
	Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { ExportButton } from '../export'

interface ScheduledReport {
	id: string
	name: string
	description?: string
	reportType:
		| 'HIPAA_AUDIT_TRAIL'
		| 'GDPR_PROCESSING_ACTIVITIES'
		| 'INTEGRITY_VERIFICATION'
		| 'CUSTOM_REPORT'
	format: 'PDF' | 'CSV' | 'JSON'
	enabled: boolean
	lastRun?: Date
	nextRun: Date
	executionCount: number
	createdAt: Date
	createdBy: string
}

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
	const [reports, setReports] = useState<ScheduledReport[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	// Mock data - in real implementation, this would come from API
	useEffect(() => {
		const mockReports: ScheduledReport[] = [
			{
				id: 'report-1',
				name: 'Monthly HIPAA Audit',
				description: 'Comprehensive HIPAA compliance audit report',
				reportType: 'HIPAA_AUDIT_TRAIL',
				format: 'PDF',
				enabled: true,
				lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
				nextRun: new Date(Date.now() + 1000 * 60 * 60 * 24 * 29), // 29 days from now
				executionCount: 12,
				createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365), // 1 year ago
				createdBy: 'admin@example.com',
			},
			{
				id: 'report-2',
				name: 'GDPR Processing Activities',
				description: 'Weekly GDPR processing activities report',
				reportType: 'GDPR_PROCESSING_ACTIVITIES',
				format: 'CSV',
				enabled: true,
				lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 1 week ago
				nextRun: new Date(Date.now() + 1000 * 60 * 60 * 24), // 1 day from now
				executionCount: 52,
				createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365), // 1 year ago
				createdBy: 'compliance@example.com',
			},
			{
				id: 'report-3',
				name: 'Data Integrity Check',
				description: 'Daily data integrity verification report',
				reportType: 'INTEGRITY_VERIFICATION',
				format: 'JSON',
				enabled: false,
				lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
				nextRun: new Date(Date.now() + 1000 * 60 * 60 * 24), // 1 day from now
				executionCount: 90,
				createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180), // 6 months ago
				createdBy: 'security@example.com',
			},
		]

		// Simulate API call
		setTimeout(() => {
			setReports(mockReports)
			setLoading(false)
		}, 1000)
	}, [])

	const getReportTypeLabel = (type: ScheduledReport['reportType']) => {
		switch (type) {
			case 'HIPAA_AUDIT_TRAIL':
				return 'HIPAA Audit'
			case 'GDPR_PROCESSING_ACTIVITIES':
				return 'GDPR Processing'
			case 'INTEGRITY_VERIFICATION':
				return 'Integrity Check'
			case 'CUSTOM_REPORT':
				return 'Custom Report'
			default:
				return type
		}
	}

	const getReportTypeBadgeVariant = (type: ScheduledReport['reportType']) => {
		switch (type) {
			case 'HIPAA_AUDIT_TRAIL':
				return 'default'
			case 'GDPR_PROCESSING_ACTIVITIES':
				return 'secondary'
			case 'INTEGRITY_VERIFICATION':
				return 'outline'
			case 'CUSTOM_REPORT':
				return 'destructive'
			default:
				return 'default'
		}
	}

	const formatDate = (date: Date) => {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		}).format(date)
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

	const handleExecuteReport = (reportId: string) => {
		// TODO: Implement report execution
		console.log('Executing report:', reportId)
	}

	const handleDeleteReport = (reportId: string) => {
		// TODO: Implement report deletion
		console.log('Deleting report:', reportId)
	}

	if (loading) {
		return (
			<div className="flex flex-col gap-6 p-6">
				<CompliancePageHeader title="Scheduled Reports" description="Loading reports..." />
				<div className="flex items-center justify-center h-64">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
						<div className="text-center text-red-600">
							<p>Error: {error}</p>
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
				<CardHeader>
					<CardTitle>Reports ({reports.length})</CardTitle>
					<CardDescription>Manage your scheduled compliance reports</CardDescription>
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
									<TableCell>{formatDate(report.nextRun)}</TableCell>
									<TableCell>{report.executionCount}</TableCell>
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
