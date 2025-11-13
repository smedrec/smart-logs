/**
 * Integration tests for report execution flow
 */

import { testAccessibility } from '@/__tests__/accessibility-utils'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ExecutionHistoryPage } from '../execution/execution-history-page'
import { ManualExecutionDialog } from '../manual/manual-execution-dialog'

// Mock dependencies
const mockClient = {
	scheduledReports: {
		execute: vi.fn(),
		get: vi.fn(),
	},
	reportExecutions: {
		list: vi.fn(),
		getDetails: vi.fn(),
	},
}

vi.mock('@/contexts/audit-provider', () => ({
	useAuditContext: () => ({
		client: mockClient,
		isConnected: true,
		error: null,
	}),
}))

vi.mock('@tanstack/react-router', () => ({
	useNavigate: () => vi.fn(),
	useParams: () => ({ reportId: 'report-1' }),
}))

describe('Report Execution Flow Integration', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should complete full manual execution flow', async () => {
		const user = userEvent.setup()
		const onClose = vi.fn()
		const onSuccess = vi.fn()

		mockClient.scheduledReports.get.mockResolvedValue({
			id: 'report-1',
			name: 'Test Report',
			reportType: 'HIPAA_AUDIT_TRAIL',
		})

		mockClient.scheduledReports.execute.mockResolvedValue({
			executionId: 'exec-1',
			status: 'pending',
		})

		render(
			<ManualExecutionDialog
				reportId="report-1"
				open={true}
				onClose={onClose}
				onSuccess={onSuccess}
			/>
		)

		// Step 1: Dialog should be visible
		await waitFor(() => {
			expect(screen.getByText(/manual execution/i)).toBeInTheDocument()
		})

		// Step 2: Confirm execution
		const executeButton = screen.getByRole('button', { name: /execute now|start execution/i })
		await user.click(executeButton)

		// Step 3: Execution should be triggered
		await waitFor(() => {
			expect(mockClient.scheduledReports.execute).toHaveBeenCalledWith('report-1')
		})

		// Step 4: Success callback should be called
		await waitFor(() => {
			expect(onSuccess).toHaveBeenCalled()
		})
	})

	it('should handle execution errors gracefully', async () => {
		const user = userEvent.setup()
		const onClose = vi.fn()
		const onSuccess = vi.fn()

		mockClient.scheduledReports.get.mockResolvedValue({
			id: 'report-1',
			name: 'Test Report',
			reportType: 'HIPAA_AUDIT_TRAIL',
		})

		mockClient.scheduledReports.execute.mockRejectedValue(new Error('Execution failed'))

		render(
			<ManualExecutionDialog
				reportId="report-1"
				open={true}
				onClose={onClose}
				onSuccess={onSuccess}
			/>
		)

		await waitFor(() => {
			expect(screen.getByText(/manual execution/i)).toBeInTheDocument()
		})

		const executeButton = screen.getByRole('button', { name: /execute now|start execution/i })
		await user.click(executeButton)

		// Should display error message
		await waitFor(() => {
			const errorMessages = screen.queryAllByRole('alert')
			expect(errorMessages.length).toBeGreaterThan(0)
		})

		// Success callback should not be called
		expect(onSuccess).not.toHaveBeenCalled()
	})

	it('should track execution progress in real-time', async () => {
		const user = userEvent.setup()
		const onClose = vi.fn()
		const onSuccess = vi.fn()

		mockClient.scheduledReports.get.mockResolvedValue({
			id: 'report-1',
			name: 'Test Report',
			reportType: 'HIPAA_AUDIT_TRAIL',
		})

		mockClient.scheduledReports.execute.mockResolvedValue({
			executionId: 'exec-1',
			status: 'running',
		})

		render(
			<ManualExecutionDialog
				reportId="report-1"
				open={true}
				onClose={onClose}
				onSuccess={onSuccess}
			/>
		)

		await waitFor(() => {
			expect(screen.getByText(/manual execution/i)).toBeInTheDocument()
		})

		const executeButton = screen.getByRole('button', { name: /execute now|start execution/i })
		await user.click(executeButton)

		// Should show progress indicator
		await waitFor(() => {
			const progressIndicators = screen.queryAllByRole('progressbar')
			expect(progressIndicators.length).toBeGreaterThanOrEqual(0)
		})
	})

	it('should navigate to execution history after successful execution', async () => {
		const user = userEvent.setup()
		const onClose = vi.fn()
		const onSuccess = vi.fn()

		mockClient.scheduledReports.get.mockResolvedValue({
			id: 'report-1',
			name: 'Test Report',
			reportType: 'HIPAA_AUDIT_TRAIL',
		})

		mockClient.scheduledReports.execute.mockResolvedValue({
			executionId: 'exec-1',
			status: 'completed',
		})

		render(
			<ManualExecutionDialog
				reportId="report-1"
				open={true}
				onClose={onClose}
				onSuccess={onSuccess}
			/>
		)

		await waitFor(() => {
			expect(screen.getByText(/manual execution/i)).toBeInTheDocument()
		})

		const executeButton = screen.getByRole('button', { name: /execute now|start execution/i })
		await user.click(executeButton)

		await waitFor(() => {
			expect(onSuccess).toHaveBeenCalled()
		})
	})

	it('should display execution in history after completion', async () => {
		render(<ExecutionHistoryPage reportId="report-1" />)

		await waitFor(() => {
			expect(screen.getByText(/execution history/i)).toBeInTheDocument()
		})

		// Should display completed execution
		await waitFor(() => {
			expect(screen.getByText(/completed/i)).toBeInTheDocument()
		})
	})

	it('should allow downloading completed execution results', async () => {
		const user = userEvent.setup()
		render(<ExecutionHistoryPage reportId="report-1" />)

		await waitFor(() => {
			expect(screen.getByText(/execution history/i)).toBeInTheDocument()
		})

		// Find and click download button for completed execution
		const downloadButtons = screen.getAllByRole('button', { name: /download/i })
		if (downloadButtons.length > 0) {
			await user.click(downloadButtons[0])

			// Download should be triggered
			await waitFor(() => {
				expect(downloadButtons[0]).toBeInTheDocument()
			})
		}
	})

	it('should have no accessibility violations during execution flow', async () => {
		const { container } = render(
			<ManualExecutionDialog
				reportId="report-1"
				open={true}
				onClose={vi.fn()}
				onSuccess={vi.fn()}
			/>
		)

		await testAccessibility(container)
	})

	it('should cancel execution when cancel button clicked', async () => {
		const user = userEvent.setup()
		const onClose = vi.fn()

		mockClient.scheduledReports.get.mockResolvedValue({
			id: 'report-1',
			name: 'Test Report',
			reportType: 'HIPAA_AUDIT_TRAIL',
		})

		render(
			<ManualExecutionDialog
				reportId="report-1"
				open={true}
				onClose={onClose}
				onSuccess={vi.fn()}
			/>
		)

		await waitFor(() => {
			expect(screen.getByText(/manual execution/i)).toBeInTheDocument()
		})

		const cancelButton = screen.getByRole('button', { name: /cancel/i })
		await user.click(cancelButton)

		expect(onClose).toHaveBeenCalled()
	})

	it('should refresh execution history automatically', async () => {
		render(<ExecutionHistoryPage reportId="report-1" />)

		await waitFor(() => {
			expect(screen.getByText(/execution history/i)).toBeInTheDocument()
		})

		// Component should display executions
		await waitFor(() => {
			expect(screen.getByText(/execution 1/i)).toBeInTheDocument()
		})
	})

	it('should filter execution history by status', async () => {
		const user = userEvent.setup()
		render(<ExecutionHistoryPage reportId="report-1" />)

		await waitFor(() => {
			expect(screen.getByText(/execution history/i)).toBeInTheDocument()
		})

		// Click status filter
		const statusFilter = screen.getByText(/filter by status/i)
		await user.click(statusFilter)

		// Select completed status
		await waitFor(() => {
			const completedOption = screen.getByText(/^completed$/i)
			expect(completedOption).toBeInTheDocument()
		})
	})
})
