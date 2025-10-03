'use client'

import { AlertSeverity, AlertStatus, AlertType } from '@/components/alerts/types/alert-types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { zodResolver } from '@hookform/resolvers/zod'
import {
	AlertCircle,
	Calendar,
	CheckCircle,
	Download,
	FileJson,
	FileSpreadsheet,
	FileText,
	Filter,
} from 'lucide-react'
import React, { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import type { AlertUI } from '@/components/alerts/types/alert-types'
import type { AlertFilters } from '@/components/alerts/types/filter-types'

// Export format options
export enum ExportFormat {
	CSV = 'csv',
	JSON = 'json',
	XLSX = 'xlsx',
	PDF = 'pdf',
}

// Export field options
export interface ExportField {
	key: keyof AlertUI | 'metadata' | 'tags'
	label: string
	description?: string
	required?: boolean
}

// Export configuration schema
const exportConfigSchema = z.object({
	format: z.nativeEnum(ExportFormat),
	filename: z.string().min(1, 'Filename is required'),
	dateRange: z
		.object({
			start: z.date(),
			end: z.date(),
		})
		.optional(),
	filters: z
		.object({
			severity: z.array(z.nativeEnum(AlertSeverity)).optional(),
			type: z.array(z.nativeEnum(AlertType)).optional(),
			status: z.array(z.nativeEnum(AlertStatus)).optional(),
			source: z.array(z.string()).optional(),
			tags: z.array(z.string()).optional(),
		})
		.optional(),
	fields: z.array(z.string()).min(1, 'At least one field must be selected'),
	includeMetadata: z.boolean(),
	includeTags: z.boolean(),
	maxRecords: z.number().min(1).max(10000).optional(),
})

type ExportConfig = z.infer<typeof exportConfigSchema>

// Export progress state
interface ExportProgress {
	status: 'idle' | 'preparing' | 'exporting' | 'completed' | 'error'
	progress: number
	message: string
	downloadUrl?: string
	error?: string
}

interface AlertExportProps {
	/** Current alert filters to pre-populate */
	currentFilters?: AlertFilters
	/** Available sources for filtering */
	availableSources?: string[]
	/** Available tags for filtering */
	availableTags?: string[]
	/** Export function */
	onExport: (config: ExportConfig) => Promise<{ url: string; filename: string }>
	/** Whether export is disabled */
	disabled?: boolean
	/** Trigger element (optional) */
	trigger?: React.ReactNode
	/** Additional CSS classes */
	className?: string
}

// Available export fields
const EXPORT_FIELDS: ExportField[] = [
	{ key: 'id', label: 'Alert ID', required: true },
	{ key: 'title', label: 'Title', required: true },
	{ key: 'description', label: 'Description' },
	{ key: 'severity', label: 'Severity', required: true },
	{ key: 'type', label: 'Type' },
	{ key: 'status', label: 'Status', required: true },
	{ key: 'source', label: 'Source' },
	{ key: 'timestamp', label: 'Created At', required: true },
	{ key: 'acknowledgedAt', label: 'Acknowledged At' },
	{ key: 'acknowledgedBy', label: 'Acknowledged By' },
	{ key: 'resolvedAt', label: 'Resolved At' },
	{ key: 'resolvedBy', label: 'Resolved By' },
	{ key: 'resolutionNotes', label: 'Resolution Notes' },
	{ key: 'organizationId', label: 'Organization ID' },
	{ key: 'correlationId', label: 'Correlation ID' },
	{ key: 'metadata', label: 'Metadata', description: 'Additional alert metadata' },
	{ key: 'tags', label: 'Tags', description: 'Alert tags' },
]

/**
 * Export functionality for alert data in multiple formats
 * Supports CSV, JSON, XLSX, and PDF export with filtering and field selection
 */
export function AlertExport({
	currentFilters = {},
	availableSources = [],
	availableTags = [],
	onExport,
	disabled = false,
	trigger,
	className,
}: AlertExportProps) {
	const [isOpen, setIsOpen] = useState(false)
	const [progress, setProgress] = useState<ExportProgress>({
		status: 'idle',
		progress: 0,
		message: '',
	})

	// Default export configuration
	const defaultConfig: ExportConfig = {
		format: ExportFormat.CSV,
		filename: `alerts-export-${new Date().toISOString().split('T')[0]}`,
		dateRange: undefined,
		filters: currentFilters,
		fields: EXPORT_FIELDS.filter((field) => field.required).map((field) => field.key),
		includeMetadata: false,
		includeTags: false,
		maxRecords: 1000,
	}

	const form = useForm<ExportConfig>({
		resolver: zodResolver(exportConfigSchema),
		defaultValues: defaultConfig,
	})

	const selectedFormat = form.watch('format')
	const selectedFields = form.watch('fields')

	const handleExport = useCallback(
		async (config: ExportConfig) => {
			try {
				setProgress({
					status: 'preparing',
					progress: 10,
					message: 'Preparing export...',
				})

				// Simulate progress updates
				const progressInterval = setInterval(() => {
					setProgress((prev) => ({
						...prev,
						progress: Math.min(prev.progress + 10, 90),
						message: prev.progress < 50 ? 'Fetching data...' : 'Generating file...',
					}))
				}, 500)

				const result = await onExport(config)

				clearInterval(progressInterval)

				setProgress({
					status: 'completed',
					progress: 100,
					message: 'Export completed successfully!',
					downloadUrl: result.url,
				})

				// Auto-download the file
				const link = document.createElement('a')
				link.href = result.url
				link.download = result.filename
				document.body.appendChild(link)
				link.click()
				document.body.removeChild(link)

				toast.success('Export completed successfully')

				// Reset after a delay
				setTimeout(() => {
					setProgress({
						status: 'idle',
						progress: 0,
						message: '',
					})
					setIsOpen(false)
				}, 2000)
			} catch (error) {
				console.error('Export failed:', error)
				setProgress({
					status: 'error',
					progress: 0,
					message: 'Export failed. Please try again.',
					error: error instanceof Error ? error.message : 'Unknown error',
				})
				toast.error('Export failed. Please try again.')
			}
		},
		[onExport]
	)

	const handleFieldToggle = useCallback(
		(fieldKey: string, checked: boolean) => {
			const currentFields = form.getValues('fields')
			const field = EXPORT_FIELDS.find((f) => f.key === fieldKey)

			if (field?.required && !checked) {
				toast.error(`${field.label} is required and cannot be deselected`)
				return
			}

			const newFields = checked
				? [...currentFields, fieldKey]
				: currentFields.filter((f) => f !== fieldKey)

			form.setValue('fields', newFields)
		},
		[form]
	)

	const handleDateRangeChange = useCallback(
		(values: { range: { from: Date; to: Date | undefined } }) => {
			if (values.range.from && values.range.to) {
				form.setValue('dateRange', {
					start: values.range.from,
					end: values.range.to,
				})
			} else {
				form.setValue('dateRange', undefined)
			}
		},
		[form]
	)

	const getFormatIcon = (format: ExportFormat) => {
		switch (format) {
			case ExportFormat.CSV:
				return <FileSpreadsheet className="h-4 w-4" />
			case ExportFormat.JSON:
				return <FileJson className="h-4 w-4" />
			case ExportFormat.XLSX:
				return <FileSpreadsheet className="h-4 w-4" />
			case ExportFormat.PDF:
				return <FileText className="h-4 w-4" />
			default:
				return <Download className="h-4 w-4" />
		}
	}

	const getFormatDescription = (format: ExportFormat) => {
		switch (format) {
			case ExportFormat.CSV:
				return 'Comma-separated values, compatible with Excel and other spreadsheet applications'
			case ExportFormat.JSON:
				return 'JavaScript Object Notation, suitable for programmatic processing'
			case ExportFormat.XLSX:
				return 'Excel spreadsheet format with formatting and multiple sheets'
			case ExportFormat.PDF:
				return 'Portable Document Format, suitable for reports and sharing'
			default:
				return ''
		}
	}

	const defaultTrigger = (
		<Button variant="outline" disabled={disabled} className={className}>
			<Download className="h-4 w-4 mr-2" />
			Export Alerts
		</Button>
	)

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
			<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Download className="h-5 w-5" />
						Export Alerts
					</DialogTitle>
					<DialogDescription>
						Configure and export alert data in your preferred format
					</DialogDescription>
				</DialogHeader>

				{progress.status === 'idle' ? (
					<Form {...form}>
						<form onSubmit={form.handleSubmit(handleExport)} className="space-y-6">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								{/* Export Format */}
								<Card>
									<CardHeader className="pb-4">
										<CardTitle className="text-lg">Export Format</CardTitle>
										<CardDescription>Choose the format for your exported data</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										<FormField
											control={form.control}
											name="format"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Format</FormLabel>
													<Select onValueChange={field.onChange} defaultValue={field.value}>
														<FormControl>
															<SelectTrigger>
																<SelectValue placeholder="Select format" />
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															{Object.values(ExportFormat).map((format) => (
																<SelectItem key={format} value={format}>
																	<div className="flex items-center gap-2">
																		{getFormatIcon(format)}
																		{format.toUpperCase()}
																	</div>
																</SelectItem>
															))}
														</SelectContent>
													</Select>
													<FormDescription>{getFormatDescription(selectedFormat)}</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name="filename"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Filename</FormLabel>
													<FormControl>
														<Input {...field} placeholder="Enter filename" />
													</FormControl>
													<FormDescription>
														Filename without extension (will be added automatically)
													</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name="maxRecords"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Maximum Records</FormLabel>
													<FormControl>
														<Input
															type="number"
															min={1}
															max={10000}
															{...field}
															onChange={(e) => field.onChange(parseInt(e.target.value))}
														/>
													</FormControl>
													<FormDescription>
														Maximum number of records to export (1-10,000)
													</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>
									</CardContent>
								</Card>

								{/* Date Range and Filters */}
								<Card>
									<CardHeader className="pb-4">
										<CardTitle className="text-lg flex items-center gap-2">
											<Filter className="h-4 w-4" />
											Filters
										</CardTitle>
										<CardDescription>Filter the data to export</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="space-y-2">
											<Label className="text-sm font-medium flex items-center gap-2">
												<Calendar className="h-4 w-4" />
												Date Range
											</Label>
											<DateRangePicker
												initialDateFrom={form.getValues('dateRange')?.start}
												initialDateTo={form.getValues('dateRange')?.end}
												onUpdate={handleDateRangeChange}
												align="start"
												showCompare={false}
											/>
											<p className="text-xs text-muted-foreground">
												Leave empty to export all dates
											</p>
										</div>

										<Separator />

										<div className="space-y-3">
											<Label className="text-sm font-medium">Status Filter</Label>
											<div className="grid grid-cols-2 gap-2">
												{Object.values(AlertStatus).map((status) => (
													<div key={status} className="flex items-center space-x-2">
														<Checkbox
															id={`status-${status}`}
															checked={form.getValues('filters')?.status?.includes(status)}
															onCheckedChange={(checked) => {
																const currentFilters = form.getValues('filters') || {}
																const currentStatus = currentFilters.status || []
																const newStatus = checked
																	? [...currentStatus, status]
																	: currentStatus.filter((s) => s !== status)
																form.setValue('filters', {
																	...currentFilters,
																	status: newStatus.length > 0 ? newStatus : undefined,
																})
															}}
														/>
														<Label
															htmlFor={`status-${status}`}
															className="text-sm font-normal capitalize"
														>
															{status}
														</Label>
													</div>
												))}
											</div>
										</div>

										<div className="space-y-3">
											<Label className="text-sm font-medium">Severity Filter</Label>
											<div className="grid grid-cols-2 gap-2">
												{Object.values(AlertSeverity).map((severity) => (
													<div key={severity} className="flex items-center space-x-2">
														<Checkbox
															id={`severity-${severity}`}
															checked={form.getValues('filters')?.severity?.includes(severity)}
															onCheckedChange={(checked) => {
																const currentFilters = form.getValues('filters') || {}
																const currentSeverity = currentFilters.severity || []
																const newSeverity = checked
																	? [...currentSeverity, severity]
																	: currentSeverity.filter((s) => s !== severity)
																form.setValue('filters', {
																	...currentFilters,
																	severity: newSeverity.length > 0 ? newSeverity : undefined,
																})
															}}
														/>
														<Label
															htmlFor={`severity-${severity}`}
															className="text-sm font-normal capitalize"
														>
															{severity}
														</Label>
													</div>
												))}
											</div>
										</div>
									</CardContent>
								</Card>
							</div>

							{/* Field Selection */}
							<Card>
								<CardHeader className="pb-4">
									<CardTitle className="text-lg">Field Selection</CardTitle>
									<CardDescription>Choose which fields to include in the export</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
										{EXPORT_FIELDS.map((field) => {
											const isSelected = selectedFields.includes(field.key)
											const isRequired = field.required

											return (
												<div
													key={field.key}
													className={`flex items-start space-x-2 p-3 rounded-lg border ${
														isRequired ? 'bg-muted/50' : ''
													}`}
												>
													<Checkbox
														id={`field-${field.key}`}
														checked={isSelected}
														onCheckedChange={(checked) => handleFieldToggle(field.key, !!checked)}
														disabled={isRequired}
													/>
													<div className="grid gap-1.5 leading-none">
														<Label
															htmlFor={`field-${field.key}`}
															className={`text-sm font-medium ${
																isRequired ? 'text-muted-foreground' : ''
															}`}
														>
															{field.label}
															{isRequired && <span className="text-xs ml-1">(Required)</span>}
														</Label>
														{field.description && (
															<p className="text-xs text-muted-foreground">{field.description}</p>
														)}
													</div>
												</div>
											)
										})}
									</div>

									<div className="mt-4 flex items-center justify-between">
										<div className="text-sm text-muted-foreground">
											{selectedFields.length} of {EXPORT_FIELDS.length} fields selected
										</div>
										<div className="flex gap-2">
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => {
													const allFields = EXPORT_FIELDS.map((f) => f.key)
													form.setValue('fields', allFields)
												}}
											>
												Select All
											</Button>
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => {
													const requiredFields = EXPORT_FIELDS.filter((f) => f.required).map(
														(f) => f.key
													)
													form.setValue('fields', requiredFields)
												}}
											>
												Required Only
											</Button>
										</div>
									</div>
								</CardContent>
							</Card>

							<DialogFooter>
								<Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
									Cancel
								</Button>
								<Button type="submit" disabled={selectedFields.length === 0}>
									<Download className="h-4 w-4 mr-2" />
									Export Data
								</Button>
							</DialogFooter>
						</form>
					</Form>
				) : (
					<div className="space-y-6 py-8">
						{/* Progress Display */}
						<div className="text-center space-y-4">
							{progress.status === 'completed' ? (
								<CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
							) : progress.status === 'error' ? (
								<AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
							) : (
								<div className="h-16 w-16 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
							)}

							<div className="space-y-2">
								<h3 className="text-lg font-semibold">
									{progress.status === 'completed' && 'Export Completed!'}
									{progress.status === 'error' && 'Export Failed'}
									{progress.status === 'preparing' && 'Preparing Export...'}
									{progress.status === 'exporting' && 'Exporting Data...'}
								</h3>
								<p className="text-muted-foreground">{progress.message}</p>
								{progress.error && <p className="text-sm text-red-500">{progress.error}</p>}
							</div>

							{progress.status !== 'error' && progress.status !== 'completed' && (
								<div className="w-full max-w-md mx-auto">
									<Progress value={progress.progress} className="w-full" />
									<p className="text-sm text-muted-foreground mt-2">
										{progress.progress}% complete
									</p>
								</div>
							)}

							{progress.status === 'completed' && progress.downloadUrl && (
								<Button
									onClick={() => {
										const link = document.createElement('a')
										link.href = progress.downloadUrl!
										link.download = form.getValues('filename')
										document.body.appendChild(link)
										link.click()
										document.body.removeChild(link)
									}}
									className="mt-4"
								>
									<Download className="h-4 w-4 mr-2" />
									Download Again
								</Button>
							)}

							{progress.status === 'error' && (
								<Button
									onClick={() => {
										setProgress({
											status: 'idle',
											progress: 0,
											message: '',
										})
									}}
									className="mt-4"
								>
									Try Again
								</Button>
							)}
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	)
}
