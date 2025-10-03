'use client'

import { AlertSeverity, AlertStatus, AlertType } from '@/components/alerts/types/alert-types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { TagsInput } from '@/components/ui/tags-input'
import { cn } from '@/lib/utils'
import { Search, X } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'

import type { AlertFilters } from '@/components/alerts/types/filter-types'

interface AlertFiltersProps {
	/** Current filter values */
	filters: AlertFilters
	/** Callback when filters change */
	onFiltersChange: (filters: AlertFilters) => void
	/** Available filter options */
	availableFilters: any[]
	/** Reset callback */
	onReset: () => void
	/** Available sources for filtering */
	availableSources?: string[]
	/** Available tags for filtering */
	availableTags?: string[]
	/** Whether the filters are in a collapsed state */
	collapsed?: boolean
	/** Callback when collapse state changes */
	onCollapseChange?: (collapsed: boolean) => void
	/** Additional CSS classes */
	className?: string
}

/**
 * Comprehensive filtering interface for alerts with multiple criteria
 * Supports severity, type, status, source, date range, search, and tags filtering
 */
export function AlertFilters({
	filters,
	onFiltersChange,
	availableFilters,
	onReset,
	availableSources = [],
	availableTags = [],
	collapsed = false,
	onCollapseChange,
	className,
}: AlertFiltersProps) {
	const [localFilters, setLocalFilters] = useState<AlertFilters>(filters)
	const [searchValue, setSearchValue] = useState(filters.search || '')

	// Sync local filters with prop changes
	useEffect(() => {
		setLocalFilters(filters)
		setSearchValue(filters.search || '')
	}, [filters])

	// Debounced search handler
	useEffect(() => {
		const timer = setTimeout(() => {
			if (searchValue !== filters.search) {
				handleFilterChange('search', searchValue || undefined)
			}
		}, 300)

		return () => clearTimeout(timer)
	}, [searchValue, filters.search])

	const handleFilterChange = useCallback(
		(key: keyof AlertFilters, value: any) => {
			const newFilters = { ...localFilters, [key]: value }
			setLocalFilters(newFilters)
			onFiltersChange(newFilters)
		},
		[localFilters, onFiltersChange]
	)

	const handleMultiSelectChange = useCallback(
		(key: keyof AlertFilters, value: string, checked: boolean) => {
			const currentValues = (localFilters[key] as string[]) || []
			const newValues = checked
				? [...currentValues, value]
				: currentValues.filter((v) => v !== value)

			handleFilterChange(key, newValues.length > 0 ? newValues : undefined)
		},
		[localFilters, handleFilterChange]
	)

	const handleDateRangeChange = useCallback(
		(values: { range: { from: Date; to: Date | undefined } }) => {
			if (values.range.from && values.range.to) {
				handleFilterChange('dateRange', {
					start: values.range.from,
					end: values.range.to,
				})
			} else {
				handleFilterChange('dateRange', undefined)
			}
		},
		[handleFilterChange]
	)

	const clearAllFilters = useCallback(() => {
		const emptyFilters: AlertFilters = {}
		setLocalFilters(emptyFilters)
		setSearchValue('')
		onReset()
	}, [onReset])

	const hasActiveFilters = Object.values(localFilters).some(
		(value) =>
			value !== undefined && value !== null && (Array.isArray(value) ? value.length > 0 : true)
	)

	const MultiSelectFilter = ({
		label,
		options,
		filterKey,
		placeholder,
	}: {
		label: string
		options: { value: string; label: string }[]
		filterKey: keyof AlertFilters
		placeholder: string
	}) => {
		const selectedValues = (localFilters[filterKey] as string[]) || []

		return (
			<div className="space-y-2">
				<Label className="text-sm font-medium">{label}</Label>
				<Select
					value=""
					onValueChange={(value) => {
						const isSelected = selectedValues.includes(value)
						handleMultiSelectChange(filterKey, value, !isSelected)
					}}
				>
					<SelectTrigger className="w-full">
						<SelectValue
							placeholder={
								selectedValues.length > 0 ? `${selectedValues.length} selected` : placeholder
							}
						/>
					</SelectTrigger>
					<SelectContent>
						{options.map((option) => {
							const isSelected = selectedValues.includes(option.value)
							return (
								<SelectItem
									key={option.value}
									value={option.value}
									className={cn('flex items-center justify-between', isSelected && 'bg-accent')}
								>
									<span>{option.label}</span>
									{isSelected && <span className="ml-2">✓</span>}
								</SelectItem>
							)
						})}
					</SelectContent>
				</Select>
				{selectedValues.length > 0 && (
					<div className="flex flex-wrap gap-1">
						{selectedValues.map((value) => {
							const option = options.find((opt) => opt.value === value)
							return (
								<Button
									key={value}
									variant="secondary"
									size="sm"
									className="h-6 px-2 text-xs"
									onClick={() => handleMultiSelectChange(filterKey, value, false)}
								>
									{option?.label}
									<X className="ml-1 h-3 w-3" />
								</Button>
							)
						})}
					</div>
				)}
			</div>
		)
	}

	if (collapsed) {
		return (
			<div className={cn('flex items-center gap-2', className)}>
				<Button
					variant="outline"
					size="sm"
					onClick={() => onCollapseChange?.(false)}
					className="whitespace-nowrap"
				>
					Filters {hasActiveFilters && `(${Object.keys(localFilters).length})`}
				</Button>
				{hasActiveFilters && (
					<Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-8 px-2">
						Clear all
					</Button>
				)}
			</div>
		)
	}

	return (
		<Card className={cn('w-full', className)}>
			<CardHeader className="pb-4">
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg">Filters</CardTitle>
					<div className="flex items-center gap-2">
						{hasActiveFilters && (
							<Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-8 px-2">
								Clear all
							</Button>
						)}
						{onCollapseChange && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onCollapseChange(true)}
								className="h-8 px-2"
							>
								<X className="h-4 w-4" />
							</Button>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Search */}
				<div className="space-y-2">
					<Label htmlFor="search" className="text-sm font-medium">
						Search
					</Label>
					<div className="relative">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							id="search"
							placeholder="Search alerts by title or description..."
							value={searchValue}
							onChange={(e) => setSearchValue(e.target.value)}
							className="pl-9"
						/>
					</div>
				</div>

				{/* Date Range */}
				<div className="space-y-2">
					<Label className="text-sm font-medium">Date Range</Label>
					<DateRangePicker
						initialDateFrom={localFilters.dateRange?.start}
						initialDateTo={localFilters.dateRange?.end}
						onUpdate={handleDateRangeChange}
						align="start"
						showCompare={false}
					/>
				</div>

				{/* Severity Filter */}
				<MultiSelectFilter
					label="Severity"
					filterKey="severity"
					placeholder="Select severity levels"
					options={Object.values(AlertSeverity).map((severity) => ({
						value: severity,
						label: severity.charAt(0).toUpperCase() + severity.slice(1),
					}))}
				/>

				{/* Type Filter */}
				<MultiSelectFilter
					label="Type"
					filterKey="type"
					placeholder="Select alert types"
					options={Object.values(AlertType).map((type) => ({
						value: type,
						label: type.charAt(0).toUpperCase() + type.slice(1),
					}))}
				/>

				{/* Status Filter */}
				<MultiSelectFilter
					label="Status"
					filterKey="status"
					placeholder="Select status"
					options={Object.values(AlertStatus).map((status) => ({
						value: status,
						label: status.charAt(0).toUpperCase() + status.slice(1),
					}))}
				/>

				{/* Source Filter */}
				{availableSources.length > 0 && (
					<MultiSelectFilter
						label="Source"
						filterKey="source"
						placeholder="Select sources"
						options={availableSources.map((source) => ({
							value: source,
							label: source,
						}))}
					/>
				)}

				{/* Tags Filter */}
				<div className="space-y-2">
					<Label className="text-sm font-medium">Tags</Label>
					<TagsInput
						value={localFilters.tags || []}
						onValueChange={(tags) => handleFilterChange('tags', tags.length > 0 ? tags : undefined)}
						placeholder="Add tags to filter by..."
						maxItems={10}
					/>
					{availableTags.length > 0 && (
						<div className="flex flex-wrap gap-1 mt-2">
							<span className="text-xs text-muted-foreground">Suggestions:</span>
							{availableTags
								.filter((tag) => !(localFilters.tags || []).includes(tag))
								.slice(0, 5)
								.map((tag) => (
									<Button
										key={tag}
										variant="outline"
										size="sm"
										className="h-6 px-2 text-xs"
										onClick={() => {
											const currentTags = localFilters.tags || []
											handleFilterChange('tags', [...currentTags, tag])
										}}
									>
										{tag}
									</Button>
								))}
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	)
}
