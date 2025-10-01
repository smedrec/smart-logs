import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
	AlertCircle,
	Calendar,
	CheckCircle2,
	Clock,
	Download,
	Eye,
	FileText,
	Filter,
	Globe,
	HardDrive,
	Mail,
	Settings,
	Upload,
	Webhook,
} from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { toast } from 'sonner'

import type { ReportType } from '../types'

interface ValidationResult {
	field: string
	status: 'valid' | 'warning' | 'error'
	message: string
}

interface PreviewPanelProps {
	className?: string
}

export function PreviewPanel({ className }: PreviewPanelProps) {
	const form = useFormContext()
	const formData = form.watch()

	const [validationResults, setValidationResults] = useState<ValidationResult[]>([])
	const [isExporting, setIsExporting] = useState(false)
	const [isImporting, setIsImporting] = useState(false)

	// Validate the entire form configuration
	const validateConfiguration = (): ValidationResult[] => {
		const results: ValidationResult[] = []

		// Basic information validation
		if (!formData.name?.trim()) {
			results.push({
				field: 'name',
				status: 'error',
				message: 'Report name is required',
			})
		}

		if (!formData.reportType) {
			results.push({
				field: 'reportType',
				status: 'error',
				message: 'Report type must be selected',
			})
		}

		// Date range validation
		if (!formData.criteria?.dateRange?.startDate || !formData.criteria?.dateRange?.endDate) {
			results.push({
				field: 'dateRange',
				status: 'error',
				message: 'Date range is required',
			})
		} else {
			const startDate = new Date(formData.criteria.dateRange.startDate)
			const endDate = new Date(formData.criteria.dateRange.endDate)

			if (startDate > endDate) {
				results.push({
					field: 'dateRange',
					status: 'error',
					message: 'Start date must be before end date',
				})
			}

			const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
			if (daysDiff > 365) {
				results.push({
					field: 'dateRange',
					status: 'warning',
					message: 'Date range spans more than 1 year, which may result in large reports',
				})
			}
		}

		// Schedule validation
		if (!formData.schedule?.cronExpression) {
			results.push({
				field: 'schedule',
				status: 'error',
				message: 'Schedule configuration is required',
			})
		} else {
			// Basic cron validation
			const cronParts = formData.schedule.cronExpression.split(' ')
			if (cronParts.length !== 5) {
				results.push({
					field: 'schedule',
					status: 'error',
					message: 'Invalid cron expression format',
				})
			}
		}

		if (!formData.schedule?.timezone) {
			results.push({
				field: 'timezone',
				status: 'error',
				message: 'Timezone is required',
			})
		}

		// Delivery validation
		if (!formData.delivery?.method) {
			results.push({
				field: 'delivery',
				status: 'error',
				message: 'Delivery method must be selected',
			})
		} else {
			const method = formData.delivery.method

			if (method === 'email') {
				if (!formData.delivery.email?.recipients?.length) {
					results.push({
						field: 'email',
						status: 'error',
						message: 'At least one email recipient is required',
					})
				}
			} else if (method === 'webhook') {
				if (!formData.delivery.webhook?.url) {
					results.push({
						field: 'webhook',
						status: 'error',
						message: 'Webhook URL is required',
					})
				}
			} else if (method === 'storage') {
				if (!formData.delivery.storage?.path) {
					results.push({
						field: 'storage',
						status: 'error',
						message: 'Storage path is required',
					})
				}
			}
		}

		return results
	}

	// Update validation when form data changes
	useEffect(() => {
		const results = validateConfiguration()
		setValidationResults(results)
	}, [formData])

	// Export configuration
	const exportConfiguration = async () => {
		setIsExporting(true)
		try {
			const configData = {
				...formData,
				exportedAt: new Date().toISOString(),
				version: '1.0',
			}

			const blob = new Blob([JSON.stringify(configData, null, 2)], {
				type: 'application/json',
			})

			const url = URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = `${formData.name || 'report-config'}-${new Date().toISOString().split('T')[0]}.json`
			document.body.appendChild(a)
			a.click()
			document.body.removeChild(a)
			URL.revokeObjectURL(url)

			toast.success('Configuration exported successfully')
		} catch (error) {
			toast.error('Failed to export configuration')
		} finally {
			setIsExporting(false)
		}
	}

	// Import configuration
	const importConfiguration = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (!file) return

		setIsImporting(true)
		try {
			const text = await file.text()
			const configData = JSON.parse(text)

			// Validate imported data structure
			if (!configData.name || !configData.reportType) {
				throw new Error('Invalid configuration file format')
			}

			// Reset form with imported data
			form.reset(configData)
			toast.success('Configuration imported successfully')
		} catch (error) {
			toast.error('Failed to import configuration: Invalid file format')
		} finally {
			setIsImporting(false)
			// Reset file input
			event.target.value = ''
		}
	}

	const getReportTypeLabel = (type: ReportType): string => {
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

	const getDeliveryMethodIcon = (method: string) => {
		switch (method) {
			case 'email':
				return Mail
			case 'webhook':
				return Webhook
			case 'storage':
				return HardDrive
			default:
				return Settings
		}
	}

	const parseCronExpression = (cronExpression: string): string => {
		if (!cronExpression) return 'No schedule set'

		// Simple cron parsing for common patterns
		if (cronExpression === '0 0 * * *') return 'Daily at midnight'
		if (cronExpression === '0 0 * * 1') return 'Weekly on Monday at midnight'
		if (cronExpression === '0 0 1 * *') return 'Monthly on the 1st at midnight'
		if (cronExpression === '0 0 1 */3 *') return 'Quarterly on the 1st at midnight'
		if (cronExpression === '0 9 * * *') return 'Daily at 9:00 AM'
		if (cronExpression === '0 0 * * 6') return 'Weekly on Saturday at midnight'

		return `Custom: ${cronExpression}`
	}

	const hasErrors = validationResults.some((r) => r.status === 'error')
	const hasWarnings = validationResults.some((r) => r.status === 'warning')

	return (
		<div className={cn('space-y-6', className)}>
			{/* Validation Summary */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<Eye className="h-5 w-5" />
								Configuration Summary
							</CardTitle>
							<CardDescription>Review your report configuration before saving</CardDescription>
						</div>
						<div className="flex items-center gap-2">
							{hasErrors ? (
								<Badge variant="destructive" className="flex items-center gap-1">
									<AlertCircle className="h-3 w-3" />
									{validationResults.filter((r) => r.status === 'error').length} Error(s)
								</Badge>
							) : hasWarnings ? (
								<Badge variant="secondary" className="flex items-center gap-1">
									<AlertCircle className="h-3 w-3" />
									{validationResults.filter((r) => r.status === 'warning').length} Warning(s)
								</Badge>
							) : (
								<Badge variant="default" className="flex items-center gap-1 bg-green-600">
									<CheckCircle2 className="h-3 w-3" />
									Valid Configuration
								</Badge>
							)}
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{validationResults.length > 0 && (
						<div className="space-y-2 mb-4">
							{validationResults.map((result, index) => (
								<Alert key={index} variant={result.status === 'error' ? 'destructive' : 'default'}>
									<AlertCircle className="h-4 w-4" />
									<AlertDescription>
										<span className="font-medium">{result.field}:</span> {result.message}
									</AlertDescription>
								</Alert>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Configuration Details */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Basic Information */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<FileText className="h-4 w-4" />
							Basic Information
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div>
							<div className="text-sm font-medium text-muted-foreground">Report Name</div>
							<div className="text-sm">{formData.name || 'Not specified'}</div>
						</div>
						<div>
							<div className="text-sm font-medium text-muted-foreground">Report Type</div>
							<div className="text-sm">
								{formData.reportType ? getReportTypeLabel(formData.reportType) : 'Not selected'}
							</div>
						</div>
						{formData.description && (
							<div>
								<div className="text-sm font-medium text-muted-foreground">Description</div>
								<div className="text-sm">{formData.description}</div>
							</div>
						)}
						<div>
							<div className="text-sm font-medium text-muted-foreground">Status</div>
							<Badge variant={formData.enabled ? 'default' : 'secondary'}>
								{formData.enabled ? 'Enabled' : 'Disabled'}
							</Badge>
						</div>
					</CardContent>
				</Card>

				{/* Criteria Configuration */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<Filter className="h-4 w-4" />
							Report Criteria
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div>
							<div className="text-sm font-medium text-muted-foreground">Date Range</div>
							<div className="text-sm">
								{formData.criteria?.dateRange?.startDate && formData.criteria?.dateRange?.endDate
									? `${new Date(formData.criteria.dateRange.startDate).toLocaleDateString()} - ${new Date(formData.criteria.dateRange.endDate).toLocaleDateString()}`
									: 'Not specified'}
							</div>
						</div>
						<div>
							<div className="text-sm font-medium text-muted-foreground">Applied Filters</div>
							<div className="text-sm">
								{formData.criteria?.filters && Object.keys(formData.criteria.filters).length > 0
									? `${Object.keys(formData.criteria.filters).length} filter(s) applied`
									: 'No additional filters'}
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Schedule Configuration */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<Clock className="h-4 w-4" />
							Schedule
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div>
							<div className="text-sm font-medium text-muted-foreground">Frequency</div>
							<div className="text-sm">
								{formData.schedule?.cronExpression
									? parseCronExpression(formData.schedule.cronExpression)
									: 'Not configured'}
							</div>
						</div>
						<div>
							<div className="text-sm font-medium text-muted-foreground">Timezone</div>
							<div className="text-sm flex items-center gap-1">
								<Globe className="h-3 w-3" />
								{formData.schedule?.timezone || 'Not specified'}
							</div>
						</div>
						{formData.schedule?.description && (
							<div>
								<div className="text-sm font-medium text-muted-foreground">Description</div>
								<div className="text-sm">{formData.schedule.description}</div>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Delivery Configuration */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							{formData.delivery?.method &&
								React.createElement(getDeliveryMethodIcon(formData.delivery.method), {
									className: 'h-4 w-4',
								})}
							Delivery
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div>
							<div className="text-sm font-medium text-muted-foreground">Method</div>
							<div className="text-sm capitalize">
								{formData.delivery?.method || 'Not selected'}
							</div>
						</div>

						{formData.delivery?.method === 'email' && (
							<div>
								<div className="text-sm font-medium text-muted-foreground">Recipients</div>
								<div className="text-sm">
									{formData.delivery.email?.recipients?.length
										? `${formData.delivery.email.recipients.length} recipient(s)`
										: 'None specified'}
								</div>
							</div>
						)}

						{formData.delivery?.method === 'webhook' && (
							<div>
								<div className="text-sm font-medium text-muted-foreground">Webhook URL</div>
								<div className="text-sm font-mono text-xs break-all">
									{formData.delivery.webhook?.url || 'Not specified'}
								</div>
							</div>
						)}

						{formData.delivery?.method === 'storage' && (
							<>
								<div>
									<div className="text-sm font-medium text-muted-foreground">Storage Path</div>
									<div className="text-sm font-mono text-xs">
										{formData.delivery.storage?.path || 'Not specified'}
									</div>
								</div>
								<div>
									<div className="text-sm font-medium text-muted-foreground">Format</div>
									<div className="text-sm uppercase">
										{formData.delivery.storage?.format || 'Not specified'}
									</div>
								</div>
							</>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Export/Import Configuration */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Settings className="h-5 w-5" />
						Configuration Management
					</CardTitle>
					<CardDescription>
						Export or import report configurations for backup or sharing
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex gap-3">
						<Button variant="outline" onClick={exportConfiguration} disabled={isExporting}>
							<Download className="h-4 w-4 mr-1" />
							{isExporting ? 'Exporting...' : 'Export Config'}
						</Button>

						<div className="relative">
							<Button
								variant="outline"
								disabled={isImporting}
								onClick={() => document.getElementById('config-import')?.click()}
							>
								<Upload className="h-4 w-4 mr-1" />
								{isImporting ? 'Importing...' : 'Import Config'}
							</Button>
							<input
								id="config-import"
								type="file"
								accept=".json"
								className="absolute inset-0 opacity-0 cursor-pointer"
								onChange={importConfiguration}
							/>
						</div>
					</div>

					<div className="mt-3 text-xs text-muted-foreground">
						Export configurations as JSON files for backup or sharing between environments. Import
						previously exported configurations to quickly set up similar reports.
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
