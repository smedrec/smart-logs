/**
 * Unit tests for ExecutionHistoryPage component
 */

import { testAccessibility, testKeyboardNavigation } from '@/__tests__/accessibility-utils'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ExecutionHistoryPage } from '../execution-history-page'

// Mock dependencies
const mockClient = {
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

describe('ExecutionHistoryPage', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should have no accessibility violations', async () => {
		const { container } = render(<ExecutionHistoryPage />)
		await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument())
		await testAccessibility(container)
	})

	it('should display page title and description', () => {
		render(<ExecutionHistoryPage />)

		expect(screen.getByText(/execution history/i)).toBeInTheDocument()
	})

	it('should display filter controls', () => {
		render(<ExecutionHistoryPage />)

		expect(screen.getByPlaceholderText(/search executions/i)).toBeInTheDocument()
		expect(screen.getByText(/filter by status/i)).toBeInTheDocument()
	})

	it('should display execution list', async () => {
		render(<ExecutionHistoryPage />)

		await waitFor(() => {
			expect(screen.getByText(/execution 1/i)).toBeInTheDocument()
		})
	})

	it('should display status badges for executions', async () => {
		render(<ExecutionHistoryPage />)

		await waitFor(() => {
			expect(screen.getByText(/completed/i)).toBeInTheDocument()
			expect(screen.getByText(/failed/i)).toBeInTheDocument()
			expect(screen.getByText(/running/i)).toBeInTheDocument()
		})
	})

	it('should have keyboard accessible filter controls', () => {
		render(<ExecutionHistoryPage />)

		const searchInput = screen.getByPlaceholderText(/search executions/i)
		const keyboard = testKeyboardNavigation(searchInput)
		expect(keyboard.isFocusable()).toBe(true)
	})

	it('should filter executions by search term', async () => {
		const user = userEvent.setup()
		render(<ExecutionHistoryPage />)

		const searchInput = screen.getByPlaceholderText(/search executions/i)
		await user.type(searchInput, 'execution 1')

		await waitFor(() => {
			expect(searchInput).toHaveValue('execution 1')
		})
	})

	it('should filter executions by status', async () => {
		const user = userEvent.setup()
		render(<ExecutionHistoryPage />)

		const statusFilter = screen.getByText(/filter by status/i)
		await user.click(statusFilter)

		await waitFor(() => {
			expect(screen.getByText(/all statuses/i)).toBeInTheDocument()
		})
	})

	it('should clear filters when clear button clicked', async () => {
		const user = userEvent.setup()
		render(<ExecutionHistoryPage />)

		const searchInput = screen.getByPlaceholderText(/search executions/i)
		await user.type(searchInput, 'test')

		const clearButton = screen.getByRole('button', { name: /clear filters/i })
		await user.click(clearButton)

		await waitFor(() => {
			expect(searchInput).toHaveValue('')
		})
	})

	it('should display execution details modal when details button clicked', async () => {
		const user = userEvent.setup()
		render(<ExecutionHistoryPage />)

		await waitFor(() => {
			expect(screen.getByText(/execution 1/i)).toBeInTheDocument()
		})

		const detailsButtons = screen.getAllByRole('button', { name: /details/i })
		await user.click(detailsButtons[0])

		await waitFor(() => {
			expect(screen.getByText(/execution details/i)).toBeInTheDocument()
		})
	})

	it('should display download button for completed executions', async () => {
		render(<ExecutionHistoryPage />)

		await waitFor(() => {
			const downloadButtons = screen.getAllByRole('button', { name: /download/i })
			expect(downloadButtons.length).toBeGreaterThan(0)
		})
	})

	it('should display error message when execution fails', async () => {
		render(<ExecutionHistoryPage />)

		await waitFor(() => {
			expect(screen.getByText(/database connection timeout/i)).toBeInTheDocument()
		})
	})

	it('should display pagination controls', async () => {
		render(<ExecutionHistoryPage />)

		await waitFor(() => {
			expect(screen.getByText(/showing/i)).toBeInTheDocument()
		})
	})

	it('should refresh data when refresh button clicked', async () => {
		const user = userEvent.setup()
		render(<ExecutionHistoryPage />)

		await waitFor(() => {
			expect(screen.getByText(/execution 1/i)).toBeInTheDocument()
		})

		const refreshButton = screen.getByRole('button', { name: /refresh/i })
		await user.click(refreshButton)

		// Component should re-render with fresh data
		await waitFor(() => {
			expect(screen.getByText(/execution 1/i)).toBeInTheDocument()
		})
	})

	it('should display empty state when no executions', async () => {
		render(<ExecutionHistoryPage reportId="empty-report" />)

		await waitFor(() => {
			expect(screen.getByText(/no executions found/i)).toBeInTheDocument()
		})
	})

	it('should display not connected message when disconnected', () => {
		vi.mock('@/contexts/audit-provider', () => ({
			useAuditContext: () => ({
				client: null,
				isConnected: false,
				error: null,
			}),
		}))

		render(<ExecutionHistoryPage />)

		expect(screen.getByText(/not connected to audit system/i)).toBeInTheDocument()
	})

	it('should have accessible action buttons', async () => {
		render(<ExecutionHistoryPage />)

		await waitFor(() => {
			expect(screen.getByText(/execution 1/i)).toBeInTheDocument()
		})

		const buttons = screen.getAllByRole('button')
		buttons.forEach((button) => {
			const keyboard = testKeyboardNavigation(button)
			expect(keyboard.isFocusable()).toBe(true)
		})
	})

	it('should display execution metrics', async () => {
		render(<ExecutionHistoryPage />)

		await waitFor(() => {
			expect(screen.getByText(/1,250 records/i)).toBeInTheDocument()
			expect(screen.getByText(/2.0 MB/i)).toBeInTheDocument()
		})
	})

	it('should format duration correctly', async () => {
		render(<ExecutionHistoryPage />)

		await waitFor(() => {
			expect(screen.getByText(/10m 0s/i)).toBeInTheDocument()
		})
	})

	it('should display execution tabs in details modal', async () => {
		const user = userEvent.setup()
		render(<ExecutionHistoryPage />)

		await waitFor(() => {
			expect(screen.getByText(/execution 1/i)).toBeInTheDocument()
		})

		const detailsButtons = screen.getAllByRole('button', { name: /details/i })
		await user.click(detailsButtons[0])

		await waitFor(() => {
			expect(screen.getByText(/overview/i)).toBeInTheDocument()
			expect(screen.getByText(/logs/i)).toBeInTheDocument()
			expect(screen.getByText(/metrics/i)).toBeInTheDocument()
		})
	})
})
