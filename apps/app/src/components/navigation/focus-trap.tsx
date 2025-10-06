import { useFocusManagement } from '@/hooks/use-keyboard-navigation'
import { useEffect, useRef } from 'react'

import type { ReactNode } from 'react'

export interface FocusTrapProps {
	children: ReactNode
	enabled?: boolean
	autoFocus?: boolean
	restoreFocus?: boolean
	className?: string
}

/**
 * Focus trap component that contains focus within its children
 * Useful for modal dialogs and dropdown menus
 */
export function FocusTrap({
	children,
	enabled = true,
	autoFocus = true,
	restoreFocus = true,
	className,
}: FocusTrapProps) {
	const { containerRef, trapFocus, focusFirst } = useFocusManagement()
	const previousActiveElement = useRef<HTMLElement | null>(null)

	useEffect(() => {
		if (!enabled) return

		// Store the previously focused element
		previousActiveElement.current = document.activeElement as HTMLElement

		// Auto-focus the first focusable element
		if (autoFocus) {
			const timer = setTimeout(() => {
				focusFirst()
			}, 0)
			return () => clearTimeout(timer)
		}
	}, [enabled, autoFocus, focusFirst])

	useEffect(() => {
		if (!enabled) return

		const handleKeyDown = (event: KeyboardEvent) => {
			trapFocus(event)
		}

		document.addEventListener('keydown', handleKeyDown)

		return () => {
			document.removeEventListener('keydown', handleKeyDown)

			// Restore focus to the previously focused element
			if (restoreFocus && previousActiveElement.current) {
				previousActiveElement.current.focus()
			}
		}
	}, [enabled, trapFocus, restoreFocus])

	if (!enabled) {
		return <>{children}</>
	}

	return (
		<div ref={containerRef} className={className}>
			{children}
		</div>
	)
}

/**
 * Hook to create a focus trap for custom components
 */
export function useFocusTrap(enabled = true) {
	const { containerRef, trapFocus, focusFirst, focusLast } = useFocusManagement()
	const previousActiveElement = useRef<HTMLElement | null>(null)

	const activate = () => {
		if (!enabled) return

		previousActiveElement.current = document.activeElement as HTMLElement

		setTimeout(() => {
			focusFirst()
		}, 0)

		document.addEventListener('keydown', trapFocus)
	}

	const deactivate = () => {
		document.removeEventListener('keydown', trapFocus)

		if (previousActiveElement.current) {
			previousActiveElement.current.focus()
		}
	}

	return {
		containerRef,
		activate,
		deactivate,
		focusFirst,
		focusLast,
	}
}
