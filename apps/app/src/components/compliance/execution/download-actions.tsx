import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuditContext } from '@/contexts/audit-provider'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import {
	AlertCircleIcon,
	ArchiveIcon,
	CheckCircleIcon,
	ClockIcon,
	CopyIcon,
	DownloadIcon,
	ExternalLinkIcon,
	EyeIcon,
	FileIcon,
	FileTextIcon,
	FolderIcon,
	HistoryIcon,
	ImageIcon,
	RefreshCwIcon,
	ShareIcon,
	TrashIcon,
	XCircleIcon,
} from 'lucide-react'
import React, { useState } from 'react'

import type { ReportExecution } from '../types'

interface DownloadActionsProps {
	execution: ReportExecution
	className?: string
	showHistory?: boolean
	onDownloadComplete?: (downloadId: string) => void
	onDownloadError?: (error: string) => void
}

interface DownloadFormat {
	id: string
	name: string
	extension: string
	icon: React.ComponentType<{ className?: string }>
	description: string
	size?: string
	available: boolean
}

interface DownloadItem {
	id: string
	executionId: string
	format: string
	filename: string
	size: number
	status: 'pending' | 'downloading' | 'completed' | 'failed'
	progress: number
	downloadedAt?: string
	error?: string
	url?: string
}

interface DownloadOptions {
	format: string
	includeMetadata: boolean
	includeAuditTrail: boolean
	compression: 'none' | 'zip' | 'gzip'
	customFilename?: string
}

export function DownloadActions({
	execution,
	className,
	showHistory = true,
	onDownloadComplete,
	onDownloadError,
}: DownloadActionsProps) {
	const { client, isConnected } = useAuditContext()

	// State management
	const [downloads, setDownloads] = useState<DownloadItem[]>([])
	const [showDownloadDialog, setShowDownloadDialog] = useState(false)
	const [downloadOptions, setDownloadOptions] = useState<DownloadOptions>({
		format: 'pdf',
		includeMetadata: true,
		includeAuditTrail: false,
		compression: 'none',
	})

	// Available download formats
	const downloadFormats: DownloadFormat[] = [
		{
			id: 'pdf',
			name: 'PDF Report',
			extension: 'pdf',
			icon: FileTextIcon,
			description: 'Formatted PDF document with charts and tables',
			size: '2.1 MB',
			available: execution.status === 'completed',
		},
		{
			id: 'csv',
			name: 'CSV Data',
			extension: 'csv',
			icon: FileIcon,
			description: 'Raw data in comma-separated values format',
			size: '856 KB',
			available: execution.status === 'completed',
		},
		{
			id: 'json',
			name: 'JSON Data',
			extension: 'json',
			icon: FileIcon,
			description: 'Structured data in JSON format',
			size: '1.2 MB',
			available: execution.status === 'completed',
		},
		{
			id: 'excel',
			name: 'Excel Workbook',
			extension: 'xlsx',
			icon: FileIcon,
			description: 'Excel workbook with multiple sheets',
			size: '1.8 MB',
			available: execution.status === 'completed',
		},
		{
			id: 'html',
			name: 'HTML Report',
			extension: 'html',
			icon: FileTextIcon,
			description: 'Interactive HTML report for web viewing',
			size: '3.2 MB',
			available: execution.status === 'completed',
		},
	]

	// Mock download history
	const downloadHistory: DownloadItem[] = [
		{
			id: 'dl-1',
			executionId: execution.id,
			format: 'pdf',
			filename: `report-${execution.id}.pdf`,
			size: 2097152,
			status: 'completed',
			progress: 100,
			downloadedAt: new Date(Date.now() - 3600000).toISOString(),
			url: '#',
		},
		{
			id: 'dl-2',
			executionId: execution.id,
			format: 'csv',
			filename: `data-${execution.id}.csv`,
			size: 876544,
			status: 'completed',
			progress: 100,
			downloadedAt: new Date(Date.now() - 7200000).toISOString(),
			url: '#',
		},
	]

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

	// Generate filename
	const generateFilename = (formatType: string, options: DownloadOptions) => {
		if (options.customFilename) {
			return `${options.customFilename}.${formatType}`
		}

		const timestamp = format(new Date(), 'yyyy-MM-dd-HHmm')
		// Use scheduledReportId since metadata is not available in ReportExecution type
		const reportType = execution.scheduledReportId?.toLowerCase().replace(/_/g, '-') || 'report'

		return `${reportType}-${execution.id}-${timestamp}.${formatType}`
	}

	// Start download
	const startDownload = async (options: DownloadOptions) => {
		if (!client || !isConnected) {
			onDownloadError?.('Not connected to audit system')
			return
		}

		const downloadId = `dl-${Date.now()}`
		const filename = generateFilename(options.format, options)

		const newDownload: DownloadItem = {
			id: downloadId,
			executionId: execution.id,
			format: options.format,
			filename,
			size: 0,
			status: 'pending',
			progress: 0,
		}

		setDownloads((prev) => [newDownload, ...prev])
		setShowDownloadDialog(false)

		try {
			// Update status to downloading
			setDownloads((prev) =>
				prev.map((d) => (d.id === downloadId ? { ...d, status: 'downloading' as const } : d))
			)

			// Mock API call - replace with actual client method
			// const downloadUrl = await client.reportExecutions.download(execution.id, options)

			// Simulate download progress
			for (let progress = 0; progress <= 100; progress += 10) {
				await new Promise((resolve) => setTimeout(resolve, 200))

				setDownloads((prev) =>
					prev.map((d) =>
						d.id === downloadId
							? { ...d, progress, size: Math.floor((progress / 100) * 2097152) }
							: d
					)
				)
			}

			// Complete download
			setDownloads((prev) =>
				prev.map((d) =>
					d.id === downloadId
						? {
								...d,
								status: 'completed' as const,
								progress: 100,
								downloadedAt: new Date().toISOString(),
								url: '#mock-download-url',
							}
						: d
				)
			)

			onDownloadComplete?.(downloadId)

			// Trigger actual file download
			const link = document.createElement('a')
			link.href = '#mock-download-url'
			link.download = filename
			document.body.appendChild(link)
			link.click()
			document.body.removeChild(link)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Download failed'

			setDownloads((prev) =>
				prev.map((d) =>
					d.id === downloadId ? { ...d, status: 'failed' as const, error: errorMessage } : d
				)
			)

			onDownloadError?.(errorMessage)
		}
	}

	// Quick download (with default options)
	const quickDownload = (format: string) => {
		startDownload({
			format,
			includeMetadata: true,
			includeAuditTrail: false,
			compression: 'none',
		})
	}

	// Retry download
	const retryDownload = (downloadId: string) => {
		const download = downloads.find((d) => d.id === downloadId)
		if (!download) return

		const options: DownloadOptions = {
			format: download.format,
			includeMetadata: true,
			includeAuditTrail: false,
			compression: 'none',
		}

		startDownload(options)
	}

	// Remove download from history
	const removeDownload = (downloadId: string) => {
		setDownloads((prev) => prev.filter((d) => d.id !== downloadId))
	}

	// Copy download link
	const copyDownloadLink = (download: DownloadItem) => {
		if (download.url) {
			navigator.clipboard.writeText(download.url)
		}
	}

	// Status badge component
	const StatusBadge = ({ status }: { status: DownloadItem['status'] }) => {
		const statusConfig = {
			pending: { icon: ClockIcon, variant: 'outline' as const, color: 'text-yellow-600' },
			downloading: { icon: RefreshCwIcon, variant: 'secondary' as const, color: 'text-blue-600' },
			completed: { icon: CheckCircleIcon, variant: 'default' as const, color: 'text-green-600' },
			failed: { icon: XCircleIcon, variant: 'destructive' as const, color: 'text-red-600' },
		}

		const config = statusConfig[status]
		const Icon = config.icon

		return (
			<Badge variant={config.variant} className="flex items-center gap-1">
				<Icon className={cn('h-3 w-3', config.color, status === 'downloading' && 'animate-spin')} />
				{status.charAt(0).toUpperCase() + status.slice(1)}
			</Badge>
		)
	}

	if (execution.status !== 'completed') {
		return (
			<Card className={className}>
				<CardContent className="flex items-center justify-center py-8">
					<div className="text-center">
						<DownloadIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
						<p className="text-muted-foreground">
							Downloads will be available when execution completes
						</p>
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<div className={cn('space-y-6', className)}>
			{/* Quick Download Actions */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<DownloadIcon className="h-4 w-4" />
						Quick Downloads
					</CardTitle>
					<CardDescription>Download report in common formats with default settings</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
						{downloadFormats
							.filter((f) => f.available)
							.map((format) => {
								const Icon = format.icon
								return (
									<Button
										key={format.id}
										variant="outline"
										className="h-auto p-4 flex flex-col items-center gap-2"
										onClick={() => quickDownload(format.id)}
									>
										<Icon className="h-6 w-6" />
										<div className="text-center">
											<p className="font-medium text-sm">{format.name}</p>
											<p className="text-xs text-muted-foreground">{format.size}</p>
										</div>
									</Button>
								)
							})}
					</div>

					<div className="mt-4 pt-4 border-t">
						<Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
							<DialogTrigger asChild>
								<Button variant="outline" className="w-full">
									<DownloadIcon className="h-4 w-4 mr-2" />
									Advanced Download Options
								</Button>
							</DialogTrigger>

							<DialogContent className="max-w-md">
								<DialogHeader>
									<DialogTitle>Download Configuration</DialogTitle>
									<DialogDescription>
										Customize your download with advanced options
									</DialogDescription>
								</DialogHeader>

								<div className="space-y-4">
									{/* Format Selection */}
									<div>
										<Label htmlFor="format">Format</Label>
										<Select
											value={downloadOptions.format}
											onValueChange={(value) =>
												setDownloadOptions((prev) => ({ ...prev, format: value }))
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{downloadFormats
													.filter((f) => f.available)
													.map((format) => (
														<SelectItem key={format.id} value={format.id}>
															{format.name} ({format.extension.toUpperCase()})
														</SelectItem>
													))}
											</SelectContent>
										</Select>
									</div>

									{/* Options */}
									<div className="space-y-3">
										<Label>Include Additional Data</Label>

										<div className="flex items-center space-x-2">
											<Checkbox
												id="metadata"
												checked={downloadOptions.includeMetadata}
												onCheckedChange={(checked) =>
													setDownloadOptions((prev) => ({
														...prev,
														includeMetadata: checked as boolean,
													}))
												}
											/>
											<Label htmlFor="metadata" className="text-sm">
												Include execution metadata
											</Label>
										</div>

										<div className="flex items-center space-x-2">
											<Checkbox
												id="audit-trail"
												checked={downloadOptions.includeAuditTrail}
												onCheckedChange={(checked) =>
													setDownloadOptions((prev) => ({
														...prev,
														includeAuditTrail: checked as boolean,
													}))
												}
											/>
											<Label htmlFor="audit-trail" className="text-sm">
												Include audit trail
											</Label>
										</div>
									</div>

									{/* Compression */}
									<div>
										<Label htmlFor="compression">Compression</Label>
										<Select
											value={downloadOptions.compression}
											onValueChange={(value) =>
												setDownloadOptions((prev) => ({
													...prev,
													compression: value as DownloadOptions['compression'],
												}))
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none">No compression</SelectItem>
												<SelectItem value="zip">ZIP archive</SelectItem>
												<SelectItem value="gzip">GZIP compression</SelectItem>
											</SelectContent>
										</Select>
									</div>

									{/* Custom Filename */}
									<div>
										<Label htmlFor="filename">Custom Filename (optional)</Label>
										<Input
											id="filename"
											placeholder="Enter custom filename"
											value={downloadOptions.customFilename || ''}
											onChange={(e) =>
												setDownloadOptions((prev) => ({
													...prev,
													customFilename: e.target.value || undefined,
												}))
											}
										/>
									</div>

									{/* Preview */}
									<div className="p-3 bg-muted rounded-lg">
										<p className="text-sm font-medium mb-1">Preview:</p>
										<p className="text-sm text-muted-foreground">
											{generateFilename(downloadOptions.format, downloadOptions)}
										</p>
									</div>

									{/* Actions */}
									<div className="flex gap-2 pt-4">
										<Button onClick={() => startDownload(downloadOptions)} className="flex-1">
											<DownloadIcon className="h-4 w-4 mr-2" />
											Start Download
										</Button>
										<Button variant="outline" onClick={() => setShowDownloadDialog(false)}>
											Cancel
										</Button>
									</div>
								</div>
							</DialogContent>
						</Dialog>
					</div>
				</CardContent>
			</Card>

			{/* Active Downloads */}
			{downloads.filter((d) => d.status === 'downloading' || d.status === 'pending').length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<RefreshCwIcon className="h-4 w-4" />
							Active Downloads
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{downloads
								.filter((d) => d.status === 'downloading' || d.status === 'pending')
								.map((download) => (
									<div key={download.id} className="border rounded-lg p-3">
										<div className="flex items-center justify-between mb-2">
											<div className="flex items-center gap-2">
												<FileIcon className="h-4 w-4" />
												<span className="font-medium text-sm">{download.filename}</span>
												<StatusBadge status={download.status} />
											</div>

											{download.status === 'downloading' && (
												<span className="text-sm text-muted-foreground">{download.progress}%</span>
											)}
										</div>

										{download.status === 'downloading' && (
											<Progress value={download.progress} className="h-2" />
										)}

										{download.error && (
											<div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
												{download.error}
											</div>
										)}
									</div>
								))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Download History */}
			{showHistory && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<HistoryIcon className="h-4 w-4" />
							Download History
						</CardTitle>
						<CardDescription>Previous downloads for this execution</CardDescription>
					</CardHeader>
					<CardContent>
						{downloadHistory.length > 0 ? (
							<div className="space-y-3">
								{downloadHistory.map((download) => (
									<div
										key={download.id}
										className="flex items-center justify-between p-3 border rounded-lg"
									>
										<div className="flex items-center gap-3">
											<FileIcon className="h-4 w-4" />
											<div>
												<p className="font-medium text-sm">{download.filename}</p>
												<p className="text-xs text-muted-foreground">
													{formatFileSize(download.size)} • Downloaded{' '}
													{format(new Date(download.downloadedAt!), 'PPp')}
												</p>
											</div>
											<StatusBadge status={download.status} />
										</div>

										<div className="flex items-center gap-1">
											{download.status === 'completed' && download.url && (
												<>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => window.open(download.url, '_blank')}
													>
														<ExternalLinkIcon className="h-4 w-4" />
													</Button>

													<Button
														variant="ghost"
														size="sm"
														onClick={() => copyDownloadLink(download)}
													>
														<CopyIcon className="h-4 w-4" />
													</Button>
												</>
											)}

											{download.status === 'failed' && (
												<Button
													variant="ghost"
													size="sm"
													onClick={() => retryDownload(download.id)}
												>
													<RefreshCwIcon className="h-4 w-4" />
												</Button>
											)}

											<Button variant="ghost" size="sm" onClick={() => removeDownload(download.id)}>
												<TrashIcon className="h-4 w-4" />
											</Button>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="text-center py-8">
								<FolderIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
								<p className="text-muted-foreground">No previous downloads</p>
							</div>
						)}
					</CardContent>
				</Card>
			)}
		</div>
	)
}
