/**
 * Accessibility tests for ReportConfigurationForm component
 */

import {
	testAccessibility,
	testFormAccessibility,
	testKeyboardNavigation,
} from '@/__tests__/accessibility-utils'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ReportConfigurationForm } from '../report-configuration-form'

// Mock dependencies
vi.mock('@/contexts/compliance-audit-provider', () => ({
	useComplianceAudit: () => ({
		isConnected: true,
		error: null,
		createScheduledReport: vi.fn(),
		updateScheduledReport: vi.fn(),
	}),
}))

vi.mock('@tanstack/react-router', () => ({
	useNavigate: () => vi.fn(),
}))

describe('ReportConfigurationForm Accessibility', () => {
	const mockOnSubmit = vi.fn()
	const mockOnCancel = vi.fn()

	it('should have no accessibility violations', async () => {
		const { container } = render(
			<ReportConfigurationForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
		)
		await testAccessibility(container)
	})

	it('should have proper form structure', () => {
		render(
			<ReportConfigurationForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
		)

		const form = screen.getByRole('form') || document.querySelector('form')
		expect(form).toBeInTheDocument()
	})

	it('should have all inputs labeled', () => {
		const { container } = render(
			<ReportConfigurationForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
		)

		const form = container.querySelector('form')
		if (form) {
			const formAccessibility = testFormAccessibility(form as HTMLFormElement)
			expect(formAccessibility.allInputsHaveLabels()).toBe(true)
		}
	})

	it('should mark required fields appropriately', () => {
		const { container } = render(
			<ReportConfigurationForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
		)

		const form = container.querySelector('form')
		if (form) {
			const formAccessibility = testFormAccessibility(form as HTMLFormElement)
			expect(formAccessibility.requiredFieldsMarked()).toBe(true)
		}
	})

	it('should have keyboard accessible form controls', () => {
		const { container } = render(
			<ReportConfigurationForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
		)

		const inputs = container.querySelectorAll('input, select, textarea, button')
		inputs.forEach((input) => {
			const keyboard = testKeyboardNavigation(input as HTMLElement)
			expect(keyboard.isFocusable()).toBe(true)
		})
	})

	it('should have accessible submit and cancel buttons', () => {
		render(
			<ReportConfigurationForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
		)

		const submitButton = screen.getByRole('button', { name: /create|save|submit/i })
		expect(submitButton).toBeInTheDocument()

		const cancelButton = screen.getByRole('button', { name: /cancel/i })
		expect(cancelButton).toBeInTheDocument()
	})

	it('should announce validation errors to screen readers', () => {
		const { container } = render(
			<ReportConfigurationForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
		)

		const errorMessages = container.querySelectorAll('[role="alert"]')
		errorMessages.forEach((error) => {
			expect(error).toHaveAttribute('aria-live')
		})
	})

	it('should associate error messages with inputs', () => {
		const { container } = render(
			<ReportConfigurationForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
		)

		const form = container.querySelector('form')
		if (form) {
			const formAccessibility = testFormAccessibility(form as HTMLFormElement)
			expect(formAccessibility.errorMessagesAssociated()).toBe(true)
		}
	})

	it('should have proper fieldset grouping', () => {
		const { container } = render(
			<ReportConfigurationForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
		)

		const fieldsets = container.querySelectorAll('fieldset')
		fieldsets.forEach((fieldset) => {
			const legend = fieldset.querySelector('legend')
			expect(legend).toBeTruthy()
		})
	})

	it('should provide help text for complex fields', () => {
		const { container } = render(
			<ReportConfigurationForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
		)

		const inputs = container.querySelectorAll('input, select, textarea')
		inputs.forEach((input) => {
			const ariaDescribedBy = input.getAttribute('aria-describedby')
			if (ariaDescribedBy) {
				const helpText = document.getElementById(ariaDescribedBy)
				expect(helpText).toBeTruthy()
			}
		})
	})
})
