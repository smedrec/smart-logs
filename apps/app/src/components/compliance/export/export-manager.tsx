/**
 * Export Manager Component
 *
 * Handles data export functionality for reports, execution history, and templates
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
	AlertCircle,
	Calendar,
	CheckCircle,
	Clock,
	Code,
	Download,
	FileText,
	Filter,
	Image,
	Settings,
	Table,
	X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

export type ExportFormat = 'csv' | 'json' | 'pdf' | 'xlsx'
export type ExportType = 'reports' | 'executions' | 'templates' | 'custom'

export interface ExportOptions {
	format: ExportFormat
	includeHeaders: boolean
	includeMetadata: boolean
	dateRange?: {
		startDate: string
		endDate: string
	}
	filters?: Record<string, any>
	columns?: string[]
	customFields?: string[]
}

export interface ExportJob {
	id: string
	type: ExportType
	format: ExportFormat
	status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
	progress: number
	createdAt: Date
	completedAt?: Date
	downloadUrl?: string
	fileName: string
	fileSize?: number
	error?: string
	options: ExportOptions
}

interface ExportManagerProps {
	type: ExportType
	data?: any[]
	onExport?: (options: ExportOptions) => Promise<ExportJob>
	availableColumns?: Array<{ key: string; label: string; description?: string }>
	defaultOptions?: Partial<ExportOptions>
}

interface ExportDialogProps {
	type: ExportType
	isOpen: boolean
	onClose: () => void
	onExport: (options: ExportOptions) => Promise<void>
	availableColumns?: Array<{ key: string; label: string; description?: string }>
	defaultOptions?: Partial<ExportOptions>
}

interface ExportProgressProps {
	jobs: ExportJob[]
	onDownload: (job: ExportJob) => void
	onCancel: (jobId: string) => void
	onClear: (jobId: string) => void
}

function ExportDialog({
	type,
	isOpen,
	onClose,
	onExport,
	availableColumns = [],
	defaultOptions = {},
}: ExportDialogProps) {
	const [options, setOptions] = useState<ExportOptions>({
		format: 'csv',
		includeHeaders: true,
		includeMetadata: false,
		columns: availableColumns.map((col) => col.key),
		...defaultOptions,
	})

	const [isExporting, setIsExporting] = useState(false)

	const formatOptions = [
		{ value: 'csv', label: 'CSV', description: 'Comma-separated values', icon: Table },
		{ value: 'json', label: 'JSON', description: 'JavaScript Object Notation', icon: Code },
		{ value: 'pdf', label: 'PDF', description: 'Portable Document Format', icon: FileText },
		{ value: 'xlsx', label: 'Excel', description: 'Microsoft Excel format', icon: Table },
	] as const

	const getTypeLabel = (type: ExportType) => {
		switch (type) {
			case 'reports':
				return 'Scheduled Reports'
			case 'executions':
				return 'Execution History'
			case 'templates':
				return 'Report Templates'
			case 'custom':
				return 'Custom Data'
			default:
				return 'Data'
		}
	}

	const handleExport = useCallback(async () => {
		setIsExporting(true)
		try {
			await onExport(options)
			onClose()
		} catch (error) {
			console.error('Export failed:', error)
		} finally {
			setIsExporting(false)
		}
	}, [options, onExport, onClose])

	const handleColumnToggle = useCallback((columnKey: string, checked: boolean) => {
		setOptions((prev) => ({
			...prev,
			columns: checked
				? [...(prev.columns || []), columnKey]
				: (prev.columns || []).filter((col) => col !== columnKey),
		}))
	}, [])

	const handleSelectAllColumns = useCallback(
		(checked: boolean) => {
			setOptions((prev) => ({
				...prev,
				columns: checked ? availableColumns.map((col) => col.key) : [],
			}))
		},
		[availableColumns]
	)

	const selectedFormat = formatOptions.find((f) => f.value === options.format)
	const allColumnsSelected = options.columns?.length === availableColumns.length
	const someColumnsSelected = (options.columns?.length || 0) > 0 && !allColumnsSelected

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="max-w-2xl max-h-[90vh]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Download className="h-5 w-5" />
						Export {getTypeLabel(type)}
					</DialogTitle>
					<DialogDescription>Configure export options and download your data</DialogDescription>
				</DialogHeader>

				<ScrollArea className="max-h-[60vh]">
					<div className="space-y-6 pr-4">
						{/* Format Selection */}
						<div className="space-y-3">
							<Label className="text-sm font-medium">Export Format</Label>
							<RadioGroup
								value={options.format}
								onValueChange={(value) =>
									setOptions((prev) => ({ ...prev, format: value as ExportFormat }))
								}
								className="grid grid-cols-2 gap-4"
							>
								{formatOptions.map((format) => (
									<div key={format.value} className="flex items-center space-x-2">
										<RadioGroupItem value={format.value} id={format.value} />
										<Label
											htmlFor={format.value}
											className="flex items-center gap-2 cursor-pointer"
										>
											<format.icon className="h-4 w-4" />
											<div>
												<div className="font-medium">{format.label}</div>
												<div className="text-xs text-muted-foreground">{format.description}</div>
											</div>
										</Label>
									</div>
								))}
							</RadioGroup>
						</div>

						<Separator />

						{/* Column Selection */}
						{availableColumns.length > 0 && (
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<Label className="text-sm font-medium">Columns to Include</Label>
									<div className="flex items-center space-x-2">
										<Checkbox
											id="selectAll"
											checked={allColumnsSelected}
											ref={(el) => {
												if (el) el.indeterminate = someColumnsSelected
											}}
											onCheckedChange={handleSelectAllColumns}
										/>
										<Label htmlFor="selectAll" className="text-sm">
											Select All ({availableColumns.length})
										</Label>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded p-3">
									{availableColumns.map((column) => (
										<div key={column.key} className="flex items-center space-x-2">
											<Checkbox
												id={column.key}
												checked={options.columns?.includes(column.key) || false}
												onCheckedChange={(checked) => handleColumnToggle(column.key, !!checked)}
											/>
											<Label htmlFor={column.key} className="text-sm cursor-pointer">
												<div className="font-medium">{column.label}</div>
												{column.description && (
													<div className="text-xs text-muted-foreground">{column.description}</div>
												)}
											</Label>
										</div>
									))}
								</div>

								<div className="text-sm text-muted-foreground">
									{options.columns?.length || 0} of {availableColumns.length} columns selected
								</div>
							</div>
						)}

						<Separator />

						{/* Export Options */}
						<div className="space-y-3">
							<Label className="text-sm font-medium">Export Options</Label>

							<div className="space-y-3">
								<div className="flex items-center space-x-2">
									<Checkbox
										id="includeHeaders"
										checked={options.includeHeaders}
										onCheckedChange={(checked) =>
											setOptions((prev) => ({ ...prev, includeHeaders: !!checked }))
										}
									/>
									<Label htmlFor="includeHeaders" className="text-sm">
										Include column headers
									</Label>
								</div>

								<div className="flex items-center space-x-2">
									<Checkbox
										id="includeMetadata"
										checked={options.includeMetadata}
										onCheckedChange={(checked) =>
											setOptions((prev) => ({ ...prev, includeMetadata: !!checked }))
										}
									/>
									<Label htmlFor="includeMetadata" className="text-sm">
										Include metadata (export date, filters, etc.)
									</Label>
								</div>
							</div>
						</div>

						{/* Preview */}
						<Card>
							<CardHeader>
								<CardTitle className="text-sm">Export Preview</CardTitle>
							</CardHeader>
							<CardContent className="text-sm space-y-2">
								<div className="flex items-center gap-2">
									<selectedFormat.icon className="h-4 w-4" />
									<span className="font-medium">{selectedFormat.label} format</span>
								</div>
								<div>
									<span className="text-muted-foreground">Columns: </span>
									{options.columns?.length || 0} selected
								</div>
								<div>
									<span className="text-muted-foreground">Options: </span>
									{options.includeHeaders && 'Headers, '}
									{options.includeMetadata && 'Metadata, '}
									{!options.includeHeaders && !options.includeMetadata && 'None'}
								</div>
							</CardContent>
						</Card>
					</div>
				</ScrollArea>

				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						onClick={handleExport}
						disabled={isExporting || (options.columns?.length || 0) === 0}
					>
						{isExporting && (
							<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
						)}
						<Download className="h-4 w-4 mr-2" />
						Export Data
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

function ExportProgress({ jobs, onDownload, onCancel, onClear }: ExportProgressProps) {
	const getStatusIcon = (status: ExportJob['status']) => {
		switch (status) {
			case 'completed':
				return <CheckCircle className="h-4 w-4 text-green-600" />
			case 'failed':
				return <AlertCircle className="h-4 w-4 text-red-600" />
			case 'processing':
				return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
			default:
				return <Clock className="h-4 w-4 text-muted-foreground" />
		}
	}

	const getStatusBadge = (status: ExportJob['status']) => {
		const variants = {
			pending: 'secondary',
			processing: 'default',
			completed: 'default',
			failed: 'destructive',
			cancelled: 'secondary',
		} as const

		return (
			<Badge variant={variants[status]} className="capitalize">
				{status}
			</Badge>
		)
	}

	const formatFileSize = (bytes?: number) => {
		if (!bytes) return 'Unknown'
		const sizes = ['Bytes', 'KB', 'MB', 'GB']
		const i = Math.floor(Math.log(bytes) / Math.log(1024))
		return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
	}

	const formatDuration = (start: Date, end?: Date) => {
		const endTime = end || new Date()
		const duration = endTime.getTime() - start.getTime()
		const seconds = Math.floor(duration / 1000)
		const minutes = Math.floor(seconds / 60)

		if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s`
		}
		return `${seconds}s`
	}

	if (jobs.length === 0) {
		return (
			<Card>
				<CardContent className="pt-6">
					<div className="text-center py-8 text-muted-foreground">
						<Download className="h-8 w-8 mx-auto mb-2" />
						<p>No export jobs yet</p>
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Download className="h-5 w-5" />
					Export Jobs ({jobs.length})
				</CardTitle>
				<CardDescription>Track your export progress and download completed files</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{jobs.map((job) => (
						<div key={job.id} className="border rounded-lg p-4">
							<div className="flex items-center justify-between mb-3">
								<div className="flex items-center gap-3">
									{getStatusIcon(job.status)}
									<div>
										<div className="font-medium">{job.fileName}</div>
										<div className="text-sm text-muted-foreground">
											{job.format.toUpperCase()} • {formatFileSize(job.fileSize)}
											{job.completedAt && ` • ${formatDuration(job.createdAt, job.completedAt)}`}
										</div>
									</div>
								</div>

								<div className="flex items-center gap-2">
									{getStatusBadge(job.status)}

									{job.status === 'completed' && job.downloadUrl && (
										<Button size="sm" onClick={() => onDownload(job)}>
											<Download className="h-4 w-4 mr-1" />
											Download
										</Button>
									)}

									{job.status === 'processing' && (
										<Button size="sm" variant="outline" onClick={() => onCancel(job.id)}>
											<X className="h-4 w-4 mr-1" />
											Cancel
										</Button>
									)}

									{(job.status === 'completed' ||
										job.status === 'failed' ||
										job.status === 'cancelled') && (
										<Button size="sm" variant="ghost" onClick={() => onClear(job.id)}>
											<X className="h-4 w-4" />
										</Button>
									)}
								</div>
							</div>

							{job.status === 'processing' && (
								<div className="space-y-2">
									<div className="flex justify-between text-sm">
										<span>Progress</span>
										<span>{job.progress}%</span>
									</div>
									<Progress value={job.progress} />
								</div>
							)}

							{job.status === 'failed' && job.error && (
								<div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
									<div className="font-medium">Export failed:</div>
									<div>{job.error}</div>
								</div>
							)}
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	)
}

export function ExportManager({
	type,
	data = [],
	onExport,
	availableColumns = [],
	defaultOptions = {},
}: ExportManagerProps) {
	const [showExportDialog, setShowExportDialog] = useState(false)
	const [exportJobs, setExportJobs] = useState<ExportJob[]>([])

	// Simulate export job updates
	useEffect(() => {
		const interval = setInterval(() => {
			setExportJobs((prev) =>
				prev.map((job) => {
					if (job.status === 'processing' && job.progress < 100) {
						const newProgress = Math.min(job.progress + Math.random() * 20, 100)
						const newStatus = newProgress >= 100 ? 'completed' : 'processing'

						return {
							...job,
							progress: newProgress,
							status: newStatus,
							completedAt: newStatus === 'completed' ? new Date() : undefined,
							downloadUrl:
								newStatus === 'completed' ? `/api/exports/${job.id}/download` : undefined,
							fileSize:
								newStatus === 'completed'
									? Math.floor(Math.random() * 1000000) + 100000
									: undefined,
						}
					}
					return job
				})
			)
		}, 1000)

		return () => clearInterval(interval)
	}, [])

	const handleExport = useCallback(
		async (options: ExportOptions) => {
			const job: ExportJob = {
				id: `export-${Date.now()}`,
				type,
				format: options.format,
				status: 'processing',
				progress: 0,
				createdAt: new Date(),
				fileName: `${type}-export-${new Date().toISOString().split('T')[0]}.${options.format}`,
				options,
			}

			setExportJobs((prev) => [job, ...prev])

			if (onExport) {
				try {
					const result = await onExport(options)
					setExportJobs((prev) => prev.map((j) => (j.id === job.id ? result : j)))
				} catch (error) {
					setExportJobs((prev) =>
						prev.map((j) =>
							j.id === job.id
								? {
										...j,
										status: 'failed',
										error: error instanceof Error ? error.message : 'Export failed',
									}
								: j
						)
					)
				}
			}
		},
		[type, onExport]
	)

	const handleDownload = useCallback((job: ExportJob) => {
		if (job.downloadUrl) {
			// Create a temporary link and trigger download
			const link = document.createElement('a')
			link.href = job.downloadUrl
			link.download = job.fileName
			document.body.appendChild(link)
			link.click()
			document.body.removeChild(link)
		}
	}, [])

	const handleCancelJob = useCallback((jobId: string) => {
		setExportJobs((prev) =>
			prev.map((job) => (job.id === jobId ? { ...job, status: 'cancelled' } : job))
		)
	}, [])

	const handleClearJob = useCallback((jobId: string) => {
		setExportJobs((prev) => prev.filter((job) => job.id !== jobId))
	}, [])

	return (
		<div className="space-y-6">
			{/* Export Controls */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<Download className="h-5 w-5" />
								Export Data
							</CardTitle>
							<CardDescription>Export your {type} data in various formats</CardDescription>
						</div>
						<Button onClick={() => setShowExportDialog(true)}>
							<Download className="h-4 w-4 mr-2" />
							New Export
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<div className="text-center">
							<div className="text-2xl font-bold">{data.length}</div>
							<div className="text-sm text-muted-foreground">Total Records</div>
						</div>
						<div className="text-center">
							<div className="text-2xl font-bold">{availableColumns.length}</div>
							<div className="text-sm text-muted-foreground">Available Columns</div>
						</div>
						<div className="text-center">
							<div className="text-2xl font-bold">
								{exportJobs.filter((j) => j.status === 'completed').length}
							</div>
							<div className="text-sm text-muted-foreground">Completed Exports</div>
						</div>
						<div className="text-center">
							<div className="text-2xl font-bold">
								{exportJobs.filter((j) => j.status === 'processing').length}
							</div>
							<div className="text-sm text-muted-foreground">In Progress</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Export Progress */}
			<ExportProgress
				jobs={exportJobs}
				onDownload={handleDownload}
				onCancel={handleCancelJob}
				onClear={handleClearJob}
			/>

			{/* Export Dialog */}
			<ExportDialog
				type={type}
				isOpen={showExportDialog}
				onClose={() => setShowExportDialog(false)}
				onExport={handleExport}
				availableColumns={availableColumns}
				defaultOptions={defaultOptions}
			/>
		</div>
	)
}
