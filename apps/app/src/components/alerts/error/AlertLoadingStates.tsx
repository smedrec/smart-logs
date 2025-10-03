import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { Download, Filter, Loader2, MoreHorizontal, RefreshCw, Search, Upload } from 'lucide-react'
import React from 'react'

interface AlertLoadingStatesProps {
	/**
	 * Type of loading state to display
	 */
	type: 'spinner' | 'skeleton' | 'progress' | 'overlay' | 'inline' | 'table' | 'card'
	/**
	 * Loading message to display
	 */
	message?: string
	/**
	 * Progress value (0-100) for progress type
	 */
	progress?: number
	/**
	 * Size variant
	 */
	size?: 'sm' | 'md' | 'lg'
	/**
	 * Additional CSS classes
	 */
	className?: string
	/**
	 * Whether to show the loading state
	 */
	show?: boolean
	/**
	 * Custom icon for the loading state
	 */
	icon?: React.ComponentType<{ className?: string }>
	/**
	 * Number of skeleton items to show (for skeleton type)
	 */
	count?: number
	/**
	 * Children to render behind overlay (for overlay type)
	 */
	children?: React.ReactNode
}

/**
 * AlertLoadingStates component for consistent loading indicators across alert operations
 *
 * Features:
 * - Multiple loading state types (spinner, skeleton, progress, overlay)
 * - Consistent loading indicators for alert operations
 * - Progress indicators for long-running operations
 * - Loading overlays for data tables and forms
 * - Accessibility compliant with proper ARIA labels
 * - Responsive design support
 *
 * @example
 * ```tsx
 * <AlertLoadingStates type="spinner" message="Loading alerts..." />
 * <AlertLoadingStates type="progress" progress={75} message="Processing alerts..." />
 * <AlertLoadingStates type="overlay">
 *   <AlertDataTable />
 * </AlertLoadingStates>
 * ```
 */
export function AlertLoadingStates({
	type,
	message,
	progress = 0,
	size = 'md',
	className,
	show = true,
	icon: CustomIcon,
	count = 3,
	children,
}: AlertLoadingStatesProps) {
	if (!show) {
		return children ? <>{children}</> : null
	}

	const sizeClasses = {
		sm: 'text-sm',
		md: 'text-base',
		lg: 'text-lg',
	}

	const iconSizes = {
		sm: 'h-4 w-4',
		md: 'h-5 w-5',
		lg: 'h-6 w-6',
	}

	const LoadingIcon = CustomIcon || Loader2

	switch (type) {
		case 'spinner':
			return (
				<div
					className={cn('flex items-center justify-center gap-3 p-4', sizeClasses[size], className)}
				>
					<LoadingIcon className={cn('animate-spin', iconSizes[size])} />
					{message && (
						<span className="text-muted-foreground" role="status" aria-live="polite">
							{message}
						</span>
					)}
				</div>
			)

		case 'skeleton':
			return (
				<div className={cn('space-y-3', className)} role="status" aria-label="Loading content">
					{Array.from({ length: count }).map((_, index) => (
						<AlertSkeleton key={index} variant="card" />
					))}
				</div>
			)

		case 'progress':
			return (
				<div className={cn('space-y-3 p-4', className)}>
					<div className="flex items-center gap-3">
						<LoadingIcon className={cn('animate-spin', iconSizes[size])} />
						{message && (
							<span className={cn('text-muted-foreground', sizeClasses[size])}>{message}</span>
						)}
					</div>
					<Progress value={progress} className="w-full" />
					<div className="text-xs text-muted-foreground text-right">{progress}% complete</div>
				</div>
			)

		case 'overlay':
			return (
				<div className={cn('relative', className)}>
					{children}
					<div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
						<div className="flex items-center gap-3 bg-background border rounded-lg p-4 shadow-lg">
							<LoadingIcon className={cn('animate-spin', iconSizes[size])} />
							{message && (
								<span className={cn('text-muted-foreground', sizeClasses[size])}>{message}</span>
							)}
						</div>
					</div>
				</div>
			)

		case 'inline':
			return (
				<div className={cn('flex items-center gap-2', className)}>
					<LoadingIcon className={cn('animate-spin', iconSizes[size])} />
					{message && (
						<span className={cn('text-muted-foreground', sizeClasses[size])}>{message}</span>
					)}
				</div>
			)

		case 'table':
			return (
				<div className={cn('space-y-2', className)} role="status" aria-label="Loading table data">
					{/* Table Header Skeleton */}
					<div className="flex gap-4 p-4 border-b">
						<Skeleton className="h-4 w-4" />
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-4 w-12" />
					</div>
					{/* Table Rows Skeleton */}
					{Array.from({ length: count }).map((_, index) => (
						<div key={index} className="flex gap-4 p-4 border-b">
							<Skeleton className="h-4 w-4" />
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-4 w-16" />
							<Skeleton className="h-4 w-12" />
						</div>
					))}
				</div>
			)

		case 'card':
			return (
				<div className={cn('space-y-4', className)} role="status" aria-label="Loading cards">
					{Array.from({ length: count }).map((_, index) => (
						<AlertSkeleton key={index} variant="card" />
					))}
				</div>
			)

		default:
			return (
				<div className={cn('flex items-center justify-center p-4', className)}>
					<Spinner variant="default" className={iconSizes[size]} />
				</div>
			)
	}
}

// Specialized loading components for different alert operations

interface AlertOperationLoadingProps {
	operation:
		| 'loading'
		| 'acknowledging'
		| 'resolving'
		| 'dismissing'
		| 'filtering'
		| 'searching'
		| 'exporting'
	message?: string
	progress?: number
	className?: string
}

/**
 * Loading indicator for specific alert operations
 */
export function AlertOperationLoading({
	operation,
	message,
	progress,
	className,
}: AlertOperationLoadingProps) {
	const getOperationConfig = () => {
		switch (operation) {
			case 'acknowledging':
				return {
					icon: RefreshCw,
					defaultMessage: 'Acknowledging alerts...',
					color: 'text-yellow-600',
				}
			case 'resolving':
				return {
					icon: RefreshCw,
					defaultMessage: 'Resolving alerts...',
					color: 'text-green-600',
				}
			case 'dismissing':
				return {
					icon: RefreshCw,
					defaultMessage: 'Dismissing alerts...',
					color: 'text-gray-600',
				}
			case 'filtering':
				return {
					icon: Filter,
					defaultMessage: 'Applying filters...',
					color: 'text-blue-600',
				}
			case 'searching':
				return {
					icon: Search,
					defaultMessage: 'Searching alerts...',
					color: 'text-purple-600',
				}
			case 'exporting':
				return {
					icon: Download,
					defaultMessage: 'Exporting alerts...',
					color: 'text-indigo-600',
				}
			default:
				return {
					icon: Loader2,
					defaultMessage: 'Loading alerts...',
					color: 'text-muted-foreground',
				}
		}
	}

	const config = getOperationConfig()
	const displayMessage = message || config.defaultMessage

	if (typeof progress === 'number') {
		return (
			<AlertLoadingStates
				type="progress"
				message={displayMessage}
				progress={progress}
				icon={config.icon}
				className={cn(config.color, className)}
			/>
		)
	}

	return (
		<AlertLoadingStates
			type="inline"
			message={displayMessage}
			icon={config.icon}
			className={cn(config.color, className)}
		/>
	)
}

// Alert-specific skeleton components

interface AlertSkeletonProps {
	variant: 'list-item' | 'card' | 'table-row' | 'notification' | 'dashboard'
	className?: string
}

/**
 * Skeleton components specifically designed for alert UI elements
 */
export function AlertSkeleton({ variant, className }: AlertSkeletonProps) {
	switch (variant) {
		case 'list-item':
			return (
				<div className={cn('flex items-center gap-4 p-4 border-b', className)}>
					<Skeleton className="h-4 w-4" /> {/* Checkbox */}
					<div className="flex items-center gap-2">
						<Skeleton className="h-6 w-6 rounded-full" /> {/* Severity icon */}
						<Skeleton className="h-4 w-16" /> {/* Severity badge */}
					</div>
					<div className="flex-1 space-y-2">
						<Skeleton className="h-4 w-3/4" /> {/* Title */}
						<Skeleton className="h-3 w-1/2" /> {/* Description */}
					</div>
					<div className="space-y-1">
						<Skeleton className="h-3 w-20" /> {/* Timestamp */}
						<Skeleton className="h-3 w-16" /> {/* Source */}
					</div>
					<Skeleton className="h-8 w-8" /> {/* Actions */}
				</div>
			)

		case 'card':
			return (
				<Card className={cn('', className)}>
					<CardHeader className="pb-3">
						<div className="flex items-start justify-between">
							<div className="space-y-2">
								<div className="flex items-center gap-2">
									<Skeleton className="h-6 w-6 rounded-full" />
									<Skeleton className="h-4 w-16" />
								</div>
								<Skeleton className="h-5 w-3/4" />
							</div>
							<Skeleton className="h-8 w-8" />
						</div>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-2/3" />
							<div className="flex items-center justify-between">
								<Skeleton className="h-3 w-24" />
								<Skeleton className="h-3 w-20" />
							</div>
						</div>
					</CardContent>
				</Card>
			)

		case 'table-row':
			return (
				<div className={cn('flex items-center gap-4 p-4 border-b', className)}>
					<Skeleton className="h-4 w-4" />
					<Skeleton className="h-4 w-16" />
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-4 w-20" />
					<Skeleton className="h-4 w-16" />
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-4 w-12" />
				</div>
			)

		case 'notification':
			return (
				<div className={cn('flex items-center gap-3 p-3 border-b', className)}>
					<Skeleton className="h-8 w-8 rounded-full" />
					<div className="flex-1 space-y-1">
						<Skeleton className="h-4 w-3/4" />
						<Skeleton className="h-3 w-1/2" />
					</div>
					<Skeleton className="h-3 w-12" />
				</div>
			)

		case 'dashboard':
			return (
				<div className={cn('space-y-6', className)}>
					{/* Stats Cards */}
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
						{Array.from({ length: 4 }).map((_, index) => (
							<Card key={index}>
								<CardContent className="p-6">
									<div className="space-y-2">
										<Skeleton className="h-4 w-20" />
										<Skeleton className="h-8 w-16" />
									</div>
								</CardContent>
							</Card>
						))}
					</div>

					{/* Chart Area */}
					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-48" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-64 w-full" />
						</CardContent>
					</Card>

					{/* Recent Alerts */}
					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-32" />
						</CardHeader>
						<CardContent className="space-y-3">
							{Array.from({ length: 5 }).map((_, index) => (
								<AlertSkeleton key={index} variant="list-item" />
							))}
						</CardContent>
					</Card>
				</div>
			)

		default:
			return <Skeleton className={cn('h-4 w-full', className)} />
	}
}

// Loading overlay for specific alert components
interface AlertLoadingOverlayProps {
	isLoading: boolean
	message?: string
	children: React.ReactNode
	className?: string
}

/**
 * Loading overlay specifically for alert components
 */
export function AlertLoadingOverlay({
	isLoading,
	message = 'Loading...',
	children,
	className,
}: AlertLoadingOverlayProps) {
	return (
		<AlertLoadingStates type="overlay" message={message} show={isLoading} className={className}>
			{children}
		</AlertLoadingStates>
	)
}

// Bulk operation loading indicator
interface AlertBulkOperationLoadingProps {
	operation: 'acknowledge' | 'resolve' | 'dismiss'
	count: number
	processed: number
	className?: string
}

/**
 * Loading indicator for bulk alert operations
 */
export function AlertBulkOperationLoading({
	operation,
	count,
	processed,
	className,
}: AlertBulkOperationLoadingProps) {
	const progress = count > 0 ? Math.round((processed / count) * 100) : 0

	const operationLabels = {
		acknowledge: 'Acknowledging',
		resolve: 'Resolving',
		dismiss: 'Dismissing',
	}

	const message = `${operationLabels[operation]} ${processed} of ${count} alerts...`

	return (
		<div className={cn('space-y-3 p-4 border rounded-lg bg-muted/50', className)}>
			<div className="flex items-center gap-3">
				<RefreshCw className="h-4 w-4 animate-spin" />
				<span className="text-sm font-medium">{message}</span>
			</div>
			<Progress value={progress} className="w-full" />
			<div className="flex justify-between text-xs text-muted-foreground">
				<span>{processed} completed</span>
				<span>{count - processed} remaining</span>
			</div>
		</div>
	)
}

// Export loading states for external use
export const AlertLoadingTypes = {
	SPINNER: 'spinner' as const,
	SKELETON: 'skeleton' as const,
	PROGRESS: 'progress' as const,
	OVERLAY: 'overlay' as const,
	INLINE: 'inline' as const,
	TABLE: 'table' as const,
	CARD: 'card' as const,
}

export const AlertSkeletonVariants = {
	LIST_ITEM: 'list-item' as const,
	CARD: 'card' as const,
	TABLE_ROW: 'table-row' as const,
	NOTIFICATION: 'notification' as const,
	DASHBOARD: 'dashboard' as const,
}
