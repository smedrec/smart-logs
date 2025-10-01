import { AlertCircle, AlertTriangle, Info, RefreshCw, X } from 'lucide-react'
import React from 'react'

import { cn } from '../../lib/utils'
import { Alert, AlertDescription, AlertTitle } from './alert'
import { Button } from './button'

import type { UIError } from '../../lib/compliance-error-handler'

interface ErrorAlertProps {
	error: UIError
	onDismiss?: () => void
	onRetry?: () => void
	className?: string
	showDetails?: boolean
	isRetrying?: boolean
}

export function ErrorAlert({
	error,
	onDismiss,
	onRetry,
	className,
	showDetails = false,
	isRetrying = false,
}: ErrorAlertProps) {
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

	return (
		<Alert variant={getVariant()} className={cn('relative', className)}>
			{getIcon()}
			<div className="flex-1">
				<AlertTitle className="flex items-center justify-between">
					<span>Error</span>
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
					<div className="space-y-2">
						<p>{error.message}</p>

						{showDetails && error.details && (
							<details className="text-sm">
								<summary className="cursor-pointer font-medium">Technical Details</summary>
								<pre className="mt-2 whitespace-pre-wrap text-xs bg-muted p-2 rounded">
									{JSON.stringify(error.details, null, 2)}
								</pre>
							</details>
						)}

						{error.retryable && onRetry && (
							<div className="flex gap-2 mt-3">
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
							</div>
						)}
					</div>
				</AlertDescription>
			</div>
		</Alert>
	)
}

// Specialized error alerts for different contexts
interface NetworkErrorAlertProps {
	onRetry?: () => void
	onDismiss?: () => void
	isRetrying?: boolean
}

export function NetworkErrorAlert({ onRetry, onDismiss, isRetrying }: NetworkErrorAlertProps) {
	const error: UIError = {
		code: 'NETWORK_ERROR',
		message: 'Unable to connect to the server. Please check your internet connection.',
		retryable: true,
		severity: 'high',
	}

	return (
		<ErrorAlert error={error} onRetry={onRetry} onDismiss={onDismiss} isRetrying={isRetrying} />
	)
}

interface AuthenticationErrorAlertProps {
	onLogin?: () => void
	onDismiss?: () => void
}

export function AuthenticationErrorAlert({ onLogin, onDismiss }: AuthenticationErrorAlertProps) {
	const error: UIError = {
		code: 'AUTHENTICATION_ERROR',
		message: 'Your session has expired. Please log in again to continue.',
		retryable: false,
		severity: 'critical',
	}

	return (
		<Alert variant="destructive">
			<AlertCircle className="h-4 w-4" />
			<div className="flex-1">
				<AlertTitle className="flex items-center justify-between">
					<span>Authentication Required</span>
					{onDismiss && (
						<Button
							variant="ghost"
							size="sm"
							onClick={onDismiss}
							className="h-6 w-6 p-0 hover:bg-transparent"
						>
							<X className="h-4 w-4" />
						</Button>
					)}
				</AlertTitle>
				<AlertDescription className="mt-2">
					<div className="space-y-3">
						<p>{error.message}</p>
						{onLogin && (
							<Button variant="outline" size="sm" onClick={onLogin}>
								Log In
							</Button>
						)}
					</div>
				</AlertDescription>
			</div>
		</Alert>
	)
}

// Error boundary fallback component
interface ErrorBoundaryFallbackProps {
	error: Error
	resetError: () => void
}

export function ErrorBoundaryFallback({ error, resetError }: ErrorBoundaryFallbackProps) {
	return (
		<div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
			<AlertCircle className="h-12 w-12 text-destructive mb-4" />
			<h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
			<p className="text-muted-foreground mb-4 max-w-md">
				An unexpected error occurred in the compliance system. Please try refreshing the page.
			</p>

			<div className="flex gap-2">
				<Button onClick={resetError} variant="outline">
					Try Again
				</Button>
				<Button onClick={() => window.location.reload()} variant="default">
					Refresh Page
				</Button>
			</div>

			<details className="mt-6 text-left">
				<summary className="cursor-pointer text-sm text-muted-foreground">
					Technical Details
				</summary>
				<pre className="mt-2 text-xs bg-muted p-3 rounded max-w-md overflow-auto">
					{error.message}
					{'\n\n'}
					{error.stack}
				</pre>
			</details>
		</div>
	)
}
