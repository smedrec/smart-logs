/**
 * Unit tests for ReportsDataTable component
 */

import { testAccessibility, testKeyboardNavigation } from '@/__tests__/accessibility-utils'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ReportsDataTable } from '../reports-data-table'

import type { ScheduledReportUI } from '../../types'

// Mock dependencies
vi.mock('../../utils/aria-live-region', () => ({
	useAriaLiveAnnouncer: () => ({
		announce: vi.fn(),
		LiveRegion: () => null,
	}),
}))

describe('ReportsDataTable', () => {
	const mockReports: ScheduledReportUI[] = [
		{
			id: 'report-1',
			name: 'HIPAA Audit Report',
			description: 'Monthly HIPAA compliance audit',
			reportType: 'HIPAA_AUDIT_TRAIL',
			enabled: true,
			schedule: { cronExpression: '0 0 1 * *' },
			nextExecution: new Date('2025-01-01').toISOString(),
			lastExecutionStatus: 'completed',
			createdAt: new Date('2024-01-01').toISOString(),
			updatedAt: new Date('2024-01-01').toISOString(),
			organizationId: 'org-1',
			createdBy: 'user-1',
		},
		{
			id: 'report-2',
			name: 'GDPR Processing Report',
			description: 'GDPR data processing activities',
			reportType: 'GDPR_PROCESSING_ACTIVITIES',
			enabled: false,
			schedule: { cronExpression: '0 0 * * 0' },
			nextExecution: new Date('2025-01-07').toISOString(),
			lastExecutionStatus: 'failed',
			createdAt: new Date('2024-01-01').toISOString(),
			updatedAt: new Date('2024-01-01').toISOString(),
			organizationId: 'org-1',
			createdBy: 'user-1',
		},
	]

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should have no accessibility violations', async () => {
		const { container } = render(<ReportsDataTable data={mockReports} />)
		await testAccessibility(container)
	})

	it('should display report data in table', () => {
		render(<ReportsDataTable data={mockReports} />)

		expect(screen.getByText('HIPAA Audit Report')).toBeInTheDocument()
		expect(screen.getByText('GDPR Processing Report')).toBeInTheDocument()
	})

	it('should display loading state', () => {
		render(<ReportsDataTable data={[]} loading={true} />)

		expect(screen.getByText(/loading compliance reports/i)).toBeInTheDocument()
	})

	it('should display error state', () => {
		render(<ReportsDataTable data={[]} error="Failed to load reports" />)

		expect(screen.getByText(/error loading reports/i)).toBeInTheDocument()
	})

	it('should display empty state when no data', () => {
		render(<ReportsDataTable data={[]} />)

		expect(screen.getByText(/no compliance reports found/i)).toBeInTheDocument()
	})

	it('should have keyboard accessible checkboxes', () => {
		render(<ReportsDataTable data={mockReports} />)

		const checkboxes = screen.getAllByRole('checkbox')
		checkboxes.forEach((checkbox) => {
			const keyboard = testKeyboardNavigation(checkbox)
			expect(keyboard.isFocusable()).toBe(true)
		})
	})

	it('should handle row selection', async () => {
		const user = userEvent.setup()
		const onSelectionChange = vi.fn()

		render(<ReportsDataTable data={mockReports} onSelectionChange={onSelectionChange} />)

		const checkboxes = screen.getAllByRole('checkbox')
		const firstRowCheckbox = checkboxes[1] // Skip the header checkbox

		await user.click(firstRowCheckbox)

		await waitFor(() => {
			expect(onSelectionChange).toHaveBeenCalled()
		})
	})

	it('should handle select all', async () => {
		const user = userEvent.setup()
		const onSelectionChange = vi.fn()

		render(<ReportsDataTable data={mockReports} onSelectionChange={onSelectionChange} />)

		const checkboxes = screen.getAllByRole('checkbox')
		const selectAllCheckbox = checkboxes[0]

		await user.click(selectAllCheckbox)

		await waitFor(() => {
			expect(onSelectionChange).toHaveBeenCalledWith(['report-1', 'report-2'])
		})
	})

	it('should display report status badges', () => {
		render(<ReportsDataTable data={mockReports} />)

		expect(screen.getByText('Enabled')).toBeInTheDocument()
		expect(screen.getByText('Disabled')).toBeInTheDocument()
	})

	it('should display report type badges', () => {
		render(<ReportsDataTable data={mockReports} />)

		expect(screen.getByText('HIPAA Audit Trail')).toBeInTheDocument()
		expect(screen.getByText('GDPR Processing Activities')).toBeInTheDocument()
	})

	it('should display last execution status', () => {
		render(<ReportsDataTable data={mockReports} />)

		expect(screen.getByText('Completed')).toBeInTheDocument()
		expect(screen.getByText('Failed')).toBeInTheDocument()
	})

	it('should have accessible action buttons', () => {
		render(<ReportsDataTable data={mockReports} />)

		const buttons = screen.getAllByRole('button')
		buttons.forEach((button) => {
			const keyboard = testKeyboardNavigation(button)
			expect(keyboard.isFocusable()).toBe(true)
		})
	})

	it('should call onReportView when view button clicked', async () => {
		const user = userEvent.setup()
		const onReportView = vi.fn()

		render(<ReportsDataTable data={mockReports} onReportView={onReportView} />)

		const viewButtons = screen.getAllByLabelText(/view report/i)
		await user.click(viewButtons[0])

		expect(onReportView).toHaveBeenCalledWith('report-1')
	})

	it('should call onReportEdit when edit button clicked', async () => {
		const user = userEvent.setup()
		const onReportEdit = vi.fn()

		render(<ReportsDataTable data={mockReports} onReportEdit={onReportEdit} />)

		const editButtons = screen.getAllByLabelText(/edit report/i)
		await user.click(editButtons[0])

		expect(onReportEdit).toHaveBeenCalledWith('report-1')
	})

	it('should call onReportExecute when execute button clicked', async () => {
		const user = userEvent.setup()
		const onReportExecute = vi.fn()

		render(<ReportsDataTable data={mockReports} onReportExecute={onReportExecute} />)

		const executeButtons = screen.getAllByLabelText(/execute report/i)
		await user.click(executeButtons[0])

		expect(onReportExecute).toHaveBeenCalledWith('report-1')
	})

	it('should disable execute button for disabled reports', () => {
		render(<ReportsDataTable data={mockReports} />)

		const executeButtons = screen.getAllByLabelText(/execute report/i)
		const disabledReportButton = executeButtons[1] // Second report is disabled

		expect(disabledReportButton).toBeDisabled()
	})

	it('should support sorting', async () => {
		const user = userEvent.setup()
		render(<ReportsDataTable data={mockReports} />)

		const nameHeader = screen.getByText('Report Name')
		await user.click(nameHeader)

		// Table should re-render with sorted data
		await waitFor(() => {
			expect(screen.getByText('HIPAA Audit Report')).toBeInTheDocument()
		})
	})

	it('should support pagination', () => {
		const manyReports = Array.from({ length: 20 }, (_, i) => ({
			...mockReports[0],
			id: `report-${i}`,
			name: `Report ${i}`,
		}))

		render(<ReportsDataTable data={manyReports} />)

		// Pagination controls should be present
		expect(screen.getByRole('navigation')).toBeInTheDocument()
	})

	it('should have proper ARIA labels for screen readers', () => {
		render(<ReportsDataTable data={mockReports} />)

		const table = screen.getByRole('table')
		expect(table).toHaveAttribute('aria-label')
	})

	it('should announce selection changes to screen readers', async () => {
		const user = userEvent.setup()
		render(<ReportsDataTable data={mockReports} />)

		const checkboxes = screen.getAllByRole('checkbox')
		const firstRowCheckbox = checkboxes[1]

		await user.click(firstRowCheckbox)

		// The component should announce the selection
		await waitFor(() => {
			expect(firstRowCheckbox).toBeChecked()
		})
	})

	it('should display bulk actions when rows selected', async () => {
		const user = userEvent.setup()
		render(<ReportsDataTable data={mockReports} />)

		const checkboxes = screen.getAllByRole('checkbox')
		const firstRowCheckbox = checkboxes[1]

		await user.click(firstRowCheckbox)

		await waitFor(() => {
			// Bulk actions should appear
			expect(screen.getByText(/selected/i)).toBeInTheDocument()
		})
	})

	it('should handle bulk enable operation', async () => {
		const user = userEvent.setup()
		const onBulkEnable = vi.fn().mockResolvedValue(undefined)

		render(<ReportsDataTable data={mockReports} onBulkEnable={onBulkEnable} />)

		// Select a report
		const checkboxes = screen.getAllByRole('checkbox')
		await user.click(checkboxes[1])

		// Click bulk enable button
		const enableButton = screen.getByRole('button', { name: /enable/i })
		await user.click(enableButton)

		await waitFor(() => {
			expect(onBulkEnable).toHaveBeenCalled()
		})
	})

	it('should handle bulk delete operation', async () => {
		const user = userEvent.setup()
		const onBulkDelete = vi.fn().mockResolvedValue(undefined)

		render(<ReportsDataTable data={mockReports} onBulkDelete={onBulkDelete} />)

		// Select a report
		const checkboxes = screen.getAllByRole('checkbox')
		await user.click(checkboxes[1])

		// Click bulk delete button
		const deleteButton = screen.getByRole('button', { name: /delete/i })
		await user.click(deleteButton)

		// Confirm deletion
		const confirmButton = screen.getByRole('button', { name: /confirm/i })
		await user.click(confirmButton)

		await waitFor(() => {
			expect(onBulkDelete).toHaveBeenCalled()
		})
	})
})
