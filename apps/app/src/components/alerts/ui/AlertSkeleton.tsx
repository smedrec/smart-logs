import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import * as React from 'react'

interface AlertSkeletonProps extends React.ComponentProps<'div'> {
	/**
	 * The type of skeleton to display
	 */
	variant?: 'card' | 'list' | 'table' | 'dashboard' | 'notification'
	/**
	 * Number of skeleton items to render
	 */
	count?: number
	/**
	 * Whether to show animation
	 */
	animate?: boolean
}

/**
 * AlertSkeleton component for displaying loading states across alert components
 *
 * Features:
 * - Multiple skeleton variants for different alert views
 * - Consistent loading states across the application
 * - Responsive design with proper spacing
 * - Animation support
 * - Accessibility considerations
 *
 * @example
 * ```tsx
 * <AlertSkeleton variant="card" count={3} />
 * <AlertSkeleton variant="list" count={5} />
 * <AlertSkeleton variant="table" />
 * ```
 */
export const AlertSkeleton = React.forwardRef<HTMLDivElement, AlertSkeletonProps>(
	({ className, variant = 'card', count = 1, animate = true, ...props }, ref) => {
		const skeletonClass = cn(animate && 'animate-pulse', className)

		const renderCardSkeleton = () => (
			<div className="space-y-4">
				{Array.from({ length: count }).map((_, index) => (
					<div key={index} className="border rounded-lg p-4 space-y-3">
						{/* Header with severity badge and timestamp */}
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Skeleton className="h-4 w-4 rounded-full" />
								<Skeleton className="h-5 w-16 rounded-md" />
							</div>
							<Skeleton className="h-4 w-20" />
						</div>

						{/* Title */}
						<Skeleton className="h-6 w-3/4" />

						{/* Description */}
						<div className="space-y-2">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-2/3" />
						</div>

						{/* Footer with source and actions */}
						<div className="flex items-center justify-between pt-2">
							<div className="flex items-center gap-2">
								<Skeleton className="h-4 w-4 rounded-full" />
								<Skeleton className="h-4 w-24" />
							</div>
							<div className="flex gap-2">
								<Skeleton className="h-8 w-20 rounded-md" />
								<Skeleton className="h-8 w-16 rounded-md" />
							</div>
						</div>
					</div>
				))}
			</div>
		)

		const renderListSkeleton = () => (
			<div className="space-y-2">
				{Array.from({ length: count }).map((_, index) => (
					<div key={index} className="flex items-center gap-3 p-3 border rounded-md">
						{/* Icon */}
						<Skeleton className="h-5 w-5 rounded-full shrink-0" />

						{/* Content */}
						<div className="flex-1 space-y-1">
							<div className="flex items-center gap-2">
								<Skeleton className="h-4 w-1/3" />
								<Skeleton className="h-4 w-16 rounded-md" />
							</div>
							<Skeleton className="h-3 w-2/3" />
						</div>

						{/* Timestamp */}
						<Skeleton className="h-3 w-16 shrink-0" />
					</div>
				))}
			</div>
		)

		const renderTableSkeleton = () => (
			<div className="space-y-3">
				{/* Table header */}
				<div className="flex items-center gap-4 p-3 border-b">
					<Skeleton className="h-4 w-4" />
					<Skeleton className="h-4 w-20" />
					<Skeleton className="h-4 w-32 flex-1" />
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-4 w-20" />
					<Skeleton className="h-4 w-16" />
				</div>

				{/* Table rows */}
				{Array.from({ length: count }).map((_, index) => (
					<div key={index} className="flex items-center gap-4 p-3 border-b last:border-b-0">
						<Skeleton className="h-4 w-4" />
						<Skeleton className="h-4 w-4 rounded-full" />
						<div className="flex-1 space-y-1">
							<Skeleton className="h-4 w-3/4" />
							<Skeleton className="h-3 w-1/2" />
						</div>
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-8 w-16 rounded-md" />
					</div>
				))}
			</div>
		)

		const renderDashboardSkeleton = () => (
			<div className="space-y-6">
				{/* Stats cards */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					{Array.from({ length: 4 }).map((_, index) => (
						<div key={index} className="border rounded-lg p-4 space-y-2">
							<div className="flex items-center justify-between">
								<Skeleton className="h-4 w-16" />
								<Skeleton className="h-4 w-4 rounded-full" />
							</div>
							<Skeleton className="h-8 w-12" />
							<Skeleton className="h-3 w-20" />
						</div>
					))}
				</div>

				{/* Chart area */}
				<div className="border rounded-lg p-6">
					<div className="space-y-4">
						<Skeleton className="h-6 w-48" />
						<Skeleton className="h-64 w-full rounded-md" />
					</div>
				</div>

				{/* Recent alerts */}
				<div className="border rounded-lg p-6">
					<div className="space-y-4">
						<Skeleton className="h-6 w-32" />
						{renderListSkeleton()}
					</div>
				</div>
			</div>
		)

		const renderNotificationSkeleton = () => (
			<div className="space-y-2">
				{Array.from({ length: count }).map((_, index) => (
					<div key={index} className="flex items-start gap-3 p-3 hover:bg-muted/50 rounded-md">
						{/* Icon */}
						<Skeleton className="h-4 w-4 rounded-full shrink-0 mt-0.5" />

						{/* Content */}
						<div className="flex-1 space-y-1">
							<Skeleton className="h-4 w-3/4" />
							<Skeleton className="h-3 w-full" />
							<Skeleton className="h-3 w-16" />
						</div>

						{/* Unread indicator */}
						<Skeleton className="h-2 w-2 rounded-full shrink-0" />
					</div>
				))}
			</div>
		)

		const renderSkeleton = () => {
			switch (variant) {
				case 'card':
					return renderCardSkeleton()
				case 'list':
					return renderListSkeleton()
				case 'table':
					return renderTableSkeleton()
				case 'dashboard':
					return renderDashboardSkeleton()
				case 'notification':
					return renderNotificationSkeleton()
				default:
					return renderCardSkeleton()
			}
		}

		return (
			<div
				ref={ref}
				className={skeletonClass}
				role="status"
				aria-label="Loading alerts..."
				{...props}
			>
				{renderSkeleton()}
			</div>
		)
	}
)

AlertSkeleton.displayName = 'AlertSkeleton'

// Convenience components for specific skeleton types
export const AlertCardSkeleton = React.forwardRef<
	HTMLDivElement,
	Omit<AlertSkeletonProps, 'variant'>
>((props, ref) => <AlertSkeleton ref={ref} variant="card" {...props} />)

AlertCardSkeleton.displayName = 'AlertCardSkeleton'

export const AlertListSkeleton = React.forwardRef<
	HTMLDivElement,
	Omit<AlertSkeletonProps, 'variant'>
>((props, ref) => <AlertSkeleton ref={ref} variant="list" {...props} />)

AlertListSkeleton.displayName = 'AlertListSkeleton'

export const AlertTableSkeleton = React.forwardRef<
	HTMLDivElement,
	Omit<AlertSkeletonProps, 'variant'>
>((props, ref) => <AlertSkeleton ref={ref} variant="table" {...props} />)

AlertTableSkeleton.displayName = 'AlertTableSkeleton'

export const AlertDashboardSkeleton = React.forwardRef<
	HTMLDivElement,
	Omit<AlertSkeletonProps, 'variant'>
>((props, ref) => <AlertSkeleton ref={ref} variant="dashboard" {...props} />)

AlertDashboardSkeleton.displayName = 'AlertDashboardSkeleton'

export const AlertNotificationSkeleton = React.forwardRef<
	HTMLDivElement,
	Omit<AlertSkeletonProps, 'variant'>
>((props, ref) => <AlertSkeleton ref={ref} variant="notification" {...props} />)

AlertNotificationSkeleton.displayName = 'AlertNotificationSkeleton'
