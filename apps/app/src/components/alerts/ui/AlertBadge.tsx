import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { cva } from 'class-variance-authority'
import { AlertTriangle, CheckCircle, Clock, Eye, Info, Shield, X, Zap } from 'lucide-react'
import * as React from 'react'

import type { VariantProps } from 'class-variance-authority'
import type { AlertSeverity, AlertStatus, AlertType } from '../types'

const alertBadgeVariants = cva(
	'inline-flex items-center justify-center gap-1 text-xs font-medium transition-colors',
	{
		variants: {
			severity: {
				CRITICAL:
					'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
				HIGH: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800',
				MEDIUM:
					'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800',
				LOW: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
				INFO: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800',
			},
			status: {
				active:
					'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
				acknowledged:
					'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800',
				resolved:
					'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
				dismissed:
					'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800',
			},
			type: {
				SYSTEM:
					'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
				SECURITY:
					'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
				PERFORMANCE:
					'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800',
				COMPLIANCE:
					'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
				CUSTOM:
					'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800',
			},
		},
	}
)

// Icon mapping for different alert types
const typeIcons = {
	SYSTEM: Zap,
	SECURITY: Shield,
	PERFORMANCE: AlertTriangle,
	COMPLIANCE: CheckCircle,
	CUSTOM: Info,
} as const

// Icon mapping for different alert statuses
const statusIcons = {
	active: AlertTriangle,
	acknowledged: Clock,
	resolved: CheckCircle,
	dismissed: X,
} as const

// Icon mapping for different alert severities
const severityIcons = {
	CRITICAL: AlertTriangle,
	HIGH: AlertTriangle,
	MEDIUM: Info,
	LOW: Info,
	INFO: Info,
} as const

interface AlertBadgeProps
	extends Omit<React.ComponentProps<typeof Badge>, 'variant'>,
		VariantProps<typeof alertBadgeVariants> {
	/**
	 * The type of badge to display
	 */
	badgeType: 'severity' | 'status' | 'type'
	/**
	 * Alert severity level
	 */
	severity?: AlertSeverity
	/**
	 * Alert status
	 */
	status?: AlertStatus
	/**
	 * Alert type
	 */
	type?: AlertType
	/**
	 * Whether to show an icon
	 */
	showIcon?: boolean
	/**
	 * Custom icon to display instead of the default
	 */
	icon?: React.ComponentType<{ className?: string }>
	/**
	 * Size variant
	 */
	size?: 'sm' | 'md' | 'lg'
}

/**
 * AlertBadge component for displaying alert severity, status, and type indicators
 *
 * Features:
 * - Color-coded badges for different alert properties
 * - Icon integration with accessibility support
 * - Consistent styling with existing compliance UI
 * - Dark mode support
 * - Multiple size variants
 *
 * @example
 * ```tsx
 * <AlertBadge badgeType="severity" severity="CRITICAL" showIcon />
 * <AlertBadge badgeType="status" status="acknowledged" />
 * <AlertBadge badgeType="type" type="SECURITY" showIcon size="lg" />
 * ```
 */
export const AlertBadge = React.forwardRef<HTMLSpanElement, AlertBadgeProps>(
	(
		{
			className,
			badgeType,
			severity,
			status,
			type,
			showIcon = false,
			icon: CustomIcon,
			size = 'md',
			children,
			...props
		},
		ref
	) => {
		// Determine the variant based on badge type
		const variantProps = React.useMemo(() => {
			switch (badgeType) {
				case 'severity':
					return { severity }
				case 'status':
					return { status }
				case 'type':
					return { type }
				default:
					return {}
			}
		}, [badgeType, severity, status, type])

		// Get the appropriate icon
		const IconComponent = React.useMemo(() => {
			if (CustomIcon) return CustomIcon

			switch (badgeType) {
				case 'severity':
					return severity ? severityIcons[severity] : undefined
				case 'status':
					return status ? statusIcons[status] : undefined
				case 'type':
					return type ? typeIcons[type] : undefined
				default:
					return undefined
			}
		}, [badgeType, severity, status, type, CustomIcon])

		// Get the display text
		const displayText = React.useMemo(() => {
			if (children) return children

			switch (badgeType) {
				case 'severity':
					return severity?.toLowerCase()
				case 'status':
					return status ? status.charAt(0).toUpperCase() + status.slice(1) : ''
				case 'type':
					return type?.toLowerCase()
				default:
					return ''
			}
		}, [badgeType, severity, status, type, children])

		// Size classes
		const sizeClasses = React.useMemo(() => {
			switch (size) {
				case 'sm':
					return 'px-1.5 py-0.5 text-xs [&>svg]:size-2.5'
				case 'lg':
					return 'px-3 py-1 text-sm [&>svg]:size-4'
				default:
					return 'px-2 py-0.5 text-xs [&>svg]:size-3'
			}
		}, [size])

		return (
			<Badge
				ref={ref}
				className={cn(
					alertBadgeVariants(variantProps),
					sizeClasses,
					'border rounded-md',
					className
				)}
				variant="outline"
				{...props}
			>
				{showIcon && IconComponent && <IconComponent className="shrink-0" aria-hidden="true" />}
				<span className="capitalize">{displayText}</span>
			</Badge>
		)
	}
)

AlertBadge.displayName = 'AlertBadge'

// Convenience components for specific badge types
export const SeverityBadge = React.forwardRef<
	HTMLSpanElement,
	Omit<AlertBadgeProps, 'badgeType'> & { severity: AlertSeverity }
>(({ severity, ...props }, ref) => (
	<AlertBadge ref={ref} badgeType="severity" severity={severity} {...props} />
))

SeverityBadge.displayName = 'SeverityBadge'

export const StatusBadge = React.forwardRef<
	HTMLSpanElement,
	Omit<AlertBadgeProps, 'badgeType'> & { status: AlertStatus }
>(({ status, ...props }, ref) => (
	<AlertBadge ref={ref} badgeType="status" status={status} {...props} />
))

StatusBadge.displayName = 'StatusBadge'

export const TypeBadge = React.forwardRef<
	HTMLSpanElement,
	Omit<AlertBadgeProps, 'badgeType'> & { type: AlertType }
>(({ type, ...props }, ref) => <AlertBadge ref={ref} badgeType="type" type={type} {...props} />)

TypeBadge.displayName = 'TypeBadge'
