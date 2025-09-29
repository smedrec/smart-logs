import { createColumns } from '@/components/compliance/hipaa/column'
import { DataTable } from '@/components/compliance/hipaa/data-table'
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Spinner } from '@/components/ui/spinner'
import { useAuditContext } from '@/contexts/audit-provider'
import { transformData } from '@/lib/charts'
import { formatDate } from '@/lib/date'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'

import type { ChartConfig } from '@/components/ui/chart'
import type { OutputData } from '@/lib/charts'
import type { DateRange } from 'react-day-picker'

export const Route = createFileRoute('/_authenticated/compliance/hipaa')({
	component: RouteComponent,
})

const today = new Date(Date.now())

function RouteComponent() {
	const [isLoading, setIsLoading] = useState(false)
	const [dateRange, setDateRange] = useState<DateRange>({
		from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 14),
		to: today,
	})
	const [report, setReport] = useState<any>()
	const [summaryData, setSummaryData] = useState<OutputData>()
	const { client, isConnected } = useAuditContext()

	const columns = createColumns()

	useEffect(() => {
		function getStats() {
			if (!client) {
				toast.error('Failed to get statistics', {
					description: 'No client available',
				})
				return
			}
			setIsLoading(true)
			client.compliance
				.generateHipaaReport({
					dateRange: {
						startDate: formatDate(dateRange.from, 'yyyy-MM-dd'),
						endDate: formatDate(dateRange.to, 'yyyy-MM-dd'),
					},
					limit: 50,
				})
				.then((report) => {
					setReport(report)
					setSummaryData(
						transformData({
							eventsByStatus: report.summary.eventsByStatus,
							eventsByAction: report.summary.eventsByAction,
							eventsByDataClassification: report.summary.eventsByDataClassification,
						})
					)
				})
				.catch((error) => {
					toast.error('Failed to get statistics', {
						description: error.message,
					})
					console.error(error)
				})
				.finally(() => {
					setIsLoading(false)
				})
		}
		if (isConnected) {
			getStats()
		}
	}, [])

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
					<BreadcrumbSeparator className="hidden md:block" />
					<BreadcrumbItem>
						<BreadcrumbPage>{report?.metadata.reportId}</BreadcrumbPage>
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
						locale="en-US"
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
					<>
						<DataTable columns={columns} data={report ? report.events : []} />
						<div className="grid auto-rows-min gap-4 py-4 md:grid-cols-3">
							<div className="aspect-video rounded-xl">
								<Card
									key="uniquePrincipals"
									className="group hover:shadow-lg transition-all duration-200"
								>
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
										<CardTitle className="text-sm font-medium text-muted-foreground">
											Unique Principals
										</CardTitle>
									</CardHeader>
									<CardContent className="pt-0">
										<div className="text-3xl font-bold mb-2">
											{report?.summary.uniquePrincipals}
										</div>
										<p className="text-sm text-muted-foreground leading-relaxed">
											Unique Principals
										</p>
									</CardContent>
								</Card>
							</div>
							<div className="aspect-video rounded-xl">
								<Card
									key="uniqueResources"
									className="group hover:shadow-lg transition-all duration-200"
								>
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
										<CardTitle className="text-sm font-medium text-muted-foreground">
											Unique Resources
										</CardTitle>
									</CardHeader>
									<CardContent className="pt-0">
										<div className="text-3xl font-bold mb-2">{report?.summary.uniqueResources}</div>
										<p className="text-sm text-muted-foreground leading-relaxed">
											Unique Resources
										</p>
									</CardContent>
								</Card>
							</div>
							<div className="aspect-video rounded-xl">
								<Card
									key="integrityViolations"
									className="group hover:shadow-lg transition-all duration-200"
								>
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
										<CardTitle className="text-sm font-medium text-muted-foreground">
											Integrity Violations
										</CardTitle>
									</CardHeader>
									<CardContent className="pt-0">
										<div className="text-3xl font-bold mb-2">
											{report?.summary.integrityViolations}
										</div>
										<p className="text-sm text-muted-foreground leading-relaxed">
											Integrity Violations
										</p>
									</CardContent>
								</Card>
							</div>
						</div>
						<div className="grid auto-rows-min gap-4 md:grid-cols-3">
							<div className="aspect-video rounded-xl">
								<Card className="flex flex-col">
									<CardHeader className="items-center pb-0">
										<CardTitle>By Status</CardTitle>
									</CardHeader>
									<CardContent className="flex-1 pb-0">
										<ChartContainer
											config={byStatusChartConfig}
											className="mx-auto aspect-square max-h-[250px]"
										>
											<PieChart>
												<ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
												<Pie
													data={summaryData?.transformedItems.filter(
														(item) => item.category === 'eventsByStatus'
													)}
													dataKey="value"
													nameKey="itemName"
													innerRadius={60}
												/>
											</PieChart>
										</ChartContainer>
									</CardContent>
									<CardFooter className="flex-col gap-2 text-sm">
										<div className="text-muted-foreground leading-none">
											{`Showing audit events from ${formatDate(dateRange.from, 'yyyy-MM-dd')} to ${formatDate(dateRange.to, 'yyyy-MM-dd')}`}
										</div>
									</CardFooter>
								</Card>
							</div>
							<div className="aspect-video rounded-xl">
								<Card className="flex flex-col">
									<CardHeader className="items-center pb-0">
										<CardTitle>By Action</CardTitle>
									</CardHeader>
									<CardContent className="flex-1 pb-0">
										<ChartContainer config={byActionChartConfig}>
											<BarChart
												accessibilityLayer
												data={summaryData?.transformedItems.filter(
													(item) => item.category === 'eventsByAction'
												)}
												layout="vertical"
												margin={{
													left: -20,
												}}
											>
												<CartesianGrid horizontal={false} />
												<XAxis type="number" dataKey="value" hide />
												<YAxis
													dataKey="itemName"
													type="category"
													tickLine={false}
													tickMargin={10}
													axisLine={false}
													tickFormatter={(value) => value.slice(0, 3)}
													hide
												/>
												<ChartTooltip
													cursor={false}
													content={<ChartTooltipContent indicator="line" />}
												/>
												<Bar
													dataKey="value"
													layout="vertical"
													fill="var(--color-success)"
													radius={5}
												>
													<LabelList
														dataKey="itemName"
														position="insideLeft"
														offset={24}
														className="fill-(--color-label)"
														fontSize={12}
													/>
													<LabelList
														dataKey="value"
														position="right"
														offset={8}
														className="fill-foreground"
														fontSize={12}
													/>
												</Bar>
											</BarChart>
										</ChartContainer>
									</CardContent>
									<CardFooter className="flex-col gap-2 text-sm">
										<div className="text-muted-foreground leading-none">
											{`Showing audit events from ${formatDate(dateRange.from, 'yyyy-MM-dd')} to ${formatDate(dateRange.to, 'yyyy-MM-dd')}`}
										</div>
									</CardFooter>
								</Card>
							</div>
							<div className="aspect-video rounded-xl">
								<Card className="flex flex-col">
									<CardHeader className="items-center pb-0">
										<CardTitle>By Data Classification</CardTitle>
									</CardHeader>
									<CardContent className="flex-1 pb-0">
										<ChartContainer
											config={byDataClassificationChartConfig}
											className="mx-auto aspect-square max-h-[250px]"
										>
											<PieChart>
												<ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
												<Pie
													data={summaryData?.transformedItems.filter(
														(item) => item.category === 'eventsByDataClassification'
													)}
													dataKey="value"
													nameKey="itemName"
													innerRadius={60}
												/>
											</PieChart>
										</ChartContainer>
									</CardContent>
									<CardFooter className="flex-col gap-2 text-sm">
										<div className="text-muted-foreground leading-none">
											{`Showing audit events from ${formatDate(dateRange.from, 'yyyy-MM-dd')} to ${formatDate(dateRange.to, 'yyyy-MM-dd')}`}
										</div>
									</CardFooter>
								</Card>
							</div>
						</div>
					</>
				)}
			</div>
		</div>
	)
}

const byStatusChartConfig = {
	status: {
		label: 'Status',
	},
	attempt: {
		label: 'attempt',
		color: 'var(--chart-2)',
	},
	success: {
		label: 'success',
		color: 'var(--chart-1)',
	},
	failure: {
		label: 'failure',
		color: 'var(--chart-4)',
	},
} satisfies ChartConfig

const byActionChartConfig = {
	action: {
		label: 'Action',
		color: 'var(--chart-1)',
	},
} satisfies ChartConfig

const byDataClassificationChartConfig = {
	dataClassification: {
		label: 'Data Classification',
	},
	PUBLIC: {
		label: 'PUBLIC',
		color: 'var(--chart-1)',
	},
	INTERNAL: {
		label: 'INTERNAL',
		color: 'var(--chart-2)',
	},
	CONFIDENTIAL: {
		label: 'CONFIDENTIAL',
		color: 'var(--chart-3)',
	},
	PHI: {
		label: 'PHI',
		color: 'var(--chart-4)',
	},
} satisfies ChartConfig
