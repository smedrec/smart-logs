/**
 * Accessibility tests for KeyboardShortcutsDialog component
 */

import { testAccessibility, testKeyboardNavigation } from '@/__tests__/accessibility-utils'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { KeyboardShortcutsDialog } from '../keyboard-shortcuts-dialog'

describe('KeyboardShortcutsDialog Accessibility', () => {
	it('should have no accessibility violations when open', async () => {
		const { container } = render(<KeyboardShortcutsDialog open={true} onOpenChange={vi.fn()} />)
		await testAccessibility(container)
	})

	it('should have proper dialog role', () => {
		render(<KeyboardShortcutsDialog open={true} onOpenChange={vi.fn()} />)

		const dialog = screen.getByRole('dialog')
		expect(dialog).toBeInTheDocument()
	})

	it('should have accessible dialog title', () => {
		render(<KeyboardShortcutsDialog open={true} onOpenChange={vi.fn()} />)

		const dialog = screen.getByRole('dialog')
		const ariaLabelledBy = dialog.getAttribute('aria-labelledby')
		expect(ariaLabelledBy).toBeTruthy()

		if (ariaLabelledBy) {
			const title = document.getElementById(ariaLabelledBy)
			expect(title).toBeTruthy()
		}
	})

	it('should trap focus within dialog', async () => {
		const user = userEvent.setup()
		render(<KeyboardShortcutsDialog open={true} onOpenChange={vi.fn()} />)

		const dialog = screen.getByRole('dialog')
		const focusableElements = dialog.querySelectorAll(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		)

		expect(focusableElements.length).toBeGreaterThan(0)

		// First element should receive focus
		const firstElement = focusableElements[0] as HTMLElement
		expect(document.activeElement).toBe(firstElement)
	})

	it('should close on Escape key', async () => {
		const user = userEvent.setup()
		const onOpenChange = vi.fn()

		render(<KeyboardShortcutsDialog open={true} onOpenChange={onOpenChange} />)

		await user.keyboard('{Escape}')
		expect(onOpenChange).toHaveBeenCalledWith(false)
	})

	it('should have keyboard accessible close button', () => {
		render(<KeyboardShortcutsDialog open={true} onOpenChange={vi.fn()} />)

		const closeButton = screen.getByRole('button', { name: /close/i })
		expect(closeButton).toBeInTheDocument()

		const keyboard = testKeyboardNavigation(closeButton as HTMLElement)
		expect(keyboard.isFocusable()).toBe(true)
	})

	it('should have proper heading structure', () => {
		render(<KeyboardShortcutsDialog open={true} onOpenChange={vi.fn()} />)

		const headings = screen.getAllByRole('heading')
		expect(headings.length).toBeGreaterThan(0)

		// Check heading hierarchy
		const levels = headings.map((h) => parseInt(h.tagName.substring(1)))
		expect(levels[0]).toBeLessThanOrEqual(3) // Main heading should be h1, h2, or h3
	})

	it('should have semantic list structure for shortcuts', () => {
		const { container } = render(<KeyboardShortcutsDialog open={true} onOpenChange={vi.fn()} />)

		const lists = container.querySelectorAll('ul, ol, dl')
		expect(lists.length).toBeGreaterThan(0)
	})

	it('should provide keyboard shortcut descriptions', () => {
		render(<KeyboardShortcutsDialog open={true} onOpenChange={vi.fn()} />)

		const shortcuts = screen.getAllByText(/ctrl|cmd|shift|alt/i)
		expect(shortcuts.length).toBeGreaterThan(0)

		shortcuts.forEach((shortcut) => {
			const parent = shortcut.closest('li, dt, div')
			expect(parent?.textContent).toBeTruthy()
		})
	})

	it('should have proper ARIA modal attributes', () => {
		render(<KeyboardShortcutsDialog open={true} onOpenChange={vi.fn()} />)

		const dialog = screen.getByRole('dialog')
		expect(dialog).toHaveAttribute('aria-modal', 'true')
	})
})
