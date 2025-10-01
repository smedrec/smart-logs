import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Play } from 'lucide-react'
import React, { useState } from 'react'

import { ExecutionProgressTracker } from './execution-progress-tracker'
import { ManualExecutionDialog } from './manual-execution-dialog'
import { NotificationCenter } from './notification-center'

import type { ScheduledReportUI } from '../types/ui-types'

export function ManualExecutionDemo() {
	const [dialogOpen, setDialogOpen] = useState(false)
	const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null)

	// Mock report for demonstration
	const mockReport: ScheduledReportUI = {
		id: 'report-demo-123',
		name: 'Demo HIPAA Audit Trail Report',
		description: 'Demonstration report for manual execution',
		organizationId: 'org-123',
		reportType: 'HIPAA_AUDIT_TRAIL',
		criteria: {
			dateRange: {
				startDate: '2024-01-01T00:00:00Z',
				endDate: '2024-12-31T23:59:59Z',
			},
		},
		format: 'pdf',
		schedule: {
			frequency: 'monthly',
			timezone: 'UTC',
			hour: 9,
			minute: 0,
			skipWeekends: false,
			skipHolidays: false,
			maxMissedRuns: 3,
			catchUpMissedRuns: false,
		},
		delivery: {
			method: 'email',
			compression: 'none',
			encryption: false,
		},
		export: {
			status: 'completed',
			format: 'pdf',
			exportId: 'export-123',
			recordCount: 0,
			dataSize: 0,
			exportTimestamp: new Date().toISOString(),
		},
		enabled: true,
		createdAt: '2024-01-01T00:00:00Z',
		updatedAt: '2024-01-01T00:00:00Z',
		createdBy: 'user-123',
		updatedBy: 'user-123',
		nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		executionCount: 5,
		successCount: 4,
		failureCount: 1,
		tags: ['demo', 'hipaa'],
		version: 1,
		nextExecutionFormatted: 'Tomorrow at 9:00 AM UTC',
		lastExecutionStatus: 'completed',
	}

	const handleExecutionStart = (executionId: string) => {
		setCurrentExecutionId(executionId)
		console.log('Execution started:', executionId)
	}

	const handleExecutionComplete = () => {
		console.log('Execution completed')
		// In a real implementation, you might refresh data or show a success message
	}

	const handleExecutionCancelled = (executionId: string) => {
		console.log('Execution cancelled:', executionId)
		setCurrentExecutionId(null)
	}

	return (
		<div className="space-y-6 p-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold">Manual Execution Demo</h2>
					<p className="text-muted-foreground">
						Demonstration of manual report execution and real-time monitoring components
					</p>
				</div>
				<div className="flex items-center gap-4">
					<NotificationCenter />
					<Button onClick={() => setDialogOpen(true)}>
						<Play className="h-4 w-4 mr-2" />
						Execute Report
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Report Information */}
				<Card>
					<CardHeader>
						<CardTitle>Report Information</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<h4 className="font-medium">{mockReport.name}</h4>
							<p className="text-sm text-muted-foreground">{mockReport.description}</p>
						</div>
						<div className="grid grid-cols-2 gap-4 text-sm">
							<div>
								<span className="text-muted-foreground">Type:</span>
								<p className="font-medium">{mockReport.reportType}</p>
							</div>
							<div>
								<span className="text-muted-foreground">Format:</span>
								<p className="font-medium">{mockReport.format}</p>
							</div>
							<div>
								<span className="text-muted-foreground">Success Rate:</span>
								<p className="font-medium">
									{Math.round((mockReport.successCount / mockReport.executionCount) * 100)}%
								</p>
							</div>
							<div>
								<span className="text-muted-foreground">Last Status:</span>
								<p className="font-medium capitalize">{mockReport.lastExecutionStatus}</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Execution Progress */}
				{currentExecutionId && (
					<ExecutionProgressTracker
						executionId={currentExecutionId}
						onExecutionComplete={handleExecutionComplete}
						onExecutionCancelled={handleExecutionCancelled}
					/>
				)}
			</div>

			{/* Manual Execution Dialog */}
			<ManualExecutionDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				report={mockReport}
				onExecutionStart={handleExecutionStart}
			/>
		</div>
	)
}
