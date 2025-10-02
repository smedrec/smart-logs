/**
 * Export Button Component
 *
 * Quick export button with dropdown for different formats
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, Code, Download, FileText, Settings, Table } from 'lucide-react'
import { useCallback, useState } from 'react'

import { ExportManager } from './export-manager'

import type { ExportFormat, ExportOptions, ExportType } from './export-manager'

interface ExportButtonProps {
	type: ExportType
	data?: any[]
	onExport?: (options: ExportOptions) => Promise<void>
	availableColumns?: Array<{ key: string; label: string; description?: string }>
	defaultOptions?: Partial<ExportOptions>
	variant?: 'default' | 'outline' | 'ghost'
	size?: 'default' | 'sm' | 'lg'
	showAdvanced?: boolean
	disabled?: boolean
}

const formatOptions = [
	{
		value: 'csv' as ExportFormat,
		label: 'CSV',
		description: 'Comma-separated values',
		icon: Table,
		recommended: true,
	},
	{
		value: 'xlsx' as ExportFormat,
		label: 'Excel',
		description: 'Microsoft Excel format',
		icon: Table,
		recommended: true,
	},
	{
		value: 'json' as ExportFormat,
		label: 'JSON',
		description: 'JavaScript Object Notation',
		icon: Code,
		recommended: false,
	},
	{
		value: 'pdf' as ExportFormat,
		label: 'PDF',
		description: 'Portable Document Format',
		icon: FileText,
		recommended: false,
	},
]

export function ExportButton({
	type,
	data = [],
	onExport,
	availableColumns = [],
	defaultOptions = {},
	variant = 'outline',
	size = 'default',
	showAdvanced = true,
	disabled = false,
}: ExportButtonProps) {
	const [showAdvancedDialog, setShowAdvancedDialog] = useState(false)
	const [isExporting, setIsExporting] = useState(false)

	const handleQuickExport = useCallback(
		async (format: ExportFormat) => {
			if (!onExport) return

			setIsExporting(true)
			try {
				const options: ExportOptions = {
					format,
					includeHeaders: true,
					includeMetadata: false,
					columns: availableColumns.map((col) => col.key),
					...defaultOptions,
				}
				await onExport(options)
			} catch (error) {
				console.error('Quick export failed:', error)
			} finally {
				setIsExporting(false)
			}
		},
		[onExport, availableColumns, defaultOptions]
	)

	const getTypeLabel = (type: ExportType) => {
		switch (type) {
			case 'reports':
				return 'Reports'
			case 'executions':
				return 'Executions'
			case 'templates':
				return 'Templates'
			case 'custom':
				return 'Data'
			default:
				return 'Data'
		}
	}

	const recommendedFormats = formatOptions.filter((f) => f.recommended)
	const otherFormats = formatOptions.filter((f) => !f.recommended)

	if (data.length === 0) {
		return (
			<Button variant={variant} size={size} disabled>
				<Download className="h-4 w-4 mr-2" />
				No Data to Export
			</Button>
		)
	}

	return (
		<div className="flex items-center gap-1">
			{/* Quick Export Dropdown */}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant={variant} size={size} disabled={disabled || isExporting}>
						{isExporting ? (
							<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
						) : (
							<Download className="h-4 w-4 mr-2" />
						)}
						Export
						<ChevronDown className="h-4 w-4 ml-1" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56">
					<DropdownMenuLabel className="flex items-center justify-between">
						Quick Export
						<Badge variant="outline" className="text-xs">
							{data.length} records
						</Badge>
					</DropdownMenuLabel>
					<DropdownMenuSeparator />

					{recommendedFormats.map((format) => (
						<DropdownMenuItem
							key={format.value}
							onClick={() => handleQuickExport(format.value)}
							className="flex items-center gap-2"
							disabled={isExporting}
						>
							<format.icon className="h-4 w-4" />
							<div className="flex-1">
								<div className="font-medium">{format.label}</div>
								<div className="text-xs text-muted-foreground">{format.description}</div>
							</div>
							<Badge variant="secondary" className="text-xs">
								Recommended
							</Badge>
						</DropdownMenuItem>
					))}

					{otherFormats.length > 0 && (
						<>
							<DropdownMenuSeparator />
							{otherFormats.map((format) => (
								<DropdownMenuItem
									key={format.value}
									onClick={() => handleQuickExport(format.value)}
									className="flex items-center gap-2"
									disabled={isExporting}
								>
									<format.icon className="h-4 w-4" />
									<div className="flex-1">
										<div className="font-medium">{format.label}</div>
										<div className="text-xs text-muted-foreground">{format.description}</div>
									</div>
								</DropdownMenuItem>
							))}
						</>
					)}

					{showAdvanced && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => setShowAdvancedDialog(true)}
								className="flex items-center gap-2"
							>
								<Settings className="h-4 w-4" />
								<div>
									<div className="font-medium">Advanced Export</div>
									<div className="text-xs text-muted-foreground">Configure columns and options</div>
								</div>
							</DropdownMenuItem>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Advanced Export Dialog */}
			{showAdvanced && (
				<Dialog open={showAdvancedDialog} onOpenChange={setShowAdvancedDialog}>
					<DialogContent className="max-w-6xl max-h-[90vh]">
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<Settings className="h-5 w-5" />
								Advanced Export - {getTypeLabel(type)}
							</DialogTitle>
							<DialogDescription>
								Configure detailed export options and manage export jobs
							</DialogDescription>
						</DialogHeader>

						<ExportManager
							type={type}
							data={data}
							onExport={onExport}
							availableColumns={availableColumns}
							defaultOptions={defaultOptions}
						/>
					</DialogContent>
				</Dialog>
			)}
		</div>
	)
}
