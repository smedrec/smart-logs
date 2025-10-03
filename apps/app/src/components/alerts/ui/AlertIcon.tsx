import { cn } from '@/lib/utils'
import { cva } from 'class-variance-authority'
import {
	Activity,
	AlertTriangle,
	CheckCircle,
	Clock,
	Eye,
	FileText,
	Info,
	Settings,
	Shield,
	X,
	Zap,
} from 'lucide-react'
import * as React from 'react'

import type { VariantProps } from 'class-variance-authority'
import type { AlertSeverity, AlertStatus, AlertType } from '../types'

const alertIconVariants = cva('shrink-0 transition-colors', {
	variants: {
		severity: {
			CRITICAL: 'text-red-600 dark:text-red-400',
			HIGH: 'text-orange-600 dark:text-orange-400',
			MEDIUM: 'text-yellow-600 dark:text-yellow-400',
			LOW: 'text-blue-600 dark:text-blue-400',
			INFO: 'text-gray-600 dark:text-gray-400',
		},
		status: {
			active: 'text-red-600 dark:text-red-400',
			acknowledged: 'text-yellow-600 dark:text-yellow-400',
			resolved: 'text-green-600 dark:text-green-400',
			dismissed: 'text-gray-600 dark:text-gray-400',
		},
		type: {
			SYSTEM: 'text-blue-600 dark:text-blue-400',
			SECURITY: 'text-red-600 dark:text-red-400',
			PERFORMANCE: 'text-orange-600 dark:text-orange-400',
			COMPLIANCE: 'text-purple-600 dark:text-purple-400',
			CUSTOM: 'text-gray-600 dark:text-gray-400',
		},
		size: {
			xs: 'size-3',
			sm: 'size-4',
			md: 'size-5',
			lg: 'size-6',
			xl: 'size-8',
		},
	},
	defaultVariants: {
		size: 'md',
	},
})

// Icon mapping for different alert types
const typeIcons = {
	SYSTEM: Zap,
	SECURITY: Shield,
	PERFORMANCE: Activity,
	COMPLIANCE: FileText,
	CUSTOM: Settings,
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

interface AlertIconProps
	extends Omit<React.ComponentProps<'svg'>, 'children'>,
		VariantProps<typeof alertIconVariants> {
	/**
	 * The type of icon to display
	 */
	iconType: 'severity' | 'status' | 'type'
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
	 * Custom icon to display instead of the default
	 */
	icon?: React.ComponentType<{ className?: string }>
	/**
	 * Accessible label for screen readers
	 */
	'aria-label'?: string
	/**
	 * Whether the icon is decorative (hidden from screen readers)
	 */
	decorative?: boolean
}

/**
 * AlertIcon component for displaying icons for different alert types and severities
 *
 * Features:
 * - Icon mapping for alert types, severities, and statuses
 * - Color coordination with alert badges
 * - Accessibility attributes and screen reader support
 * - Multiple size variants
 * - Custom icon support
 * - Dark mode support
 *
 * @example
 * ```tsx
 * <AlertIcon iconType="severity" severity="CRITICAL" aria-label="Critical alert" />
 * <AlertIcon iconType="status" status="acknowledged" size="lg" />
 * <AlertIcon iconType="type" type="SECURITY" decorative />
 * ```
 */
export const AlertIcon = React.forwardRef<SVGSVGElement, AlertIconProps>(
	(
		{
			className,
			iconType,
			severity,
			status,
			type,
			icon: CustomIcon,
			size,
			'aria-label': ariaLabel,
			decorative = false,
			...props
		},
		ref
	) => {
		// Determine the variant based on icon type
		const variantProps = React.useMemo(() => {
			switch (iconType) {
				case 'severity':
					return { severity, size }
				case 'status':
					return { status, size }
				case 'type':
					return { type, size }
				default:
					return { size }
			}
		}, [iconType, severity, status, type, size])

		// Get the appropriate icon component
		const IconComponent = React.useMemo(() => {
			if (CustomIcon) return CustomIcon

			switch (iconType) {
				case 'severity':
					return severity ? severityIcons[severity] : Info
				case 'status':
					return status ? statusIcons[status] : AlertTriangle
				case 'type':
					return type ? typeIcons[type] : Settings
				default:
					return Info
			}
		}, [iconType, severity, status, type, CustomIcon])

		// Generate accessible label if not provided
		const accessibleLabel = React.useMemo(() => {
			if (ariaLabel) return ariaLabel
			if (decorative) return undefined

			switch (iconType) {
				case 'severity':
					return severity ? `${severity.toLowerCase()} severity alert` : 'Alert severity'
				case 'status':
					return status ? `Alert ${status}` : 'Alert status'
				case 'type':
					return type ? `${type.toLowerCase()} alert type` : 'Alert type'
				default:
					return 'Alert icon'
			}
		}, [iconType, severity, status, type, ariaLabel, decorative])

		// Accessibility props
		const accessibilityProps = React.useMemo(() => {
			if (decorative) {
				return {
					'aria-hidden': true,
					role: 'presentation',
				}
			}

			return {
				'aria-label': accessibleLabel,
				role: 'img',
			}
		}, [decorative, accessibleLabel])

		return (
			<IconComponent
				ref={ref}
				className={cn(alertIconVariants(variantProps), className)}
				{...accessibilityProps}
				{...props}
			/>
		)
	}
)

AlertIcon.displayName = 'AlertIcon'

// Convenience components for specific icon types
export const SeverityIcon = React.forwardRef<
	SVGSVGElement,
	Omit<AlertIconProps, 'iconType'> & { severity: AlertSeverity }
>(({ severity, ...props }, ref) => (
	<AlertIcon ref={ref} iconType="severity" severity={severity} {...props} />
))

SeverityIcon.displayName = 'SeverityIcon'

export const StatusIcon = React.forwardRef<
	SVGSVGElement,
	Omit<AlertIconProps, 'iconType'> & { status: AlertStatus }
>(({ status, ...props }, ref) => (
	<AlertIcon ref={ref} iconType="status" status={status} {...props} />
))

StatusIcon.displayName = 'StatusIcon'

export const TypeIcon = React.forwardRef<
	SVGSVGElement,
	Omit<AlertIconProps, 'iconType'> & { type: AlertType }
>(({ type, ...props }, ref) => <AlertIcon ref={ref} iconType="type" type={type} {...props} />)

TypeIcon.displayName = 'TypeIcon'

// Utility function to get icon component by type
export const getAlertIcon = (
	iconType: 'severity' | 'status' | 'type',
	value: AlertSeverity | AlertStatus | AlertType
): React.ComponentType<{ className?: string }> => {
	switch (iconType) {
		case 'severity':
			return severityIcons[value as AlertSeverity] || Info
		case 'status':
			return statusIcons[value as AlertStatus] || AlertTriangle
		case 'type':
			return typeIcons[value as AlertType] || Settings
		default:
			return Info
	}
}

// Utility function to get icon color class
export const getAlertIconColor = (
	iconType: 'severity' | 'status' | 'type',
	value: AlertSeverity | AlertStatus | AlertType
): string => {
	const variants = alertIconVariants({ [iconType]: value as any })
	return variants
}
