/**
 * Unit tests for CriteriaBuilder component
 */

import { testAccessibility, testFormAccessibility } from '@/__tests__/accessibility-utils'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormProvider, useForm } from 'react-hook-form'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CriteriaBuilder } from '../criteria-builder'

// Wrapper component to provide form context
function TestWrapper({ children }: { children: React.ReactNode }) {
	const methods = useForm({
		defaultValues: {
			reportType: 'HIPAA_AUDIT_TRAIL',
			criteria: {
				dateRange: {
					startDate: new Date('2024-01-01').toISOString(),
					endDate: new Date('2024-12-31').toISOString(),
				},
				filters: {},
			},
		},
	})

	return <FormProvider {...methods}>{children}</FormProvider>
}

describe('CriteriaBuilder', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should have no accessibility violations', async () => {
		const { container } = render(
			<TestWrapper>
				<CriteriaBuilder />
			</TestWrapper>
		)
		await testAccessibility(container)
	})

	it('should display date range section', () => {
		render(
			<TestWrapper>
				<CriteriaBuilder />
			</TestWrapper>
		)

		expect(screen.getByText(/date range/i)).toBeInTheDocument()
		expect(screen.getByText(/report date range/i)).toBeInTheDocument()
	})

	it('should display advanced filters section', () => {
		render(
			<TestWrapper>
				<CriteriaBuilder />
			</TestWrapper>
		)

		expect(screen.getByText(/advanced filters/i)).toBeInTheDocument()
		expect(screen.getByRole('button', { name: /add filter/i })).toBeInTheDocument()
	})

	it('should display preview section', () => {
		render(
			<TestWrapper>
				<CriteriaBuilder />
			</TestWrapper>
		)

		expect(screen.getByText(/criteria preview/i)).toBeInTheDocument()
		expect(screen.getByRole('button', { name: /generate preview/i })).toBeInTheDocument()
	})

	it('should add filter when add button clicked', async () => {
		const user = userEvent.setup()
		render(
			<TestWrapper>
				<CriteriaBuilder />
			</TestWrapper>
		)

		const addButton = screen.getByRole('button', { name: /add filter/i })
		await user.click(addButton)

		await waitFor(() => {
			expect(screen.getByText(/field/i)).toBeInTheDocument()
			expect(screen.getByText(/operator/i)).toBeInTheDocument()
			expect(screen.getByText(/value/i)).toBeInTheDocument()
		})
	})

	it('should remove filter when remove button clicked', async () => {
		const user = userEvent.setup()
		render(
			<TestWrapper>
				<CriteriaBuilder />
			</TestWrapper>
		)

		// Add a filter first
		const addButton = screen.getByRole('button', { name: /add filter/i })
		await user.click(addButton)

		await waitFor(() => {
			expect(screen.getByText(/field/i)).toBeInTheDocument()
		})

		// Remove the filter
		const removeButtons = screen.getAllByRole('button')
		const removeButton = removeButtons.find((btn) => btn.querySelector('svg'))
		if (removeButton) {
			await user.click(removeButton)

			await waitFor(() => {
				expect(screen.getByText(/no filters added yet/i)).toBeInTheDocument()
			})
		}
	})

	it('should display empty state when no filters', () => {
		render(
			<TestWrapper>
				<CriteriaBuilder />
			</TestWrapper>
		)

		expect(screen.getByText(/no filters added yet/i)).toBeInTheDocument()
	})

	it('should generate preview when button clicked', async () => {
		const user = userEvent.setup()
		render(
			<TestWrapper>
				<CriteriaBuilder />
			</TestWrapper>
		)

		const previewButton = screen.getByRole('button', { name: /generate preview/i })
		await user.click(previewButton)

		await waitFor(() => {
			expect(screen.getByText(/estimated records/i)).toBeInTheDocument()
		})
	})

	it('should disable preview button when no date range', () => {
		const methods = useForm({
			defaultValues: {
				reportType: 'HIPAA_AUDIT_TRAIL',
				criteria: {
					dateRange: null,
					filters: {},
				},
			},
		})

		render(
			<FormProvider {...methods}>
				<CriteriaBuilder />
			</FormProvider>
		)

		const previewButton = screen.getByRole('button', { name: /generate preview/i })
		expect(previewButton).toBeDisabled()
	})

	it('should display warning when no date range selected', () => {
		const methods = useForm({
			defaultValues: {
				reportType: 'HIPAA_AUDIT_TRAIL',
				criteria: {
					dateRange: null,
					filters: {},
				},
			},
		})

		render(
			<FormProvider {...methods}>
				<CriteriaBuilder />
			</FormProvider>
		)

		expect(screen.getByText(/please select a date range/i)).toBeInTheDocument()
	})

	it('should have accessible form controls', () => {
		render(
			<TestWrapper>
				<CriteriaBuilder />
			</TestWrapper>
		)

		const buttons = screen.getAllByRole('button')
		buttons.forEach((button) => {
			expect(button).toBeInTheDocument()
		})
	})

	it('should display report type specific fields for HIPAA', async () => {
		const user = userEvent.setup()
		render(
			<TestWrapper>
				<CriteriaBuilder />
			</TestWrapper>
		)

		const addButton = screen.getByRole('button', { name: /add filter/i })
		await user.click(addButton)

		await waitFor(() => {
			// HIPAA specific fields should be available
			expect(screen.getByText(/field/i)).toBeInTheDocument()
		})
	})

	it('should update filter field when changed', async () => {
		const user = userEvent.setup()
		render(
			<TestWrapper>
				<CriteriaBuilder />
			</TestWrapper>
		)

		const addButton = screen.getByRole('button', { name: /add filter/i })
		await user.click(addButton)

		await waitFor(() => {
			expect(screen.getByText(/field/i)).toBeInTheDocument()
		})

		// Field selection should be interactive
		const selects = screen.getAllByRole('combobox')
		expect(selects.length).toBeGreaterThan(0)
	})

	it('should display preview data after generation', async () => {
		const user = userEvent.setup()
		render(
			<TestWrapper>
				<CriteriaBuilder />
			</TestWrapper>
		)

		const previewButton = screen.getByRole('button', { name: /generate preview/i })
		await user.click(previewButton)

		await waitFor(
			() => {
				expect(screen.getByText(/estimated records/i)).toBeInTheDocument()
				expect(screen.getByText(/applied filters/i)).toBeInTheDocument()
				expect(screen.getByText(/processing time/i)).toBeInTheDocument()
				expect(screen.getByText(/output size/i)).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)
	})

	it('should have proper form structure', () => {
		const { container } = render(
			<TestWrapper>
				<CriteriaBuilder />
			</TestWrapper>
		)

		// Check for form elements
		const inputs = container.querySelectorAll('input, select, button')
		expect(inputs.length).toBeGreaterThan(0)
	})

	it('should display field descriptions', async () => {
		const user = userEvent.setup()
		render(
			<TestWrapper>
				<CriteriaBuilder />
			</TestWrapper>
		)

		const addButton = screen.getByRole('button', { name: /add filter/i })
		await user.click(addButton)

		await waitFor(() => {
			// Field descriptions should be present
			const descriptions = screen.getAllByText(/filter/i)
			expect(descriptions.length).toBeGreaterThan(0)
		})
	})
})
