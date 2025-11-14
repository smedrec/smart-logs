import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { testAccessibility } from '../../__tests__/test-utils'
import { CompliancePageHeader } from '../CompliancePageHeader'

// Mock the router
vi.mock('@tanstack/react-router', () => ({
	Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
}))

describe('CompliancePageHeader', () => {
	it('should render title and description', () => {
		render(<CompliancePageHeader title="Test Title" description="Test Description" />)

		expect(screen.getByText('Test Title')).toBeInTheDocument()
		expect(screen.getByText('Test Description')).toBeInTheDocument()
	})

	it('should render without description', () => {
		render(<CompliancePageHeader title="Test Title" />)

		expect(screen.getByText('Test Title')).toBeInTheDocument()
	})

	it('should render action buttons', () => {
		const actions = [
			{ label: 'Create', href: '/create' },
			{ label: 'View All', href: '/view', variant: 'outline' as const },
		]

		render(<CompliancePageHeader title="Test Title" actions={actions} />)

		expect(screen.getByText('Create')).toBeInTheDocument()
		expect(screen.getByText('View All')).toBeInTheDocument()
	})

	it('should have proper heading hierarchy', () => {
		render(<CompliancePageHeader title="Test Title" description="Test Description" />)

		const heading = screen.getByRole('heading', { level: 1 })
		expect(heading).toHaveTextContent('Test Title')
	})

	it('should have no accessibility violations', async () => {
		const { container } = render(
			<CompliancePageHeader title="Test Title" description="Test Description" />
		)

		await testAccessibility(container)
	})

	it('should render with custom className', () => {
		const { container } = render(
			<CompliancePageHeader title="Test Title" className="custom-class" />
		)

		expect(container.firstChild).toHaveClass('custom-class')
	})
})
