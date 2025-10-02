/**
 * Lazy Loading Components
 *
 * Lazy-loaded versions of heavy compliance components for better performance
 */

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2 } from 'lucide-react'
import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'

// Loading fallback components
const ComponentSkeleton = ({ height = 200 }: { height?: number }) => (
	<Card>
		<CardContent className="p-6">
			<div className="animate-pulse space-y-4">
				<Skeleton className="h-4 w-1/4" />
				<Skeleton className={`h-${height} w-full`} />
				<div className="flex gap-2">
					<Skeleton className="h-8 w-20" />
					<Skeleton className="h-8 w-20" />
				</div>
			</div>
		</CardContent>
	</Card>
)

const LoadingSpinner = ({ message = 'Loading...' }: { message?: string }) => (
	<div className="flex items-center justify-center p-8">
		<Loader2 className="h-6 w-6 animate-spin mr-2" />
		<span className="text-muted-foreground">{message}</span>
	</div>
)

// Lazy-loaded components
export const LazyTemplateForm = lazy(() =>
	import('../templates/template-form').then((module) => ({
		default: module.TemplateForm,
	}))
)

export const LazyTemplateVersionManager = lazy(() =>
	import('../templates/template-version-manager').then((module) => ({
		default: module.TemplateVersionManager,
	}))
)

export const LazyTemplateSharingManager = lazy(() =>
	import('../templates/template-sharing-manager').then((module) => ({
		default: module.TemplateSharingManager,
	}))
)

export const LazyExportManager = lazy(() =>
	import('../export/export-manager').then((module) => ({
		default: module.ExportManager,
	}))
)

export const LazyReportConfigurationForm = lazy(() =>
	import('../forms/report-configuration-form').then((module) => ({
		default: module.ReportConfigurationForm,
	}))
)

export const LazyExecutionDetails = lazy(() =>
	import('../execution/execution-details').then((module) => ({
		default: module.ExecutionDetails,
	}))
)

export const LazyExecutionTimeline = lazy(() =>
	import('../execution/execution-timeline').then((module) => ({
		default: module.ExecutionTimeline,
	}))
)

export const LazyManualExecutionDialog = lazy(() =>
	import('../manual/manual-execution-dialog').then((module) => ({
		default: module.ManualExecutionDialog,
	}))
)

// Wrapper components with suspense
interface LazyWrapperProps {
	children: React.ReactNode
	fallback?: React.ReactNode
	height?: number
}

export const LazyWrapper = ({ children, fallback, height }: LazyWrapperProps) => (
	<Suspense fallback={fallback || <ComponentSkeleton height={height} />}>{children}</Suspense>
)

// Specific lazy component wrappers
export const LazyTemplateFormWrapper = (props: any) => (
	<LazyWrapper fallback={<LoadingSpinner message="Loading template form..." />}>
		<LazyTemplateForm {...props} />
	</LazyWrapper>
)

export const LazyTemplateVersionManagerWrapper = (props: any) => (
	<LazyWrapper fallback={<LoadingSpinner message="Loading version history..." />}>
		<LazyTemplateVersionManager {...props} />
	</LazyWrapper>
)

export const LazyTemplateSharingManagerWrapper = (props: any) => (
	<LazyWrapper fallback={<LoadingSpinner message="Loading sharing settings..." />}>
		<LazyTemplateSharingManager {...props} />
	</LazyWrapper>
)

export const LazyExportManagerWrapper = (props: any) => (
	<LazyWrapper fallback={<LoadingSpinner message="Loading export options..." />}>
		<LazyExportManager {...props} />
	</LazyWrapper>
)

export const LazyReportConfigurationFormWrapper = (props: any) => (
	<LazyWrapper fallback={<LoadingSpinner message="Loading report configuration..." />}>
		<LazyReportConfigurationForm {...props} />
	</LazyWrapper>
)

export const LazyExecutionDetailsWrapper = (props: any) => (
	<LazyWrapper fallback={<LoadingSpinner message="Loading execution details..." />}>
		<LazyExecutionDetails {...props} />
	</LazyWrapper>
)

export const LazyExecutionTimelineWrapper = (props: any) => (
	<LazyWrapper fallback={<LoadingSpinner message="Loading execution timeline..." />}>
		<LazyExecutionTimeline {...props} />
	</LazyWrapper>
)

export const LazyManualExecutionDialogWrapper = (props: any) => (
	<LazyWrapper fallback={<LoadingSpinner message="Loading execution dialog..." />}>
		<LazyManualExecutionDialog {...props} />
	</LazyWrapper>
)

// Hook for preloading components
export const usePreloadComponents = () => {
	const preloadTemplateForm = () => import('../templates/template-form')
	const preloadVersionManager = () => import('../templates/template-version-manager')
	const preloadSharingManager = () => import('../templates/template-sharing-manager')
	const preloadExportManager = () => import('../export/export-manager')
	const preloadReportForm = () => import('../forms/report-configuration-form')
	const preloadExecutionDetails = () => import('../execution/execution-details')
	const preloadExecutionTimeline = () => import('../execution/execution-timeline')
	const preloadManualExecution = () => import('../manual/manual-execution-dialog')

	return {
		preloadTemplateForm,
		preloadVersionManager,
		preloadSharingManager,
		preloadExportManager,
		preloadReportForm,
		preloadExecutionDetails,
		preloadExecutionTimeline,
		preloadManualExecution,
		preloadAll: () =>
			Promise.all([
				preloadTemplateForm(),
				preloadVersionManager(),
				preloadSharingManager(),
				preloadExportManager(),
				preloadReportForm(),
				preloadExecutionDetails(),
				preloadExecutionTimeline(),
				preloadManualExecution(),
			]),
	}
}

// Component for intersection observer based lazy loading
interface IntersectionLazyProps {
	children: React.ReactNode
	fallback?: React.ReactNode
	rootMargin?: string
	threshold?: number
	className?: string
}

export const IntersectionLazy = ({
	children,
	fallback,
	rootMargin = '50px',
	threshold = 0.1,
	className,
}: IntersectionLazyProps) => {
	const [isVisible, setIsVisible] = useState(false)
	const [hasLoaded, setHasLoaded] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting && !hasLoaded) {
					setIsVisible(true)
					setHasLoaded(true)
				}
			},
			{
				rootMargin,
				threshold,
			}
		)

		if (ref.current) {
			observer.observe(ref.current)
		}

		return () => {
			if (ref.current) {
				observer.unobserve(ref.current)
			}
		}
	}, [rootMargin, threshold, hasLoaded])

	return (
		<div ref={ref} className={className}>
			{isVisible ? children : fallback || <ComponentSkeleton />}
		</div>
	)
}

// Performance monitoring wrapper
interface PerformanceWrapperProps {
	name: string
	children: React.ReactNode
	onRender?: (name: string, phase: string, actualDuration: number) => void
}

export const PerformanceWrapper = ({ name, children, onRender }: PerformanceWrapperProps) => {
	const handleRender = useCallback(
		(id: string, phase: string, actualDuration: number) => {
			if (onRender) {
				onRender(id, phase, actualDuration)
			}

			// Log performance in development
			if (process.env.NODE_ENV === 'development') {
				console.log(`[Performance] ${id} (${phase}): ${actualDuration.toFixed(2)}ms`)
			}
		},
		[onRender]
	)

	return (
		<React.Profiler id={name} onRender={handleRender}>
			{children}
		</React.Profiler>
	)
}
