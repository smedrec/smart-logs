import { cn } from '@/lib/utils'
import React from 'react'

import { useAlertResponsive } from '../hooks/use-alert-responsive'

import type { AlertBreakpoint } from '../hooks/use-alert-responsive'

export interface AlertResponsiveContainerProps {
	/** Children to render inside the container */
	children: React.ReactNode
	/** Maximum width configuration per breakpoint */
	maxWidth?: Partial<Record<AlertBreakpoint, string>>
	/** Padding configuration per breakpoint */
	padding?: Partial<Record<AlertBreakpoint, string>>
	/** Whether to center the container */
	centered?: boolean
	/** Additional CSS classes */
	className?: string
	/** HTML element to render as */
	as?: keyof JSX.IntrinsicElements
}

/**
 * Responsive container component for alert layouts
 * Provides configurable max-width and padding per breakpoint
 */
export function AlertResponsiveContainer({
	children,
	maxWidth,
	padding,
	centered = true,
	className,
	as: Component = 'div',
}: AlertResponsiveContainerProps) {
	const { currentBreakpoint } = useAlertResponsive()

	const defaultMaxWidth: Partial<Record<AlertBreakpoint, string>> = {
		sm: 'max-w-full',
		md: 'max-w-3xl',
		lg: 'max-w-5xl',
		xl: 'max-w-7xl',
		'2xl': 'max-w-7xl',
	}

	const defaultPadding: Partial<Record<AlertBreakpoint, string>> = {
		sm: 'px-4 py-3',
		md: 'px-6 py-4',
		lg: 'px-8 py-6',
		xl: 'px-8 py-6',
		'2xl': 'px-8 py-6',
	}

	const getResponsiveClasses = (config: Partial<Record<AlertBreakpoint, string>>) => {
		const classes = []

		Object.entries(config).forEach(([breakpoint, className]) => {
			if (breakpoint === 'sm') {
				classes.push(className)
			} else {
				classes.push(`${breakpoint}:${className}`)
			}
		})

		return classes.join(' ')
	}

	const maxWidthClasses = getResponsiveClasses(maxWidth || defaultMaxWidth)
	const paddingClasses = getResponsiveClasses(padding || defaultPadding)

	return (
		<Component
			className={cn('w-full', maxWidthClasses, paddingClasses, centered && 'mx-auto', className)}
		>
			{children}
		</Component>
	)
}

/**
 * Responsive grid component for alert layouts
 */
export interface AlertResponsiveGridProps {
	/** Children to render in the grid */
	children: React.ReactNode
	/** Columns configuration per breakpoint */
	columns?: Partial<Record<AlertBreakpoint, number>>
	/** Gap configuration per breakpoint */
	gap?: Partial<Record<AlertBreakpoint, string>>
	/** Additional CSS classes */
	className?: string
}

export function AlertResponsiveGrid({
	children,
	columns,
	gap,
	className,
}: AlertResponsiveGridProps) {
	const defaultColumns: Partial<Record<AlertBreakpoint, number>> = {
		sm: 1,
		md: 2,
		lg: 3,
		xl: 4,
		'2xl': 4,
	}

	const defaultGap: Partial<Record<AlertBreakpoint, string>> = {
		sm: 'gap-3',
		md: 'gap-4',
		lg: 'gap-6',
		xl: 'gap-6',
		'2xl': 'gap-6',
	}

	const getGridClasses = (config: Partial<Record<AlertBreakpoint, number>>) => {
		const classes = []

		Object.entries(config).forEach(([breakpoint, cols]) => {
			const gridClass = `grid-cols-${cols}`
			if (breakpoint === 'sm') {
				classes.push(gridClass)
			} else {
				classes.push(`${breakpoint}:${gridClass}`)
			}
		})

		return classes.join(' ')
	}

	const getGapClasses = (config: Partial<Record<AlertBreakpoint, string>>) => {
		const classes = []

		Object.entries(config).forEach(([breakpoint, gapClass]) => {
			if (breakpoint === 'sm') {
				classes.push(gapClass)
			} else {
				classes.push(`${breakpoint}:${gapClass}`)
			}
		})

		return classes.join(' ')
	}

	const columnClasses = getGridClasses(columns || defaultColumns)
	const gapClasses = getGapClasses(gap || defaultGap)

	return <div className={cn('grid', columnClasses, gapClasses, className)}>{children}</div>
}

/**
 * Responsive card component for alerts
 */
export interface AlertResponsiveCardProps {
	/** Children to render inside the card */
	children: React.ReactNode
	/** Whether to use touch-optimized interactions */
	touchOptimized?: boolean
	/** Card size variant */
	size?: 'sm' | 'md' | 'lg'
	/** Additional CSS classes */
	className?: string
	/** Click handler */
	onClick?: () => void
	/** Whether the card is interactive */
	interactive?: boolean
}

export function AlertResponsiveCard({
	children,
	touchOptimized = true,
	size = 'md',
	className,
	onClick,
	interactive = false,
}: AlertResponsiveCardProps) {
	const { isMobile, isTablet } = useAlertResponsive()

	const getSizeClasses = () => {
		const sizeMap = {
			sm: {
				mobile: 'p-3',
				tablet: 'p-4',
				desktop: 'p-4',
			},
			md: {
				mobile: 'p-4',
				tablet: 'p-5',
				desktop: 'p-6',
			},
			lg: {
				mobile: 'p-5',
				tablet: 'p-6',
				desktop: 'p-8',
			},
		}

		if (isMobile) return sizeMap[size].mobile
		if (isTablet) return sizeMap[size].tablet
		return sizeMap[size].desktop
	}

	const getTouchClasses = () => {
		if (!touchOptimized || (!isMobile && !isTablet)) return ''
		return 'active:scale-[0.98] transition-transform duration-150'
	}

	const getInteractiveClasses = () => {
		if (!interactive) return ''
		return 'cursor-pointer hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
	}

	return (
		<div
			className={cn(
				'bg-card text-card-foreground rounded-lg border shadow-sm',
				getSizeClasses(),
				getTouchClasses(),
				getInteractiveClasses(),
				className
			)}
			onClick={onClick}
			tabIndex={interactive ? 0 : undefined}
			role={interactive ? 'button' : undefined}
		>
			{children}
		</div>
	)
}

export default AlertResponsiveContainer
