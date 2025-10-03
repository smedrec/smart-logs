import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
	AlertCircle,
	AlertTriangle,
	Clock,
	Info,
	Lock,
	RefreshCw,
	Server,
	Shield,
	Wifi,
	WifiOff,
	X,
} from 'lucide-react'
import React from 'react'

import type { UIError } from '@/lib/compliance-error-handler'

interface AlertErrorAlertProps {
	error: UIError
	onDismiss?: () => void
	onRetry?: () => void
	className?: string
	showDetails?: boolean
	isRetrying?: boolean
	/**
	 * Whether to show the error in a compact format
	 */
	compact?: boolean
	/**
	 * Additional context information to display
	 */
	context?: string
	/**
	 * Custom action buttons
	 */
	actions?: React.ReactNode
}

/**
 * AlertErrorAlert component for displaying API failures and other errors in alert management
 *
 * Features:
 * - Reusable error alert component for API failures
 * - Dismissible alerts with action buttons
 * - Error categorization and user guidance
 * - Consistent styling with existing alert UI
 * - Support for retry functionality
 * - Accessibility compliant
 *
 * @example
 * ```tsx
 * <AlertErrorAlert
 *   error={apiError}
 *   onRetry={handleRetry}
 *   onDismiss={handleDismiss}
 *   showDetails={true}
 * />
 * ```
 */
export function AlertErrorAlert({
	error,
	onDismiss,
	onRetry,
	className,
	showDetails = false,
	isRetrying = false,
	compact = false,
	context,
	actions,
}: AlertErrorAlertProps) {
	const getVariant = () => {
		switch (error.severity) {
			case 'critical':
				return 'destructive'
			case 'high':
				return 'destructive'
			case 'medium':
				return 'default'
			case 'low':
				return 'default'
			default:
				return 'default'
		}
	}

	const getIcon = () => {
		// Icon based on error code for better visual categorization
		switch (error.code) {
			case 'NETWORK_ERROR':
				return <WifiOff className="h-4 w-4" />
			case 'TIMEOUT_ERROR':
				return <Clock className="h-4 w-4" />
			case 'AUTHENTICATION_ERROR':
				return <Lock className="h-4 w-4" />
			case 'AUTHORIZATION_ERROR':
				return <Shield className="h-4 w-4" />
			case 'SERVER_ERROR':
				return <Server className="h-4 w-4" />
			case 'RATE_LIMIT_ERROR':
				return <Clock className="h-4 w-4" />
			default:
				// Fallback to severity-based icons
				switch (error.severity) {
					case 'critical':
					case 'high':
						return <AlertCircle className="h-4 w-4" />
					case 'medium':
						return <AlertTriangle className="h-4 w-4" />
					case 'low':
						return <Info className="h-4 w-4" />
					default:
						return <AlertCircle className="h-4 w-4" />
				}
		}
	}

	const getTitle = () => {
		switch (error.code) {
			case 'NETWORK_ERROR':
				return 'Connection Error'
			case 'TIMEOUT_ERROR':
				return 'Request Timeout'
			case 'AUTHENTICATION_ERROR':
				return 'Authentication Required'
			case 'AUTHORIZATION_ERROR':
				return 'Access Denied'
			case 'SERVER_ERROR':
				return 'Server Error'
			case 'RATE_LIMIT_ERROR':
				return 'Rate Limited'
			case 'VALIDATION_ERROR':
				return 'Validation Error'
			default:
				return 'Error'
		}
	}

	const getSeverityBadge = () => {
		const severityColors = {
			critical: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400',
			high: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400',
			medium:
				'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400',
			low: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400',
		}

		return (
			<Badge variant="outline" className={cn('text-xs', severityColors[error.severity])}>
				{error.severity.toUpperCase()}
			</Badge>
		)
	}

	const getUserGuidance = () => {
		switch (error.code) {
			case 'NETWORK_ERROR':
				return 'Check your internet connection and try again.'
			case 'TIMEOUT_ERROR':
				return 'The server may be busy. Please wait a moment and try again.'
			case 'AUTHENTICATION_ERROR':
				return 'Please log in again to continue.'
			case 'AUTHORIZATION_ERROR':
				return 'Contact your administrator if you believe you should have access.'
			case 'SERVER_ERROR':
				return 'Our team has been notified. Please try again later.'
			case 'RATE_LIMIT_ERROR':
				return 'Please wait a few minutes before making more requests.'
			case 'VALIDATION_ERROR':
				return 'Please check your input and correct any errors.'
			default:
				return 'Please try again or contact support if the problem persists.'
		}
	}

	if (compact) {
		return (
			<div
				className={cn(
					'flex items-center gap-2 p-2 text-sm border rounded-md',
					error.severity === 'critical' || error.severity === 'high'
						? 'border-destructive/20 bg-destructive/5 text-destructive'
						: 'border-yellow-200 bg-yellow-50 text-yellow-800',
					className
				)}
			>
				{getIcon()}
				<span className="flex-1 truncate">{error.message}</span>
				{error.retryable && onRetry && (
					<Button
						variant="ghost"
						size="sm"
						onClick={onRetry}
						disabled={isRetrying}
						className="h-6 w-6 p-0"
					>
						<RefreshCw className={cn('h-3 w-3', isRetrying && 'animate-spin')} />
						<span className="sr-only">Retry</span>
					</Button>
				)}
				{onDismiss && (
					<Button variant="ghost" size="sm" onClick={onDismiss} className="h-6 w-6 p-0">
						<X className="h-3 w-3" />
						<span className="sr-only">Dismiss</span>
					</Button>
				)}
			</div>
		)
	}

	return (
		<Alert variant={getVariant()} className={cn('relative', className)}>
			{getIcon()}
			<div className="flex-1">
				<AlertTitle className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span>{getTitle()}</span>
						{getSeverityBadge()}
					</div>
					{onDismiss && (
						<Button
							variant="ghost"
							size="sm"
							onClick={onDismiss}
							className="h-6 w-6 p-0 hover:bg-transparent"
						>
							<X className="h-4 w-4" />
							<span className="sr-only">Dismiss</span>
						</Button>
					)}
				</AlertTitle>

				<AlertDescription className="mt-2">
					<div className="space-y-3">
						{/* Error Message */}
						<p>{error.message}</p>

						{/* User Guidance */}
						<p className="text-sm text-muted-foreground">{getUserGuidance()}</p>

						{/* Field-specific error (for validation errors) */}
						{error.field && (
							<p className="text-sm">
								<strong>Field:</strong> {error.field}
							</p>
						)}

						{/* Context Information */}
						{context && (
							<p className="text-xs text-muted-foreground">
								<strong>Context:</strong> {context}
							</p>
						)}

						{/* Technical Details */}
						{showDetails && error.details && (
							<details className="text-sm">
								<summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
									Technical Details
								</summary>
								<div className="mt-2 space-y-2">
									<div className="text-xs bg-muted p-3 rounded">
										<strong>Error Code:</strong> {error.code}
									</div>
									<div className="text-xs bg-muted p-3 rounded">
										<strong>Details:</strong>
										<pre className="mt-1 whitespace-pre-wrap overflow-auto">
											{JSON.stringify(error.details, null, 2)}
										</pre>
									</div>
								</div>
							</details>
						)}

						{/* Action Buttons */}
						<div className="flex flex-wrap gap-2 mt-3">
							{error.retryable && onRetry && (
								<Button
									variant="outline"
									size="sm"
									onClick={onRetry}
									disabled={isRetrying}
									className="h-8"
								>
									{isRetrying ? (
										<>
											<RefreshCw className="h-3 w-3 mr-1 animate-spin" />
											Retrying...
										</>
									) : (
										<>
											<RefreshCw className="h-3 w-3 mr-1" />
											Try Again
										</>
									)}
								</Button>
							)}

							{/* Custom Actions */}
							{actions}
						</div>
					</div>
				</AlertDescription>
			</div>
		</Alert>
	)
}

// Specialized error alerts for common alert management scenarios

interface AlertNetworkErrorProps {
	onRetry?: () => void
	onDismiss?: () => void
	isRetrying?: boolean
	context?: string
}

/**
 * Specialized network error alert for alert management operations
 */
export function AlertNetworkError({
	onRetry,
	onDismiss,
	isRetrying,
	context,
}: AlertNetworkErrorProps) {
	const error: UIError = {
		code: 'NETWORK_ERROR',
		message: 'Unable to connect to the alert service. Please check your internet connection.',
		retryable: true,
		severity: 'high',
	}

	return (
		<AlertErrorAlert
			error={error}
			onRetry={onRetry}
			onDismiss={onDismiss}
			isRetrying={isRetrying}
			context={context}
		/>
	)
}

interface AlertAuthenticationErrorProps {
	onLogin?: () => void
	onDismiss?: () => void
	context?: string
}

/**
 * Specialized authentication error alert for alert management
 */
export function AlertAuthenticationError({
	onLogin,
	onDismiss,
	context,
}: AlertAuthenticationErrorProps) {
	const error: UIError = {
		code: 'AUTHENTICATION_ERROR',
		message: 'Your session has expired. Please log in again to continue managing alerts.',
		retryable: false,
		severity: 'critical',
	}

	return (
		<AlertErrorAlert
			error={error}
			onDismiss={onDismiss}
			context={context}
			actions={
				onLogin && (
					<Button variant="default" size="sm" onClick={onLogin}>
						<Lock className="h-3 w-3 mr-1" />
						Log In
					</Button>
				)
			}
		/>
	)
}

interface AlertServerErrorProps {
	onRetry?: () => void
	onDismiss?: () => void
	isRetrying?: boolean
	context?: string
}

/**
 * Specialized server error alert for alert management operations
 */
export function AlertServerError({
	onRetry,
	onDismiss,
	isRetrying,
	context,
}: AlertServerErrorProps) {
	const error: UIError = {
		code: 'SERVER_ERROR',
		message: 'The alert service is currently experiencing issues. Our team has been notified.',
		retryable: true,
		severity: 'high',
	}

	return (
		<AlertErrorAlert
			error={error}
			onRetry={onRetry}
			onDismiss={onDismiss}
			isRetrying={isRetrying}
			context={context}
		/>
	)
}

interface AlertValidationErrorProps {
	error: UIError
	onDismiss?: () => void
	context?: string
}

/**
 * Specialized validation error alert for alert management forms
 */
export function AlertValidationError({ error, onDismiss, context }: AlertValidationErrorProps) {
	const validationError: UIError = {
		...error,
		code: 'VALIDATION_ERROR',
		retryable: false,
		severity: 'low',
	}

	return (
		<AlertErrorAlert
			error={validationError}
			onDismiss={onDismiss}
			context={context}
			showDetails={false}
		/>
	)
}

interface AlertRateLimitErrorProps {
	onDismiss?: () => void
	retryAfter?: number
	context?: string
}

/**
 * Specialized rate limit error alert for alert management operations
 */
export function AlertRateLimitError({ onDismiss, retryAfter, context }: AlertRateLimitErrorProps) {
	const message = retryAfter
		? `Too many requests. Please wait ${retryAfter} seconds before trying again.`
		: 'Too many requests. Please wait a moment before trying again.'

	const error: UIError = {
		code: 'RATE_LIMIT_ERROR',
		message,
		retryable: true,
		severity: 'medium',
		details: retryAfter ? { retryAfter } : undefined,
	}

	return <AlertErrorAlert error={error} onDismiss={onDismiss} context={context} />
}

// Error alert list component for displaying multiple errors
interface AlertErrorListProps {
	errors: UIError[]
	onDismiss?: (index: number) => void
	onDismissAll?: () => void
	onRetry?: (index: number) => void
	className?: string
	maxVisible?: number
}

/**
 * Component for displaying multiple alert errors in a list format
 */
export function AlertErrorList({
	errors,
	onDismiss,
	onDismissAll,
	onRetry,
	className,
	maxVisible = 5,
}: AlertErrorListProps) {
	const visibleErrors = errors.slice(0, maxVisible)
	const hiddenCount = errors.length - maxVisible

	if (errors.length === 0) {
		return null
	}

	return (
		<div className={cn('space-y-2', className)}>
			{/* Dismiss All Button */}
			{errors.length > 1 && onDismissAll && (
				<div className="flex justify-end">
					<Button variant="ghost" size="sm" onClick={onDismissAll}>
						<X className="h-3 w-3 mr-1" />
						Dismiss All ({errors.length})
					</Button>
				</div>
			)}

			{/* Error List */}
			{visibleErrors.map((error, index) => (
				<AlertErrorAlert
					key={`${error.code}-${index}`}
					error={error}
					onDismiss={onDismiss ? () => onDismiss(index) : undefined}
					onRetry={onRetry ? () => onRetry(index) : undefined}
					compact={errors.length > 3}
				/>
			))}

			{/* Hidden Errors Indicator */}
			{hiddenCount > 0 && (
				<div className="text-center">
					<Badge variant="outline" className="text-xs">
						+{hiddenCount} more error{hiddenCount > 1 ? 's' : ''}
					</Badge>
				</div>
			)}
		</div>
	)
}
