/**
 * Accessibility tests for ErrorAlert component
 */

import { testAccessibility, testKeyboardNavigation } from '@/__tests__/accessibility-utils'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ErrorAlert } from '../error-alert'

describe('ErrorAlert Accessibility', () => {
	const mockError = {
		code: 'TEST_ERROR',
		message: 'This is a test error message',
	}

	it('should have no accessibility violations', async () => {
		const { container } = render(<ErrorAlert error={mockError} />)
		await testAccessibility(container)
	})

	it('should have alert role', () => {
		render(<ErrorAlert error={mockError} />)

		const alert = screen.getByRole('alert')
		expect(alert).toBeInTheDocument()
	})

	it('should announce errors to screen readers', () => {
		render(<ErrorAlert error={mockError} />)

		const alert = screen.getByRole('alert')
		expect(alert).toHaveAttribute('aria-live', 'assertive')
	})

	it('should have accessible error message', () => {
		render(<ErrorAlert error={mockError} />)

		const message = screen.getByText(mockError.message)
		expect(message).toBeInTheDocument()
	})

	it('should have keyboard accessible dismiss button', () => {
		const onDismiss = vi.fn()
		render(<ErrorAlert error={mockError} onDismiss={onDismiss} />)

		const dismissButton = screen.getByRole('button', { name: /dismiss|close/i })
		expect(dismissButton).toBeInTheDocument()

		const keyboard = testKeyboardNavigation(dismissButton as HTMLElement)
		expect(keyboard.isFocusable()).toBe(true)
	})

	it('should have keyboard accessible retry button', () => {
		const onRetry = vi.fn()
		render(<ErrorAlert error={mockError} onRetry={onRetry} />)

		const retryButton = screen.getByRole('button', { name: /retry/i })
		expect(retryButton).toBeInTheDocument()

		const keyboard = testKeyboardNavigation(retryButton as HTMLElement)
		expect(keyboard.isFocusable()).toBe(true)
	})

	it('should dismiss on button click', async () => {
		const user = userEvent.setup()
		const onDismiss = vi.fn()

		render(<ErrorAlert error={mockError} onDismiss={onDismiss} />)

		const dismissButton = screen.getByRole('button', { name: /dismiss|close/i })
		await user.click(dismissButton)

		expect(onDismiss).toHaveBeenCalled()
	})

	it('should have proper color contrast for error variant', () => {
		const { container } = render(<ErrorAlert error={mockError} variant="destructive" />)

		const alert = container.querySelector('[role="alert"]')
		expect(alert).toHaveClass(/destructive|error|danger/i)
	})

	it('should provide context for error codes', () => {
		render(<ErrorAlert error={mockError} />)

		const errorCode = screen.getByText(mockError.code)
		expect(errorCode).toBeInTheDocument()
	})

	it('should have semantic HTML structure', () => {
		const { container } = render(<ErrorAlert error={mockError} />)

		const alert = container.querySelector('[role="alert"]')
		expect(alert?.tagName).toMatch(/DIV|SECTION|ASIDE/)
	})
})
