import { useCallback, useEffect, useRef } from 'react'

interface AlertKeyboardShortcut {
	key: string
	ctrlKey?: boolean
	altKey?: boolean
	shiftKey?: boolean
	metaKey?: boolean
	action: () => void
	description: string
	preventDefault?: boolean
}

export interface UseAlertKeyboardNavigationOptions {
	shortcuts?: AlertKeyboardShortcut[]
	enabled?: boolean
	scope?: 'global' | 'local'
}

/**
 * Hook for managing keyboard navigation and shortcuts in alert components
 */
export function useAlertKeyboardNavigation(options: UseAlertKeyboardNavigationOptions = {}) {
	const { shortcuts = [], enabled = true, scope = 'local' } = options
	const elementRef = useRef<HTMLElement>(null)

	const handleKeyDown = useCallback(
		(event: Event) => {
			if (!enabled) return

			const keyboardEvent = event as KeyboardEvent

			// Don't handle shortcuts when user is typing in input fields
			const target = keyboardEvent.target as HTMLElement
			if (
				target.tagName === 'INPUT' ||
				target.tagName === 'TEXTAREA' ||
				target.contentEditable === 'true'
			) {
				return
			}

			const matchingShortcut = shortcuts.find((shortcut) => {
				return (
					shortcut.key.toLowerCase() === keyboardEvent.key.toLowerCase() &&
					!!shortcut.ctrlKey === keyboardEvent.ctrlKey &&
					!!shortcut.altKey === keyboardEvent.altKey &&
					!!shortcut.shiftKey === keyboardEvent.shiftKey &&
					!!shortcut.metaKey === keyboardEvent.metaKey
				)
			})

			if (matchingShortcut) {
				if (matchingShortcut.preventDefault !== false) {
					keyboardEvent.preventDefault()
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
 * Hook for managing focus within alert containers
 */
export function useAlertFocusManagement() {
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
			'[data-alert-card]',
			'[data-alert-action]',
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

	const focusAlert = useCallback((alertId: string) => {
		const alertElement = containerRef.current?.querySelector(
			`[data-alert-id="${alertId}"]`
		) as HTMLElement
		if (alertElement) {
			alertElement.focus()
		}
	}, [])

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

	const handleArrowNavigation = useCallback(
		(event: KeyboardEvent) => {
			if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return

			const elements = getFocusableElements()
			const currentIndex = elements.findIndex((el) => el === document.activeElement)

			if (currentIndex === -1) return

			event.preventDefault()

			switch (event.key) {
				case 'ArrowDown':
				case 'ArrowRight':
					focusNext()
					break
				case 'ArrowUp':
				case 'ArrowLeft':
					focusPrevious()
					break
			}
		},
		[getFocusableElements, focusNext, focusPrevious]
	)

	return {
		containerRef,
		focusFirst,
		focusLast,
		focusNext,
		focusPrevious,
		focusAlert,
		trapFocus,
		handleArrowNavigation,
		getFocusableElements,
	}
}

/**
 * Alert-specific keyboard shortcuts
 */
export const ALERT_SHORTCUTS = {
	// Navigation shortcuts
	REFRESH_ALERTS: { key: 'r', ctrlKey: true, description: 'Refresh alerts' },
	SEARCH_ALERTS: { key: 'k', ctrlKey: true, description: 'Focus alert search' },
	FILTER_ALERTS: { key: 'f', ctrlKey: true, description: 'Open alert filters' },

	// View shortcuts
	LIST_VIEW: { key: '1', description: 'Switch to list view' },
	BOARD_VIEW: { key: '2', description: 'Switch to board view' },
	STATISTICS_VIEW: { key: '3', description: 'Switch to statistics view' },

	// Alert actions
	ACKNOWLEDGE_ALERT: { key: 'a', description: 'Acknowledge selected alert' },
	RESOLVE_ALERT: { key: 'r', description: 'Resolve selected alert' },
	DISMISS_ALERT: { key: 'd', description: 'Dismiss selected alert' },

	// Selection shortcuts
	SELECT_ALL: { key: 'a', ctrlKey: true, description: 'Select all alerts' },
	CLEAR_SELECTION: { key: 'Escape', description: 'Clear alert selection' },

	// Navigation
	NEXT_ALERT: { key: 'j', description: 'Focus next alert' },
	PREVIOUS_ALERT: { key: 'k', description: 'Focus previous alert' },
	FIRST_ALERT: { key: 'Home', description: 'Focus first alert' },
	LAST_ALERT: { key: 'End', description: 'Focus last alert' },

	// Modal/Dialog shortcuts
	CLOSE_MODAL: { key: 'Escape', description: 'Close modal or dialog' },
	CONFIRM_ACTION: { key: 'Enter', description: 'Confirm current action' },

	// Help
	SHOW_SHORTCUTS: { key: '?', description: 'Show keyboard shortcuts help' },
} as const

// Re-export the interface to ensure it's available
export type { AlertKeyboardShortcut }
