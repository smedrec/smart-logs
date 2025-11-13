/**
 * Unit tests for SystemHealth component
 */

import { testAccessibility, testKeyboardNavigation } from '@/__tests__/accessibility-utils'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SystemHealth } from '../system-health'

// Mock the audit context
const mockClient = {
	scheduledReports: {
		list: vi.fn(),
	},
}

const mockReconnect = vi.fn()

vi.mock('@/contexts/audit-provider', () => ({
	useAuditContext: () => ({
		client: mockClient,
		isConnected: true,
		error: null,
		reconnect: mockReconnect,
	}),
}))

describe('SystemHealth', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should have no accessibility violations', async () => {
		mockClient.scheduledReports.list.mockResolvedValue({ data: [] })
		const { container } = render(<SystemHealth />)
		await waitFor(() => expect(screen.queryByText(/checking connection/i)).not.toBeInTheDocument())
		await testAccessibility(container)
	})

	it('should display loading state initially', () => {
		mockClient.scheduledReports.list.mockImplementation(
			() => new Promise((resolve) => setTimeout(() => resolve({ data: [] }), 100))
		)
		render(<SystemHealth />)
		expect(screen.getByText(/system health/i)).toBeInTheDocument()
	})

	it('should display healthy status when connection is good', async () => {
		mockClient.scheduledReports.list.mockResolvedValue({ data: [] })
		render(<SystemHealth />)

		await waitFor(() => {
			expect(screen.getByText(/healthy/i)).toBeInTheDocument()
			expect(screen.getByText(/all systems operational/i)).toBeInTheDocument()
		})
	})

	it('should display down status when connection fails', async () => {
		mockClient.scheduledReports.list.mockRejectedValue(new Error('Connection failed'))
		render(<SystemHealth />)

		await waitFor(() => {
			expect(screen.getByText(/down/i)).toBeInTheDocument()
		})
	})

	it('should display response time metrics', async () => {
		mockClient.scheduledReports.list.mockResolvedValue({ data: [] })
		render(<SystemHealth />)

		await waitFor(() => {
			expect(screen.getByText(/response time/i)).toBeInTheDocument()
		})
	})

	it('should display connection status', async () => {
		mockClient.scheduledReports.list.mockResolvedValue({ data: [] })
		render(<SystemHealth />)

		await waitFor(() => {
			expect(screen.getByText(/connection/i)).toBeInTheDocument()
			expect(screen.getByText(/connected/i)).toBeInTheDocument()
		})
	})

	it('should have keyboard accessible refresh button', async () => {
		mockClient.scheduledReports.list.mockResolvedValue({ data: [] })
		render(<SystemHealth />)

		await waitFor(() => expect(screen.queryByText(/checking connection/i)).not.toBeInTheDocument())

		const refreshButtons = screen.getAllByRole('button')
		const refreshButton = refreshButtons.find((btn) => btn.querySelector('svg'))

		if (refreshButton) {
			const keyboard = testKeyboardNavigation(refreshButton)
			expect(keyboard.isFocusable()).toBe(true)
		}
	})

	it('should trigger health check on refresh button click', async () => {
		const user = userEvent.setup()
		mockClient.scheduledReports.list.mockResolvedValue({ data: [] })

		render(<SystemHealth />)

		await waitFor(() => expect(screen.queryByText(/checking connection/i)).not.toBeInTheDocument())

		const refreshButtons = screen.getAllByRole('button')
		const refreshButton = refreshButtons.find((btn) => btn.querySelector('svg'))

		if (refreshButton) {
			await user.click(refreshButton)
			await waitFor(() => {
				expect(mockClient.scheduledReports.list).toHaveBeenCalledTimes(2)
			})
		}
	})

	it('should display reconnect button when disconnected', async () => {
		mockClient.scheduledReports.list.mockRejectedValue(new Error('Connection failed'))
		render(<SystemHealth />)

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /reconnect/i })).toBeInTheDocument()
		})
	})

	it('should call reconnect on reconnect button click', async () => {
		const user = userEvent.setup()
		mockClient.scheduledReports.list.mockRejectedValue(new Error('Connection failed'))

		render(<SystemHealth />)

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /reconnect/i })).toBeInTheDocument()
		})

		const reconnectButton = screen.getByRole('button', { name: /reconnect/i })
		await user.click(reconnectButton)

		await waitFor(() => {
			expect(mockReconnect).toHaveBeenCalled()
		})
	})

	it('should display last check time', async () => {
		mockClient.scheduledReports.list.mockResolvedValue({ data: [] })
		render(<SystemHealth />)

		await waitFor(() => {
			expect(screen.getByText(/last check/i)).toBeInTheDocument()
		})
	})

	it('should show degraded status for slow response times', async () => {
		mockClient.scheduledReports.list.mockImplementation(
			() => new Promise((resolve) => setTimeout(() => resolve({ data: [] }), 2000))
		)

		render(<SystemHealth />)

		await waitFor(
			() => {
				expect(screen.getByText(/degraded/i)).toBeInTheDocument()
			},
			{ timeout: 3000 }
		)
	})
})
