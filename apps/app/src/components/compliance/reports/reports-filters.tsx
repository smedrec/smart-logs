import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import {
	Calendar as CalendarIcon,
	Check,
	CheckCircle,
	FileText,
	Filter,
	Search,
	Shield,
	X,
	XCircle,
} from 'lucide-react'
import * as React from 'react'

import type { ReportFilters, ReportType } from '../types'

interface ReportsFiltersProps {
	filters: ReportFilters
	onFiltersChange: (filters: ReportFilters) => void
	className?: string
}

// Filter options
const reportTypeOptions = [
	{
		label: 'HIPAA Audit Trail',
		value: 'HIPAA_AUDIT_TRAIL' as ReportType,
		icon: Shield,
	},
	{
		label: 'GDPR Processing Activities',
		value: 'GDPR_PROCESSING_ACTIVITIES' as ReportType,
		icon: FileText,
	},
	{
		label: 'Integrity Verification',
		value: 'INTEGRITY_VERIFICATION' as ReportType,
		icon: CheckCircle,
	},
]

const statusOptions = [
	{
		label: 'Enabled',
		value: 'enabled' as const,
		icon: CheckCircle,
	},
	{
		label: 'Disabled',
		value: 'disabled' as const,
		icon: XCircle,
	},
]

export function ReportsFilters({ filters, onFiltersChange, className }: ReportsFiltersProps) {
	const [searchValue, setSearchValue] = React.useState(filters.search || '')
	const [dateRangeOpen, setDateRangeOpen] = React.useState(false)

	// Debounced search
	React.useEffect(() => {
		const timer = setTimeout(() => {
			onFiltersChange({
				...filters,
				search: searchValue || undefined,
			})
		}, 300)

		return () => clearTimeout(timer)
	}, [searchValue, filters, onFiltersChange])

	const handleReportTypeToggle = (reportType: ReportType) => {
		const currentTypes = filters.reportType || []
		const newTypes = currentTypes.includes(reportType)
			? currentTypes.filter((type) => type !== reportType)
			: [...currentTypes, reportType]

		onFiltersChange({
			...filters,
			reportType: newTypes.length > 0 ? newTypes : undefined,
		})
	}

	const handleStatusToggle = (status: 'enabled' | 'disabled') => {
		const currentStatuses = filters.status || []
		const newStatuses = currentStatuses.includes(status)
			? currentStatuses.filter((s) => s !== status)
			: [...currentStatuses, status]

		onFiltersChange({
			...filters,
			status: newStatuses.length > 0 ? newStatuses : undefined,
		})
	}

	const handleDateRangeChange = (range: { startDate?: string; endDate?: string } | undefined) => {
		onFiltersChange({
			...filters,
			dateRange: range,
		})
	}

	const clearAllFilters = () => {
		setSearchValue('')
		onFiltersChange({})
	}

	const hasActiveFilters = Boolean(
		filters.search ||
			filters.reportType?.length ||
			filters.status?.length ||
			filters.dateRange ||
			filters.createdBy?.length ||
			filters.tags?.length
	)

	const activeFilterCount = [
		filters.reportType?.length || 0,
		filters.status?.length || 0,
		filters.dateRange ? 1 : 0,
		filters.createdBy?.length || 0,
		filters.tags?.length || 0,
	].reduce((sum, count) => sum + count, 0)

	return (
		<div className={cn('space-y-4', className)}>
			{/* Search and primary filters */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				{/* Search */}
				<div className="relative flex-1 max-w-sm">
					<Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
					<Input
						placeholder="Search reports by name or description..."
						value={searchValue}
						onChange={(e) => setSearchValue(e.target.value)}
						className="pl-9"
					/>
				</div>

				{/* Filter actions */}
				<div className="flex items-center gap-2">
					{hasActiveFilters && (
						<Button
							variant="ghost"
							size="sm"
							onClick={clearAllFilters}
							className="h-8 px-2 lg:px-3"
						>
							Clear filters
							<X className="ml-2 size-4" />
						</Button>
					)}
					<Badge variant="secondary" className="hidden sm:inline-flex">
						{activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''}
					</Badge>
				</div>
			</div>

			{/* Filter controls */}
			<div className="flex flex-wrap items-center gap-2">
				{/* Report Type Filter */}
				<Popover>
					<PopoverTrigger asChild>
						<Button variant="outline" size="sm" className="h-8 border-dashed">
							<Filter className="mr-2 size-4" />
							Report Type
							{filters.reportType && filters.reportType.length > 0 && (
								<>
									<Separator orientation="vertical" className="mx-2 h-4" />
									<Badge variant="secondary" className="rounded-sm px-1 font-normal">
										{filters.reportType.length}
									</Badge>
								</>
							)}
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-[200px] p-0" align="start">
						<Command>
							<CommandInput placeholder="Search types..." />
							<CommandList>
								<CommandEmpty>No types found.</CommandEmpty>
								<CommandGroup>
									{reportTypeOptions.map((option) => {
										const isSelected = filters.reportType?.includes(option.value) || false
										return (
											<CommandItem
												key={option.value}
												onSelect={() => handleReportTypeToggle(option.value)}
											>
												<div
													className={cn(
														'flex size-4 items-center justify-center rounded-sm border border-primary',
														isSelected
															? 'bg-primary text-primary-foreground'
															: 'opacity-50 [&_svg]:invisible'
													)}
												>
													<Check className="size-4" />
												</div>
												<option.icon className="text-muted-foreground ml-2 size-4" />
												<span>{option.label}</span>
											</CommandItem>
										)
									})}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>

				{/* Status Filter */}
				<Popover>
					<PopoverTrigger asChild>
						<Button variant="outline" size="sm" className="h-8 border-dashed">
							<Filter className="mr-2 size-4" />
							Status
							{filters.status && filters.status.length > 0 && (
								<>
									<Separator orientation="vertical" className="mx-2 h-4" />
									<Badge variant="secondary" className="rounded-sm px-1 font-normal">
										{filters.status.length}
									</Badge>
								</>
							)}
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-[150px] p-0" align="start">
						<Command>
							<CommandList>
								<CommandGroup>
									{statusOptions.map((option) => {
										const isSelected = filters.status?.includes(option.value) || false
										return (
											<CommandItem
												key={option.value}
												onSelect={() => handleStatusToggle(option.value)}
											>
												<div
													className={cn(
														'flex size-4 items-center justify-center rounded-sm border border-primary',
														isSelected
															? 'bg-primary text-primary-foreground'
															: 'opacity-50 [&_svg]:invisible'
													)}
												>
													<Check className="size-4" />
												</div>
												<option.icon className="text-muted-foreground ml-2 size-4" />
												<span>{option.label}</span>
											</CommandItem>
										)
									})}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>

				{/* Date Range Filter */}
				<Popover open={dateRangeOpen} onOpenChange={setDateRangeOpen}>
					<PopoverTrigger asChild>
						<Button variant="outline" size="sm" className="h-8 border-dashed">
							<CalendarIcon className="mr-2 size-4" />
							Created Date
							{filters.dateRange && (
								<>
									<Separator orientation="vertical" className="mx-2 h-4" />
									<Badge variant="secondary" className="rounded-sm px-1 font-normal">
										Range
									</Badge>
								</>
							)}
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-auto p-0" align="start">
						<div className="p-4 space-y-4">
							<div className="space-y-2">
								<Label htmlFor="start-date">Start Date</Label>
								<div className="flex items-center gap-2">
									<Input
										id="start-date"
										type="date"
										value={filters.dateRange?.startDate || ''}
										onChange={(e) =>
											handleDateRangeChange({
												...filters.dateRange,
												startDate: e.target.value || undefined,
											})
										}
										className="w-full"
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="end-date">End Date</Label>
								<div className="flex items-center gap-2">
									<Input
										id="end-date"
										type="date"
										value={filters.dateRange?.endDate || ''}
										onChange={(e) =>
											handleDateRangeChange({
												...filters.dateRange,
												endDate: e.target.value || undefined,
											})
										}
										className="w-full"
									/>
								</div>
							</div>
							<div className="flex justify-between">
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										handleDateRangeChange(undefined)
										setDateRangeOpen(false)
									}}
								>
									Clear
								</Button>
								<Button size="sm" onClick={() => setDateRangeOpen(false)}>
									Apply
								</Button>
							</div>
						</div>
					</PopoverContent>
				</Popover>
			</div>

			{/* Active filters display */}
			{hasActiveFilters && (
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-muted-foreground text-sm">Active filters:</span>

					{filters.reportType?.map((type) => {
						const option = reportTypeOptions.find((opt) => opt.value === type)
						return (
							<Badge key={type} variant="secondary" className="gap-1">
								{option?.label || type}
								<Button
									variant="ghost"
									size="sm"
									className="h-auto p-0 text-muted-foreground hover:text-foreground"
									onClick={() => handleReportTypeToggle(type)}
								>
									<X className="size-3" />
								</Button>
							</Badge>
						)
					})}

					{filters.status?.map((status) => {
						const option = statusOptions.find((opt) => opt.value === status)
						return (
							<Badge key={status} variant="secondary" className="gap-1">
								{option?.label || status}
								<Button
									variant="ghost"
									size="sm"
									className="h-auto p-0 text-muted-foreground hover:text-foreground"
									onClick={() => handleStatusToggle(status)}
								>
									<X className="size-3" />
								</Button>
							</Badge>
						)
					})}

					{filters.dateRange && (
						<Badge variant="secondary" className="gap-1">
							{filters.dateRange.startDate && filters.dateRange.endDate
								? `${format(new Date(filters.dateRange.startDate), 'MMM dd')} - ${format(new Date(filters.dateRange.endDate), 'MMM dd')}`
								: filters.dateRange.startDate
									? `From ${format(new Date(filters.dateRange.startDate), 'MMM dd')}`
									: filters.dateRange.endDate
										? `Until ${format(new Date(filters.dateRange.endDate), 'MMM dd')}`
										: 'Date range'}
							<Button
								variant="ghost"
								size="sm"
								className="h-auto p-0 text-muted-foreground hover:text-foreground"
								onClick={() => handleDateRangeChange(undefined)}
							>
								<X className="size-3" />
							</Button>
						</Badge>
					)}
				</div>
			)}
		</div>
	)
}
