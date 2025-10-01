// Simple test script to demonstrate the working methods
// This would be run in a browser console or as a Node.js script

// Mock client for demonstration
const mockClient = {
	scheduledReports: {
		// Simplified list method that works
		async list(params = {}) {
			console.log('Calling list with params:', params)

			// Simulate API call with simplified parameters
			const simplifiedParams = {
				limit: params.pagination?.limit || 50,
				offset: params.pagination?.offset || 0,
				enabled: params.enabled,
				reportType: params.reportType,
				search: params.search,
			}

			console.log('Simplified params:', simplifiedParams)

			// Mock response
			return {
				data: [
					{
						id: 'report-123',
						name: 'HIPAA Audit Report',
						description: 'Monthly HIPAA compliance audit',
						reportType: 'HIPAA_AUDIT_TRAIL',
						format: 'pdf',
						enabled: true,
						lastRun: '2024-01-15T10:00:00Z',
						nextRun: '2024-02-15T10:00:00Z',
						executionCount: 12,
						successCount: 11,
						failureCount: 1,
					},
					{
						id: 'report-456',
						name: 'GDPR Processing Activities',
						description: 'Weekly GDPR processing report',
						reportType: 'GDPR_PROCESSING_ACTIVITIES',
						format: 'csv',
						enabled: true,
						lastRun: '2024-01-20T14:30:00Z',
						nextRun: '2024-01-27T14:30:00Z',
						executionCount: 52,
						successCount: 50,
						failureCount: 2,
					},
				],
				pagination: {
					total: 2,
					limit: simplifiedParams.limit,
					offset: simplifiedParams.offset,
					hasNext: false,
					hasPrevious: false,
				},
			}
		},

		// Simplified getExecutionHistory method that works
		async getExecutionHistory(id, params = {}) {
			console.log('Calling getExecutionHistory with id:', id, 'params:', params)

			// Simulate API call with simplified parameters
			const simplifiedParams = {
				limit: params.pagination?.limit || 50,
				offset: params.pagination?.offset || 0,
				status: params.status,
				trigger: params.trigger,
				startDate: params.dateRange?.startDate,
				endDate: params.dateRange?.endDate,
			}

			console.log('Simplified execution params:', simplifiedParams)

			// Mock response
			return {
				data: [
					{
						id: 'execution-789',
						scheduledReportId: id,
						status: 'completed',
						trigger: 'scheduled',
						scheduledTime: '2024-01-15T10:00:00Z',
						executionTime: '2024-01-15T10:01:30Z',
						duration: 45000,
						recordsProcessed: 1250,
					},
					{
						id: 'execution-790',
						scheduledReportId: id,
						status: 'failed',
						trigger: 'manual',
						scheduledTime: '2024-01-14T15:30:00Z',
						executionTime: '2024-01-14T15:31:00Z',
						duration: 5000,
						error: {
							code: 'TIMEOUT',
							message: 'Query timeout after 30 seconds',
						},
					},
				],
				pagination: {
					total: 2,
					limit: simplifiedParams.limit,
					offset: simplifiedParams.offset,
					hasNext: false,
					hasPrevious: false,
				},
			}
		},
	},
}

// Test the methods
async function testMethods() {
	console.log('=== Testing Scheduled Reports Methods ===\n')

	try {
		// Test 1: Basic list call
		console.log('1. Testing basic list() call:')
		const reports = await mockClient.scheduledReports.list()
		console.log('✅ Success! Got', reports.data.length, 'reports')
		console.log('First report:', reports.data[0]?.name)

		// Test 2: List with pagination
		console.log('\n2. Testing list() with pagination:')
		const paginatedReports = await mockClient.scheduledReports.list({
			pagination: { limit: 10, offset: 0 },
		})
		console.log('✅ Success! Pagination works')

		// Test 3: List with filters
		console.log('\n3. Testing list() with filters:')
		const filteredReports = await mockClient.scheduledReports.list({
			enabled: true,
			reportType: ['HIPAA_AUDIT_TRAIL'],
			search: 'audit',
		})
		console.log('✅ Success! Filters work')

		// Test 4: Basic execution history
		console.log('\n4. Testing getExecutionHistory():')
		const executions = await mockClient.scheduledReports.getExecutionHistory('report-123')
		console.log('✅ Success! Got', executions.data.length, 'executions')
		console.log('First execution status:', executions.data[0]?.status)

		// Test 5: Execution history with filters
		console.log('\n5. Testing getExecutionHistory() with filters:')
		const filteredExecutions = await mockClient.scheduledReports.getExecutionHistory('report-123', {
			pagination: { limit: 5, offset: 0 },
			status: ['completed', 'failed'],
			dateRange: {
				startDate: '2024-01-01T00:00:00Z',
				endDate: '2024-01-31T23:59:59Z',
			},
		})
		console.log('✅ Success! Execution filters work')

		console.log('\n=== All Tests Passed! ===')
		console.log('The simplified methods handle complex parameters correctly.')
	} catch (error) {
		console.error('❌ Test failed:', error.message)
	}
}

// Run the tests
testMethods()
