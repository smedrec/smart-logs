import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { cva } from 'class-variance-authority'
import {
	AlertCircle,
	AlertTriangle,
	Bug,
	CheckCircle,
	Copy,
	ExternalLink,
	Info,
	RefreshCw,
	X,
	XCircle,
} from 'lucide-react'
import React from 'react'

import type { VariantProps } from 'class-variance-authority'
import type { UIError } from '../types/ui-types'

const errorAlertVariants = cva(
	'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground',
	{
		variants: {
			variant: {
				destructive:
					'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive bg-destructive/5',
				warning:
					'border-yellow-500/50 text-yellow-700 dark:text-yellow-400 dark:border-yellow-500 [&>svg]:text-yellow-600 dark:[&>svg]:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20',
				info: 'border-blue-500/50 text-blue-700 dark:text-blue-400 dark:border-blue-500 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-400 bg-blue-50 dark:bg-blue-950/20',
				success:
					'border-green-500/50 text-green-700 dark:text-green-400 dark:border-green-500 [&>svg]:text-green-600 dark:[&>svg]:text-green-400 bg-green-50 dark:bg-green-950/20',
			},
		},
		defaultVariants: {
			variant: 'destructive',
		},
	}
)

interface ErrorAlertAction {
	label: string
	onClick: () => void
	variant?: 'default' | 'outline' | 'destructive' | 'secondary' | 'ghost' | 'link'
	icon?: React.ComponentType<{ className?: string }>
	loading?: boolean
}

interface ErrorAlertProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof errorAlertVariants> {
	error?: UIError | Error | string
	title?: string
	description?: string
	dismissible?: boolean
	onDismiss?: () => void
	actions?: ErrorAlertAction[]
	showErrorCode?: boolean
	showTimestamp?: boolean
	collapsible?: boolean
	className?: string
}

/**
 * Get appropriate icon for alert variant
 */
const getVariantIcon = (variant: ErrorAlertProps['variant']) => {
	switch (variant) {
		case 'destructive':
			return XCircle
		case 'warning':
			return AlertTriangle
		case 'info':
			return Info
		case 'success':
			return CheckCircle
		default:
			return AlertCircle
	}
}

/**
 * Extract error information from different error types
 */
const extractErrorInfo = (error: UIError | Error | string) => {
	if (typeof error === 'string') {
		return {
			message: error,
			code: undefined,
			field: undefined,
			details: undefined,
		}
	}

	if (error instanceof Error) {
		return {
			message: error.message,
			code: 'JAVASCRIPT_ERROR',
			field: undefined,
			details: { stack: error.stack },
		}
	}

	// UIError
	return {
		message: error.message,
		code: error.code,
		field: error.field,
		details: error.details,
	}
}

/**
 * Get user-friendly error messages and guidance based on error codes
 */
const getErrorGuidance = (code?: string): { title?: string; guidance?: string } => {
	const errorGuidance: Record<string, { title: string; guidance: string }> = {
		NETWORK_ERROR: {
			title: 'Connection Problem',
			guidance:
				'Please check your internet connection and try again. If the problem persists, the service may be temporarily unavailable.',
		},
		UNAUTHORIZED: {
			title: 'Access Denied',
			guidance:
				"You don't have permission to perform this action. Please contact your administrator if you believe this is an error.",
		},
		VALIDATION_ERROR: {
			title: 'Invalid Input',
			guidance: 'Please check the highlighted fields and correct any errors before submitting.',
		},
		SERVER_ERROR: {
			title: 'Server Error',
			guidance: 'An unexpected error occurred on our servers. Please try again in a few moments.',
		},
		TIMEOUT_ERROR: {
			title: 'Request Timeout',
			guidance:
				'The request took too long to complete. Please try again with a smaller data set or contact support.',
		},
		RATE_LIMIT_ERROR: {
			title: 'Too Many Requests',
			guidance: "You've made too many requests. Please wait a moment before trying again.",
		},
		NOT_FOUND: {
			title: 'Resource Not Found',
			guidance: 'The requested resource could not be found. It may have been deleted or moved.',
		},
		COMPLIANCE_ERROR: {
			title: 'Compliance Validation Failed',
			guidance:
				"The report configuration doesn't meet compliance requirements. Please review the settings and try again.",
		},
		EXECUTION_ERROR: {
			title: 'Report Execution Failed',
			guidance:
				'The report could not be generated. Check the configuration and data availability, then try again.',
		},
	}

	return errorGuidance[code || ''] || {}
}

/**
 * Reusable error alert component with different variants and user guidance
 *
 * Features:
 * - Multiple alert variants (destructive, warning, info, success)
 * - Dismissible alerts with close button
 * - Action buttons for error recovery
 * - Error categorization and user guidance
 * - Collapsible error details
 * - Error code display for support
 * - Timestamp display
 *
 * Requirements: 8.1, 8.3
 */
export const ErrorAlert: React.FC<ErrorAlertProps> = ({
	error,
	title,
	description,
	variant = 'destructive',
	dismissible = false,
	onDismiss,
	actions = [],
	showErrorCode = false,
	showTimestamp = false,
	collapsible = false,
	className,
	...props
}) => {
	const [isCollapsed, setIsCollapsed] = React.useState(collapsible)
	const [showDetails, setShowDetails] = React.useState(false)

	const errorInfo = error ? extractErrorInfo(error) : null
	const guidance = errorInfo ? getErrorGuidance(errorInfo.code) : {}
	const Icon = getVariantIcon(variant)

	const displayTitle = title || guidance.title || 'Error'
	const displayDescription = description || errorInfo?.message || guidance.guidance

	const copyErrorDetails = async () => {
		if (!errorInfo) return

		const details = {
			code: errorInfo.code,
			message: errorInfo.message,
			field: errorInfo.field,
			details: errorInfo.details,
			timestamp: new Date().toISOString(),
		}

		try {
			await navigator.clipboard.writeText(JSON.stringify(details, null, 2))
			// Could show a toast notification here
		} catch (err) {
			console.error('Failed to copy error details:', err)
		}
	}

	if (isCollapsed) {
		return (
			<div
				className={cn(
					'flex items-center gap-2 p-2 rounded border border-border/50 bg-muted/30',
					className
				)}
			>
				<Icon className="h-4 w-4 text-muted-foreground" />
				<span className="text-sm text-muted-foreground flex-1">{displayTitle}</span>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setIsCollapsed(false)}
					className="h-6 px-2 text-xs"
				>
					Show
				</Button>
				{dismissible && onDismiss && (
					<Button variant="ghost" size="sm" onClick={onDismiss} className="h-6 w-6 p-0">
						<X className="h-3 w-3" />
					</Button>
				)}
			</div>
		)
	}

	return (
		<Alert className={cn(errorAlertVariants({ variant }), className)} {...props}>
			<Icon className="h-4 w-4" />

			{/* Dismiss button */}
			{dismissible && onDismiss && (
				<Button
					variant="ghost"
					size="sm"
					onClick={onDismiss}
					className="absolute right-2 top-2 h-6 w-6 p-0 hover:bg-transparent"
				>
					<X className="h-3 w-3" />
				</Button>
			)}

			{/* Collapse button */}
			{collapsible && (
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setIsCollapsed(true)}
					className="absolute right-8 top-2 h-6 w-6 p-0 hover:bg-transparent"
				>
					<X className="h-3 w-3" />
				</Button>
			)}

			<div className="space-y-2">
				<AlertTitle className="flex items-center gap-2">
					{displayTitle}
					{showTimestamp && (
						<span className="text-xs font-normal text-muted-foreground">
							{new Date().toLocaleTimeString()}
						</span>
					)}
				</AlertTitle>

				<AlertDescription>{displayDescription}</AlertDescription>

				{/* Error code and field information */}
				{(showErrorCode || errorInfo?.field) && errorInfo && (
					<div className="flex flex-wrap gap-2 text-xs">
						{showErrorCode && errorInfo.code && (
							<span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded">
								<Bug className="h-3 w-3" />
								Code: {errorInfo.code}
							</span>
						)}
						{errorInfo.field && (
							<span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded">
								Field: {errorInfo.field}
							</span>
						)}
					</div>
				)}

				{/* Action buttons */}
				{actions.length > 0 && (
					<div className="flex flex-wrap gap-2 pt-2">
						{actions.map((action, index) => {
							const ActionIcon = action.icon
							return (
								<Button
									key={index}
									variant={action.variant || 'outline'}
									size="sm"
									onClick={action.onClick}
									disabled={action.loading}
									className="h-8"
								>
									{action.loading ? (
										<RefreshCw className="h-3 w-3 mr-1 animate-spin" />
									) : ActionIcon ? (
										<ActionIcon className="h-3 w-3 mr-1" />
									) : null}
									{action.label}
								</Button>
							)
						})}
					</div>
				)}

				{/* Error details toggle */}
				{errorInfo?.details && (
					<div className="pt-2 border-t border-border/50">
						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setShowDetails(!showDetails)}
								className="h-6 px-2 text-xs"
							>
								{showDetails ? 'Hide' : 'Show'} Details
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={copyErrorDetails}
								className="h-6 px-2 text-xs"
							>
								<Copy className="h-3 w-3 mr-1" />
								Copy
							</Button>
						</div>

						{showDetails && (
							<pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-32">
								{JSON.stringify(errorInfo.details, null, 2)}
							</pre>
						)}
					</div>
				)}
			</div>
		</Alert>
	)
}

/**
 * Specialized error alert components for common use cases
 */

export const NetworkErrorAlert: React.FC<Omit<ErrorAlertProps, 'variant'>> = (props) => (
	<ErrorAlert
		variant="destructive"
		title="Connection Error"
		actions={[
			{
				label: 'Retry',
				onClick: () => window.location.reload(),
				icon: RefreshCw,
			},
		]}
		{...props}
	/>
)

export const ValidationErrorAlert: React.FC<Omit<ErrorAlertProps, 'variant'>> = (props) => (
	<ErrorAlert variant="warning" title="Validation Error" showErrorCode {...props} />
)

export const SuccessAlert: React.FC<Omit<ErrorAlertProps, 'variant'>> = (props) => (
	<ErrorAlert variant="success" dismissible {...props} />
)

export const InfoAlert: React.FC<Omit<ErrorAlertProps, 'variant'>> = (props) => (
	<ErrorAlert variant="info" dismissible {...props} />
)

/**
 * Hook for managing error alerts in components
 */
export const useErrorAlert = () => {
	const [alerts, setAlerts] = React.useState<
		Array<{
			id: string
			props: ErrorAlertProps
		}>
	>([])

	const showAlert = React.useCallback((props: ErrorAlertProps) => {
		const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
		setAlerts((prev) => [...prev, { id, props }])
		return id
	}, [])

	const dismissAlert = React.useCallback((id: string) => {
		setAlerts((prev) => prev.filter((alert) => alert.id !== id))
	}, [])

	const clearAlerts = React.useCallback(() => {
		setAlerts([])
	}, [])

	return {
		alerts,
		showAlert,
		dismissAlert,
		clearAlerts,
	}
}

export type { ErrorAlertProps, ErrorAlertAction }
