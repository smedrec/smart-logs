import React from 'react'

import { ComplianceLayout, CompliancePage, ComplianceSection } from './index'

/**
 * Demo component showing the implemented compliance UI structure
 * This demonstrates the base layout components are working correctly
 */
export function ComplianceDemo() {
	return (
		<ComplianceLayout
			sidebar={
				<div className="p-4">
					<h3 className="font-semibold mb-2">Compliance Navigation</h3>
					<ul className="space-y-1 text-sm">
						<li>Dashboard</li>
						<li>Scheduled Reports</li>
						<li>Execution History</li>
						<li>Settings</li>
					</ul>
				</div>
			}
			header={
				<div className="flex items-center justify-between">
					<h1 className="text-xl font-semibold">Compliance Management</h1>
					<button className="px-4 py-2 bg-primary text-primary-foreground rounded">
						New Report
					</button>
				</div>
			}
			breadcrumbs={
				<div className="text-sm text-muted-foreground">Home / Compliance / Dashboard</div>
			}
		>
			<CompliancePage
				title="Compliance Dashboard"
				description="Monitor and manage your compliance reporting"
				actions={<button className="px-3 py-1 text-sm border rounded">Refresh</button>}
			>
				<div className="space-y-6">
					<ComplianceSection
						title="System Status"
						description="Current system health and connectivity"
						variant="card"
					>
						<div className="text-green-600">✓ All systems operational</div>
					</ComplianceSection>

					<ComplianceSection
						title="Recent Activity"
						description="Latest compliance report executions"
						variant="bordered"
						collapsible
					>
						<div className="space-y-2">
							<div className="p-2 bg-muted rounded">HIPAA Report - Completed</div>
							<div className="p-2 bg-muted rounded">GDPR Report - Running</div>
						</div>
					</ComplianceSection>

					<ComplianceSection title="Quick Actions">
						<div className="flex gap-2">
							<button className="px-4 py-2 bg-secondary text-secondary-foreground rounded">
								Generate Report
							</button>
							<button className="px-4 py-2 bg-secondary text-secondary-foreground rounded">
								View History
							</button>
						</div>
					</ComplianceSection>
				</div>
			</CompliancePage>
		</ComplianceLayout>
	)
}
