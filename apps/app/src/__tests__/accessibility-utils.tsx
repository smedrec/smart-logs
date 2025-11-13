/**
 * Accessibility Testing Utilities
 *
 * This module provides utilities for testing accessibility compliance
 * in React components using jest-axe and Testing Library.
 */

import { render, RenderOptions, RenderResult } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import React, { ReactElement } from 'react'

import type { JestAxeConfigureOptions } from 'jest-axe'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

/**
 * Default axe configuration for accessibility testing
 */
export const defaultAxeConfig: JestAxeConfigureOptions = {
	rules: {
		// Disable color contrast checks in tests (requires actual rendering)
		'color-contrast': { enabled: false },
		// Region rule can be noisy in component tests
		region: { enabled: false },
	},
}

/**
 * Strict axe configuration for comprehensive accessibility testing
 */
export const strictAxeConfig: JestAxeConfigureOptions = {
	rules: {
		// Enable all rules for strict testing
		'color-contrast': { enabled: true },
		region: { enabled: true },
	},
}

/**
 * Test wrapper component that provides common providers
 */
interface TestWrapperProps {
	children: React.ReactNode
}

export const TestWrapper: React.FC<TestWrapperProps> = ({ children }) => {
	return <div>{children}</div>
}

/**
 * Custom render function that includes common providers
 */
export function renderWithProviders(
	ui: ReactElement,
	options?: Omit<RenderOptions, 'wrapper'>
): RenderResult {
	return render(ui, { wrapper: TestWrapper, ...options })
}

/**
 * Run accessibility tests on a rendered component
 *
 * @param container - The container element to test
 * @param config - Optional axe configuration
 * @returns Promise that resolves when tests complete
 */
export async function testAccessibility(
	container: HTMLElement,
	config: JestAxeConfigureOptions = defaultAxeConfig
): Promise<void> {
	const results = await axe(container, config)
	expect(results).toHaveNoViolations()
}

/**
 * Test keyboard navigation for a component
 *
 * @param element - The element to test
 * @returns Object with keyboard testing utilities
 */
export function testKeyboardNavigation(element: HTMLElement) {
	return {
		/**
		 * Check if element is keyboard focusable
		 */
		isFocusable: () => {
			const tabIndex = element.getAttribute('tabindex')
			const isInteractive =
				element.tagName === 'BUTTON' ||
				element.tagName === 'A' ||
				element.tagName === 'INPUT' ||
				element.tagName === 'SELECT' ||
				element.tagName === 'TEXTAREA'

			return isInteractive || (tabIndex !== null && parseInt(tabIndex) >= 0)
		},

		/**
		 * Check if element has visible focus indicator
		 */
		hasFocusIndicator: () => {
			element.focus()
			const styles = window.getComputedStyle(element)
			return (
				styles.outline !== 'none' || styles.outlineWidth !== '0px' || styles.boxShadow !== 'none'
			)
		},

		/**
		 * Get tab order of element
		 */
		getTabIndex: () => {
			const tabIndex = element.getAttribute('tabindex')
			return tabIndex ? parseInt(tabIndex) : 0
		},
	}
}

/**
 * Test screen reader support for a component
 *
 * @param element - The element to test
 * @returns Object with screen reader testing utilities
 */
export function testScreenReaderSupport(element: HTMLElement) {
	return {
		/**
		 * Check if element has accessible name
		 */
		hasAccessibleName: () => {
			const ariaLabel = element.getAttribute('aria-label')
			const ariaLabelledBy = element.getAttribute('aria-labelledby')
			const title = element.getAttribute('title')
			const textContent = element.textContent?.trim()

			return !!(ariaLabel || ariaLabelledBy || title || textContent)
		},

		/**
		 * Get accessible name of element
		 */
		getAccessibleName: () => {
			const ariaLabel = element.getAttribute('aria-label')
			if (ariaLabel) return ariaLabel

			const ariaLabelledBy = element.getAttribute('aria-labelledby')
			if (ariaLabelledBy) {
				const labelElement = document.getElementById(ariaLabelledBy)
				return labelElement?.textContent?.trim() || ''
			}

			const title = element.getAttribute('title')
			if (title) return title

			return element.textContent?.trim() || ''
		},

		/**
		 * Check if element has accessible description
		 */
		hasAccessibleDescription: () => {
			const ariaDescribedBy = element.getAttribute('aria-describedby')
			const ariaDescription = element.getAttribute('aria-description')
			return !!(ariaDescribedBy || ariaDescription)
		},

		/**
		 * Get ARIA role of element
		 */
		getRole: () => {
			return element.getAttribute('role') || element.tagName.toLowerCase()
		},

		/**
		 * Check if element is hidden from screen readers
		 */
		isHiddenFromScreenReaders: () => {
			const ariaHidden = element.getAttribute('aria-hidden')
			return ariaHidden === 'true'
		},

		/**
		 * Get all ARIA attributes
		 */
		getAriaAttributes: () => {
			const attributes: Record<string, string> = {}
			Array.from(element.attributes).forEach((attr) => {
				if (attr.name.startsWith('aria-')) {
					attributes[attr.name] = attr.value
				}
			})
			return attributes
		},
	}
}

/**
 * Test responsive design for a component
 *
 * @param element - The element to test
 * @returns Object with responsive testing utilities
 */
export function testResponsiveDesign(element: HTMLElement) {
	return {
		/**
		 * Check if element has minimum touch target size (44x44px)
		 */
		hasTouchTargetSize: () => {
			const rect = element.getBoundingClientRect()
			return rect.width >= 44 && rect.height >= 44
		},

		/**
		 * Check if element is visible on mobile
		 */
		isVisibleOnMobile: () => {
			const styles = window.getComputedStyle(element)
			return styles.display !== 'none' && styles.visibility !== 'hidden'
		},

		/**
		 * Get computed styles
		 */
		getStyles: () => {
			return window.getComputedStyle(element)
		},
	}
}

/**
 * Common accessibility test suite for components
 *
 * @param name - Component name
 * @param renderComponent - Function that renders the component
 * @param options - Test options
 */
export function describeAccessibility(
	name: string,
	renderComponent: () => RenderResult,
	options: {
		skipAxe?: boolean
		skipKeyboard?: boolean
		skipScreenReader?: boolean
		axeConfig?: JestAxeConfigureOptions
	} = {}
) {
	describe(`${name} Accessibility`, () => {
		if (!options.skipAxe) {
			it('should have no accessibility violations', async () => {
				const { container } = renderComponent()
				await testAccessibility(container, options.axeConfig)
			})
		}

		if (!options.skipKeyboard) {
			it('should be keyboard accessible', () => {
				const { container } = renderComponent()
				const interactiveElements = container.querySelectorAll(
					'button, a, input, select, textarea, [tabindex]'
				)

				interactiveElements.forEach((element) => {
					const keyboard = testKeyboardNavigation(element as HTMLElement)
					expect(keyboard.isFocusable()).toBe(true)
				})
			})
		}

		if (!options.skipScreenReader) {
			it('should have proper screen reader support', () => {
				const { container } = renderComponent()
				const interactiveElements = container.querySelectorAll('button, a, input, select, textarea')

				interactiveElements.forEach((element) => {
					const screenReader = testScreenReaderSupport(element as HTMLElement)
					expect(screenReader.hasAccessibleName()).toBe(true)
				})
			})
		}
	})
}

/**
 * Test ARIA live regions
 *
 * @param container - The container to search in
 * @returns Object with live region testing utilities
 */
export function testAriaLiveRegions(container: HTMLElement) {
	return {
		/**
		 * Find all live regions
		 */
		findLiveRegions: () => {
			return container.querySelectorAll('[aria-live]')
		},

		/**
		 * Check if live region exists with specific politeness
		 */
		hasLiveRegion: (politeness: 'polite' | 'assertive' | 'off') => {
			const liveRegions = container.querySelectorAll(`[aria-live="${politeness}"]`)
			return liveRegions.length > 0
		},

		/**
		 * Get content of live regions
		 */
		getLiveRegionContent: () => {
			const liveRegions = container.querySelectorAll('[aria-live]')
			return Array.from(liveRegions).map((region) => region.textContent?.trim() || '')
		},
	}
}

/**
 * Test form accessibility
 *
 * @param form - The form element to test
 * @returns Object with form testing utilities
 */
export function testFormAccessibility(form: HTMLFormElement) {
	return {
		/**
		 * Check if all inputs have labels
		 */
		allInputsHaveLabels: () => {
			const inputs = form.querySelectorAll('input, select, textarea')
			return Array.from(inputs).every((input) => {
				const id = input.getAttribute('id')
				const ariaLabel = input.getAttribute('aria-label')
				const ariaLabelledBy = input.getAttribute('aria-labelledby')

				if (ariaLabel || ariaLabelledBy) return true
				if (id) {
					const label = form.querySelector(`label[for="${id}"]`)
					return !!label
				}
				return false
			})
		},

		/**
		 * Check if all required fields are marked
		 */
		requiredFieldsMarked: () => {
			const requiredInputs = form.querySelectorAll('[required]')
			return Array.from(requiredInputs).every((input) => {
				const ariaRequired = input.getAttribute('aria-required')
				return ariaRequired === 'true' || input.hasAttribute('required')
			})
		},

		/**
		 * Check if error messages are associated with inputs
		 */
		errorMessagesAssociated: () => {
			const inputs = form.querySelectorAll('[aria-invalid="true"]')
			return Array.from(inputs).every((input) => {
				const ariaDescribedBy = input.getAttribute('aria-describedby')
				return !!ariaDescribedBy
			})
		},
	}
}

/**
 * Export all utilities
 */
export {
	axe,
	render,
	renderWithProviders as customRender,
	type JestAxeConfigureOptions,
	type RenderOptions,
	type RenderResult,
}
