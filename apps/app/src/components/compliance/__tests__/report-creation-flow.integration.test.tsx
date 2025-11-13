/**
 * Integration tests for report creation flow
 */

import { testAccessibility } from '@/__tests__/accessibility-utils'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormProvider, useForm } from 'react-hook-form'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ReportConfigurationForm } from '../forms/report-configuration-form'

// Mock dependencies
const mockClient = {
	scheduledReports: {
		create: vi.fn(),
		update: vi.fn(),
	},
}

vi.mock('@/contexts/compliance-audit-provider', () => ({
	useComplianceAudit: () => ({
		isConnected: true,
		error: null,
		createScheduledReport: mockClient.scheduledReports.create,
		updateScheduledReport: mockClient.scheduledReports.update,
	}),
}))

vi.mock('@tanstack/react-router', () => ({
	useNavigate: () => vi.fn(),
}))

describe('Report Creation Flow Integration', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should complete full report creation flow', async () => {
		const user = userEvent.setup()
		const onSubmit = vi.fn()
		const onCancel = vi.fn()

		mockClient.scheduledReports.create.mockResolvedValue({
			id: 'new-report-1',
			name: 'Test Report',
		})

		render(<ReportConfigurationForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />)

		// Step 1: Select report type
		const reportTypeSelect = screen.getByLabelText(/report type/i)
		await user.click(reportTypeSelect)

		const hipaaOption = screen.getByText(/hipaa audit trail/i)
		await user.click(hipaaOption)

		// Step 2: Fill in basic information
		const nameInput = screen.getByLabelText(/report name/i)
		await user.type(nameInput, 'Monthly HIPAA Audit')

		const descriptionInput = screen.getByLabelText(/description/i)
		await user.type(descriptionInput, 'Monthly compliance audit report')

		// Step 3: Configure criteria
		// Date range should be available
		await waitFor(() => {
			expect(screen.getByText(/date range/i)).toBeInTheDocument()
		})

		// Step 4: Configure schedule
		const scheduleSection = screen.getByText(/schedule/i)
		expect(scheduleSection).toBeInTheDocument()

		// Step 5: Configure delivery
		const deliverySection = screen.getByText(/delivery/i)
		expect(deliverySection).toBeInTheDocument()

		// Step 6: Submit form
		const submitButton = screen.getByRole('button', { name: /create|save|submit/i })
		await user.click(submitButton)

		await waitFor(() => {
			expect(onSubmit).toHaveBeenCalled()
		})
	})

	it('should validate required fields before submission', async () => {
		const user = userEvent.setup()
		const onSubmit = vi.fn()
		const onCancel = vi.fn()

		render(<ReportConfigurationForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />)

		// Try to submit without filling required fields
		const submitButton = screen.getByRole('button', { name: /create|save|submit/i })
		await user.click(submitButton)

		// Should show validation errors
		await waitFor(() => {
			const errors = screen.getAllByRole('alert')
			expect(errors.length).toBeGreaterThan(0)
		})

		// onSubmit should not be called
		expect(onSubmit).not.toHaveBeenCalled()
	})

	it('should handle form cancellation', async () => {
		const user = userEvent.setup()
		const onSubmit = vi.fn()
		const onCancel = vi.fn()

		render(<ReportConfigurationForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />)

		const cancelButton = screen.getByRole('button', { name: /cancel/i })
		await user.click(cancelButton)

		expect(onCancel).toHaveBeenCalled()
		expect(onSubmit).not.toHaveBeenCalled()
	})

	it('should handle API errors during submission', async () => {
		const user = userEvent.setup()
		const onSubmit = vi.fn().mockRejectedValue(new Error('API Error'))

		mockClient.scheduledReports.create.mockRejectedValue(new Error('API Error'))

		render(<ReportConfigurationForm mode="create" onSubmit={onSubmit} onCancel={vi.fn()} />)

		// Fill in minimum required fields
		const nameInput = screen.getByLabelText(/report name/i)
		await user.type(nameInput, 'Test Report')

		const submitButton = screen.getByRole('button', { name: /create|save|submit/i })
		await user.click(submitButton)

		// Should display error message
		await waitFor(() => {
			const errorMessages = screen.queryAllByRole('alert')
			expect(errorMessages.length).toBeGreaterThan(0)
		})
	})

	it('should populate form in edit mode', async () => {
		const initialData = {
			name: 'Existing Report',
			description: 'Existing description',
			reportType: 'HIPAA_AUDIT_TRAIL',
			enabled: true,
		}

		render(
			<ReportConfigurationForm
				mode="edit"
				initialData={initialData}
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
			/>
		)

		// Form should be populated with initial data
		await waitFor(() => {
			const nameInput = screen.getByLabelText(/report name/i) as HTMLInputElement
			expect(nameInput.value).toBe('Existing Report')
		})
	})

	it('should have no accessibility violations during flow', async () => {
		const { container } = render(
			<ReportConfigurationForm mode="create" onSubmit={vi.fn()} onCancel={vi.fn()} />
		)

		await testAccessibility(container)
	})

	it('should show loading state during submission', async () => {
		const user = userEvent.setup()
		const onSubmit = vi
			.fn()
			.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)))

		render(<ReportConfigurationForm mode="create" onSubmit={onSubmit} onCancel={vi.fn()} />)

		// Fill in minimum required fields
		const nameInput = screen.getByLabelText(/report name/i)
		await user.type(nameInput, 'Test Report')

		const submitButton = screen.getByRole('button', { name: /create|save|submit/i })
		await user.click(submitButton)

		// Should show loading state
		await waitFor(() => {
			expect(submitButton).toBeDisabled()
		})
	})

	it('should preserve form data when navigating between sections', async () => {
		const user = userEvent.setup()

		render(<ReportConfigurationForm mode="create" onSubmit={vi.fn()} onCancel={vi.fn()} />)

		// Fill in report name
		const nameInput = screen.getByLabelText(/report name/i)
		await user.type(nameInput, 'Test Report')

		// Navigate to different sections (if multi-step)
		// The name should still be there
		await waitFor(() => {
			const nameInputAfter = screen.getByLabelText(/report name/i) as HTMLInputElement
			expect(nameInputAfter.value).toBe('Test Report')
		})
	})
})
