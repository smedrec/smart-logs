/**
 * Virtual Table Component
 *
 * High-performance table with virtual scrolling for large datasets
 */

import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface VirtualTableColumn<T = any> {
	key: string
	header: string
	width?: number
	minWidth?: number
	maxWidth?: number
	render?: (item: T, index: number) => React.ReactNode
	sortable?: boolean
	className?: string
	headerClassName?: string
}

export interface VirtualTableProps<T = any> {
	data: T[]
	columns: VirtualTableColumn<T>[]
	height?: number
	itemHeight?: number
	overscan?: number
	loading?: boolean
	loadingRows?: number
	onRowClick?: (item: T, index: number) => void
	onSort?: (column: string, direction: 'asc' | 'desc') => void
	sortColumn?: string
	sortDirection?: 'asc' | 'desc'
	className?: string
	emptyMessage?: string
	stickyHeader?: boolean
}

function VirtualTableSkeleton({
	rows = 10,
	columns,
}: {
	rows?: number
	columns: VirtualTableColumn[]
}) {
	return (
		<div className="space-y-2">
			{Array.from({ length: rows }).map((_, index) => (
				<div key={index} className="flex gap-4">
					{columns.map((column) => (
						<Skeleton
							key={column.key}
							className="h-8"
							style={{
								width: column.width || 150,
								minWidth: column.minWidth || 100,
								maxWidth: column.maxWidth || 300,
							}}
						/>
					))}
				</div>
			))}
		</div>
	)
}

export function VirtualTable<T = any>({
	data,
	columns,
	height = 400,
	itemHeight = 52,
	overscan = 5,
	loading = false,
	loadingRows = 10,
	onRowClick,
	onSort,
	sortColumn,
	sortDirection,
	className,
	emptyMessage = 'No data available',
	stickyHeader = true,
}: VirtualTableProps<T>) {
	const parentRef = useRef<HTMLDivElement>(null)

	// Calculate total width for horizontal scrolling
	const totalWidth = useMemo(() => {
		return columns.reduce((sum, column) => sum + (column.width || 150), 0)
	}, [columns])

	// Simple virtual scrolling implementation
	const [scrollTop, setScrollTop] = useState(0)

	const visibleRange = useMemo(() => {
		const containerHeight = height
		const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
		const endIndex = Math.min(
			data.length - 1,
			Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
		)
		return { startIndex, endIndex }
	}, [scrollTop, itemHeight, height, data.length, overscan])

	const visibleItems = useMemo(() => {
		return data.slice(visibleRange.startIndex, visibleRange.endIndex + 1).map((item, index) => ({
			item,
			index: visibleRange.startIndex + index,
			key: `${visibleRange.startIndex + index}`,
			start: (visibleRange.startIndex + index) * itemHeight,
			size: itemHeight,
		}))
	}, [data, visibleRange, itemHeight])

	const totalSize = data.length * itemHeight

	const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
		setScrollTop(event.currentTarget.scrollTop)
	}, [])

	const handleSort = useCallback(
		(column: VirtualTableColumn<T>) => {
			if (!column.sortable || !onSort) return

			const newDirection = sortColumn === column.key && sortDirection === 'asc' ? 'desc' : 'asc'
			onSort(column.key, newDirection)
		},
		[sortColumn, sortDirection, onSort]
	)

	const getSortIcon = useCallback(
		(column: VirtualTableColumn<T>) => {
			if (!column.sortable) return null

			if (sortColumn !== column.key) {
				return <span className="text-muted-foreground">↕</span>
			}

			return sortDirection === 'asc' ? '↑' : '↓'
		},
		[sortColumn, sortDirection]
	)

	const renderCell = useCallback((item: T, column: VirtualTableColumn<T>, index: number) => {
		if (column.render) {
			return column.render(item, index)
		}

		const value = (item as any)[column.key]
		return value?.toString() || ''
	}, [])

	if (loading) {
		return (
			<div className={cn('border rounded-lg', className)}>
				<div className="p-4">
					<VirtualTableSkeleton rows={loadingRows} columns={columns} />
				</div>
			</div>
		)
	}

	if (data.length === 0) {
		return (
			<div className={cn('border rounded-lg', className)}>
				<div className="p-8 text-center text-muted-foreground">{emptyMessage}</div>
			</div>
		)
	}

	return (
		<div className={cn('border rounded-lg overflow-hidden', className)}>
			{/* Header */}
			{stickyHeader && (
				<div className="border-b bg-muted/50">
					<div className="flex" style={{ minWidth: totalWidth }}>
						{columns.map((column) => (
							<div
								key={column.key}
								className={cn(
									'px-4 py-3 text-left text-sm font-medium text-muted-foreground border-r last:border-r-0',
									column.sortable && 'cursor-pointer hover:bg-muted/80 select-none',
									column.headerClassName
								)}
								style={{
									width: column.width || 150,
									minWidth: column.minWidth || 100,
									maxWidth: column.maxWidth || 300,
								}}
								onClick={() => handleSort(column)}
							>
								<div className="flex items-center justify-between">
									<span>{column.header}</span>
									{getSortIcon(column)}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Virtual scrolling container */}
			<div ref={parentRef} className="overflow-auto" style={{ height }} onScroll={handleScroll}>
				<div
					style={{
						height: `${totalSize}px`,
						width: '100%',
						position: 'relative',
						minWidth: totalWidth,
					}}
				>
					{visibleItems.map((virtualItem) => {
						return (
							<div
								key={virtualItem.key}
								className={cn(
									'absolute top-0 left-0 w-full border-b hover:bg-muted/50 transition-colors',
									onRowClick && 'cursor-pointer'
								)}
								style={{
									height: `${virtualItem.size}px`,
									transform: `translateY(${virtualItem.start}px)`,
								}}
								onClick={() => onRowClick?.(virtualItem.item, virtualItem.index)}
							>
								<div className="flex h-full items-center">
									{columns.map((column) => (
										<div
											key={column.key}
											className={cn(
												'px-4 py-2 text-sm border-r last:border-r-0 flex items-center',
												column.className
											)}
											style={{
												width: column.width || 150,
												minWidth: column.minWidth || 100,
												maxWidth: column.maxWidth || 300,
											}}
										>
											{renderCell(virtualItem.item, column, virtualItem.index)}
										</div>
									))}
								</div>
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}

// Hook for managing virtual table state
export function useVirtualTable<T = any>({
	data,
	pageSize = 50,
	sortable = true,
}: {
	data: T[]
	pageSize?: number
	sortable?: boolean
}) {
	const [sortColumn, setSortColumn] = useState<string>()
	const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
	const [page, setPage] = useState(0)

	// Sort data
	const sortedData = useMemo(() => {
		if (!sortColumn || !sortable) return data

		return [...data].sort((a, b) => {
			const aValue = (a as any)[sortColumn]
			const bValue = (b as any)[sortColumn]

			if (aValue === bValue) return 0

			const comparison = aValue < bValue ? -1 : 1
			return sortDirection === 'asc' ? comparison : -comparison
		})
	}, [data, sortColumn, sortDirection, sortable])

	// Paginate data
	const paginatedData = useMemo(() => {
		const start = page * pageSize
		const end = start + pageSize
		return sortedData.slice(start, end)
	}, [sortedData, page, pageSize])

	const handleSort = useCallback((column: string, direction: 'asc' | 'desc') => {
		setSortColumn(column)
		setSortDirection(direction)
		setPage(0) // Reset to first page when sorting
	}, [])

	const totalPages = Math.ceil(sortedData.length / pageSize)
	const hasNextPage = page < totalPages - 1
	const hasPreviousPage = page > 0

	return {
		data: paginatedData,
		sortColumn,
		sortDirection,
		page,
		totalPages,
		hasNextPage,
		hasPreviousPage,
		handleSort,
		setPage,
		totalItems: sortedData.length,
	}
}
