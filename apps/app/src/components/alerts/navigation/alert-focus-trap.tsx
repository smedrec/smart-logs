import { cn } from '@/lib/utils'
import React, { useCallback, useEffect, useRef } from 'react'

export interface AlertFocusTrapProps {
	/** Whether the focus trap is active */
	active?: boolean
	/** Element to focus when trap is activated */
	initialFocus?: HTMLElement | (() => HTMLElement | null)
	/** Element to focus when trap is deactivated */
	restoreFocus?: HTMLElement | (() => HTMLElement | null)
	/** Whether to auto-focus the first focusable element */
	autoFocus?: boolean
	/** Children to render inside the focus trap */
	children: React.ReactNode
	/** Additional CSS classes */
	className?: string
	/** Callback when focus trap is activated */
	onActivate?: () => void
	/** Callback when focus trap is deactivated */
	onDeactivate?: () => void
}

/**
 * Focus trap component for alert modals and dialogs
 * Ensures keyboard focus stays within the component when active
 */
export function AlertFocusTrap({
	active = true,
	initialFocus,
	restoreFocus,
	autoFocus = true,
	children,
	className,
	onActivate,
	onDeactivate,
}: AlertFocusTrapProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const previousActiveElement = useRef<HTMLElement | null>(null)

	const getFocusableElements = useCallback(() => {
		if (!containerRef.current) return []

		const focusableSelectors = [
			'button:not([disabled])',
			'input:not([disabled])',
			'select:not([disabled])',
			'textarea:not([disabled])',
			'a[href]',
			'[tabindex]:not([tabindex="-1"])',
			'[role="button"]:not([disabled])',
			'[role="link"]:not([disabled])',
			'[role="menuitem"]:not([disabled])',
			'[role="tab"]:not([disabled])',
		].join(', ')

		return Array.from(containerRef.current.querySelectorAll(focusableSelectors)) as HTMLElement[]
	}, [])

	const getInitialFocusElement = useCallback(() => {
		if (initialFocus) {
			return typeof initialFocus === 'function' ? initialFocus() : initialFocus
		}

		if (autoFocus) {
			const focusableElements = getFocusableElements()
			return focusableElements[0] || null
		}

		return null
	}, [initialFocus, autoFocus, getFocusableElements])

	const getRestoreFocusElement = useCallback(() => {
		if (restoreFocus) {
			return typeof restoreFocus === 'function' ? restoreFocus() : restoreFocus
		}
		return previousActiveElement.current
	}, [restoreFocus])

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (!active || event.key !== 'Tab') return

			const focusableElements = getFocusableElements()
			if (focusableElements.length === 0) return

			const firstElement = focusableElements[0]
			const lastElement = focusableElements[focusableElements.length - 1]

			if (event.shiftKey) {
				// Shift + Tab: moving backwards
				if (document.activeElement === firstElement) {
					event.preventDefault()
					lastElement.focus()
				}
			} else {
				// Tab: moving forwards
				if (document.activeElement === lastElement) {
					event.preventDefault()
					firstElement.focus()
				}
			}
		},
		[active, getFocusableElements]
	)

	// Handle focus trap activation
	useEffect(() => {
		if (!active) return

		// Store the currently focused element
		previousActiveElement.current = document.activeElement as HTMLElement

		// Focus the initial element
		const initialElement = getInitialFocusElement()
		if (initialElement) {
			// Use setTimeout to ensure the element is rendered
			setTimeout(() => {
				initialElement.focus()
			}, 0)
		}

		// Add event listener for tab key
		document.addEventListener('keydown', handleKeyDown)

		// Call activation callback
		onActivate?.()

		return () => {
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [active, getInitialFocusElement, handleKeyDown, onActivate])

	// Handle focus trap deactivation
	useEffect(() => {
		return () => {
			if (active) {
				// Restore focus to the previous element
				const restoreElement = getRestoreFocusElement()
				if (restoreElement && document.contains(restoreElement)) {
					restoreElement.focus()
				}

				// Call deactivation callback
				onDeactivate?.()
			}
		}
	}, [active, getRestoreFocusElement, onDeactivate])

	// Handle clicks outside the focus trap
	const handleMouseDown = useCallback(
		(event: React.MouseEvent) => {
			if (!active) return

			// If clicking outside the container, focus the first element
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				event.preventDefault()
				const firstElement = getFocusableElements()[0]
				if (firstElement) {
					firstElement.focus()
				}
			}
		},
		[active, getFocusableElements]
	)

	return (
		<div
			ref={containerRef}
			className={cn('focus-trap', className)}
			onMouseDown={handleMouseDown}
			data-focus-trap={active}
		>
			{children}
		</div>
	)
}

/**
 * Hook for managing focus trap state
 */
export function useAlertFocusTrap() {
	const [isActive, setIsActive] = React.useState(false)
	const [initialFocus, setInitialFocus] = React.useState<HTMLElement | null>(null)
	const [restoreFocus, setRestoreFocus] = React.useState<HTMLElement | null>(null)

	const activate = useCallback(
		(options?: { initialFocus?: HTMLElement; restoreFocus?: HTMLElement }) => {
			if (options?.initialFocus) {
				setInitialFocus(options.initialFocus)
			}
			if (options?.restoreFocus) {
				setRestoreFocus(options.restoreFocus)
			}
			setIsActive(true)
		},
		[]
	)

	const deactivate = useCallback(() => {
		setIsActive(false)
		setInitialFocus(null)
		setRestoreFocus(null)
	}, [])

	return {
		isActive,
		initialFocus,
		restoreFocus,
		activate,
		deactivate,
	}
}

export default AlertFocusTrap
