import { Button } from '@/components/ui/button'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { X } from 'lucide-react'
import * as React from 'react'

import type { DestinationDeliveryStatus } from '@smedrec/audit-client'
import type { DateRange } from 'react-day-picker'

export interface DeliveryHistoryFilters {
	search?: string
	status?: DestinationDeliveryStatus
	destinationId?: string
	dateRange?: DateRange
}

interface DeliveryHistoryFiltersProps {
	filters: DeliveryHistoryFilters
	onFiltersChange: (filters: DeliveryHistoryFilters) => void
	availableDestinations?: Array<{ id: string; label: string }>
}

export function DeliveryHistoryFilters({
	filters,
	onFiltersChange,
	availableDestinations = [],
}: DeliveryHistoryFiltersProps) {
	const hasActiveFilters =
		filters.search || filters.status || filters.destinationId || filters.dateRange

	const handleClearFilters = () => {
		onFiltersChange({})
	}

	const handleSearchChange = (search: string) => {
		onFiltersChange({ ...filters, search: search || undefined })
	}

	const handleStatusChange = (status: string) => {
		onFiltersChange({
			...filters,
			status: status === 'all' ? undefined : (status as DestinationDeliveryStatus),
		})
	}

	const handleDestinationChange = (destinationId: string) => {
		onFiltersChange({
			...filters,
			destinationId: destinationId === 'all' ? undefined : destinationId,
		})
	}

	const handleDateRangeChange = (dateRange: DateRange | undefined) => {
		onFiltersChange({ ...filters, dateRange })
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-medium">Filters</h3>
				{hasActiveFilters && (
					<Button variant="ghost" size="sm" onClick={handleClearFilters}>
						<X className="mr-2 h-4 w-4" />
						Clear Filters
					</Button>
				)}
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{/* Search */}
				<div className="space-y-2">
					<Label htmlFor="search">Search</Label>
					<Input
						id="search"
						placeholder="Search by delivery ID..."
						value={filters.search || ''}
						onChange={(e) => handleSearchChange(e.target.value)}
					/>
				</div>

				{/* Status Filter */}
				<div className="space-y-2">
					<Label htmlFor="status">Status</Label>
					<Select value={filters.status || 'all'} onValueChange={handleStatusChange}>
						<SelectTrigger id="status">
							<SelectValue placeholder="All statuses" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Statuses</SelectItem>
							<SelectItem value="pending">Pending</SelectItem>
							<SelectItem value="delivered">Delivered</SelectItem>
							<SelectItem value="failed">Failed</SelectItem>
							<SelectItem value="retrying">Retrying</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Destination Filter */}
				<div className="space-y-2">
					<Label htmlFor="destination">Destination</Label>
					<Select value={filters.destinationId || 'all'} onValueChange={handleDestinationChange}>
						<SelectTrigger id="destination">
							<SelectValue placeholder="All destinations" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Destinations</SelectItem>
							{availableDestinations.map((dest) => (
								<SelectItem key={dest.id} value={dest.id}>
									{dest.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Date Range Filter */}
				<div className="space-y-2">
					<Label>Date Range</Label>
					<DateRangePicker
						initialDateFrom={filters.dateRange?.from}
						initialDateTo={filters.dateRange?.to}
						onUpdate={(values) => handleDateRangeChange(values.range)}
					/>
				</div>
			</div>
		</div>
	)
}
