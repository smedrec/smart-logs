import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import {
	Calendar,
	CheckCircle,
	ChevronDown,
	ChevronRight,
	Clock,
	FileText,
	MoreHorizontal,
	Play,
	Settings,
	Shield,
	XCircle,
} from 'lucide-react'
import * as React from 'react'

import type { ReportType, ScheduledReportUI } from '../types'

interface ReportCardProps {
	report: ScheduledReportUI
	isSelected?: boolean
	onSelectionChange?: (selected: boolean) => void
	onEdit?: () => void
	onExecute?: () => void
	onView?: () => void
	onDelete?: () => void
	showSelection?: boolean
	className?: string
}

// Report type configurations
const reportTypeConfigs = {
	HIPAA_AUDIT_TRAIL: {
		label: 'HIPAA Audit Trail',
		icon: Shield,
		color: 'text-blue-600',
		bgColor: 'bg-blue-50',
	},
	GDPR_PROCESSING_ACTIVITIES: {
		label: 'GDPR Processing Activities',
		icon: FileText,
		color: 'text-green-600',
		bgColor: 'bg-green-50',
	},
	INTEGRITY_VERIFICATION: {
		label: 'Integrity Verification',
		icon: CheckCircle,
		color: 'text-purple-600',
		bgColor: 'bg-purple-50',
	},
} as const

// Execution status configurations
const statusConfigs = {
	completed: {
		label: 'Completed',
		variant: 'default' as const,
		icon: CheckCircle,
		color: 'text-green-600',
	},
	failed: {
		label: 'Failed',
		variant: 'destructive' as const,
		icon: XCircle,
		color: 'text-red-600',
	},
	running: {
		label: 'Running',
		variant: 'secondary' as const,
		icon: Play,
		color: 'text-blue-600',
	},
	pending: {
		label: 'Pending',
		variant: 'outline' as const,
		icon: Clock,
		color: 'text-yellow-600',
	},
	cancelled: {
		label: 'Cancelled',
		variant: 'secondary' as const,
		icon: XCircle,
		color: 'text-gray-600',
	},
	timeout: {
		label: 'Timeout',
		variant: 'destructive' as const,
		icon: XCircle,
		color: 'text-red-600',
	},
}

export function ReportCard({
	report,
	isSelected = false,
	onSelectionChange,
	onEdit,
	onExecute,
	onView,
	onDelete,
	showSelection = false,
	className,
}: ReportCardProps) {
	const [isExpanded, setIsExpanded] = React.useState(false)

	const reportTypeConfig = reportTypeConfigs[report.reportType as keyof typeof reportTypeConfigs]
	const statusConfig = report.lastExecutionStatus
		? statusConfigs[report.lastExecutionStatus as keyof typeof statusConfigs]
		: null

	const TypeIcon = reportTypeConfig?.icon || FileText
	const StatusIcon = statusConfig?.icon || Clock

	return (
		<Card
			className={cn('transition-all duration-200', isSelected && 'ring-2 ring-primary', className)}
		>
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between gap-3">
					{/* Selection and Type */}
					<div className="flex items-start gap-3 flex-1 min-w-0">
						{showSelection && (
							<Checkbox
								checked={isSelected}
								onCheckedChange={onSelectionChange}
								className="mt-1"
								aria-label={`Select ${report.name}`}
							/>
						)}

						{/* Report Type Icon */}
						<div className={cn('p-2 rounded-lg', reportTypeConfig?.bgColor || 'bg-gray-50')}>
							<TypeIcon className={cn('size-5', reportTypeConfig?.color || 'text-gray-600')} />
						</div>

						{/* Report Info */}
						<div className="flex-1 min-w-0">
							<div className="flex items-start justify-between gap-2">
								<div className="min-w-0 flex-1">
									<h3 className="font-semibold text-base leading-tight truncate">{report.name}</h3>
									{report.description && (
										<p className="text-muted-foreground text-sm mt-1 line-clamp-2">
											{report.description}
										</p>
									)}
								</div>

								{/* Status Badge */}
								<Badge variant={report.enabled ? 'default' : 'secondary'} className="shrink-0">
									{report.enabled ? 'Enabled' : 'Disabled'}
								</Badge>
							</div>

							{/* Report Type */}
							<div className="flex items-center gap-2 mt-2">
								<Badge variant="outline" className="text-xs">
									{reportTypeConfig?.label || report.reportType}
								</Badge>
							</div>
						</div>
					</div>

					{/* Actions Menu */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
								<span className="sr-only">Open menu</span>
								<MoreHorizontal className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={onView}>
								<FileText className="mr-2 size-4" />
								View Details
							</DropdownMenuItem>
							<DropdownMenuItem onClick={onEdit}>
								<Settings className="mr-2 size-4" />
								Edit Report
							</DropdownMenuItem>
							<DropdownMenuItem onClick={onExecute} disabled={!report.enabled}>
								<Play className="mr-2 size-4" />
								Execute Now
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={onDelete}
								className="text-destructive focus:text-destructive"
							>
								<XCircle className="mr-2 size-4" />
								Delete Report
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</CardHeader>

			<CardContent className="pt-0">
				{/* Quick Info */}
				<div className="grid grid-cols-2 gap-4 mb-4">
					{/* Schedule */}
					<div className="space-y-1">
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Clock className="size-4" />
							<span>Schedule</span>
						</div>
						<p className="text-sm font-medium">
							{report.schedule?.cronExpression || 'Manual only'}
						</p>
					</div>

					{/* Next Execution */}
					<div className="space-y-1">
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Calendar className="size-4" />
							<span>Next Run</span>
						</div>
						<p className="text-sm font-medium">
							{report.nextExecution
								? format(new Date(report.nextExecution), 'MMM dd, HH:mm')
								: 'Manual only'}
						</p>
					</div>
				</div>

				{/* Last Execution Status */}
				{statusConfig && (
					<div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 mb-4">
						<div className="flex items-center gap-2">
							<StatusIcon className={cn('size-4', statusConfig.color)} />
							<span className="text-sm font-medium">Last execution:</span>
							<Badge variant={statusConfig.variant} className="text-xs">
								{statusConfig.label}
							</Badge>
						</div>
					</div>
				)}

				{/* Expandable Details */}
				<Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
					<CollapsibleTrigger asChild>
						<Button variant="ghost" size="sm" className="w-full justify-between p-0 h-auto">
							<span className="text-sm font-medium">
								{isExpanded ? 'Hide Details' : 'Show Details'}
							</span>
							{isExpanded ? (
								<ChevronDown className="size-4" />
							) : (
								<ChevronRight className="size-4" />
							)}
						</Button>
					</CollapsibleTrigger>
					<CollapsibleContent className="space-y-4 mt-4">
						<Separator />

						{/* Detailed Information */}
						<div className="space-y-3">
							{/* Created Date */}
							<div className="flex justify-between items-center">
								<span className="text-sm text-muted-foreground">Created:</span>
								<span className="text-sm font-medium">
									{format(new Date(report.createdAt), 'MMM dd, yyyy')}
								</span>
							</div>

							{/* Updated Date */}
							{report.updatedAt && (
								<div className="flex justify-between items-center">
									<span className="text-sm text-muted-foreground">Updated:</span>
									<span className="text-sm font-medium">
										{format(new Date(report.updatedAt), 'MMM dd, yyyy')}
									</span>
								</div>
							)}

							{/* Schedule Details */}
							{report.schedule && (
								<div className="space-y-2">
									<span className="text-sm text-muted-foreground">Schedule Details:</span>
									<div className="bg-muted/30 p-2 rounded text-xs font-mono">
										{report.schedule.cronExpression}
									</div>
									{report.schedule.timezone && (
										<div className="flex justify-between items-center">
											<span className="text-sm text-muted-foreground">Timezone:</span>
											<span className="text-sm font-medium">{report.schedule.timezone}</span>
										</div>
									)}
								</div>
							)}

							{/* Report Format */}
							<div className="flex justify-between items-center">
								<span className="text-sm text-muted-foreground">Format:</span>
								<Badge variant="outline" className="text-xs uppercase">
									{report.format}
								</Badge>
							</div>
						</div>

						{/* Action Buttons */}
						<div className="flex gap-2 pt-2">
							<Button variant="outline" size="sm" onClick={onView} className="flex-1">
								<FileText className="mr-2 size-4" />
								View
							</Button>
							<Button variant="outline" size="sm" onClick={onEdit} className="flex-1">
								<Settings className="mr-2 size-4" />
								Edit
							</Button>
							<Button
								variant="default"
								size="sm"
								onClick={onExecute}
								disabled={!report.enabled}
								className="flex-1"
							>
								<Play className="mr-2 size-4" />
								Execute
							</Button>
						</div>
					</CollapsibleContent>
				</Collapsible>
			</CardContent>
		</Card>
	)
}

/**
 * Grid layout for report cards with responsive design
 */
interface ReportCardsGridProps {
	reports: ScheduledReportUI[]
	selectedIds?: string[]
	onSelectionChange?: (reportId: string, selected: boolean) => void
	onReportEdit?: (reportId: string) => void
	onReportExecute?: (reportId: string) => void
	onReportView?: (reportId: string) => void
	onReportDelete?: (reportId: string) => void
	showSelection?: boolean
	loading?: boolean
	className?: string
}

export function ReportCardsGrid({
	reports,
	selectedIds = [],
	onSelectionChange,
	onReportEdit,
	onReportExecute,
	onReportView,
	onReportDelete,
	showSelection = false,
	loading = false,
	className,
}: ReportCardsGridProps) {
	if (loading) {
		return (
			<div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
				{Array.from({ length: 6 }).map((_, i) => (
					<Card key={i} className="animate-pulse">
						<CardHeader>
							<div className="flex items-start gap-3">
								<div className="w-10 h-10 bg-muted rounded-lg" />
								<div className="flex-1 space-y-2">
									<div className="h-4 bg-muted rounded w-3/4" />
									<div className="h-3 bg-muted rounded w-1/2" />
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								<div className="grid grid-cols-2 gap-4">
									<div className="h-3 bg-muted rounded" />
									<div className="h-3 bg-muted rounded" />
								</div>
								<div className="h-8 bg-muted rounded" />
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		)
	}

	if (reports.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-center">
				<FileText className="size-12 text-muted-foreground mb-4" />
				<h3 className="text-lg font-semibold mb-2">No reports found</h3>
				<p className="text-muted-foreground max-w-sm">
					Create your first compliance report to get started with automated reporting.
				</p>
			</div>
		)
	}

	return (
		<div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
			{reports.map((report) => (
				<ReportCard
					key={report.id}
					report={report}
					isSelected={selectedIds.includes(report.id)}
					onSelectionChange={(selected) => onSelectionChange?.(report.id, selected)}
					onEdit={() => onReportEdit?.(report.id)}
					onExecute={() => onReportExecute?.(report.id)}
					onView={() => onReportView?.(report.id)}
					onDelete={() => onReportDelete?.(report.id)}
					showSelection={showSelection}
				/>
			))}
		</div>
	)
}
