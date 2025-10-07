'use client'

import { AlertSeverity, AlertStatus, AlertType } from '@/components/alerts/types/alert-types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from '@/components/ui/chart'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
	Activity,
	AlertTriangle,
	BarChart3,
	Calendar,
	CheckCircle,
	Clock,
	Download,
	Filter,
	PieChart as PieChartIcon,
	RefreshCw,
	TrendingDown,
	TrendingUp,
	XCircle,
} from 'lucide-react'
import React, { useCallback, useMemo, useState } from 'react'
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Line,
	LineChart,
	Pie,
	PieChart,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from 'recharts'

import type { AlertStatistics as AlertStatisticsType } from '@/components/alerts/types/alert-types'
import type { Alert } from '@/lib/collections'

// Time period options
export enum TimePeriod {
	LAST_24_HOURS = 'last_24_hours',
	LAST_7_DAYS = 'last_7_days',
	LAST_30_DAYS = 'last_30_days',
	LAST_90_DAYS = 'last_90_days',
	CUSTOM = 'custom',
}

// Chart type options
export enum ChartType {
	BAR = 'bar',
	LINE = 'line',
	PIE = 'pie',
	AREA = 'area',
}

// Metric options
export enum MetricType {
	COUNT = 'count',
	RESOLUTION_TIME = 'resolution_time',
	RESPONSE_TIME = 'response_time',
	TREND = 'trend',
}

interface AlertStatisticsProps {
	/** Alert statistics data */
	statistics?: AlertStatisticsType
	/** Raw alert data for calculations */
	alerts?: Alert[]
	/** Callback to refresh data */
	onRefresh?: () => Promise<void>
	/** Callback to export statistics */
	onExport?: (format: 'csv' | 'pdf' | 'png') => Promise<void>
	/** Whether data is loading */
	loading?: boolean
	/** Additional CSS classes */
	className?: string
}

// Chart configuration
const chartConfig = {
	active: {
		label: 'Active',
		color: 'hsl(var(--destructive))',
	},
	acknowledged: {
		label: 'Acknowledged',
		color: 'hsl(var(--warning))',
	},
	resolved: {
		label: 'Resolved',
		color: 'hsl(var(--success))',
	},
	dismissed: {
		label: 'Dismissed',
		color: 'hsl(var(--muted))',
	},
	critical: {
		label: 'Critical',
		color: 'hsl(0 84% 60%)',
	},
	high: {
		label: 'High',
		color: 'hsl(25 95% 53%)',
	},
	medium: {
		label: 'Medium',
		color: 'hsl(48 96% 53%)',
	},
	low: {
		label: 'Low',
		color: 'hsl(142 76% 36%)',
	},
	info: {
		label: 'Info',
		color: 'hsl(217 91% 60%)',
	},
}

// Severity colors for pie charts
const SEVERITY_COLORS = {
	[AlertSeverity.CRITICAL]: '#dc2626',
	[AlertSeverity.HIGH]: '#ea580c',
	[AlertSeverity.MEDIUM]: '#ca8a04',
	[AlertSeverity.LOW]: '#16a34a',
	[AlertSeverity.INFO]: '#2563eb',
}

// Status colors for pie charts
const STATUS_COLORS = {
	[AlertStatus.ACTIVE]: '#dc2626',
	[AlertStatus.ACKNOWLEDGED]: '#ca8a04',
	[AlertStatus.RESOLVED]: '#16a34a',
	[AlertStatus.DISMISSED]: '#6b7280',
}

/**
 * Statistics dashboard for alert metrics and trends
 * Displays charts and visualizations for alert data with time-based filtering
 */
export function AlertStatistics({
	statistics,
	alerts = [],
	onRefresh,
	onExport,
	loading = false,
	className,
}: AlertStatisticsProps) {
	const [timePeriod, setTimePeriod] = useState<TimePeriod>(TimePeriod.LAST_7_DAYS)
	const [chartType, setChartType] = useState<ChartType>(ChartType.BAR)
	const [metricType, setMetricType] = useState<MetricType>(MetricType.COUNT)
	const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | undefined>()

	// Calculate statistics from alerts if not provided
	const calculatedStats = useMemo(() => {
		if (statistics) return statistics

		const now = new Date()
		const filteredAlerts = alerts.filter((alert) => {
			const alertDate = new Date(alert.created_at)

			switch (timePeriod) {
				case TimePeriod.LAST_24_HOURS:
					return alertDate >= new Date(now.getTime() - 24 * 60 * 60 * 1000)
				case TimePeriod.LAST_7_DAYS:
					return alertDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
				case TimePeriod.LAST_30_DAYS:
					return alertDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
				case TimePeriod.LAST_90_DAYS:
					return alertDate >= new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
				case TimePeriod.CUSTOM:
					if (!customDateRange) return true
					return alertDate >= customDateRange.start && alertDate <= customDateRange.end
				default:
					return true
			}
		})

		const total = filteredAlerts.length
		const active = filteredAlerts.filter((a) => a.status === AlertStatus.ACTIVE).length
		const acknowledged = filteredAlerts.filter((a) => a.status === AlertStatus.ACKNOWLEDGED).length
		const resolved = filteredAlerts.filter((a) => a.status === AlertStatus.RESOLVED).length
		const dismissed = filteredAlerts.filter((a) => a.status === AlertStatus.DISMISSED).length

		const bySeverity = Object.values(AlertSeverity).reduce(
			(acc, severity) => {
				acc[severity] = filteredAlerts.filter((a) => a.severity === severity).length
				return acc
			},
			{} as Record<AlertSeverity, number>
		)

		const byType = Object.values(AlertType).reduce(
			(acc, type) => {
				acc[type] = filteredAlerts.filter((a) => a.type === type).length
				return acc
			},
			{} as Record<AlertType, number>
		)

		const bySource = filteredAlerts.reduce(
			(acc, alert) => {
				acc[alert.source] = (acc[alert.source] || 0) + 1
				return acc
			},
			{} as Record<string, number>
		)

		// Generate trend data
		const trends = []
		const days =
			timePeriod === TimePeriod.LAST_24_HOURS
				? 24
				: timePeriod === TimePeriod.LAST_7_DAYS
					? 7
					: timePeriod === TimePeriod.LAST_30_DAYS
						? 30
						: 90

		for (let i = days - 1; i >= 0; i--) {
			const date = new Date(
				now.getTime() -
					i * (timePeriod === TimePeriod.LAST_24_HOURS ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000)
			)
			const period =
				timePeriod === TimePeriod.LAST_24_HOURS
					? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
					: date.toLocaleDateString([], { month: 'short', day: 'numeric' })

			const periodAlerts = filteredAlerts.filter((alert) => {
				const alertDate = new Date(alert.created_at)
				if (timePeriod === TimePeriod.LAST_24_HOURS) {
					return (
						alertDate.getHours() === date.getHours() &&
						alertDate.toDateString() === date.toDateString()
					)
				} else {
					return alertDate.toDateString() === date.toDateString()
				}
			})

			const periodResolved = periodAlerts.filter(
				(alert) =>
					alert.resolved_at && new Date(alert.resolved_at).toDateString() === date.toDateString()
			)

			trends.push({
				period,
				created: periodAlerts.length,
				resolved: periodResolved.length,
			})
		}

		return {
			total,
			active,
			acknowledged,
			resolved,
			dismissed,
			bySeverity,
			byType,
			bySource,
			trends,
		}
	}, [alerts, statistics, timePeriod, customDateRange])

	// Prepare chart data
	const statusChartData = useMemo(
		() =>
			[
				{ name: 'Active', value: calculatedStats.active, fill: STATUS_COLORS[AlertStatus.ACTIVE] },
				{
					name: 'Acknowledged',
					value: calculatedStats.acknowledged,
					fill: STATUS_COLORS[AlertStatus.ACKNOWLEDGED],
				},
				{
					name: 'Resolved',
					value: calculatedStats.resolved,
					fill: STATUS_COLORS[AlertStatus.RESOLVED],
				},
				{
					name: 'Dismissed',
					value: calculatedStats.dismissed,
					fill: STATUS_COLORS[AlertStatus.DISMISSED],
				},
			].filter((item) => item.value > 0),
		[calculatedStats]
	)

	const severityChartData = useMemo(
		() =>
			Object.entries(calculatedStats.bySeverity)
				.filter(([, count]) => count > 0)
				.map(([severity, count]) => ({
					name: severity.charAt(0).toUpperCase() + severity.slice(1),
					value: count,
					fill: SEVERITY_COLORS[severity as AlertSeverity],
				})),
		[calculatedStats.bySeverity]
	)

	const typeChartData = useMemo(
		() =>
			Object.entries(calculatedStats.byType)
				.filter(([, count]) => count > 0)
				.map(([type, count]) => ({
					name: type.charAt(0).toUpperCase() + type.slice(1),
					value: count,
				})),
		[calculatedStats.byType]
	)

	const sourceChartData = useMemo(
		() =>
			Object.entries(calculatedStats.bySource)
				.sort(([, a], [, b]) => b - a)
				.slice(0, 10)
				.map(([source, count]) => ({
					name: source,
					value: count,
				})),
		[calculatedStats.bySource]
	)

	const trendChartData = useMemo(() => calculatedStats.trends, [calculatedStats.trends])

	const handleDateRangeChange = useCallback(
		(values: { range: { from: Date; to: Date | undefined } }) => {
			if (values.range.from && values.range.to) {
				setCustomDateRange({
					start: values.range.from,
					end: values.range.to,
				})
			} else {
				setCustomDateRange(undefined)
			}
		},
		[]
	)

	const handleExport = useCallback(
		async (format: 'csv' | 'pdf' | 'png') => {
			if (onExport) {
				await onExport(format)
			}
		},
		[onExport]
	)

	const renderChart = (data: any[], dataKey: string, title: string) => {
		const commonProps = {
			data,
			margin: { top: 20, right: 30, left: 20, bottom: 5 },
		}

		switch (chartType) {
			case ChartType.BAR:
				return (
					<BarChart {...commonProps}>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey="name" />
						<YAxis />
						<ChartTooltip content={<ChartTooltipContent />} />
						<Bar dataKey={dataKey} fill="hsl(var(--primary))" />
					</BarChart>
				)
			case ChartType.LINE:
				return (
					<LineChart {...commonProps}>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey="name" />
						<YAxis />
						<ChartTooltip content={<ChartTooltipContent />} />
						<Line type="monotone" dataKey={dataKey} stroke="hsl(var(--primary))" strokeWidth={2} />
					</LineChart>
				)
			case ChartType.AREA:
				return (
					<AreaChart {...commonProps}>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey="name" />
						<YAxis />
						<ChartTooltip content={<ChartTooltipContent />} />
						<Area
							type="monotone"
							dataKey={dataKey}
							stroke="hsl(var(--primary))"
							fill="hsl(var(--primary))"
							fillOpacity={0.3}
						/>
					</AreaChart>
				)
			case ChartType.PIE:
				return (
					<PieChart>
						<Pie
							data={data}
							cx="50%"
							cy="50%"
							labelLine={false}
							label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
							outerRadius={80}
							fill="#8884d8"
							dataKey={dataKey}
						>
							{data.map((entry, index) => (
								<Cell key={`cell-${index}`} fill={entry.fill || `hsl(${index * 45}, 70%, 50%)`} />
							))}
						</Pie>
						<ChartTooltip content={<ChartTooltipContent />} />
					</PieChart>
				)
			default:
				return null
		}
	}

	return (
		<div className={cn('space-y-6', className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold tracking-tight">Alert Statistics</h2>
					<p className="text-muted-foreground">Analytics and insights for alert data</p>
				</div>
				<div className="flex items-center gap-2">
					{onRefresh && (
						<Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
							<RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
							Refresh
						</Button>
					)}
					{onExport && (
						<Select onValueChange={(value) => handleExport(value as 'csv' | 'pdf' | 'png')}>
							<SelectTrigger className="w-32">
								<SelectValue placeholder="Export" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="csv">CSV</SelectItem>
								<SelectItem value="pdf">PDF</SelectItem>
								<SelectItem value="png">PNG</SelectItem>
							</SelectContent>
						</Select>
					)}
				</div>
			</div>

			{/* Controls */}
			<Card>
				<CardHeader className="pb-4">
					<CardTitle className="text-lg flex items-center gap-2">
						<Filter className="h-4 w-4" />
						Filters & Options
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
						<div>
							<Label className="text-sm font-medium">Time Period</Label>
							<Select
								value={timePeriod}
								onValueChange={(value) => setTimePeriod(value as TimePeriod)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={TimePeriod.LAST_24_HOURS}>Last 24 Hours</SelectItem>
									<SelectItem value={TimePeriod.LAST_7_DAYS}>Last 7 Days</SelectItem>
									<SelectItem value={TimePeriod.LAST_30_DAYS}>Last 30 Days</SelectItem>
									<SelectItem value={TimePeriod.LAST_90_DAYS}>Last 90 Days</SelectItem>
									<SelectItem value={TimePeriod.CUSTOM}>Custom Range</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{timePeriod === TimePeriod.CUSTOM && (
							<div>
								<Label className="text-sm font-medium">Date Range</Label>
								<DateRangePicker
									initialDateFrom={customDateRange?.start}
									initialDateTo={customDateRange?.end}
									onUpdate={handleDateRangeChange}
									align="start"
									showCompare={false}
								/>
							</div>
						)}

						<div>
							<Label className="text-sm font-medium">Chart Type</Label>
							<Select value={chartType} onValueChange={(value) => setChartType(value as ChartType)}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ChartType.BAR}>Bar Chart</SelectItem>
									<SelectItem value={ChartType.LINE}>Line Chart</SelectItem>
									<SelectItem value={ChartType.AREA}>Area Chart</SelectItem>
									<SelectItem value={ChartType.PIE}>Pie Chart</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div>
							<Label className="text-sm font-medium">Metric</Label>
							<Select
								value={metricType}
								onValueChange={(value) => setMetricType(value as MetricType)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={MetricType.COUNT}>Alert Count</SelectItem>
									<SelectItem value={MetricType.TREND}>Trends</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Summary Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
						<Activity className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{calculatedStats.total.toLocaleString()}</div>
						<p className="text-xs text-muted-foreground">All alerts in selected period</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
						<AlertTriangle className="h-4 w-4 text-destructive" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-destructive">
							{calculatedStats.active.toLocaleString()}
						</div>
						<p className="text-xs text-muted-foreground">
							{calculatedStats.total > 0
								? ((calculatedStats.active / calculatedStats.total) * 100).toFixed(1)
								: 0}
							% of total
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Resolved Alerts</CardTitle>
						<CheckCircle className="h-4 w-4 text-green-600" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-green-600">
							{calculatedStats.resolved.toLocaleString()}
						</div>
						<p className="text-xs text-muted-foreground">
							{calculatedStats.total > 0
								? ((calculatedStats.resolved / calculatedStats.total) * 100).toFixed(1)
								: 0}
							% of total
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Acknowledged</CardTitle>
						<Clock className="h-4 w-4 text-yellow-600" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-yellow-600">
							{calculatedStats.acknowledged.toLocaleString()}
						</div>
						<p className="text-xs text-muted-foreground">
							{calculatedStats.total > 0
								? ((calculatedStats.acknowledged / calculatedStats.total) * 100).toFixed(1)
								: 0}
							% of total
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Charts */}
			<Tabs defaultValue="overview" className="w-full">
				<TabsList className="grid w-full grid-cols-4">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="severity">By Severity</TabsTrigger>
					<TabsTrigger value="type">By Type</TabsTrigger>
					<TabsTrigger value="trends">Trends</TabsTrigger>
				</TabsList>

				<TabsContent value="overview" className="space-y-6">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<Card>
							<CardHeader>
								<CardTitle>Alert Status Distribution</CardTitle>
								<CardDescription>Breakdown of alerts by current status</CardDescription>
							</CardHeader>
							<CardContent>
								<ChartContainer config={chartConfig} className="h-[300px]">
									<PieChart>
										<Pie
											data={statusChartData}
											cx="50%"
											cy="50%"
											labelLine={false}
											label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
											outerRadius={80}
											fill="#8884d8"
											dataKey="value"
										>
											{statusChartData.map((entry, index) => (
												<Cell key={`cell-${index}`} fill={entry.fill} />
											))}
										</Pie>
										<ChartTooltip content={<ChartTooltipContent />} />
									</PieChart>
								</ChartContainer>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Top Alert Sources</CardTitle>
								<CardDescription>Most active alert sources</CardDescription>
							</CardHeader>
							<CardContent>
								<ChartContainer config={chartConfig} className="h-[300px]">
									<BarChart
										data={sourceChartData}
										margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
									>
										<CartesianGrid strokeDasharray="3 3" />
										<XAxis dataKey="name" />
										<YAxis />
										<ChartTooltip content={<ChartTooltipContent />} />
										<Bar dataKey="value" fill="hsl(var(--primary))" />
									</BarChart>
								</ChartContainer>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="severity" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Alerts by Severity</CardTitle>
							<CardDescription>Distribution of alerts across severity levels</CardDescription>
						</CardHeader>
						<CardContent>
							<ChartContainer config={chartConfig} className="h-[400px]">
								<PieChart>
									<Pie
										data={severityChartData}
										cx="50%"
										cy="50%"
										labelLine={false}
										label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
										outerRadius={120}
										fill="#8884d8"
										dataKey="value"
									>
										{severityChartData.map((entry, index) => (
											<Cell key={`cell-${index}`} fill={entry.fill} />
										))}
									</Pie>
									<ChartTooltip content={<ChartTooltipContent />} />
								</PieChart>
							</ChartContainer>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="type" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Alerts by Type</CardTitle>
							<CardDescription>Breakdown of alerts by category</CardDescription>
						</CardHeader>
						<CardContent>
							<ChartContainer config={chartConfig} className="h-[400px]">
								<BarChart data={typeChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="name" />
									<YAxis />
									<ChartTooltip content={<ChartTooltipContent />} />
									<Bar dataKey="value" fill="hsl(var(--primary))" />
								</BarChart>
							</ChartContainer>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="trends" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Alert Trends</CardTitle>
							<CardDescription>Alert creation and resolution trends over time</CardDescription>
						</CardHeader>
						<CardContent>
							<ChartContainer config={chartConfig} className="h-[400px]">
								<LineChart
									data={trendChartData}
									margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
								>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="period" />
									<YAxis />
									<ChartTooltip content={<ChartTooltipContent />} />
									<Line
										type="monotone"
										dataKey="created"
										stroke="#dc2626"
										strokeWidth={2}
										name="Created"
									/>
									<Line
										type="monotone"
										dataKey="resolved"
										stroke="#16a34a"
										strokeWidth={2}
										name="Resolved"
									/>
									<ChartLegend content={<ChartLegendContent />} />
								</LineChart>
							</ChartContainer>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	)
}
