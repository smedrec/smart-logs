import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AlertTriangle, Bug, Home, RefreshCw } from 'lucide-react'
import React, { Component } from 'react'

import type { ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryState {
	hasError: boolean
	error: Error | null
	errorInfo: ErrorInfo | null
	errorId: string
}

interface ErrorBoundaryProps {
	children: ReactNode
	fallback?: React.ComponentType<ErrorFallbackProps>
	onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void
	className?: string
	showErrorDetails?: boolean
}

interface ErrorFallbackProps {
	error: Error
	errorInfo: ErrorInfo
	resetError: () => void
	errorId: string
	showDetails?: boolean
}

/**
 * Default error fallback component with user-friendly error display and recovery options
 */
const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({
	error,
	errorInfo,
	resetError,
	errorId,
	showDetails = false,
}) => {
	const [showFullError, setShowFullError] = React.useState(false)
	const [isRetrying, setIsRetrying] = React.useState(false)

	const handleRetry = async () => {
		setIsRetrying(true)
		// Add a small delay to show loading state
		await new Promise((resolve) => setTimeout(resolve, 500))
		resetError()
		setIsRetrying(false)
	}

	const handleReportError = () => {
		// In a real implementation, this would send error details to an error reporting service
		console.error('Error reported:', { error, errorInfo, errorId })
		// Could integrate with services like Sentry, LogRocket, etc.
	}

	const goHome = () => {
		window.location.href = '/'
	}

	return (
		<div className="min-h-[400px] flex items-center justify-center p-4">
			<Card className="w-full max-w-2xl">
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
						<AlertTriangle className="h-6 w-6 text-destructive" />
					</div>
					<CardTitle className="text-xl">Something went wrong</CardTitle>
					<CardDescription>
						We encountered an unexpected error in the compliance reporting system. Don't worry -
						your data is safe and this issue has been logged.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Error ID for support */}
					<Alert>
						<Bug className="h-4 w-4" />
						<AlertTitle>Error ID</AlertTitle>
						<AlertDescription>
							Reference this ID when contacting support:{' '}
							<code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">{errorId}</code>
						</AlertDescription>
					</Alert>

					{/* Action buttons */}
					<div className="flex flex-col sm:flex-row gap-3 justify-center">
						<Button onClick={handleRetry} disabled={isRetrying} className="flex items-center gap-2">
							<RefreshCw className={cn('h-4 w-4', isRetrying && 'animate-spin')} />
							{isRetrying ? 'Retrying...' : 'Try Again'}
						</Button>
						<Button variant="outline" onClick={goHome} className="flex items-center gap-2">
							<Home className="h-4 w-4" />
							Go to Dashboard
						</Button>
						<Button
							variant="outline"
							onClick={handleReportError}
							className="flex items-center gap-2"
						>
							<Bug className="h-4 w-4" />
							Report Issue
						</Button>
					</div>

					{/* Error details toggle */}
					{showDetails && (
						<div className="pt-4 border-t">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setShowFullError(!showFullError)}
								className="mb-3"
							>
								{showFullError ? 'Hide' : 'Show'} Technical Details
							</Button>

							{showFullError && (
								<div className="space-y-3">
									<div>
										<h4 className="font-medium text-sm mb-2">Error Message:</h4>
										<pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-32">
											{error.message}
										</pre>
									</div>

									<div>
										<h4 className="font-medium text-sm mb-2">Stack Trace:</h4>
										<pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48">
											{error.stack}
										</pre>
									</div>

									{errorInfo.componentStack && (
										<div>
											<h4 className="font-medium text-sm mb-2">Component Stack:</h4>
											<pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-32">
												{errorInfo.componentStack}
											</pre>
										</div>
									)}
								</div>
							)}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	)
}

/**
 * Application-wide error boundary component for compliance reporting system
 *
 * Features:
 * - Catches JavaScript errors anywhere in the child component tree
 * - Logs error information for debugging and monitoring
 * - Displays user-friendly error UI with recovery options
 * - Provides error reporting functionality
 * - Supports custom fallback components
 *
 * Requirements: 8.1, 8.2
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props)
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
			errorId: '',
		}
	}

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		// Generate unique error ID for tracking
		const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

		return {
			hasError: true,
			error,
			errorId,
		}
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		// Update state with error info
		this.setState({
			errorInfo,
		})

		// Log error for monitoring and debugging
		console.error('ErrorBoundary caught an error:', {
			error,
			errorInfo,
			errorId: this.state.errorId,
			timestamp: new Date().toISOString(),
			userAgent: navigator.userAgent,
			url: window.location.href,
		})

		// Call custom error handler if provided
		if (this.props.onError) {
			this.props.onError(error, errorInfo, this.state.errorId)
		}

		// In production, you might want to send this to an error reporting service
		if (process.env.NODE_ENV === 'production') {
			// Example: Send to error reporting service
			// errorReportingService.captureException(error, {
			//   extra: errorInfo,
			//   tags: { errorId: this.state.errorId, component: 'compliance' }
			// })
		}
	}

	resetError = () => {
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null,
			errorId: '',
		})
	}

	render() {
		if (this.state.hasError && this.state.error && this.state.errorInfo) {
			const FallbackComponent = this.props.fallback || DefaultErrorFallback

			return (
				<div className={cn('error-boundary-container', this.props.className)}>
					<FallbackComponent
						error={this.state.error}
						errorInfo={this.state.errorInfo}
						resetError={this.resetError}
						errorId={this.state.errorId}
						showDetails={this.props.showErrorDetails}
					/>
				</div>
			)
		}

		return this.props.children
	}
}

/**
 * Hook for using error boundary functionality in functional components
 */
export const useErrorHandler = () => {
	const [error, setError] = React.useState<Error | null>(null)

	const resetError = React.useCallback(() => {
		setError(null)
	}, [])

	const captureError = React.useCallback((error: Error) => {
		setError(error)
	}, [])

	// Throw error to be caught by nearest error boundary
	React.useEffect(() => {
		if (error) {
			throw error
		}
	}, [error])

	return { captureError, resetError }
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export const withErrorBoundary = <P extends object>(
	Component: React.ComponentType<P>,
	errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) => {
	const WrappedComponent = (props: P) => (
		<ErrorBoundary {...errorBoundaryProps}>
			<Component {...props} />
		</ErrorBoundary>
	)

	WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

	return WrappedComponent
}

export type { ErrorBoundaryProps, ErrorFallbackProps }
