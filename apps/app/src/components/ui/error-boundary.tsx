import React, { Component, ReactNode } from 'react'

import { logError, transformError } from '../../lib/compliance-error-handler'
import { ErrorBoundaryFallback } from './error-alert'

interface ErrorBoundaryState {
	hasError: boolean
	error: Error | null
}

interface ErrorBoundaryProps {
	children: ReactNode
	fallback?: React.ComponentType<{ error: Error; resetError: () => void }>
	onError?: (error: Error, errorInfo: React.ErrorInfo) => void
	context?: string
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props)
		this.state = { hasError: false, error: null }
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error }
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		// Log the error
		const uiError = transformError(error)
		logError(uiError, `Error Boundary: ${this.props.context || 'Unknown'}`)

		// Call custom error handler if provided
		this.props.onError?.(error, errorInfo)

		// In production, you might want to send to error tracking service
		if (process.env.NODE_ENV === 'production') {
			// Example: errorTrackingService.captureException(error, { extra: errorInfo })
		}
	}

	resetError = () => {
		this.setState({ hasError: false, error: null })
	}

	render() {
		if (this.state.hasError && this.state.error) {
			const FallbackComponent = this.props.fallback || ErrorBoundaryFallback
			return <FallbackComponent error={this.state.error} resetError={this.resetError} />
		}

		return this.props.children
	}
}

// Specialized error boundary for compliance features
export function ComplianceErrorBoundary({ children }: { children: ReactNode }) {
	return (
		<ErrorBoundary
			context="Compliance System"
			onError={(error, errorInfo) => {
				console.error('Compliance Error Boundary:', error, errorInfo)
			}}
		>
			{children}
		</ErrorBoundary>
	)
}

// Hook for using error boundary in functional components
export function useErrorBoundary() {
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
