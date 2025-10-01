import { useCallback, useEffect, useRef } from 'react'

export interface KeyboardShortcut {
	key: string
	ctrlKey?: boolean
	altKey?: boolean
	shiftKey?: boolean
	metaKey?: boolean
	action: () => void
	description: string
	preventDefault?: boolean
}

export interface UseKeyboardNavigationOptions {
	shortcuts?: KeyboardShortcut[]
	enabled?: boolean
	scope?: 'global' | 'local'
}

/**
 * Hook for managing keyboard navigation and shortcuts
 */
export function useKeyboardNavigation(options: UseKeyboardNavigationOptions = {}) {
	const { shortcuts = [], enabled = true, scope = 'local' } = options
	const elementRef = useRef<HTMLElement>(null)

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (!enabled) return

			const matchingShortcut = shortcuts.find((shortcut) => {
				return (
					shortcut.key.toLowerCase() === event.key.toLowerCase() &&
					!!shortcut.ctrlKey === event.ctrlKey &&
					!!shortcut.altKey === event.altKey &&
					!!shortcut.shiftKey === event.shiftKey &&
					!!shortcut.metaKey === event.metaKey
				)
			})

			if (matchingShortcut) {
				if (matchingShortcut.preventDefault !== false) {
					event.preventDefault()
				}
				matchingShortcut.action()
			}
		},
		[shortcuts, enabled]
	)

	useEffect(() => {
		if (!enabled) return

		const target = scope === 'global' ? document : elementRef.current
		if (!target) return

		target.addEventListener('keydown', handleKeyDown)

		return () => {
			target.removeEventListener('keydown', handleKeyDown)
		}
	}, [handleKeyDown, enabled, scope])

	return {
		ref: elementRef,
		shortcuts,
	}
}

/**
 * Hook for managing focus within a container
 */
export function useFocusManagement() {
	const containerRef = useRef<HTMLElement>(null)

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

	const focusFirst = useCallback(() => {
		const elements = getFocusableElements()
		if (elements.length > 0) {
			elements[0].focus()
		}
	}, [getFocusableElements])

	const focusLast = useCallback(() => {
		const elements = getFocusableElements()
		if (elements.length > 0) {
			elements[elements.length - 1].focus()
		}
	}, [getFocusableElements])

	const focusNext = useCallback(() => {
		const elements = getFocusableElements()
		const currentIndex = elements.findIndex((el) => el === document.activeElement)

		if (currentIndex < elements.length - 1) {
			elements[currentIndex + 1].focus()
		} else {
			elements[0].focus() // Wrap to first
		}
	}, [getFocusableElements])

	const focusPrevious = useCallback(() => {
		const elements = getFocusableElements()
		const currentIndex = elements.findIndex((el) => el === document.activeElement)

		if (currentIndex > 0) {
			elements[currentIndex - 1].focus()
		} else {
			elements[elements.length - 1].focus() // Wrap to last
		}
	}, [getFocusableElements])

	const trapFocus = useCallback(
		(event: KeyboardEvent) => {
			if (event.key !== 'Tab') return

			const elements = getFocusableElements()
			if (elements.length === 0) return

			const firstElement = elements[0]
			const lastElement = elements[elements.length - 1]

			if (event.shiftKey) {
				if (document.activeElement === firstElement) {
					event.preventDefault()
					lastElement.focus()
				}
			} else {
				if (document.activeElement === lastElement) {
					event.preventDefault()
					firstElement.focus()
				}
			}
		},
		[getFocusableElements]
	)

	return {
		containerRef,
		focusFirst,
		focusLast,
		focusNext,
		focusPrevious,
		trapFocus,
		getFocusableElements,
	}
}

/**
 * Common keyboard shortcuts for compliance interface
 */
export const COMPLIANCE_SHORTCUTS = {
	CREATE_REPORT: { key: 'n', ctrlKey: true, description: 'Create new report' },
	SEARCH: { key: 'k', ctrlKey: true, description: 'Focus search' },
	REFRESH: { key: 'r', ctrlKey: true, description: 'Refresh data' },
	HELP: { key: '?', description: 'Show keyboard shortcuts' },
	ESCAPE: { key: 'Escape', description: 'Close modal/dialog' },
	SAVE: { key: 's', ctrlKey: true, description: 'Save current form' },
	CANCEL: { key: 'Escape', description: 'Cancel current action' },
} as const
