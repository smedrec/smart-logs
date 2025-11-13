import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Cloud, Database, Download, Mail, Search, Server, Webhook, X } from 'lucide-react'
import * as React from 'react'

import type { DeliveryDestinationType } from '@smedrec/audit-client'

export interface DeliveryDestinationFilters {
	search?: string
	type?: DeliveryDestinationType
	status?: 'enabled' | 'disabled'
}

interface DeliveryDestinationsFiltersProps {
	filters: DeliveryDestinationFilters
	onFiltersChange: (filters: DeliveryDestinationFilters) => void
	className?: string
}

const destinationTypeOptions = [
	{ label: 'Email', value: 'email' as DeliveryDestinationType, icon: Mail },
	{ label: 'Webhook', value: 'webhook' as DeliveryDestinationType, icon: Webhook },
	{ label: 'Storage', value: 'storage' as DeliveryDestinationType, icon: Database },
	{ label: 'SFTP', value: 'sftp' as DeliveryDestinationType, icon: Server },
	{ label: 'Download', value: 'download' as DeliveryDestinationType, icon: Download },
]

export function DeliveryDestinationsFilters({
	filters,
	onFiltersChange,
	className,
}: DeliveryDestinationsFiltersProps) {
	const [searchValue, setSearchValue] = React.useState(filters.search || '')

	// Debounce search input
	React.useEffect(() => {
		const timer = setTimeout(() => {
			if (searchValue !== filters.search) {
				onFiltersChange({ ...filters, search: searchValue || undefined })
			}
		}, 300)

		return () => clearTimeout(timer)
	}, [searchValue])

	const handleTypeChange = (value: string) => {
		if (value === 'all') {
			onFiltersChange({ ...filters, type: undefined })
		} else {
			onFiltersChange({ ...filters, type: value as DeliveryDestinationType })
		}
	}

	const handleStatusChange = (value: string) => {
		if (value === 'all') {
			onFiltersChange({ ...filters, status: undefined })
		} else {
			onFiltersChange({ ...filters, status: value as 'enabled' | 'disabled' })
		}
	}

	const handleClearFilters = () => {
		setSearchValue('')
		onFiltersChange({})
	}

	const hasActiveFilters = filters.search || filters.type || filters.status

	return (
		<div className={className}>
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
					{/* Search */}
					<div className="relative flex-1 sm:max-w-sm">
						<Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
						<Input
							placeholder="Search destinations..."
							value={searchValue}
							onChange={(e) => setSearchValue(e.target.value)}
							className="pl-8"
							aria-label="Search delivery destinations"
						/>
					</div>

					{/* Type Filter */}
					<Select value={filters.type || 'all'} onValueChange={handleTypeChange}>
						<SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by destination type">
							<SelectValue placeholder="All Types" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Types</SelectItem>
							{destinationTypeOptions.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									<div className="flex items-center gap-2">
										<option.icon className="size-4" />
										{option.label}
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{/* Status Filter */}
					<Select value={filters.status || 'all'} onValueChange={handleStatusChange}>
						<SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by status">
							<SelectValue placeholder="All Statuses" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Statuses</SelectItem>
							<SelectItem value="enabled">Enabled</SelectItem>
							<SelectItem value="disabled">Disabled</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Clear Filters */}
				{hasActiveFilters && (
					<Button
						variant="ghost"
						onClick={handleClearFilters}
						className="w-full sm:w-auto"
						aria-label="Clear all filters"
					>
						<X className="mr-2 size-4" />
						Clear Filters
					</Button>
				)}
			</div>
		</div>
	)
}
