/**
 * Accessibility tests for DashboardStats component
 */

import { testAccessibility, testScreenReaderSupport } from '@/__tests__/accessibility-utils'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DashboardStats } from '../dashboard-stats'

// Mock the audit provider
vi.mock('@/contexts/compliance-audit-provider', () => ({
	useComplianceAudit: () => ({
		isConnected: true,
		error: null,
	}),
}))

describe('DashboardStats Accessibility', () => {
	const mockStats = {
		totalReports: 10,
		activeReports: 8,
		successRate: 95,
		failedExecutions: 2,
		lastExecution: new Date().toISOString(),
	}

	it('should have no accessibility violations', async () => {
		const { container } = render(<DashboardStats />)
		await testAccessibility(container)
	})

	it('should have proper heading structure', () => {
		render(<DashboardStats />)
		const heading = screen.getByText(/compliance overview/i)
		expect(heading).toBeInTheDocument()
	})

	it('should have accessible stat cards', () => {
		const { container } = render(<DashboardStats />)
		const statCards = container.querySelectorAll('[role="region"]')

		statCards.forEach((card) => {
			const screenReader = testScreenReaderSupport(card as HTMLElement)
			expect(screenReader.hasAccessibleName()).toBe(true)
		})
	})

	it('should announce loading state to screen readers', () => {
		render(<DashboardStats />)
		const loadingElement = screen.queryByRole('status')
		if (loadingElement) {
			expect(loadingElement).toHaveAttribute('aria-live')
		}
	})

	it('should have semantic HTML structure', () => {
		const { container } = render(<DashboardStats />)
		const sections = container.querySelectorAll('section, article, aside')
		expect(sections.length).toBeGreaterThan(0)
	})

	it('should provide context for numeric values', () => {
		const { container } = render(<DashboardStats />)
		const numbers = container.querySelectorAll('[data-stat-value]')

		numbers.forEach((number) => {
			const parent = number.parentElement
			expect(parent?.textContent).toBeTruthy()
		})
	})
})
