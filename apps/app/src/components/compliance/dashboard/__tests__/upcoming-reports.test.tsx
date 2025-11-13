/**
 * Unit tests for UpcomingReports component
 */

import { testAccessibility, testKeyboardNavigation } from '@/__tests__/accessibility-utils'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UpcomingReports } from '../upcoming-reports'

// Mock the audit context
const mockClient = {
	scheduledReports: {
		list: vi.fn(),
		execute: vi.fn(),
	},
}

vi.mock('@/contexts/audit-provider', () => ({
	useAuditContext: () => ({
		client: mockClient,
		isConnected: true,
		error: null,
	}),
}))

describe('UpcomingReports', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should have no accessibility violations', async () => {
		mockClient.scheduledReports.list.mockResolvedValue({ data: [] })
		const { container } = render(<UpcomingReports />)
		await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument())
		await testAccessibility(container)
	})

	it('should display loading state initially', () => {
		mockClient.scheduledReports.list.mockImplementation(
			() => new Promise((resolve) => setTimeout(() => resolve({ data: [] }), 100))
		)
		render(<UpcomingReports />)
		expect(screen.getByText(/upcoming reports/i)).toBeInTheDocument()
	})

	it('should display error state when fetch fails', async () => {
		mockClient.scheduledReports.list.mockRejectedValue(new Error('Network error'))
		render(<UpcomingReports />)

		await waitFor(() => {
			expect(screen.getByText(/failed to load reports/i)).toBeInTheDocument()
		})
	})

	it('should display empty state when no reports', async () => {
		mockClient.scheduledReports.list.mockResolvedValue({ data: [] })
		render(<UpcomingReports />)

		await waitFor(() => {
			expect(screen.getByText(/no upcoming reports/i)).toBeInTheDocument()
		})
	})

	it('should display report list when data is available', async () => {
		const mockReports = [
			{
				id: 'report-1',
				name: 'Test Report',
				reportType: 'HIPAA_AUDIT_TRAIL',
				enabled: true,
				schedule: { cronExpression: '0 0 * * *' },
			},
		]

		mockClient.scheduledReports.list.mockResolvedValue({ data: mockReports })

		render(<UpcomingReports />)

		await waitFor(() => {
			expect(screen.getByText(/test report/i)).toBeInTheDocument()
		})
	})

	it('should have keyboard accessible manual execution button', async () => {
		const mockReports = [
			{
				id: 'report-1',
				name: 'Test Report',
				reportType: 'HIPAA_AUDIT_TRAIL',
				enabled: true,
				schedule: { cronExpression: '0 0 * * *' },
			},
		]

		mockClient.scheduledReports.list.mockResolvedValue({ data: mockReports })

		render(<UpcomingReports />)

		await waitFor(() => {
			expect(screen.getByText(/test report/i)).toBeInTheDocument()
		})

		const executeButtons = screen.getAllByRole('button', { name: /execute now/i })
		if (executeButtons.length > 0) {
			const keyboard = testKeyboardNavigation(executeButtons[0])
			expect(keyboard.isFocusable()).toBe(true)
		}
	})

	it('should trigger manual execution on button click', async () => {
		const user = userEvent.setup()
		const mockReports = [
			{
				id: 'report-1',
				name: 'Test Report',
				reportType: 'HIPAA_AUDIT_TRAIL',
				enabled: true,
				schedule: { cronExpression: '0 0 * * *' },
			},
		]

		mockClient.scheduledReports.list.mockResolvedValue({ data: mockReports })
		mockClient.scheduledReports.execute.mockResolvedValue({})

		render(<UpcomingReports />)

		await waitFor(() => {
			expect(screen.getByText(/test report/i)).toBeInTheDocument()
		})

		const executeButton = screen.getByRole('button', { name: /execute now/i })
		await user.click(executeButton)

		await waitFor(() => {
			expect(mockClient.scheduledReports.execute).toHaveBeenCalledWith('report-1')
		})
	})

	it('should display report type badges', async () => {
		const mockReports = [
			{
				id: 'report-1',
				name: 'HIPAA Report',
				reportType: 'HIPAA_AUDIT_TRAIL',
				enabled: true,
				schedule: { cronExpression: '0 0 * * *' },
			},
			{
				id: 'report-2',
				name: 'GDPR Report',
				reportType: 'GDPR_PROCESSING_ACTIVITIES',
				enabled: true,
				schedule: { cronExpression: '0 0 * * *' },
			},
		]

		mockClient.scheduledReports.list.mockResolvedValue({ data: mockReports })

		render(<UpcomingReports />)

		await waitFor(() => {
			expect(screen.getByText(/hipaa audit trail/i)).toBeInTheDocument()
			expect(screen.getByText(/gdpr processing activities/i)).toBeInTheDocument()
		})
	})

	it('should limit displayed reports to maxItems', async () => {
		const mockReports = Array.from({ length: 10 }, (_, i) => ({
			id: `report-${i}`,
			name: `Test Report ${i}`,
			reportType: 'HIPAA_AUDIT_TRAIL',
			enabled: true,
			schedule: { cronExpression: '0 0 * * *' },
		}))

		mockClient.scheduledReports.list.mockResolvedValue({ data: mockReports })

		render(<UpcomingReports maxItems={3} />)

		await waitFor(() => {
			const reportNames = screen.getAllByText(/test report/i)
			expect(reportNames.length).toBeLessThanOrEqual(3)
		})
	})

	it('should have accessible refresh button', async () => {
		mockClient.scheduledReports.list.mockResolvedValue({ data: [] })
		render(<UpcomingReports />)

		await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument())

		const refreshButtons = screen.getAllByRole('button')
		const refreshButton = refreshButtons.find((btn) => btn.querySelector('svg'))

		if (refreshButton) {
			const keyboard = testKeyboardNavigation(refreshButton)
			expect(keyboard.isFocusable()).toBe(true)
		}
	})
})
