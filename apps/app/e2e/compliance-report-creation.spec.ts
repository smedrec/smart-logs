import { expect, test } from '@playwright/test'

/**
 * End-to-end test for compliance report creation flow
 *
 * Tests the complete user journey from navigating to the compliance dashboard
 * to creating a new scheduled report.
 *
 * Requirements: Testing strategy from design
 */

test.describe('Compliance Report Creation Flow', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to the compliance dashboard
		await page.goto('/compliance')

		// Wait for the dashboard to load
		await page.waitForSelector('text=Compliance Dashboard')
	})

	test('should complete full report creation flow', async ({ page }) => {
		// Click on "Create Report" button
		await page.click('text=Create Report')

		// Wait for the form to load
		await page.waitForSelector('text=Create Scheduled Report')

		// Fill in report name
		await page.fill('input[name="name"]', 'E2E Test Report')

		// Fill in description
		await page.fill('textarea[name="description"]', 'This is an end-to-end test report')

		// Select report type
		await page.click('button:has-text("Select report type")')
		await page.click('text=HIPAA')

		// Configure schedule
		await page.click('button:has-text("Daily")')

		// Set time
		await page.fill('input[name="schedule.time"]', '09:00')

		// Submit the form
		await page.click('button:has-text("Create Report")')

		// Wait for success message
		await expect(page.locator('text=Report created successfully')).toBeVisible({
			timeout: 10000,
		})

		// Verify redirect to reports list
		await expect(page).toHaveURL(/\/compliance\/scheduled-reports/)

		// Verify the new report appears in the list
		await expect(page.locator('text=E2E Test Report')).toBeVisible()
	})

	test('should validate required fields', async ({ page }) => {
		// Click on "Create Report" button
		await page.click('text=Create Report')

		// Wait for the form to load
		await page.waitForSelector('text=Create Scheduled Report')

		// Try to submit without filling required fields
		await page.click('button:has-text("Create Report")')

		// Verify validation errors appear
		await expect(page.locator('text=Name is required')).toBeVisible()
	})

	test('should cancel report creation', async ({ page }) => {
		// Click on "Create Report" button
		await page.click('text=Create Report')

		// Wait for the form to load
		await page.waitForSelector('text=Create Scheduled Report')

		// Fill in some data
		await page.fill('input[name="name"]', 'Test Report')

		// Click cancel
		await page.click('button:has-text("Cancel")')

		// Verify redirect back to dashboard or reports list
		await expect(page).toHaveURL(/\/compliance/)
	})

	test('should be keyboard accessible', async ({ page }) => {
		// Navigate using keyboard
		await page.keyboard.press('Tab')
		await page.keyboard.press('Tab')

		// Press Enter on "Create Report" button
		await page.keyboard.press('Enter')

		// Wait for the form to load
		await page.waitForSelector('text=Create Scheduled Report')

		// Verify form is accessible via keyboard
		await page.keyboard.press('Tab')
		const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
		expect(focusedElement).toBe('INPUT')
	})

	test('should work on mobile viewport', async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 })

		// Navigate to compliance dashboard
		await page.goto('/compliance')

		// Verify mobile-friendly layout
		await expect(page.locator('text=Compliance Dashboard')).toBeVisible()

		// Click on "Create Report" button
		await page.click('text=Create Report')

		// Verify form is usable on mobile
		await page.waitForSelector('text=Create Scheduled Report')
		await expect(page.locator('input[name="name"]')).toBeVisible()
	})
})
