'use client'

import { Button } from '@/components/ui/button'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import * as React from 'react'

import type { Table } from '@tanstack/react-table'

export interface AlertPaginationProps<TData> {
	/** TanStack Table instance */
	table: Table<TData> | null
	/** Enable URL state management */
	enableUrlState?: boolean
	/** Custom page size options */
	pageSizeOptions?: number[]
	/** Show page size selector */
	showPageSizeSelector?: boolean
	/** Show page info */
	showPageInfo?: boolean
	/** Show row selection info */
	showRowSelection?: boolean
	/** Show navigation buttons */
	showNavigation?: boolean
	/** Show first/last page buttons */
	showFirstLastButtons?: boolean
	/** Additional CSS classes */
	className?: string
	/** Custom labels */
	labels?: {
		rowsPerPage?: string
		page?: string
		of?: string
		selected?: string
		rows?: string
		goToFirstPage?: string
		goToPreviousPage?: string
		goToNextPage?: string
		goToLastPage?: string
	}
}

/**
 * Server-side pagination component with page size controls and URL state management
 * Provides pagination info display and navigation controls for alert data tables
 */
export function AlertPagination<TData>({
	table,
	enableUrlState = true,
	pageSizeOptions = [10, 20, 25, 30, 40, 50, 100],
	showPageSizeSelector = true,
	showPageInfo = true,
	showRowSelection = true,
	showNavigation = true,
	showFirstLastButtons = true,
	className,
	labels = {
		rowsPerPage: 'Rows per page',
		page: 'Page',
		of: 'of',
		selected: 'selected',
		rows: 'row(s)',
		goToFirstPage: 'Go to first page',
		goToPreviousPage: 'Go to previous page',
		goToNextPage: 'Go to next page',
		goToLastPage: 'Go to last page',
	},
}: AlertPaginationProps<TData>) {
	const navigate = useNavigate()
	const searchParams = useSearch({ strict: false })

	// Track if we're initializing from URL to prevent circular updates
	const [isInitialized, setIsInitialized] = React.useState(false)
	const [isUpdatingUrl, setIsUpdatingUrl] = React.useState(false)

	// Handle null table
	if (!table) {
		return (
			<div className={cn('flex items-center justify-between px-2', className)}>
				<div className="flex-1 text-sm text-muted-foreground">Loading pagination...</div>
				<div className="flex items-center space-x-6 lg:space-x-8">
					<div className="flex items-center space-x-2">
						<p className="text-sm font-medium">{labels.rowsPerPage}</p>
						<Select disabled>
							<SelectTrigger className="h-8 w-[70px]">
								<SelectValue placeholder="25" />
							</SelectTrigger>
						</Select>
					</div>
					<div className="flex w-[100px] items-center justify-center text-sm font-medium">
						<span>Page 1 of 1</span>
					</div>
					<div className="flex items-center space-x-2">
						<Button variant="outline" size="icon" className="size-8" disabled>
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<Button variant="outline" size="icon" className="size-8" disabled>
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>
		)
	}

	const pagination = table.getState().pagination
	const { pageIndex, pageSize } = pagination
	const pageCount = table.getPageCount()
	const canPreviousPage = table.getCanPreviousPage()
	const canNextPage = table.getCanNextPage()

	// URL state management - only update URL when user interacts, not during initialization
	const updateUrlState = React.useCallback(
		(newPageIndex?: number, newPageSize?: number) => {
			if (!enableUrlState || !isInitialized || isUpdatingUrl) return

			setIsUpdatingUrl(true)

			const newSearch: Record<string, any> = { ...searchParams }

			if (newPageIndex !== undefined) {
				if (newPageIndex === 0) {
					delete newSearch.page
				} else {
					newSearch.page = newPageIndex + 1
				}
			}

			if (newPageSize !== undefined) {
				if (newPageSize === 25) {
					delete newSearch.pageSize
				} else {
					newSearch.pageSize = newPageSize
				}
			}

			navigate({
				search: newSearch as any,
				replace: true, // Use replace to avoid cluttering browser history
			}).finally(() => {
				setIsUpdatingUrl(false)
			})
		},
		[enableUrlState, navigate, searchParams, isInitialized, isUpdatingUrl]
	)

	// Handle page size change
	const handlePageSizeChange = (newPageSize: string) => {
		const size = Number(newPageSize)
		table.setPageSize(size)
		table.setPageIndex(0) // Reset to first page when changing page size
		updateUrlState(0, size)
	}

	// Handle page navigation
	const handlePageChange = (newPageIndex: number) => {
		table.setPageIndex(newPageIndex)
		updateUrlState(newPageIndex)
	}

	// Initialize from URL state only once
	React.useEffect(() => {
		if (!enableUrlState || isInitialized) return

		const urlPage = searchParams.page ? Number(searchParams.page) - 1 : 0 // Convert to 0-based index
		const urlPageSize = searchParams.pageSize ? Number(searchParams.pageSize) : 25

		// Validate URL parameters
		const validPageSize = pageSizeOptions.includes(urlPageSize) ? urlPageSize : 25
		const validPageIndex = urlPage >= 0 ? urlPage : 0

		// Set initial table state without triggering URL updates
		if (validPageSize !== pagination.pageSize) {
			table.setPageSize(validPageSize)
		}

		if (validPageIndex !== pagination.pageIndex) {
			table.setPageIndex(validPageIndex)
		}

		setIsInitialized(true)
	}, [enableUrlState, isInitialized]) // Remove dependencies that cause re-runs

	const selectedRowCount = table.getFilteredSelectedRowModel().rows.length
	const totalRowCount = table.getFilteredRowModel().rows.length

	return (
		<div className={cn('flex items-center justify-between px-2', className)}>
			{/* Row selection info */}
			<div className="flex-1 text-sm text-muted-foreground">
				{showRowSelection && selectedRowCount > 0 ? (
					<span>
						{selectedRowCount} of {totalRowCount} {labels.rows} {labels.selected}
					</span>
				) : (
					<span>
						{totalRowCount} {labels.rows} total
					</span>
				)}
			</div>

			{/* Pagination controls */}
			<div className="flex items-center space-x-6 lg:space-x-8">
				{/* Page size selector */}
				{showPageSizeSelector && (
					<div className="flex items-center space-x-2">
						<p className="text-sm font-medium">{labels.rowsPerPage}</p>
						<Select value={`${pageSize}`} onValueChange={handlePageSizeChange}>
							<SelectTrigger className="h-8 w-[70px]">
								<SelectValue placeholder={pageSize} />
							</SelectTrigger>
							<SelectContent side="top">
								{pageSizeOptions.map((size) => (
									<SelectItem key={size} value={`${size}`}>
										{size}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}

				{/* Page info */}
				{showPageInfo && (
					<div className="flex w-[100px] items-center justify-center text-sm font-medium">
						{pageCount > 0 ? (
							<span>
								{labels.page} {pageIndex + 1} {labels.of} {pageCount}
							</span>
						) : (
							<span>No pages</span>
						)}
					</div>
				)}

				{/* Navigation buttons */}
				{showNavigation && (
					<div className="flex items-center space-x-2">
						{/* First page button */}
						{showFirstLastButtons && (
							<Button
								variant="outline"
								size="icon"
								className="hidden size-8 lg:flex"
								onClick={() => handlePageChange(0)}
								disabled={!canPreviousPage}
								aria-label={labels.goToFirstPage}
							>
								<span className="sr-only">{labels.goToFirstPage}</span>
								<ChevronsLeft className="h-4 w-4" />
							</Button>
						)}

						{/* Previous page button */}
						<Button
							variant="outline"
							size="icon"
							className="size-8"
							onClick={() => handlePageChange(pageIndex - 1)}
							disabled={!canPreviousPage}
							aria-label={labels.goToPreviousPage}
						>
							<span className="sr-only">{labels.goToPreviousPage}</span>
							<ChevronLeft className="h-4 w-4" />
						</Button>

						{/* Next page button */}
						<Button
							variant="outline"
							size="icon"
							className="size-8"
							onClick={() => handlePageChange(pageIndex + 1)}
							disabled={!canNextPage}
							aria-label={labels.goToNextPage}
						>
							<span className="sr-only">{labels.goToNextPage}</span>
							<ChevronRight className="h-4 w-4" />
						</Button>

						{/* Last page button */}
						{showFirstLastButtons && (
							<Button
								variant="outline"
								size="icon"
								className="hidden size-8 lg:flex"
								onClick={() => handlePageChange(pageCount - 1)}
								disabled={!canNextPage}
								aria-label={labels.goToLastPage}
							>
								<span className="sr-only">{labels.goToLastPage}</span>
								<ChevronsRight className="h-4 w-4" />
							</Button>
						)}
					</div>
				)}
			</div>
		</div>
	)
}

/**
 * Simplified pagination component for basic use cases
 */
export function SimpleAlertPagination<TData>({
	table,
	className,
}: {
	table: Table<TData> | null
	className?: string
}) {
	return (
		<AlertPagination
			table={table}
			enableUrlState={false}
			showPageSizeSelector={false}
			showFirstLastButtons={false}
			showRowSelection={false}
			className={className}
		/>
	)
}

/**
 * Compact pagination component for mobile views
 */
export function CompactAlertPagination<TData>({
	table,
	className,
}: {
	table: Table<TData> | null
	className?: string
}) {
	if (!table) {
		return (
			<div className={cn('flex items-center justify-between px-2', className)}>
				<div className="text-sm text-muted-foreground">Loading...</div>
				<div className="flex items-center space-x-2">
					<Button variant="outline" size="sm" disabled>
						Previous
					</Button>
					<Button variant="outline" size="sm" disabled>
						Next
					</Button>
				</div>
			</div>
		)
	}

	const pagination = table.getState().pagination
	const { pageIndex } = pagination
	const pageCount = table.getPageCount()
	const canPreviousPage = table.getCanPreviousPage()
	const canNextPage = table.getCanNextPage()

	return (
		<div className={cn('flex items-center justify-between px-2', className)}>
			<div className="text-sm text-muted-foreground">
				{pageCount > 0 ? `${pageIndex + 1} of ${pageCount}` : 'No pages'}
			</div>
			<div className="flex items-center space-x-2">
				<Button
					variant="outline"
					size="sm"
					onClick={() => table.previousPage()}
					disabled={!canPreviousPage}
				>
					Previous
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={() => table.nextPage()}
					disabled={!canNextPage}
				>
					Next
				</Button>
			</div>
		</div>
	)
}

export default AlertPagination
