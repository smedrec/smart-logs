import { expect, test } from '@playwright/test'

/**
 * End-to-end test for compliance execution history viewing and filtering
 *
 * Tests the complete user journey for viewing and filtering report execution history.
 *
 * Requirements: Testing strategy from design
 */

test.describe('Compliance Execution History Flow', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to the compliance dashboard
		await page.goto('/compliance')

		// Wait for the dashboard to load
		await page.waitForSelector('text=Compliance Dashboard')
	})

	test('should view execution history for a report', async ({ page }) => {
		// Navigate to scheduled reports
		await page.click('text=View All Reports')

		// Wait for reports list to load
		await page.waitForSelector('text=Scheduled Reports')

		// Click on a report to view details
		await page.click('tr:has-text("Test Report"):first-child')

		// Wait for report details page
		await page.waitForSelector('text=Report Details')

		// Click on "Execution History" tab or link
		await page.click('text=Execution History')

		// Verify execution history is displayed
		await expect(page.locator('text=Execution History')).toBeVisible()

		// Verify execution entries are shown
		await expect(page.locator('table tbody tr')).toHaveCount({ min: 1 })
	})

	test('should filter execution history by status', async ({ page }) => {
		// Navigate to execution history
		await page.goto('/compliance/execution-history')

		// Wait for page to load
		await page.waitForSelector('text=Execution History')

		// Open status filter
		await page.click('button:has-text("Status")')

		// Select "Success" filter
		await page.click('text=Success')

		// Verify filtered results
		await expect(page.locator('text=Success')).toHaveCount({ min: 1 })

		// Verify no failed executions are shown
		await expect(page.locator('text=Failed')).toHaveCount(0)
	})

	test('should filter execution history by date range', async ({ page }) => {
		// Navigate to execution history
		await page.goto('/compliance/execution-history')

		// Wait for page to load
		await page.waitForSelector('text=Execution History')

		// Open date range filter
		await page.click('button:has-text("Date Range")')

		// Select "Last 7 days"
		await page.click('text=Last 7 days')

		// Verify filtered results
		await expect(page.locator('table tbody tr')).toHaveCount({ min: 1 })
	})

	test('should view execution details', async ({ page }) => {
		// Navigate to execution history
		await page.goto('/compliance/execution-history')

		// Wait for page to load
		await page.waitForSelector('text=Execution History')

		// Click on an execution to view details
		await page.click('tr:has-text("Success"):first-child')

		// Verify execution details modal or page opens
		await expect(page.locator('text=Execution Details')).toBeVisible()

		// Verify execution information is displayed
		await expect(page.locator('text=Status')).toBeVisible()
		await expect(page.locator('text=Duration')).toBeVisible()
	})

	test('should download execution results', async ({ page }) => {
		// Navigate to execution history
		await page.goto('/compliance/execution-history')

		// Wait for page to load
		await page.waitForSelector('text=Execution History')

		// Set up download listener
		const downloadPromise = page.waitForEvent('download')

		// Click download button for an execution
		await page.click('button[aria-label="Download"]:first-child')

		// Wait for download to start
		const download = await downloadPromise

		// Verify download filename
		expect(download.suggestedFilename()).toMatch(/report.*\.(pdf|csv|json)/)
	})

	test('should paginate through execution history', async ({ page }) => {
		// Navigate to execution history
		await page.goto('/compliance/execution-history')

		// Wait for page to load
		await page.waitForSelector('text=Execution History')

		// Verify pagination controls are present
		await expect(page.locator('button:has-text("Next")')).toBeVisible()

		// Click next page
		await page.click('button:has-text("Next")')

		// Verify page changed
		await expect(page.locator('text=Page 2')).toBeVisible()
	})

	test('should be accessible via keyboard', async ({ page }) => {
		// Navigate to execution history
		await page.goto('/compliance/execution-history')

		// Wait for page to load
		await page.waitForSelector('text=Execution History')

		// Navigate using keyboard
		await page.keyboard.press('Tab')
		await page.keyboard.press('Tab')

		// Verify focus is on interactive element
		const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
		expect(['BUTTON', 'A', 'INPUT']).toContain(focusedElement)
	})
})
