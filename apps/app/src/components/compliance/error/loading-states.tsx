import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react'
import React from 'react'

interface LoadingStateProps {
	className?: string
	children?: React.ReactNode
}

interface ProgressLoadingProps extends LoadingStateProps {
	progress: number
	message?: string
	estimatedTime?: string
	showPercentage?: boolean
}

interface OperationLoadingProps extends LoadingStateProps {
	operation: string
	description?: string
	steps?: Array<{
		label: string
		status: 'pending' | 'running' | 'completed' | 'error'
	}>
}

/**
 * Basic loading spinner component
 */
export const LoadingSpinner: React.FC<LoadingStateProps> = ({ className, children }) => (
	<div className={cn('flex items-center justify-center gap-2', className)}>
		<Loader2 className="h-4 w-4 animate-spin" />
		{children && <span className="text-sm text-muted-foreground">{children}</span>}
	</div>
)

/**
 * Inline loading indicator for buttons and small components
 */
export const InlineLoading: React.FC<LoadingStateProps> = ({ className, children }) => (
	<span className={cn('inline-flex items-center gap-2', className)}>
		<Loader2 className="h-3 w-3 animate-spin" />
		{children}
	</span>
)

/**
 * Full page loading overlay
 */
export const PageLoading: React.FC<LoadingStateProps & { message?: string }> = ({
	className,
	message = 'Loading...',
}) => (
	<div
		className={cn(
			'fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center',
			className
		)}
	>
		<Card className="w-full max-w-sm">
			<CardContent className="pt-6">
				<div className="flex flex-col items-center space-y-4">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
					<p className="text-sm text-muted-foreground text-center">{message}</p>
				</div>
			</CardContent>
		</Card>
	</div>
)

/**
 * Progress loading indicator with percentage and estimated time
 */
export const ProgressLoading: React.FC<ProgressLoadingProps> = ({
	progress,
	message,
	estimatedTime,
	showPercentage = true,
	className,
}) => (
	<div className={cn('space-y-3', className)}>
		<div className="flex items-center justify-between">
			<span className="text-sm font-medium">{message || 'Processing...'}</span>
			{showPercentage && (
				<span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
			)}
		</div>
		<Progress value={progress} className="h-2" />
		{estimatedTime && (
			<div className="flex items-center gap-1 text-xs text-muted-foreground">
				<Clock className="h-3 w-3" />
				{estimatedTime} remaining
			</div>
		)}
	</div>
)

/**
 * Operation loading with step-by-step progress
 */
export const OperationLoading: React.FC<OperationLoadingProps> = ({
	operation,
	description,
	steps = [],
	className,
}) => {
	const getStepIcon = (status: string) => {
		switch (status) {
			case 'completed':
				return <CheckCircle className="h-4 w-4 text-green-500" />
			case 'running':
				return <Loader2 className="h-4 w-4 animate-spin text-primary" />
			case 'error':
				return <AlertCircle className="h-4 w-4 text-destructive" />
			default:
				return <div className="h-4 w-4 rounded-full border-2 border-muted" />
		}
	}

	return (
		<Card className={cn('w-full max-w-md', className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Loader2 className="h-5 w-5 animate-spin" />
					{operation}
				</CardTitle>
				{description && <CardDescription>{description}</CardDescription>}
			</CardHeader>
			{steps.length > 0 && (
				<CardContent>
					<div className="space-y-3">
						{steps.map((step, index) => (
							<div key={index} className="flex items-center gap-3">
								{getStepIcon(step.status)}
								<span
									className={cn(
										'text-sm',
										step.status === 'completed' && 'text-muted-foreground',
										step.status === 'running' && 'font-medium',
										step.status === 'error' && 'text-destructive'
									)}
								>
									{step.label}
								</span>
							</div>
						))}
					</div>
				</CardContent>
			)}
		</Card>
	)
}

/**
 * Skeleton loading components for different UI elements
 */

export const TableSkeleton: React.FC<{ rows?: number; columns?: number; className?: string }> = ({
	rows = 5,
	columns = 4,
	className,
}) => (
	<div className={cn('space-y-3', className)}>
		{/* Table header */}
		<div className="flex gap-4">
			{Array.from({ length: columns }).map((_, i) => (
				<Skeleton key={i} className="h-4 flex-1" />
			))}
		</div>
		{/* Table rows */}
		{Array.from({ length: rows }).map((_, rowIndex) => (
			<div key={rowIndex} className="flex gap-4">
				{Array.from({ length: columns }).map((_, colIndex) => (
					<Skeleton key={colIndex} className="h-8 flex-1" />
				))}
			</div>
		))}
	</div>
)

export const CardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
	<Card className={className}>
		<CardHeader>
			<Skeleton className="h-5 w-3/4" />
			<Skeleton className="h-4 w-1/2" />
		</CardHeader>
		<CardContent className="space-y-3">
			<Skeleton className="h-4 w-full" />
			<Skeleton className="h-4 w-5/6" />
			<Skeleton className="h-4 w-2/3" />
		</CardContent>
	</Card>
)

export const FormSkeleton: React.FC<{ fields?: number; className?: string }> = ({
	fields = 4,
	className,
}) => (
	<div className={cn('space-y-6', className)}>
		{Array.from({ length: fields }).map((_, index) => (
			<div key={index} className="space-y-2">
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-10 w-full" />
			</div>
		))}
		<div className="flex gap-3 pt-4">
			<Skeleton className="h-10 w-20" />
			<Skeleton className="h-10 w-16" />
		</div>
	</div>
)

export const DashboardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
	<div className={cn('space-y-6', className)}>
		{/* Stats cards */}
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			{Array.from({ length: 4 }).map((_, i) => (
				<Card key={i}>
					<CardContent className="p-6">
						<div className="space-y-2">
							<Skeleton className="h-4 w-16" />
							<Skeleton className="h-8 w-12" />
						</div>
					</CardContent>
				</Card>
			))}
		</div>

		{/* Main content area */}
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<CardSkeleton />
			<CardSkeleton />
		</div>

		{/* Table area */}
		<Card>
			<CardHeader>
				<Skeleton className="h-6 w-48" />
			</CardHeader>
			<CardContent>
				<TableSkeleton />
			</CardContent>
		</Card>
	</div>
)

export const ReportExecutionSkeleton: React.FC<{ className?: string }> = ({ className }) => (
	<div className={cn('space-y-4', className)}>
		{/* Execution header */}
		<div className="flex items-center justify-between">
			<div className="space-y-2">
				<Skeleton className="h-6 w-48" />
				<Skeleton className="h-4 w-32" />
			</div>
			<Skeleton className="h-10 w-24" />
		</div>

		{/* Progress section */}
		<Card>
			<CardContent className="pt-6">
				<div className="space-y-4">
					<div className="flex justify-between">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-4 w-12" />
					</div>
					<Skeleton className="h-2 w-full" />
					<Skeleton className="h-4 w-32" />
				</div>
			</CardContent>
		</Card>

		{/* Execution steps */}
		<Card>
			<CardHeader>
				<Skeleton className="h-5 w-32" />
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					{Array.from({ length: 4 }).map((_, i) => (
						<div key={i} className="flex items-center gap-3">
							<Skeleton className="h-4 w-4 rounded-full" />
							<Skeleton className="h-4 flex-1" />
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	</div>
)

/**
 * Higher-order component for adding loading states to any component
 */
export const withLoadingState = <P extends object>(
	Component: React.ComponentType<P>,
	LoadingSkeleton: React.ComponentType<{ className?: string }> = CardSkeleton
) => {
	return React.forwardRef<any, P & { loading?: boolean; className?: string }>((props, ref) => {
		const { loading, className, ...componentProps } = props

		if (loading) {
			return <LoadingSkeleton className={className} />
		}

		return <Component ref={ref} {...(componentProps as P)} />
	})
}

/**
 * Hook for managing loading states
 */
export const useLoadingState = (initialState = false) => {
	const [loading, setLoading] = React.useState(initialState)
	const [progress, setProgress] = React.useState(0)
	const [message, setMessage] = React.useState<string>()

	const startLoading = React.useCallback((loadingMessage?: string) => {
		setLoading(true)
		setProgress(0)
		setMessage(loadingMessage)
	}, [])

	const updateProgress = React.useCallback((newProgress: number, progressMessage?: string) => {
		setProgress(Math.max(0, Math.min(100, newProgress)))
		if (progressMessage) {
			setMessage(progressMessage)
		}
	}, [])

	const stopLoading = React.useCallback(() => {
		setLoading(false)
		setProgress(0)
		setMessage(undefined)
	}, [])

	return {
		loading,
		progress,
		message,
		startLoading,
		updateProgress,
		stopLoading,
	}
}

/**
 * Hook for managing async operations with loading states
 */
export const useAsyncOperation = <T extends any[], R>(operation: (...args: T) => Promise<R>) => {
	const [loading, setLoading] = React.useState(false)
	const [error, setError] = React.useState<Error | null>(null)
	const [data, setData] = React.useState<R | null>(null)

	const execute = React.useCallback(
		async (...args: T) => {
			try {
				setLoading(true)
				setError(null)
				const result = await operation(...args)
				setData(result)
				return result
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Unknown error')
				setError(error)
				throw error
			} finally {
				setLoading(false)
			}
		},
		[operation]
	)

	const reset = React.useCallback(() => {
		setLoading(false)
		setError(null)
		setData(null)
	}, [])

	return {
		loading,
		error,
		data,
		execute,
		reset,
	}
}

export type { LoadingStateProps, ProgressLoadingProps, OperationLoadingProps }
