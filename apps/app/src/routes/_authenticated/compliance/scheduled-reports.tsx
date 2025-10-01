import { ComingSoon } from '@/components/coming-soon'
import { useAuditContext } from '@/contexts/audit-provider'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import type { ScheduledReport } from '@smedrec/audit-client'

export const Route = createFileRoute('/_authenticated/compliance/scheduled-reports')({
	component: RouteComponent,
})

function RouteComponent() {
	const [reports, setReports] = useState<ScheduledReport[]>([])
	const { client } = useAuditContext()

	useEffect(() => {
		async function getReports() {
			const reports = await client?.scheduledReports.list()
			setReports(reports?.data ?? [])
		}
		getReports()
	}, [])
	return (
		<div className="flex flex-col gap-4">
			{reports.length > 0 &&
				reports.map((report) => (
					<ul>
						<li key={report.id}>{report.name}</li>
						<li>{report.lastRun}</li>
						<li>{report.nextRun}</li>
					</ul>
				))}
		</div>
	)
}
