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
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import * as React from 'react'

import type { Table } from '@tanstack/react-table'

export interface AlertPaginationProps<TData> {
	/** TanStack Table instance */
	table: Table<TData>
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
	const router = useRouter()
	const searchParams = useSearchParams()

	const pagination = table.getState().pagination
	const { pageIndex, pageSize } = pagination
	const pageCount = table.getPageCount()
	const canPreviousPage = table.getCanPreviousPage()
	const canNextPage = table.getCanNextPage()

	// URL state management
	const updateUrlState = React.useCallback(
		(newPageIndex?: number, newPageSize?: number) => {
			if (!enableUrlState) return

			const params = new URLSearchParams(searchParams.toString())

			if (newPageIndex !== undefined) {
				if (newPageIndex === 0) {
					params.delete('page')
				} else {
					params.set('page', (newPageIndex + 1).toString())
				}
			}

			if (newPageSize !== undefined) {
				if (newPageSize === 25) {
					params.delete('pageSize')
				} else {
					params.set('pageSize', newPageSize.toString())
				}
			}

			const newUrl = params.toString() ? `?${params.toString()}` : ''
			router.push(newUrl, { scroll: false })
		},
		[enableUrlState, router, searchParams]
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

	// Initialize from URL state
	React.useEffect(() => {
		if (!enableUrlState) return

		const urlPage = searchParams.get('page')
		const urlPageSize = searchParams.get('pageSize')

		if (urlPage) {
			const pageIndex = Math.max(0, parseInt(urlPage) - 1)
			if (pageIndex !== pagination.pageIndex && pageIndex < pageCount) {
				table.setPageIndex(pageIndex)
			}
		}

		if (urlPageSize) {
			const pageSize = parseInt(urlPageSize)
			if (pageSizeOptions.includes(pageSize) && pageSize !== pagination.pageSize) {
				table.setPageSize(pageSize)
			}
		}
	}, [
		enableUrlState,
		searchParams,
		table,
		pagination.pageIndex,
		pagination.pageSize,
		pageCount,
		pageSizeOptions,
	])

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
	table: Table<TData>
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
	table: Table<TData>
	className?: string
}) {
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
