import { cn } from '@/lib/utils'

import { useResponsive } from '../hooks/use-responsive'

import type { ReactNode } from 'react'
import type { Breakpoint } from '../hooks/use-responsive'

export interface ResponsiveContainerProps {
	children: ReactNode
	className?: string
	maxWidth?: Breakpoint | 'none'
	padding?: boolean | Partial<Record<Breakpoint, string>>
	center?: boolean
}

/**
 * Responsive container component that adapts to different screen sizes
 */
export function ResponsiveContainer({
	children,
	className,
	maxWidth = 'xl',
	padding = true,
	center = true,
}: ResponsiveContainerProps) {
	const { currentBreakpoint } = useResponsive()

	const getMaxWidthClass = () => {
		if (maxWidth === 'none') return ''
		return `max-w-screen-${maxWidth}`
	}

	const getPaddingClasses = () => {
		if (!padding) return ''

		if (typeof padding === 'boolean') {
			return 'px-4 sm:px-6 lg:px-8'
		}

		const classes = []
		Object.entries(padding).forEach(([breakpoint, paddingClass]) => {
			if (breakpoint === 'sm') {
				classes.push(paddingClass)
			} else {
				classes.push(`${breakpoint}:${paddingClass}`)
			}
		})

		return classes.join(' ')
	}

	return (
		<div
			className={cn(
				'w-full',
				getMaxWidthClass(),
				getPaddingClasses(),
				center && 'mx-auto',
				className
			)}
		>
			{children}
		</div>
	)
}

export interface ResponsiveGridProps {
	children: ReactNode
	className?: string
	columns?: Partial<Record<Breakpoint, number>>
	gap?: string
	minItemWidth?: string
}

/**
 * Responsive grid component with configurable columns per breakpoint
 */
export function ResponsiveGrid({
	children,
	className,
	columns = { sm: 1, md: 2, lg: 3, xl: 4 },
	gap = 'gap-6',
	minItemWidth,
}: ResponsiveGridProps) {
	const getGridClasses = () => {
		if (minItemWidth) {
			return `grid-cols-[repeat(auto-fit,minmax(${minItemWidth},1fr))]`
		}

		const classes = []
		Object.entries(columns).forEach(([breakpoint, cols]) => {
			if (breakpoint === 'sm') {
				classes.push(`grid-cols-${cols}`)
			} else {
				classes.push(`${breakpoint}:grid-cols-${cols}`)
			}
		})

		return classes.join(' ')
	}

	return <div className={cn('grid', getGridClasses(), gap, className)}>{children}</div>
}

export interface ResponsiveStackProps {
	children: ReactNode
	className?: string
	direction?: Partial<Record<Breakpoint, 'row' | 'column'>>
	gap?: string
	align?: string
	justify?: string
}

/**
 * Responsive stack component that changes direction based on screen size
 */
export function ResponsiveStack({
	children,
	className,
	direction = { sm: 'column', md: 'row' },
	gap = 'gap-4',
	align,
	justify,
}: ResponsiveStackProps) {
	const getDirectionClasses = () => {
		const classes = []
		Object.entries(direction).forEach(([breakpoint, dir]) => {
			const flexClass = dir === 'row' ? 'flex-row' : 'flex-col'
			if (breakpoint === 'sm') {
				classes.push(flexClass)
			} else {
				classes.push(`${breakpoint}:${flexClass}`)
			}
		})

		return classes.join(' ')
	}

	return (
		<div className={cn('flex', getDirectionClasses(), gap, align, justify, className)}>
			{children}
		</div>
	)
}
