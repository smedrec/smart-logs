/**
 * Manual Execution Page Component
 *
 * Allows users to manually execute a scheduled report with custom parameters
 */

import { CompliancePageHeader } from '@/components/compliance/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useNavigate } from '@tanstack/react-router'
import { AlertCircle, Calendar, CheckCircle, Clock, FileText, Play, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'

interface ManualExecutionPageProps {
	reportId: string
}

interface ReportInfo {
	id: string
	name: string
	description?: string
	reportType: 'HIPAA_AUDIT_TRAIL' | 'GDPR_PROCESSING_ACTIVITIES' | 'INTEGRITY_VERIFICATION'
	format: 'PDF' | 'CSV' | 'JSON'
	enabled: boolean
	lastRun?: Date
	nextRun: Date
}

interface ExecutionParameters {
	dateRange: {
		startDate: string
		endDate: string
	}
	outputFormat: 'PDF' | 'CSV' | 'JSON'
	includeDetails: boolean
	notifyOnCompletion: boolean
	priority: 'low' | 'normal' | 'high'
	customParameters: Record<string, string>
}

export function ManualExecutionPage({ reportId }: ManualExecutionPageProps) {
	const navigate = useNavigate()
	const [report, setReport] = useState<ReportInfo | null>(null)
	const [loading, setLoading] = useState(true)
	const [executing, setExecuting] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [executionId, setExecutionId] = useState<string | null>(null)

	const [parameters, setParameters] = useState<ExecutionParameters>({
		dateRange: {
			startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
			endDate: new Date().toISOString().split('T')[0], // today
		},
		outputFormat: 'PDF',
		includeDetails: true,
		notifyOnCompletion: true,
		priority: 'normal',
		customParameters: {},
	})

	useEffect(() => {
		// Mock data - in real implementation, this would come from API
		const mockReport: ReportInfo = {
			id: reportId,
			name: 'Monthly HIPAA Audit',
			description: 'Comprehensive HIPAA compliance audit report',
			reportType: 'HIPAA_AUDIT_TRAIL',
			format: 'PDF',
			enabled: true,
			lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
			nextRun: new Date(Date.now() + 1000 * 60 * 60 * 24 * 29), // 29 days from now
		}

		// Simulate API call
		setTimeout(() => {
			setReport(mockReport)
			setParameters((prev) => ({ ...prev, outputFormat: mockReport.format }))
			setLoading(false)
		}, 1000)
	}, [reportId])

	const getReportTypeLabel = (type: ReportInfo['reportType']) => {
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

	const updateParameters = (updates: Partial<ExecutionParameters>) => {
		setParameters((prev) => ({ ...prev, ...updates }))
	}

	const updateDateRange = (updates: Partial<ExecutionParameters['dateRange']>) => {
		setParameters((prev) => ({
			...prev,
			dateRange: { ...prev.dateRange, ...updates },
		}))
	}

	const updateCustomParameter = (key: string, value: string) => {
		setParameters((prev) => ({
			...prev,
			customParameters: { ...prev.customParameters, [key]: value },
		}))
	}

	const removeCustomParameter = (key: string) => {
		setParameters((prev) => {
			const newParams = { ...prev.customParameters }
			delete newParams[key]
			return { ...prev, customParameters: newParams }
		})
	}

	const handleExecute = async () => {
		if (!report) return

		setExecuting(true)
		setError(null)

		try {
			// Mock API call - in real implementation, this would call the API
			console.log('Executing report with parameters:', parameters)

			// Simulate execution
			await new Promise((resolve) => setTimeout(resolve, 2000))

			// Mock execution ID
			const mockExecutionId = `exec-${Date.now()}`
			setExecutionId(mockExecutionId)

			// Navigate to execution history after a delay
			setTimeout(() => {
				navigate({
					to: '/compliance/scheduled-reports/$reportId/executions',
					params: { reportId },
				})
			}, 3000)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to execute report')
		} finally {
			setExecuting(false)
		}
	}

	const handleCancel = () => {
		navigate({
			to: '/compliance/scheduled-reports/$reportId',
			params: { reportId },
		})
	}

	if (loading) {
		return (
			<div className="flex flex-col gap-6 p-6">
				<CompliancePageHeader
					title="Loading Report..."
					showBackButton
					backButtonHref={`/compliance/scheduled-reports/${reportId}`}
				/>
				<div className="flex items-center justify-center h-64">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
				</div>
			</div>
		)
	}

	if (error && !report) {
		return (
			<div className="flex flex-col gap-6 p-6">
				<CompliancePageHeader
					title="Report Not Found"
					showBackButton
					backButtonHref={`/compliance/scheduled-reports/${reportId}`}
				/>
				<Card>
					<CardContent className="pt-6">
						<div className="text-center text-red-600">
							<AlertCircle className="h-12 w-12 mx-auto mb-4" />
							<p>Report not found or you don't have permission to execute it.</p>
						</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	if (executionId) {
		return (
			<div className="flex flex-col gap-6 p-6">
				<CompliancePageHeader
					title="Execution Started"
					description="Your report execution has been queued"
				/>
				<Card>
					<CardContent className="pt-6">
						<div className="text-center">
							<CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
							<h3 className="text-lg font-medium mb-2">Report Execution Started</h3>
							<p className="text-muted-foreground mb-4">
								Execution ID: <code className="bg-muted px-2 py-1 rounded">{executionId}</code>
							</p>
							<p className="text-sm text-muted-foreground">
								You will be redirected to the execution history page shortly...
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-6 p-6">
			<CompliancePageHeader
				title={`Execute: ${report?.name}`}
				description="Configure and execute this report manually"
				showBackButton
				backButtonHref={`/compliance/scheduled-reports/${reportId}`}
			/>

			{/* Report Information */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<FileText className="h-5 w-5" />
						Report Information
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 md:grid-cols-2">
						<div>
							<p className="text-sm font-medium text-muted-foreground">Type</p>
							<Badge className="mt-1">{report && getReportTypeLabel(report.reportType)}</Badge>
						</div>
						<div>
							<p className="text-sm font-medium text-muted-foreground">Default Format</p>
							<p className="mt-1">{report?.format}</p>
						</div>
						<div>
							<p className="text-sm font-medium text-muted-foreground">Last Run</p>
							<p className="mt-1">
								{report?.lastRun
									? new Intl.DateTimeFormat('en-US', {
											month: 'short',
											day: 'numeric',
											year: 'numeric',
											hour: '2-digit',
											minute: '2-digit',
										}).format(report.lastRun)
									: 'Never'}
							</p>
						</div>
						<div>
							<p className="text-sm font-medium text-muted-foreground">Status</p>
							<Badge variant={report?.enabled ? 'default' : 'secondary'} className="mt-1">
								{report?.enabled ? 'Enabled' : 'Disabled'}
							</Badge>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Execution Parameters */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Settings className="h-5 w-5" />
						Execution Parameters
					</CardTitle>
					<CardDescription>Configure the parameters for this manual execution</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Date Range */}
					<div className="grid gap-4 md:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="startDate">Start Date</Label>
							<Input
								id="startDate"
								type="date"
								value={parameters.dateRange.startDate}
								onChange={(e) => updateDateRange({ startDate: e.target.value })}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="endDate">End Date</Label>
							<Input
								id="endDate"
								type="date"
								value={parameters.dateRange.endDate}
								onChange={(e) => updateDateRange({ endDate: e.target.value })}
							/>
						</div>
					</div>

					{/* Output Format */}
					<div className="space-y-2">
						<Label>Output Format</Label>
						<Select
							value={parameters.outputFormat}
							onValueChange={(value: 'PDF' | 'CSV' | 'JSON') =>
								updateParameters({ outputFormat: value })
							}
						>
							<SelectTrigger className="w-48">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="PDF">PDF</SelectItem>
								<SelectItem value="CSV">CSV</SelectItem>
								<SelectItem value="JSON">JSON</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Priority */}
					<div className="space-y-2">
						<Label>Execution Priority</Label>
						<Select
							value={parameters.priority}
							onValueChange={(value: 'low' | 'normal' | 'high') =>
								updateParameters({ priority: value })
							}
						>
							<SelectTrigger className="w-48">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="low">Low</SelectItem>
								<SelectItem value="normal">Normal</SelectItem>
								<SelectItem value="high">High</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Options */}
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div>
								<Label>Include Detailed Information</Label>
								<p className="text-sm text-muted-foreground">
									Include additional details in the report output
								</p>
							</div>
							<Switch
								checked={parameters.includeDetails}
								onCheckedChange={(checked) => updateParameters({ includeDetails: checked })}
							/>
						</div>

						<div className="flex items-center justify-between">
							<div>
								<Label>Notify on Completion</Label>
								<p className="text-sm text-muted-foreground">
									Send email notification when execution completes
								</p>
							</div>
							<Switch
								checked={parameters.notifyOnCompletion}
								onCheckedChange={(checked) => updateParameters({ notifyOnCompletion: checked })}
							/>
						</div>
					</div>

					{/* Custom Parameters */}
					<div className="space-y-4">
						<div>
							<Label>Custom Parameters</Label>
							<p className="text-sm text-muted-foreground">
								Additional parameters specific to this report type
							</p>
						</div>

						{Object.entries(parameters.customParameters).map(([key, value]) => (
							<div key={key} className="flex gap-2">
								<Input
									placeholder="Parameter name"
									value={key}
									onChange={(e) => {
										const newKey = e.target.value
										const newParams = { ...parameters.customParameters }
										delete newParams[key]
										if (newKey) newParams[newKey] = value
										updateParameters({ customParameters: newParams })
									}}
								/>
								<Input
									placeholder="Parameter value"
									value={value}
									onChange={(e) => updateCustomParameter(key, e.target.value)}
								/>
								<Button variant="outline" size="sm" onClick={() => removeCustomParameter(key)}>
									Remove
								</Button>
							</div>
						))}

						<Button variant="outline" onClick={() => updateCustomParameter('', '')}>
							Add Parameter
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Error Display */}
			{error && (
				<Card className="border-destructive">
					<CardContent className="pt-6">
						<div className="flex items-center gap-2 text-destructive">
							<AlertCircle className="h-4 w-4" />
							<span>{error}</span>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Actions */}
			<div className="flex justify-between">
				<Button variant="outline" onClick={handleCancel}>
					Cancel
				</Button>

				<Button onClick={handleExecute} disabled={executing}>
					{executing ? (
						<>
							<Clock className="h-4 w-4 mr-2 animate-spin" />
							Executing...
						</>
					) : (
						<>
							<Play className="h-4 w-4 mr-2" />
							Execute Report
						</>
					)}
				</Button>
			</div>
		</div>
	)
}
