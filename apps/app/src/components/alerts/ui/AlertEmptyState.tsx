import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
	AlertTriangle,
	CheckCircle,
	Filter,
	Plus,
	RefreshCw,
	Search,
	Settings,
	Shield,
} from 'lucide-react'
import * as React from 'react'

interface AlertEmptyStateProps extends React.ComponentProps<'div'> {
	/**
	 * The type of empty state to display
	 */
	variant?: 'no-alerts' | 'no-results' | 'filtered' | 'error' | 'resolved'
	/**
	 * Custom title for the empty state
	 */
	title?: string
	/**
	 * Custom description for the empty state
	 */
	description?: string
	/**
	 * Custom icon component
	 */
	icon?: React.ComponentType<{ className?: string }>
	/**
	 * Action button configuration
	 */
	action?: {
		label: string
		onClick: () => void
		variant?: 'default' | 'outline' | 'secondary'
		icon?: React.ComponentType<{ className?: string }>
	}
	/**
	 * Secondary action button configuration
	 */
	secondaryAction?: {
		label: string
		onClick: () => void
		variant?: 'default' | 'outline' | 'secondary'
		icon?: React.ComponentType<{ className?: string }>
	}
	/**
	 * Whether to show the illustration/icon
	 */
	showIcon?: boolean
	/**
	 * Size variant
	 */
	size?: 'sm' | 'md' | 'lg'
}

// Default content for different variants
const defaultContent = {
	'no-alerts': {
		title: 'No alerts found',
		description:
			'Great news! There are currently no active alerts in your system. Your infrastructure is running smoothly.',
		icon: CheckCircle,
	},
	'no-results': {
		title: 'No alerts match your search',
		description: "Try adjusting your search terms or filters to find what you're looking for.",
		icon: Search,
	},
	filtered: {
		title: 'No alerts match your filters',
		description: 'Try adjusting your filters or clearing them to see more results.',
		icon: Filter,
	},
	error: {
		title: 'Unable to load alerts',
		description:
			'There was a problem loading your alerts. Please try again or contact support if the issue persists.',
		icon: AlertTriangle,
	},
	resolved: {
		title: 'All alerts resolved',
		description:
			'Excellent work! All alerts have been resolved. Keep up the great monitoring practices.',
		icon: CheckCircle,
	},
} as const

/**
 * AlertEmptyState component for displaying empty states across alert interfaces
 *
 * Features:
 * - Multiple variants for different empty state scenarios
 * - Helpful messaging and action suggestions
 * - Customizable icons and illustrations
 * - Action buttons for common tasks
 * - Responsive design
 * - Accessibility support
 *
 * @example
 * ```tsx
 * <AlertEmptyState variant="no-alerts" />
 * <AlertEmptyState
 *   variant="no-results"
 *   action={{ label: "Clear filters", onClick: clearFilters }}
 * />
 * <AlertEmptyState
 *   variant="error"
 *   action={{ label: "Retry", onClick: retry, icon: RefreshCw }}
 * />
 * ```
 */
export const AlertEmptyState = React.forwardRef<HTMLDivElement, AlertEmptyStateProps>(
	(
		{
			className,
			variant = 'no-alerts',
			title,
			description,
			icon: CustomIcon,
			action,
			secondaryAction,
			showIcon = true,
			size = 'md',
			...props
		},
		ref
	) => {
		const content = defaultContent[variant]
		const IconComponent = CustomIcon || content.icon

		// Size classes
		const sizeClasses = React.useMemo(() => {
			switch (size) {
				case 'sm':
					return {
						container: 'py-8 px-4',
						icon: 'size-12',
						title: 'text-lg',
						description: 'text-sm',
						spacing: 'space-y-3',
					}
				case 'lg':
					return {
						container: 'py-16 px-6',
						icon: 'size-20',
						title: 'text-2xl',
						description: 'text-base',
						spacing: 'space-y-6',
					}
				default:
					return {
						container: 'py-12 px-6',
						icon: 'size-16',
						title: 'text-xl',
						description: 'text-sm',
						spacing: 'space-y-4',
					}
			}
		}, [size])

		// Icon color based on variant
		const iconColor = React.useMemo(() => {
			switch (variant) {
				case 'no-alerts':
				case 'resolved':
					return 'text-green-500 dark:text-green-400'
				case 'error':
					return 'text-red-500 dark:text-red-400'
				case 'no-results':
				case 'filtered':
					return 'text-blue-500 dark:text-blue-400'
				default:
					return 'text-muted-foreground'
			}
		}, [variant])

		return (
			<div
				ref={ref}
				className={cn(
					'flex flex-col items-center justify-center text-center',
					sizeClasses.container,
					className
				)}
				role="status"
				aria-live="polite"
				{...props}
			>
				<div className={cn('flex flex-col items-center', sizeClasses.spacing)}>
					{/* Icon */}
					{showIcon && IconComponent && (
						<div className="flex items-center justify-center">
							<IconComponent
								className={cn(sizeClasses.icon, iconColor, 'shrink-0')}
								aria-hidden="true"
							/>
						</div>
					)}

					{/* Content */}
					<div className={cn('space-y-2 max-w-md')}>
						<h3 className={cn('font-semibold', sizeClasses.title)}>{title || content.title}</h3>
						<p className={cn('text-muted-foreground', sizeClasses.description)}>
							{description || content.description}
						</p>
					</div>

					{/* Actions */}
					{(action || secondaryAction) && (
						<div className="flex flex-col sm:flex-row gap-3 items-center">
							{action && (
								<Button
									onClick={action.onClick}
									variant={action.variant || 'default'}
									className="flex items-center gap-2"
								>
									{action.icon && <action.icon className="size-4" />}
									{action.label}
								</Button>
							)}
							{secondaryAction && (
								<Button
									onClick={secondaryAction.onClick}
									variant={secondaryAction.variant || 'outline'}
									className="flex items-center gap-2"
								>
									{secondaryAction.icon && <secondaryAction.icon className="size-4" />}
									{secondaryAction.label}
								</Button>
							)}
						</div>
					)}
				</div>
			</div>
		)
	}
)

AlertEmptyState.displayName = 'AlertEmptyState'

// Convenience components for specific empty state types
export const NoAlertsEmptyState = React.forwardRef<
	HTMLDivElement,
	Omit<AlertEmptyStateProps, 'variant'>
>((props, ref) => <AlertEmptyState ref={ref} variant="no-alerts" {...props} />)

NoAlertsEmptyState.displayName = 'NoAlertsEmptyState'

export const NoResultsEmptyState = React.forwardRef<
	HTMLDivElement,
	Omit<AlertEmptyStateProps, 'variant'>
>((props, ref) => <AlertEmptyState ref={ref} variant="no-results" {...props} />)

NoResultsEmptyState.displayName = 'NoResultsEmptyState'

export const FilteredEmptyState = React.forwardRef<
	HTMLDivElement,
	Omit<AlertEmptyStateProps, 'variant'>
>((props, ref) => <AlertEmptyState ref={ref} variant="filtered" {...props} />)

FilteredEmptyState.displayName = 'FilteredEmptyState'

export const ErrorEmptyState = React.forwardRef<
	HTMLDivElement,
	Omit<AlertEmptyStateProps, 'variant'>
>((props, ref) => <AlertEmptyState ref={ref} variant="error" {...props} />)

ErrorEmptyState.displayName = 'ErrorEmptyState'

export const ResolvedEmptyState = React.forwardRef<
	HTMLDivElement,
	Omit<AlertEmptyStateProps, 'variant'>
>((props, ref) => <AlertEmptyState ref={ref} variant="resolved" {...props} />)

ResolvedEmptyState.displayName = 'ResolvedEmptyState'

// Common action configurations
export const commonActions = {
	refresh: (onClick: () => void) => ({
		label: 'Refresh',
		onClick,
		icon: RefreshCw,
		variant: 'outline' as const,
	}),
	clearFilters: (onClick: () => void) => ({
		label: 'Clear filters',
		onClick,
		icon: Filter,
		variant: 'outline' as const,
	}),
	createAlert: (onClick: () => void) => ({
		label: 'Create alert',
		onClick,
		icon: Plus,
		variant: 'default' as const,
	}),
	settings: (onClick: () => void) => ({
		label: 'Settings',
		onClick,
		icon: Settings,
		variant: 'outline' as const,
	}),
}
