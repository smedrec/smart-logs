import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { testAccessibility } from '../../__tests__/test-utils'
import { ManualExecutionDialog } from '../manual-execution-dialog'

// Mock the compliance audit provider
vi.mock('@/contexts/compliance-audit-provider', () => ({
	useComplianceAudit: () => ({
		isConnected: true,
		executeScheduledReport: vi.fn().mockResolvedValue({
			id: 'exec-1',
			status: 'running',
			startedAt: new Date().toISOString(),
		}),
	}),
}))

describe('ManualExecutionDialog', () => {
	const mockReport = {
		id: 'report-1',
		name: 'Test Report',
		reportType: 'HIPAA' as const,
		organizationId: 'org-1',
		enabled: true,
		schedule: {
			frequency: 'daily' as const,
			time: '09:00',
			timezone: 'UTC',
		},
		criteria: {},
		destinations: [],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	}

	it('should render dialog when open', () => {
		render(<ManualExecutionDialog open={true} onOpenChange={vi.fn()} report={mockReport} />)

		expect(screen.getByText(/Execute Report Manually/i)).toBeInTheDocument()
		expect(screen.getByText(mockReport.name)).toBeInTheDocument()
	})

	it('should not render when closed', () => {
		render(<ManualExecutionDialog open={false} onOpenChange={vi.fn()} report={mockReport} />)

		expect(screen.queryByText(/Execute Report Manually/i)).not.toBeInTheDocument()
	})

	it('should call onOpenChange when cancel button clicked', async () => {
		const user = userEvent.setup()
		const onOpenChange = vi.fn()

		render(<ManualExecutionDialog open={true} onOpenChange={onOpenChange} report={mockReport} />)

		const cancelButton = screen.getByRole('button', { name: /cancel/i })
		await user.click(cancelButton)

		expect(onOpenChange).toHaveBeenCalledWith(false)
	})

	it('should display report details', () => {
		render(<ManualExecutionDialog open={true} onOpenChange={vi.fn()} report={mockReport} />)

		expect(screen.getByText(mockReport.name)).toBeInTheDocument()
		expect(screen.getByText(/HIPAA/i)).toBeInTheDocument()
	})

	it('should have no accessibility violations', async () => {
		const { container } = render(
			<ManualExecutionDialog open={true} onOpenChange={vi.fn()} report={mockReport} />
		)

		await testAccessibility(container)
	})

	it('should have proper dialog role and labeling', () => {
		render(<ManualExecutionDialog open={true} onOpenChange={vi.fn()} report={mockReport} />)

		const dialog = screen.getByRole('dialog')
		expect(dialog).toBeInTheDocument()
		expect(dialog).toHaveAccessibleName()
	})

	it('should close on Escape key', async () => {
		const user = userEvent.setup()
		const onOpenChange = vi.fn()

		render(<ManualExecutionDialog open={true} onOpenChange={onOpenChange} report={mockReport} />)

		await user.keyboard('{Escape}')

		await waitFor(() => {
			expect(onOpenChange).toHaveBeenCalledWith(false)
		})
	})
})
