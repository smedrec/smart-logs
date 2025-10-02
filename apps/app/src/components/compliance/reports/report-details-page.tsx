/**
 * Report Details Page Component
 *
 * Displays detailed information about a specific scheduled report
 * including configuration, execution history, and management actions.
 */

import { CompliancePageHeader } from '@/components/compliance/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { Link } from '@tanstack/react-router'
import {
	AlertCircle,
	Calendar,
	CheckCircle,
	Clock,
	Download,
	Edit,
	FileText,
	Play,
	Settings,
	Trash2,
	User,
} from 'lucide-react'
import { useEffect, useState } from 'react'

interface ReportDetailsPageProps {
	reportId: string
}

interface ScheduledReport {
	id: string
	name: string
	description?: string
	reportType: 'HIPAA_AUDIT_TRAIL' | 'GDPR_PROCESSING_ACTIVITIES' | 'INTEGRITY_VERIFICATION'
	format: 'PDF' | 'CSV' | 'JSON'
	enabled: boolean
	lastRun?: Date
	nextRun: Date
	executionCount: number
	createdAt: Date
	createdBy: string
	schedule: {
		frequency: string
		time: string
		timezone: string
	}
	notifications: {
		onSuccess: boolean
		onFailure: boolean
		recipients: string[]
	}
}

interface RecentExecution {
	id: string
	scheduledTime: Date
	executionTime?: Date
	duration?: number
	status: 'completed' | 'failed' | 'running' | 'pending'
	errorMessage?: string
	outputSize?: number
}

export function ReportDetailsPage({ reportId }: ReportDetailsPageProps) {
	const [report, setReport] = useState<ScheduledReport | null>(null)
	const [recentExecutions, setRecentExecutions] = useState<RecentExecution[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		// Mock data - in real implementation, this would come from API
		const mockReport: ScheduledReport = {
			id: reportId,
			name: 'Monthly HIPAA Audit',
			description:
				'Comprehensive HIPAA compliance audit report covering all patient data access and modifications',
			reportType: 'HIPAA_AUDIT_TRAIL',
			format: 'PDF',
			enabled: true,
			lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
			nextRun: new Date(Date.now() + 1000 * 60 * 60 * 24 * 29), // 29 days from now
			executionCount: 12,
			createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365), // 1 year ago
			createdBy: 'admin@example.com',
			schedule: {
				frequency: 'monthly',
				time: '09:00',
				timezone: 'UTC',
			},
			notifications: {
				onSuccess: true,
				onFailure: true,
				recipients: ['compliance@example.com', 'admin@example.com'],
			},
		}

		const mockExecutions: RecentExecution[] = [
			{
				id: 'exec-1',
				scheduledTime: new Date(Date.now() - 1000 * 60 * 60 * 24),
				executionTime: new Date(Date.now() - 1000 * 60 * 60 * 24 + 1000 * 60 * 2),
				duration: 120000, // 2 minutes
				status: 'completed',
				outputSize: 2048576, // 2MB
			},
			{
				id: 'exec-2',
				scheduledTime: new Date(Date.now() - 1000 * 60 * 60 * 24 * 31),
				executionTime: new Date(Date.now() - 1000 * 60 * 60 * 24 * 31 + 1000 * 60 * 3),
				duration: 180000, // 3 minutes
				status: 'completed',
				outputSize: 1945600, // 1.9MB
			},
			{
				id: 'exec-3',
				scheduledTime: new Date(Date.now() - 1000 * 60 * 60 * 24 * 62),
				status: 'failed',
				errorMessage: 'Database connection timeout',
			},
		]

		// Simulate API call
		setTimeout(() => {
			setReport(mockReport)
			setRecentExecutions(mockExecutions)
			setLoading(false)
		}, 1000)
	}, [reportId])

	const getReportTypeLabel = (type: ScheduledReport['reportType']) => {
		switch (type) {
			case 'HIPAA_AUDIT_TRAIL':
				return 'HIPAA Audit Trail'
			case 'GDPR_PROCESSING_ACTIVITIES':
				return 'GDPR Processing Activities'
			case 'INTEGRITY_VERIFICATION':
				return 'Data Integrity Verification'
			default:
				return type
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

	const formatDuration = (ms: number) => {
		const seconds = Math.floor(ms / 1000)
		const minutes = Math.floor(seconds / 60)
		const remainingSeconds = seconds % 60
		return `${minutes}m ${remainingSeconds}s`
	}

	const formatFileSize = (bytes: number) => {
		const mb = bytes / (1024 * 1024)
		return `${mb.toFixed(1)} MB`
	}

	const handleExecuteNow = () => {
		// TODO: Implement immediate execution
		console.log('Executing report now:', reportId)
	}

	const handleToggleStatus = () => {
		// TODO: Implement status toggle
		console.log('Toggling report status:', reportId)
	}

	const handleDelete = () => {
		// TODO: Implement report deletion
		console.log('Deleting report:', reportId)
	}

	if (loading) {
		return (
			<div className="flex flex-col gap-6 p-6">
				<CompliancePageHeader
					title="Loading Report..."
					showBackButton
					backButtonHref="/compliance/scheduled-reports"
				/>
				<div className="flex items-center justify-center h-64">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
				</div>
			</div>
		)
	}

	if (error || !report) {
		return (
			<div className="flex flex-col gap-6 p-6">
				<CompliancePageHeader
					title="Report Not Found"
					showBackButton
					backButtonHref="/compliance/scheduled-reports"
				/>
				<Card>
					<CardContent className="pt-6">
						<div className="text-center text-red-600">
							<AlertCircle className="h-12 w-12 mx-auto mb-4" />
							<p>Report not found or you don't have permission to view it.</p>
						</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-6 p-6">
			<CompliancePageHeader
				title={report.name}
				description={report.description}
				showBackButton
				backButtonHref="/compliance/scheduled-reports"
				actions={[
					{
						label: 'Execute Now',
						onClick: handleExecuteNow,
						icon: Play,
					},
					{
						label: 'Edit',
						href: `/compliance/scheduled-reports/${reportId}/edit`,
						variant: 'outline',
						icon: Edit,
					},
				]}
			/>

			<div className="grid gap-6 md:grid-cols-2">
				{/* Report Configuration */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Settings className="h-5 w-5" />
							Configuration
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<p className="text-sm font-medium text-muted-foreground">Type</p>
								<Badge className="mt-1">{getReportTypeLabel(report.reportType)}</Badge>
							</div>
							<div>
								<p className="text-sm font-medium text-muted-foreground">Format</p>
								<p className="mt-1">{report.format}</p>
							</div>
							<div>
								<p className="text-sm font-medium text-muted-foreground">Status</p>
								<Badge variant={report.enabled ? 'default' : 'secondary'} className="mt-1">
									{report.enabled ? 'Enabled' : 'Disabled'}
								</Badge>
							</div>
							<div>
								<p className="text-sm font-medium text-muted-foreground">Executions</p>
								<p className="mt-1">{report.executionCount}</p>
							</div>
						</div>

						<div>
							<p className="text-sm font-medium text-muted-foreground">Created</p>
							<div className="flex items-center gap-2 mt-1">
								<User className="h-4 w-4" />
								<span className="text-sm">{report.createdBy}</span>
								<span className="text-sm text-muted-foreground">
									on {formatDate(report.createdAt)}
								</span>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Schedule Information */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Calendar className="h-5 w-5" />
							Schedule
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<p className="text-sm font-medium text-muted-foreground">Frequency</p>
								<p className="mt-1 capitalize">{report.schedule.frequency}</p>
							</div>
							<div>
								<p className="text-sm font-medium text-muted-foreground">Time</p>
								<p className="mt-1">
									{report.schedule.time} {report.schedule.timezone}
								</p>
							</div>
							<div>
								<p className="text-sm font-medium text-muted-foreground">Last Run</p>
								<p className="mt-1">{report.lastRun ? formatDate(report.lastRun) : 'Never'}</p>
							</div>
							<div>
								<p className="text-sm font-medium text-muted-foreground">Next Run</p>
								<p className="mt-1">{formatDate(report.nextRun)}</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Notifications */}
			<Card>
				<CardHeader>
					<CardTitle>Notifications</CardTitle>
					<CardDescription>Email notifications for report execution events</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 md:grid-cols-2">
						<div className="flex items-center justify-between">
							<span>Success notifications</span>
							<Badge variant={report.notifications.onSuccess ? 'default' : 'secondary'}>
								{report.notifications.onSuccess ? 'Enabled' : 'Disabled'}
							</Badge>
						</div>
						<div className="flex items-center justify-between">
							<span>Failure notifications</span>
							<Badge variant={report.notifications.onFailure ? 'default' : 'secondary'}>
								{report.notifications.onFailure ? 'Enabled' : 'Disabled'}
							</Badge>
						</div>
					</div>

					{report.notifications.recipients.length > 0 && (
						<div className="mt-4">
							<p className="text-sm font-medium text-muted-foreground mb-2">Recipients</p>
							<div className="flex flex-wrap gap-2">
								{report.notifications.recipients.map((email, index) => (
									<Badge key={index} variant="outline">
										{email}
									</Badge>
								))}
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Recent Executions */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Recent Executions</CardTitle>
							<CardDescription>Latest execution results for this report</CardDescription>
						</div>
						<Link to={`/compliance/scheduled-reports/${reportId}/executions`}>
							<Button variant="outline" size="sm">
								View All
							</Button>
						</Link>
					</div>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Scheduled Time</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Duration</TableHead>
								<TableHead>Output Size</TableHead>
								<TableHead>Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{recentExecutions.map((execution) => (
								<TableRow key={execution.id}>
									<TableCell>{formatDate(execution.scheduledTime)}</TableCell>
									<TableCell>
										<div className="flex items-center gap-2">
											{execution.status === 'completed' ? (
												<CheckCircle className="h-4 w-4 text-green-600" />
											) : execution.status === 'failed' ? (
												<AlertCircle className="h-4 w-4 text-red-600" />
											) : (
												<Clock className="h-4 w-4 text-yellow-600" />
											)}
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
									</TableCell>
									<TableCell>
										{execution.duration ? formatDuration(execution.duration) : '-'}
									</TableCell>
									<TableCell>
										{execution.outputSize ? formatFileSize(execution.outputSize) : '-'}
									</TableCell>
									<TableCell>
										{execution.status === 'completed' && (
											<Button variant="ghost" size="sm">
												<Download className="h-4 w-4" />
											</Button>
										)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>

					{recentExecutions.length === 0 && (
						<div className="text-center py-8 text-muted-foreground">No executions found</div>
					)}
				</CardContent>
			</Card>

			{/* Actions */}
			<Card>
				<CardHeader>
					<CardTitle>Actions</CardTitle>
					<CardDescription>Manage this scheduled report</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-wrap gap-2">
						<Button onClick={handleExecuteNow}>
							<Play className="h-4 w-4 mr-2" />
							Execute Now
						</Button>

						<Link to={`/compliance/scheduled-reports/${reportId}/edit`}>
							<Button variant="outline">
								<Edit className="h-4 w-4 mr-2" />
								Edit Configuration
							</Button>
						</Link>

						<Button variant="outline" onClick={handleToggleStatus}>
							{report.enabled ? 'Disable' : 'Enable'}
						</Button>

						<Link to={`/compliance/scheduled-reports/${reportId}/executions`}>
							<Button variant="outline">
								<Clock className="h-4 w-4 mr-2" />
								View All Executions
							</Button>
						</Link>

						<Button variant="destructive" onClick={handleDelete}>
							<Trash2 className="h-4 w-4 mr-2" />
							Delete Report
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
