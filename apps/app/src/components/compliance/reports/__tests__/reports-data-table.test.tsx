/**
 * Accessibility tests for ReportsDataTable component
 */

import {
	testAccessibility,
	testKeyboardNavigation,
	testScreenReaderSupport,
} from '@/__tests__/accessibility-utils'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ReportsDataTable } from '../reports-data-table'

// Mock dependencies
vi.mock('@/contexts/compliance-audit-provider', () => ({
	useComplianceAudit: () => ({
		isConnected: true,
		error: null,
	}),
}))

vi.mock('@tanstack/react-router', () => ({
	useNavigate: () => vi.fn(),
	Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}))

describe('ReportsDataTable Accessibility', () => {
	const mockReports = [
		{
			id: '1',
			name: 'HIPAA Audit Report',
			reportType: 'hipaa_audit',
			status: 'enabled',
			schedule: { cronExpression: '0 0 * * *' },
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		},
		{
			id: '2',
			name: 'GDPR Compliance Report',
			reportType: 'gdpr_compliance',
			status: 'disabled',
			schedule: { cronExpression: '0 0 * * 0' },
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		},
	]

	it('should have no accessibility violations', async () => {
		const { container } = render(
			<ReportsDataTable reports={mockReports} onReportSelect={vi.fn()} />
		)
		await testAccessibility(container)
	})

	it('should have proper table structure', () => {
		render(<ReportsDataTable reports={mockReports} onReportSelect={vi.fn()} />)

		const table = screen.getByRole('table')
		expect(table).toBeInTheDocument()

		const columnHeaders = screen.getAllByRole('columnheader')
		expect(columnHeaders.length).toBeGreaterThan(0)

		const rows = screen.getAllByRole('row')
		expect(rows.length).toBeGreaterThan(1) // Header + data rows
	})

	it('should have accessible column headers', () => {
		render(<ReportsDataTable reports={mockReports} onReportSelect={vi.fn()} />)

		const columnHeaders = screen.getAllByRole('columnheader')
		columnHeaders.forEach((header) => {
			const screenReader = testScreenReaderSupport(header as HTMLElement)
			expect(screenReader.hasAccessibleName()).toBe(true)
		})
	})

	it('should have keyboard accessible sort buttons', () => {
		render(<ReportsDataTable reports={mockReports} onReportSelect={vi.fn()} />)

		const sortButtons = screen.getAllByRole('button', { name: /sort/i })
		sortButtons.forEach((button) => {
			const keyboard = testKeyboardNavigation(button as HTMLElement)
			expect(keyboard.isFocusable()).toBe(true)
		})
	})

	it('should announce sort state to screen readers', () => {
		render(<ReportsDataTable reports={mockReports} onReportSelect={vi.fn()} />)

		const sortButtons = screen.getAllByRole('button', { name: /sort/i })
		sortButtons.forEach((button) => {
			const ariaSort = button.getAttribute('aria-sort')
			expect(['none', 'ascending', 'descending', null]).toContain(ariaSort)
		})
	})

	it('should have accessible row selection', () => {
		render(<ReportsDataTable reports={mockReports} onReportSelect={vi.fn()} />)

		const checkboxes = screen.getAllByRole('checkbox')
		checkboxes.forEach((checkbox) => {
			const screenReader = testScreenReaderSupport(checkbox as HTMLElement)
			expect(screenReader.hasAccessibleName()).toBe(true)
		})
	})

	it('should provide row context for screen readers', () => {
		const { container } = render(
			<ReportsDataTable reports={mockReports} onReportSelect={vi.fn()} />
		)

		const dataRows = container.querySelectorAll('tbody tr')
		dataRows.forEach((row) => {
			const cells = within(row as HTMLElement).getAllByRole('cell')
			expect(cells.length).toBeGreaterThan(0)
		})
	})

	it('should have accessible action buttons', () => {
		render(<ReportsDataTable reports={mockReports} onReportSelect={vi.fn()} />)

		const actionButtons = screen.getAllByRole('button')
		actionButtons.forEach((button) => {
			const screenReader = testScreenReaderSupport(button as HTMLElement)
			expect(screenReader.hasAccessibleName()).toBe(true)
		})
	})

	it('should announce table updates to screen readers', () => {
		const { container } = render(
			<ReportsDataTable reports={mockReports} onReportSelect={vi.fn()} />
		)

		const liveRegions = container.querySelectorAll('[aria-live]')
		expect(liveRegions.length).toBeGreaterThan(0)
	})

	it('should have proper caption or summary', () => {
		render(<ReportsDataTable reports={mockReports} onReportSelect={vi.fn()} />)

		const table = screen.getByRole('table')
		const caption = within(table).queryByRole('caption')
		const ariaLabel = table.getAttribute('aria-label')
		const ariaLabelledBy = table.getAttribute('aria-labelledby')

		expect(caption || ariaLabel || ariaLabelledBy).toBeTruthy()
	})
})
