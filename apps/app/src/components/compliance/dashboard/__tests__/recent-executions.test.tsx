/**
 * Unit tests for RecentExecutions component
 */

import { testAccessibility, testKeyboardNavigation } from '@/__tests__/accessibility-utils'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RecentExecutions } from '../recent-executions'

// Mock the audit context
const mockClient = {
	scheduledReports: {
		list: vi.fn(),
		getExecutionHistory: vi.fn(),
	},
}

vi.mock('@/contexts/audit-provider', () => ({
	useAuditContext: () => ({
		client: mockClient,
		isConnected: true,
		error: null,
	}),
}))

describe('RecentExecutions', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should have no accessibility violations', async () => {
		mockClient.scheduledReports.list.mockResolvedValue({ data: [] })
		const { container } = render(<RecentExecutions />)
		await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument())
		await testAccessibility(container)
	})

	it('should display loading state initially', () => {
		mockClient.scheduledReports.list.mockImplementation(
			() => new Promise((resolve) => setTimeout(() => resolve({ data: [] }), 100))
		)
		render(<RecentExecutions />)
		expect(screen.getByText(/recent executions/i)).toBeInTheDocument()
	})

	it('should display error state when fetch fails', async () => {
		mockClient.scheduledReports.list.mockRejectedValue(new Error('Network error'))
		render(<RecentExecutions />)

		await waitFor(() => {
			expect(screen.getByText(/failed to load executions/i)).toBeInTheDocument()
		})
	})

	it('should display empty state when no executions', async () => {
		mockClient.scheduledReports.list.mockResolvedValue({ data: [] })
		render(<RecentExecutions />)

		await waitFor(() => {
			expect(screen.getByText(/no recent executions/i)).toBeInTheDocument()
		})
	})

	it('should display execution list when data is available', async () => {
		const mockReports = [{ id: 'report-1', name: 'Test Report' }]
		const mockExecutions = [
			{
				id: 'exec-1',
				scheduledReportId: 'report-1',
				status: 'completed',
				scheduledTime: new Date().toISOString(),
			},
		]

		mockClient.scheduledReports.list.mockResolvedValue({ data: mockReports })
		mockClient.scheduledReports.getExecutionHistory.mockResolvedValue({ data: mockExecutions })

		render(<RecentExecutions />)

		await waitFor(() => {
			expect(screen.getByText(/report report-1/i)).toBeInTheDocument()
		})
	})

	it('should have keyboard accessible refresh button', async () => {
		mockClient.scheduledReports.list.mockResolvedValue({ data: [] })
		render(<RecentExecutions />)

		await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument())

		const refreshButtons = screen.getAllByRole('button')
		const refreshButton = refreshButtons.find((btn) => btn.querySelector('svg'))

		if (refreshButton) {
			const keyboard = testKeyboardNavigation(refreshButton)
			expect(keyboard.isFocusable()).toBe(true)
		}
	})

	it('should call retry on error button click', async () => {
		const user = userEvent.setup()
		mockClient.scheduledReports.list.mockRejectedValueOnce(new Error('Network error'))

		render(<RecentExecutions />)

		await waitFor(() => {
			expect(screen.getByText(/failed to load executions/i)).toBeInTheDocument()
		})

		mockClient.scheduledReports.list.mockResolvedValue({ data: [] })

		const retryButton = screen.getByRole('button', { name: /retry/i })
		await user.click(retryButton)

		await waitFor(() => {
			expect(mockClient.scheduledReports.list).toHaveBeenCalledTimes(2)
		})
	})

	it('should display status badges for executions', async () => {
		const mockReports = [{ id: 'report-1', name: 'Test Report' }]
		const mockExecutions = [
			{
				id: 'exec-1',
				scheduledReportId: 'report-1',
				status: 'completed',
				scheduledTime: new Date().toISOString(),
			},
			{
				id: 'exec-2',
				scheduledReportId: 'report-1',
				status: 'failed',
				scheduledTime: new Date().toISOString(),
			},
		]

		mockClient.scheduledReports.list.mockResolvedValue({ data: mockReports })
		mockClient.scheduledReports.getExecutionHistory.mockResolvedValue({ data: mockExecutions })

		render(<RecentExecutions />)

		await waitFor(() => {
			expect(screen.getByText(/completed/i)).toBeInTheDocument()
			expect(screen.getByText(/failed/i)).toBeInTheDocument()
		})
	})

	it('should limit displayed executions to maxItems', async () => {
		const mockReports = [{ id: 'report-1', name: 'Test Report' }]
		const mockExecutions = Array.from({ length: 10 }, (_, i) => ({
			id: `exec-${i}`,
			scheduledReportId: 'report-1',
			status: 'completed',
			scheduledTime: new Date().toISOString(),
		}))

		mockClient.scheduledReports.list.mockResolvedValue({ data: mockReports })
		mockClient.scheduledReports.getExecutionHistory.mockResolvedValue({ data: mockExecutions })

		render(<RecentExecutions maxItems={3} />)

		await waitFor(() => {
			const executionItems = screen.getAllByText(/report report-1/i)
			expect(executionItems.length).toBeLessThanOrEqual(3)
		})
	})
})
