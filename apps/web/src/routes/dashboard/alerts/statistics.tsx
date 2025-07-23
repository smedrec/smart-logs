import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Spinner } from '@/components/ui/kibo-ui/spinner'
import { transformSeverityData, transformTypeData } from '@/utils/charts'
import { trpc } from '@/utils/trpc'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Pie, PieChart } from 'recharts'

import type { ChartConfig } from '@/components/ui/chart'
import type { SeverityDataItem, TypeDataItem } from '@/utils/charts'

export const Route = createFileRoute('/dashboard/alerts/statistics')({
	component: RouteComponent,
})

function RouteComponent() {
	const [severityData, setSeverityData] = useState<SeverityDataItem[]>([])
	const [typeData, setTypeData] = useState<TypeDataItem[]>([])
	const { data: statistics, isLoading } = useQuery(trpc.alerts.statistics.queryOptions())

	useEffect(() => {
		if (statistics) {
			setSeverityData(transformSeverityData(statistics.bySeverity))
			setTypeData(transformTypeData(statistics.byType))
		}
	}, [statistics])

	return (
		<div className="flex flex-1 flex-col gap-4 p-4">
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem className="hidden md:block">
						<BreadcrumbLink href="#">Alerts</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator className="hidden md:block" />
					<BreadcrumbItem>
						<BreadcrumbPage>Statistics</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<div className="min-h-[100vh] flex-1 rounded-xl md:min-h-min">
				{isLoading ? (
					<div className="flex flex-1 items-center justify-center">
						<Spinner variant="bars" size={64} />
					</div>
				) : (
					<>
						<div className="grid auto-rows-min gap-4 md:grid-cols-3">
							<div className="aspect-video rounded-xl">
								<Card key="total" className="group hover:shadow-lg transition-all duration-200">
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
										<CardTitle className="text-sm font-medium text-muted-foreground">
											Total
										</CardTitle>
									</CardHeader>
									<CardContent className="pt-0">
										<div className="text-3xl font-bold mb-2">{statistics?.total}</div>
										<p className="text-sm text-muted-foreground leading-relaxed">Total Alerts</p>
									</CardContent>
								</Card>
							</div>
							<div className="aspect-video rounded-xl">
								<Card key="total" className="group hover:shadow-lg transition-all duration-200">
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
										<CardTitle className="text-sm font-medium text-muted-foreground">
											Active
										</CardTitle>
									</CardHeader>
									<CardContent className="pt-0">
										<div className="text-3xl font-bold mb-2">{statistics?.active}</div>
										<p className="text-sm text-muted-foreground leading-relaxed">Active Alerts</p>
									</CardContent>
								</Card>
							</div>
							<div className="aspect-video rounded-xl">
								<Card key="total" className="group hover:shadow-lg transition-all duration-200">
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
										<CardTitle className="text-sm font-medium text-muted-foreground">
											Resolved
										</CardTitle>
									</CardHeader>
									<CardContent className="pt-0">
										<div className="text-3xl font-bold mb-2">{statistics?.resolved}</div>
										<p className="text-sm text-muted-foreground leading-relaxed">Resolved Alerts</p>
									</CardContent>
								</Card>
							</div>
						</div>
						<div className="grid auto-rows-min gap-4 md:grid-cols-2">
							<div className="aspect-video rounded-xl">
								<Card className="flex flex-col">
									<CardHeader className="items-center pb-0">
										<CardTitle>By Severity</CardTitle>
									</CardHeader>
									<CardContent className="flex-1 pb-0">
										<ChartContainer
											config={bySeverityChartConfig}
											className="mx-auto aspect-square max-h-[250px]"
										>
											<PieChart>
												<ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
												<Pie
													data={severityData}
													dataKey="value"
													nameKey="severity"
													innerRadius={60}
												/>
											</PieChart>
										</ChartContainer>
									</CardContent>
									<CardFooter className="flex-col gap-2 text-sm">
										<div className="text-muted-foreground leading-none">
											Showing total alerts for the last 6 months
										</div>
									</CardFooter>
								</Card>
							</div>
							<div className="aspect-video rounded-xl">
								<Card className="flex flex-col">
									<CardHeader className="items-center pb-0">
										<CardTitle>By Type</CardTitle>
									</CardHeader>
									<CardContent className="flex-1 pb-0">
										<ChartContainer
											config={byTypeChartConfig}
											className="mx-auto aspect-square max-h-[250px]"
										>
											<PieChart>
												<ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
												<Pie data={typeData} dataKey="value" nameKey="type" innerRadius={60} />
											</PieChart>
										</ChartContainer>
									</CardContent>
									<CardFooter className="flex-col gap-2 text-sm">
										<div className="text-muted-foreground leading-none">
											Showing total alerts for the last 6 months
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

const bySeverityChartConfig = {
	severity: {
		label: 'Severity',
	},
	LOW: {
		label: 'LOW',
		color: 'var(--chart-1)',
	},
	MEDIUM: {
		label: 'MEDIUM',
		color: 'var(--chart-2)',
	},
	HIGH: {
		label: 'HIGH',
		color: 'var(--chart-3)',
	},
	CRITICAL: {
		label: 'CRITICAL',
		color: 'var(--chart-4)',
	},
} satisfies ChartConfig

const byTypeChartConfig = {
	type: {
		label: 'Type',
	},
	SECURITY: {
		label: 'SECURITY',
		color: 'var(--chart-1)',
	},
	COMPLIANCE: {
		label: 'COMPLIANCE',
		color: 'var(--chart-2)',
	},
	PERFORMANCE: {
		label: 'PERFORMANCE',
		color: 'var(--chart-3)',
	},
	SYSTEM: {
		label: 'SYSTEM',
		color: 'var(--chart-4)',
	},
} satisfies ChartConfig
