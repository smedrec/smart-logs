import { useEffect, useState } from 'react'

export interface BreakpointConfig {
	sm: number
	md: number
	lg: number
	xl: number
	'2xl': number
}

const DEFAULT_BREAKPOINTS: BreakpointConfig = {
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280,
	'2xl': 1536,
}

export type Breakpoint = keyof BreakpointConfig

/**
 * Hook for responsive design utilities
 */
export function useResponsive(breakpoints: BreakpointConfig = DEFAULT_BREAKPOINTS) {
	const [windowSize, setWindowSize] = useState({
		width: typeof window !== 'undefined' ? window.innerWidth : 1024,
		height: typeof window !== 'undefined' ? window.innerHeight : 768,
	})

	useEffect(() => {
		if (typeof window === 'undefined') return

		const handleResize = () => {
			setWindowSize({
				width: window.innerWidth,
				height: window.innerHeight,
			})
		}

		window.addEventListener('resize', handleResize)
		return () => window.removeEventListener('resize', handleResize)
	}, [])

	const getCurrentBreakpoint = (): Breakpoint => {
		const { width } = windowSize

		if (width >= breakpoints['2xl']) return '2xl'
		if (width >= breakpoints.xl) return 'xl'
		if (width >= breakpoints.lg) return 'lg'
		if (width >= breakpoints.md) return 'md'
		return 'sm'
	}

	const isBreakpoint = (breakpoint: Breakpoint): boolean => {
		return windowSize.width >= breakpoints[breakpoint]
	}

	const isMobile = windowSize.width < breakpoints.md
	const isTablet = windowSize.width >= breakpoints.md && windowSize.width < breakpoints.lg
	const isDesktop = windowSize.width >= breakpoints.lg

	return {
		windowSize,
		currentBreakpoint: getCurrentBreakpoint(),
		isBreakpoint,
		isMobile,
		isTablet,
		isDesktop,
		breakpoints,
	}
}

/**
 * Hook for managing responsive table layouts
 */
export function useResponsiveTable() {
	const { isMobile, isTablet } = useResponsive()

	const getTableLayout = () => {
		if (isMobile) return 'cards'
		if (isTablet) return 'compact'
		return 'full'
	}

	const shouldShowColumn = (priority: 'high' | 'medium' | 'low') => {
		if (isMobile) return priority === 'high'
		if (isTablet) return priority !== 'low'
		return true
	}

	return {
		layout: getTableLayout(),
		shouldShowColumn,
		isMobile,
		isTablet,
	}
}

/**
 * Hook for responsive grid layouts
 */
export function useResponsiveGrid() {
	const { currentBreakpoint, windowSize } = useResponsive()

	const getGridColumns = (config: Partial<Record<Breakpoint, number>>) => {
		const breakpointOrder: Breakpoint[] = ['2xl', 'xl', 'lg', 'md', 'sm']

		for (const bp of breakpointOrder) {
			if (config[bp] && (bp === currentBreakpoint || windowSize.width >= DEFAULT_BREAKPOINTS[bp])) {
				return config[bp]
			}
		}

		return config.sm || 1
	}

	const getGridClasses = (config: Partial<Record<Breakpoint, string>>) => {
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

	return {
		getGridColumns,
		getGridClasses,
		currentBreakpoint,
	}
}

/**
 * Hook for touch-friendly interactions
 */
export function useTouchFriendly() {
	const { isMobile } = useResponsive()
	const [isTouchDevice, setIsTouchDevice] = useState(false)

	useEffect(() => {
		if (typeof window === 'undefined') return

		const checkTouch = () => {
			setIsTouchDevice(
				'ontouchstart' in window ||
					navigator.maxTouchPoints > 0 ||
					// @ts-ignore
					navigator.msMaxTouchPoints > 0
			)
		}

		checkTouch()
	}, [])

	const getTouchTargetSize = (size: 'sm' | 'md' | 'lg' = 'md') => {
		if (!isTouchDevice && !isMobile) return undefined

		const sizes = {
			sm: 'min-h-[40px] min-w-[40px]',
			md: 'min-h-[44px] min-w-[44px]',
			lg: 'min-h-[48px] min-w-[48px]',
		}

		return sizes[size]
	}

	const getTouchSpacing = () => {
		return isTouchDevice || isMobile ? 'gap-3' : 'gap-2'
	}

	return {
		isTouchDevice,
		getTouchTargetSize,
		getTouchSpacing,
		shouldUseTouchOptimizations: isTouchDevice || isMobile,
	}
}
