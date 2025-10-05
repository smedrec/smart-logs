import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AlertPagination } from '../AlertPagination'

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
	useNavigate: () => vi.fn(),
	useSearch: () => ({}),
}))

describe('AlertPagination', () => {
	it('renders loading state when table is null', () => {
		render(<AlertPagination table={null} enableUrlState={false} />)

		expect(screen.getByText('Loading pagination...')).toBeInTheDocument()
	})

	it('renders disabled controls when table is null', () => {
		render(<AlertPagination table={null} enableUrlState={false} />)

		// Check that pagination controls are disabled
		const buttons = screen.getAllByRole('button')
		buttons.forEach((button) => {
			expect(button).toBeDisabled()
		})
	})
})
