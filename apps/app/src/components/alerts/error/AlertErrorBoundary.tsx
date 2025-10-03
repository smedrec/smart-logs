import { logError, transformError } from '@/lib/compliance-error-handler'
import React, { Component, ReactNode } from 'react'

import { AlertErrorAlert } from './AlertErrorAlert'

import type { UIError } from '@/lib/compliance-error-handler'

interface AlertErrorBoundaryState {
	hasError: boolean
	error: UIError | null
	errorInfo: React.ErrorInfo | null
}

interface AlertErrorBoundaryProps {
	children: ReactNode
	/**
	 * Custom fallback component to render when an error occurs
	 */
	fallback?: React.ComponentType<{
		error: UIError
		resetError: () => void
		errorInfo?: React.ErrorInfo
	}>
	/**
	 * Callback function called when an error occurs
	 */
	onError?: (error: UIError, errorInfo: React.ErrorInfo) => void
	/**
	 * Context identifier for error reporting
	 */
	context?: string
	/**
	 * Whether to show detailed error information (useful for development)
	 */
	showDetails?: boolean
	/**
	 * Custom error recovery function
	 */
	onRecover?: () => Promise<void> | void
}

/**
 * AlertErrorBoundary component specifically designed for alert management components
 *
 * Features:
 * - Catches JavaScript errors in alert component tree
 * - Transforms errors to UI-friendly format
 * - Provides error reporting and recovery functionality
 * - User-friendly error display with retry options
 * - Integration with existing error handling system
 *
 * @example
 * ```tsx
 * <AlertErrorBoundary context="Alert Dashboard">
 *   <AlertDashboard />
 * </AlertErrorBoundary>
 * ```
 */
export class AlertErrorBoundary extends Component<
	AlertErrorBoundaryProps,
	AlertErrorBoundaryState
> {
	private retryCount = 0
	private readonly maxRetries = 3

	constructor(props: AlertErrorBoundaryProps) {
		super(props)
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
		}
	}

	static getDerivedStateFromError(error: Error): Partial<AlertErrorBoundaryState> {
		// Transform the error to UI-friendly format
		const uiError = transformError(error)
		return {
			hasError: true,
			error: uiError,
		}
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		// Transform error for UI display
		const uiError = transformError(error)

		// Update state with error info
		this.setState({ errorInfo })

		// Log the error with context
		const context = this.props.context || 'Alert Management'
		logError(uiError, `Alert Error Boundary: ${context}`)

		// Call custom error handler if provided
		this.props.onError?.(uiError, errorInfo)

		// In production, send to error tracking service
		if (process.env.NODE_ENV === 'production') {
			// Example: Send to error tracking service
			// errorTrackingService.captureException(error, {
			//   tags: { component: 'AlertErrorBoundary', context },
			//   extra: { errorInfo, uiError }
			// })
		}
	}

	resetError = async () => {
		// Attempt custom recovery if provided
		if (this.props.onRecover) {
			try {
				await this.props.onRecover()
			} catch (recoveryError) {
				console.warn('Alert error recovery failed:', recoveryError)
				// Don't prevent the reset, just log the recovery failure
			}
		}

		// Reset the error state
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null,
		})

		// Reset retry count
		this.retryCount = 0
	}

	handleRetry = async () => {
		if (this.retryCount >= this.maxRetries) {
			// Max retries reached, suggest page refresh
			if (window.confirm('Maximum retry attempts reached. Would you like to refresh the page?')) {
				window.location.reload()
			}
			return
		}

		this.retryCount++
		await this.resetError()
	}

	render() {
		if (this.state.hasError && this.state.error) {
			// Use custom fallback if provided
			if (this.props.fallback) {
				const FallbackComponent = this.props.fallback
				return (
					<FallbackComponent
						error={this.state.error}
						resetError={this.resetError}
						errorInfo={this.state.errorInfo || undefined}
					/>
				)
			}

			// Use default alert error display
			return (
				<AlertErrorBoundaryFallback
					error={this.state.error}
					errorInfo={this.state.errorInfo}
					onRetry={this.handleRetry}
					onReset={this.resetError}
					context={this.props.context}
					showDetails={this.props.showDetails}
					retryCount={this.retryCount}
					maxRetries={this.maxRetries}
				/>
			)
		}

		return this.props.children
	}
}

// Default fallback component for alert errors
interface AlertErrorBoundaryFallbackProps {
	error: UIError
	errorInfo: React.ErrorInfo | null
	onRetry: () => void
	onReset: () => void
	context?: string
	showDetails?: boolean
	retryCount: number
	maxRetries: number
}

function AlertErrorBoundaryFallback({
	error,
	errorInfo,
	onRetry,
	onReset,
	context = 'Alert Management',
	showDetails = false,
	retryCount,
	maxRetries,
}: AlertErrorBoundaryFallbackProps) {
	const canRetry = retryCount < maxRetries && error.retryable

	return (
		<div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center border border-destructive/20 rounded-lg bg-destructive/5">
			<div className="max-w-md space-y-4">
				{/* Error Alert */}
				<AlertErrorAlert
					error={error}
					onRetry={canRetry ? onRetry : undefined}
					onDismiss={onReset}
					showDetails={showDetails}
					className="text-left"
				/>

				{/* Additional Actions */}
				<div className="flex flex-col sm:flex-row gap-2 justify-center">
					{canRetry && (
						<button
							onClick={onRetry}
							className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
						>
							Try Again ({maxRetries - retryCount} attempts left)
						</button>
					)}

					<button
						onClick={() => window.location.reload()}
						className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
					>
						Refresh Page
					</button>
				</div>

				{/* Context Information */}
				{context && <p className="text-xs text-muted-foreground">Error occurred in: {context}</p>}

				{/* Technical Details (Development/Debug) */}
				{showDetails && errorInfo && (
					<details className="mt-4 text-left">
						<summary className="cursor-pointer text-sm font-medium text-muted-foreground">
							Technical Details
						</summary>
						<div className="mt-2 space-y-2">
							<div className="text-xs bg-muted p-3 rounded">
								<strong>Component Stack:</strong>
								<pre className="mt-1 whitespace-pre-wrap">{errorInfo.componentStack}</pre>
							</div>
							{error.details && (
								<div className="text-xs bg-muted p-3 rounded">
									<strong>Error Details:</strong>
									<pre className="mt-1 whitespace-pre-wrap">
										{JSON.stringify(error.details, null, 2)}
									</pre>
								</div>
							)}
						</div>
					</details>
				)}
			</div>
		</div>
	)
}

// Specialized error boundaries for different alert contexts

/**
 * Error boundary specifically for alert dashboard components
 */
export function AlertDashboardErrorBoundary({ children }: { children: ReactNode }) {
	return (
		<AlertErrorBoundary
			context="Alert Dashboard"
			showDetails={process.env.NODE_ENV === 'development'}
			onError={(error, errorInfo) => {
				console.error('Alert Dashboard Error:', error, errorInfo)
			}}
		>
			{children}
		</AlertErrorBoundary>
	)
}

/**
 * Error boundary specifically for alert list components
 */
export function AlertListErrorBoundary({ children }: { children: ReactNode }) {
	return (
		<AlertErrorBoundary
			context="Alert List"
			showDetails={process.env.NODE_ENV === 'development'}
			onError={(error, errorInfo) => {
				console.error('Alert List Error:', error, errorInfo)
			}}
		>
			{children}
		</AlertErrorBoundary>
	)
}

/**
 * Error boundary specifically for alert notification components
 */
export function AlertNotificationErrorBoundary({ children }: { children: ReactNode }) {
	return (
		<AlertErrorBoundary
			context="Alert Notifications"
			showDetails={process.env.NODE_ENV === 'development'}
			onError={(error, errorInfo) => {
				console.error('Alert Notification Error:', error, errorInfo)
			}}
		>
			{children}
		</AlertErrorBoundary>
	)
}

/**
 * Error boundary specifically for alert form components
 */
export function AlertFormErrorBoundary({ children }: { children: ReactNode }) {
	return (
		<AlertErrorBoundary
			context="Alert Forms"
			showDetails={process.env.NODE_ENV === 'development'}
			onError={(error, errorInfo) => {
				console.error('Alert Form Error:', error, errorInfo)
			}}
		>
			{children}
		</AlertErrorBoundary>
	)
}

// Hook for using error boundary in functional components
export function useAlertErrorBoundary() {
	const [error, setError] = React.useState<Error | null>(null)

	const resetError = React.useCallback(() => {
		setError(null)
	}, [])

	const captureError = React.useCallback((error: Error) => {
		setError(error)
	}, [])

	React.useEffect(() => {
		if (error) {
			throw error
		}
	}, [error])

	return { captureError, resetError }
}
