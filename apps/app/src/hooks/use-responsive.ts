import { useEffect, useState } from 'react'

export interface BreakpointConfig {
	sm: number
	md: number
	lg: number
	xl: number
	'2xl': number
}

const BREAKPOINTS: BreakpointConfig = {
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280,
	'2xl': 1536,
}

export type Breakpoint = keyof BreakpointConfig

/**
 * Hook for responsive design utilities specific to app components
 */
export function useResponsive(breakpoints: BreakpointConfig = BREAKPOINTS) {
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

		// Debounce resize events for better performance
		let timeoutId: NodeJS.Timeout
		const debouncedResize = () => {
			clearTimeout(timeoutId)
			timeoutId = setTimeout(handleResize, 150)
		}

		window.addEventListener('resize', debouncedResize)
		return () => {
			window.removeEventListener('resize', debouncedResize)
			clearTimeout(timeoutId)
		}
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

	// Alert-specific responsive utilities
	const getAlertLayout = () => {
		if (isMobile) return 'stack'
		if (isTablet) return 'compact'
		return 'full'
	}

	const getAlertCardSize = () => {
		if (isMobile) return 'full'
		if (isTablet) return 'medium'
		return 'large'
	}

	const getAlertColumnsCount = () => {
		if (isMobile) return 1
		if (isTablet) return 2
		if (windowSize.width >= breakpoints.xl) return 4
		return 3
	}

	const shouldShowAlertColumn = (priority: 'high' | 'medium' | 'low') => {
		if (isMobile) return priority === 'high'
		if (isTablet) return priority !== 'low'
		return true
	}

	const getAlertSpacing = () => {
		if (isMobile) return 'gap-3'
		if (isTablet) return 'gap-4'
		return 'gap-6'
	}

	return {
		windowSize,
		currentBreakpoint: getCurrentBreakpoint(),
		isBreakpoint,
		isMobile,
		isTablet,
		isDesktop,
		breakpoints,
		// Alert-specific utilities
		alertLayout: getAlertLayout(),
		alertCardSize: getAlertCardSize(),
		alertColumnsCount: getAlertColumnsCount(),
		shouldShowAlertColumn,
		alertSpacing: getAlertSpacing(),
	}
}

/**
 * Hook for managing responsive alert table layouts
 */
export function useAlertResponsiveTable() {
	const { isMobile, isTablet, currentBreakpoint } = useResponsive()

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

	const getColumnWidth = (
		columnType: 'severity' | 'title' | 'status' | 'timestamp' | 'actions'
	) => {
		const widths = {
			mobile: {
				severity: 'w-12',
				title: 'flex-1',
				status: 'w-20',
				timestamp: 'w-16',
				actions: 'w-12',
			},
			tablet: {
				severity: 'w-16',
				title: 'flex-1',
				status: 'w-24',
				timestamp: 'w-20',
				actions: 'w-16',
			},
			desktop: {
				severity: 'w-20',
				title: 'flex-1',
				status: 'w-32',
				timestamp: 'w-40',
				actions: 'w-20',
			},
		}

		if (isMobile) return widths.mobile[columnType]
		if (isTablet) return widths.tablet[columnType]
		return widths.desktop[columnType]
	}

	return {
		layout: getTableLayout(),
		shouldShowColumn,
		getColumnWidth,
		isMobile,
		isTablet,
		currentBreakpoint,
	}
}

/**
 * Hook for responsive alert grid layouts
 */
export function useAlertResponsiveGrid() {
	const { currentBreakpoint, windowSize, alertColumnsCount } = useResponsive()

	const getGridColumns = (config?: Partial<Record<Breakpoint, number>>) => {
		if (config) {
			const breakpointOrder: Breakpoint[] = ['2xl', 'xl', 'lg', 'md', 'sm']

			for (const bp of breakpointOrder) {
				if (config[bp] && (bp === currentBreakpoint || windowSize.width >= BREAKPOINTS[bp])) {
					return config[bp]
				}
			}

			return config.sm || 1
		}

		return alertColumnsCount
	}

	const getGridClasses = (config: Partial<Record<Breakpoint, string>>) => {
		const classes: string[] = []

		Object.entries(config).forEach(([breakpoint, className]) => {
			if (breakpoint === 'sm') {
				classes.push(className)
			} else {
				classes.push(`${breakpoint}:${className}`)
			}
		})

		return classes.join(' ')
	}

	const getAlertGridClasses = () => {
		return getGridClasses({
			sm: 'grid-cols-1',
			md: 'grid-cols-2',
			lg: 'grid-cols-3',
			xl: 'grid-cols-4',
		})
	}

	return {
		getGridColumns,
		getGridClasses,
		getAlertGridClasses,
		currentBreakpoint,
		columnsCount: alertColumnsCount,
	}
}

/**
 * Hook for touch-friendly alert interactions
 */
export function useAlertTouchFriendly() {
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

	const getAlertCardTouchClasses = () => {
		if (!isTouchDevice && !isMobile) return ''

		return 'active:scale-[0.98] transition-transform duration-150'
	}

	const getAlertButtonTouchClasses = () => {
		if (!isTouchDevice && !isMobile) return ''

		return 'active:scale-95 transition-transform duration-150'
	}

	return {
		isTouchDevice,
		getTouchTargetSize,
		getTouchSpacing,
		getAlertCardTouchClasses,
		getAlertButtonTouchClasses,
		shouldUseTouchOptimizations: isTouchDevice || isMobile,
	}
}

/**
 * Hook for responsive alert dashboard layout
 */
export function useDashboardLayout() {
	const { isMobile, isTablet, isDesktop, alertSpacing } = useResponsive()

	const getDashboardLayout = () => {
		if (isMobile) return 'vertical'
		if (isTablet) return 'mixed'
		return 'horizontal'
	}

	const getSidebarPosition = () => {
		if (isMobile) return 'bottom'
		return 'left'
	}

	const getHeaderLayout = () => {
		if (isMobile) return 'stacked'
		if (isTablet) return 'wrapped'
		return 'inline'
	}

	const getActionButtonsLayout = () => {
		if (isMobile) return 'dropdown'
		if (isTablet) return 'compact'
		return 'full'
	}

	return {
		layout: getDashboardLayout(),
		sidebarPosition: getSidebarPosition(),
		headerLayout: getHeaderLayout(),
		actionButtonsLayout: getActionButtonsLayout(),
		spacing: alertSpacing,
		isMobile,
		isTablet,
		isDesktop,
	}
}
