import { createColumns } from '@/components/hipaa/column'
import { DataTable } from '@/components/hipaa/data-table'
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Spinner } from '@/components/ui/kibo-ui/spinner'
import { auditClient } from '@/lib/audit-client'
import { formatDate } from '@/lib/date'
import { trpc } from '@/utils/trpc'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import type { DateRange } from 'react-day-picker'
import type { HIPAAComplianceReport } from '@repo/audit'

export const Route = createFileRoute('/dashboard/compliance/hipaa')({
	component: RouteComponent,
})

const today = new Date(Date.now())

function RouteComponent() {
	const [dateRange, setDateRange] = useState<DateRange>({
		from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 14),
		to: today,
	})

	const { data: report, isLoading } = useQuery(
		trpc.reports.hipaa.queryOptions({
			criteria: {
				dateRange: {
					startDate: formatDate(dateRange.from, 'yyyy-MM-dd'),
					/**dateRange.from?.getFullYear().toString() +
						'-' +
						dateRange.from?.getMonth().toString() +
						'-' +
						dateRange.from?.getDay().toString(),*/
					endDate: formatDate(dateRange.to, 'yyyy-MM-dd'),
					/**dateRange.to?.getFullYear().toString() +
						'-' +
						dateRange.to?.getMonth().toString() +
						'-' +
						dateRange.to?.getDay().toString(),*/
				},
				limit: 50,
			},
		})
	)

	console.log(JSON.stringify(report))
	const columns = createColumns()

	return (
		<div className="flex flex-1 flex-col gap-4 p-4">
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem className="hidden md:block">
						<BreadcrumbLink href="#">Compliance</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator className="hidden md:block" />
					<BreadcrumbItem>
						<BreadcrumbPage>Hipaa Reports</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<div className="min-h-[100vh] flex-1 rounded-xl md:min-h-min">
				<div className="flex items-center justify-between">
					<DateRangePicker
						onUpdate={(values) => setDateRange(values.range)}
						initialDateFrom={dateRange.from}
						initialDateTo={dateRange.to}
						align="start"
						locale="en-GB"
						showCompare={false}
					/>
					<div className="flex items-center gap-4">
						<Button>Filters</Button>
					</div>
					<div className="flex items-center gap-4">
						<Button>Export</Button>
					</div>
				</div>
				{isLoading ? (
					<div className="flex flex-1 items-center justify-center">
						<Spinner variant="bars" size={64} />
					</div>
				) : (
					<DataTable columns={columns} data={report ? report.events : []} />
				)}
			</div>
		</div>
	)
}
