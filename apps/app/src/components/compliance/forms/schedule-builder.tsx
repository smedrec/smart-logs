import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { AlertCircle, Calendar, CheckCircle2, Clock, Globe, Info } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { toast } from 'sonner'

interface ScheduleTemplate {
	id: string
	name: string
	description: string
	cronExpression: string
	frequency: string
}

const SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
	{
		id: 'daily',
		name: 'Daily',
		description: 'Run every day at midnight',
		cronExpression: '0 0 * * *',
		frequency: 'Daily',
	},
	{
		id: 'weekly',
		name: 'Weekly',
		description: 'Run every Monday at midnight',
		cronExpression: '0 0 * * 1',
		frequency: 'Weekly',
	},
	{
		id: 'monthly',
		name: 'Monthly',
		description: 'Run on the 1st of every month at midnight',
		cronExpression: '0 0 1 * *',
		frequency: 'Monthly',
	},
	{
		id: 'quarterly',
		name: 'Quarterly',
		description: 'Run on the 1st of every quarter at midnight',
		cronExpression: '0 0 1 */3 *',
		frequency: 'Quarterly',
	},
	{
		id: 'business-hours',
		name: 'Business Hours Daily',
		description: 'Run every day at 9 AM',
		cronExpression: '0 9 * * *',
		frequency: 'Daily (9 AM)',
	},
	{
		id: 'weekend',
		name: 'Weekend',
		description: 'Run every Saturday at midnight',
		cronExpression: '0 0 * * 6',
		frequency: 'Weekly (Saturday)',
	},
]

// Common timezones for selection
const TIMEZONES = [
	{ value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
	{ value: 'America/New_York', label: 'Eastern Time (ET)' },
	{ value: 'America/Chicago', label: 'Central Time (CT)' },
	{ value: 'America/Denver', label: 'Mountain Time (MT)' },
	{ value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
	{ value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
	{ value: 'Europe/Paris', label: 'Central European Time (CET)' },
	{ value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
	{ value: 'Asia/Shanghai', label: 'China Standard Time (CST)' },
	{ value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
]

interface ScheduleBuilderProps {
	className?: string
}

export function ScheduleBuilder({ className }: ScheduleBuilderProps) {
	const form = useFormContext()
	const scheduleData = form.watch('schedule')

	const [selectedTemplate, setSelectedTemplate] = useState<string>('')
	const [nextExecutions, setNextExecutions] = useState<string[]>([])
	const [isValidCron, setIsValidCron] = useState(true)
	const [cronError, setCronError] = useState<string>('')

	// Parse cron expression to human-readable format
	const parseCronExpression = useCallback((cronExpression: string): string => {
		if (!cronExpression) return 'No schedule set'

		try {
			// Basic cron parsing - in a real app, you'd use a proper cron parser library
			const parts = cronExpression.split(' ')
			if (parts.length !== 5) {
				return 'Invalid cron expression'
			}

			const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

			// Simple patterns
			if (cronExpression === '0 0 * * *') return 'Daily at midnight'
			if (cronExpression === '0 0 * * 1') return 'Weekly on Monday at midnight'
			if (cronExpression === '0 0 1 * *') return 'Monthly on the 1st at midnight'
			if (cronExpression === '0 0 1 */3 *') return 'Quarterly on the 1st at midnight'
			if (cronExpression === '0 9 * * *') return 'Daily at 9:00 AM'
			if (cronExpression === '0 0 * * 6') return 'Weekly on Saturday at midnight'

			// Generic parsing
			let description = ''

			if (dayOfMonth !== '*' && dayOfWeek === '*') {
				description = `Monthly on day ${dayOfMonth}`
			} else if (dayOfWeek !== '*' && dayOfMonth === '*') {
				const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
				const dayName = days[parseInt(dayOfWeek)] || `day ${dayOfWeek}`
				description = `Weekly on ${dayName}`
			} else if (dayOfMonth === '*' && dayOfWeek === '*') {
				description = 'Daily'
			} else {
				description = 'Custom schedule'
			}

			if (hour !== '*' || minute !== '*') {
				const hourStr = hour === '*' ? 'every hour' : `${hour}:${minute.padStart(2, '0')}`
				description += ` at ${hourStr}`
			}

			return description
		} catch (error) {
			return 'Invalid cron expression'
		}
	}, [])

	// Validate cron expression
	const validateCronExpression = useCallback((cronExpression: string): boolean => {
		if (!cronExpression) return false

		const parts = cronExpression.split(' ')
		if (parts.length !== 5) {
			setCronError('Cron expression must have 5 parts: minute hour day month day-of-week')
			return false
		}

		// Basic validation - in a real app, use a proper cron validation library
		const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

		// Validate ranges
		const validateRange = (value: string, min: number, max: number): boolean => {
			if (value === '*') return true
			if (value.includes('/')) {
				const [range, step] = value.split('/')
				return validateRange(range, min, max) && parseInt(step) > 0
			}
			if (value.includes('-')) {
				const [start, end] = value.split('-')
				return parseInt(start) >= min && parseInt(end) <= max && parseInt(start) <= parseInt(end)
			}
			if (value.includes(',')) {
				return value.split(',').every((v) => validateRange(v.trim(), min, max))
			}
			const num = parseInt(value)
			return !isNaN(num) && num >= min && num <= max
		}

		if (!validateRange(minute, 0, 59)) {
			setCronError('Minute must be 0-59')
			return false
		}
		if (!validateRange(hour, 0, 23)) {
			setCronError('Hour must be 0-23')
			return false
		}
		if (!validateRange(dayOfMonth, 1, 31)) {
			setCronError('Day of month must be 1-31')
			return false
		}
		if (!validateRange(month, 1, 12)) {
			setCronError('Month must be 1-12')
			return false
		}
		if (!validateRange(dayOfWeek, 0, 7)) {
			setCronError('Day of week must be 0-7 (0 and 7 are Sunday)')
			return false
		}

		setCronError('')
		return true
	}, [])

	// Calculate next execution times
	const calculateNextExecutions = useCallback(
		(cronExpression: string, timezone: string): string[] => {
			if (!cronExpression || !isValidCron) return []

			try {
				// Mock calculation - in a real app, use a proper cron library like node-cron
				const now = new Date()
				const executions: string[] = []

				// Generate next 5 execution times (simplified)
				for (let i = 1; i <= 5; i++) {
					const nextDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000) // Daily approximation
					executions.push(
						nextDate.toLocaleString('en-US', {
							timeZone: timezone,
							weekday: 'short',
							year: 'numeric',
							month: 'short',
							day: 'numeric',
							hour: '2-digit',
							minute: '2-digit',
							timeZoneName: 'short',
						})
					)
				}

				return executions
			} catch (error) {
				return []
			}
		},
		[isValidCron]
	)

	// Update validation and next executions when cron or timezone changes
	useEffect(() => {
		const cronExpression = scheduleData?.cronExpression
		const timezone = scheduleData?.timezone || 'UTC'

		if (cronExpression) {
			const valid = validateCronExpression(cronExpression)
			setIsValidCron(valid)

			if (valid) {
				const executions = calculateNextExecutions(cronExpression, timezone)
				setNextExecutions(executions)
			} else {
				setNextExecutions([])
			}
		} else {
			setIsValidCron(false)
			setNextExecutions([])
		}
	}, [
		scheduleData?.cronExpression,
		scheduleData?.timezone,
		validateCronExpression,
		calculateNextExecutions,
	])

	// Apply template
	const applyTemplate = (template: ScheduleTemplate) => {
		setSelectedTemplate(template.id)
		form.setValue('schedule.cronExpression', template.cronExpression, { shouldDirty: true })
		form.setValue('schedule.description', template.description, { shouldDirty: true })
		toast.success(`Applied ${template.name} template`)
	}

	// Check if current cron matches a template
	useEffect(() => {
		const currentCron = scheduleData?.cronExpression
		const matchingTemplate = SCHEDULE_TEMPLATES.find((t) => t.cronExpression === currentCron)
		setSelectedTemplate(matchingTemplate?.id || '')
	}, [scheduleData?.cronExpression])

	return (
		<div className={cn('space-y-6', className)}>
			{/* Schedule Templates */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Clock className="h-5 w-5" />
						Schedule Templates
					</CardTitle>
					<CardDescription>
						Choose from common scheduling patterns or create a custom schedule
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
						{SCHEDULE_TEMPLATES.map((template) => (
							<Button
								key={template.id}
								variant={selectedTemplate === template.id ? 'default' : 'outline'}
								className="h-auto p-4 flex flex-col items-start text-left"
								onClick={() => applyTemplate(template)}
							>
								<div className="flex items-center gap-2 w-full">
									<span className="font-medium">{template.name}</span>
									{selectedTemplate === template.id && <CheckCircle2 className="h-4 w-4 ml-auto" />}
								</div>
								<span className="text-xs text-muted-foreground mt-1">{template.description}</span>
								<Badge variant="secondary" className="mt-2 text-xs">
									{template.frequency}
								</Badge>
							</Button>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Custom Schedule Configuration */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Calendar className="h-5 w-5" />
						Schedule Configuration
					</CardTitle>
					<CardDescription>Configure the exact schedule using cron expressions</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{/* Cron Expression */}
						<FormField
							control={form.control}
							name="schedule.cronExpression"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Cron Expression *</FormLabel>
									<FormControl>
										<Input
											placeholder="0 0 * * *"
											{...field}
											className={cn(!isValidCron && field.value && 'border-red-500')}
										/>
									</FormControl>
									<FormDescription>Format: minute hour day month day-of-week</FormDescription>
									{cronError && (
										<div className="flex items-center gap-1 text-sm text-red-600">
											<AlertCircle className="h-3 w-3" />
											{cronError}
										</div>
									)}
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Timezone */}
						<FormField
							control={form.control}
							name="schedule.timezone"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Timezone *</FormLabel>
									<Select onValueChange={field.onChange} value={field.value}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select timezone" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{TIMEZONES.map((tz) => (
												<SelectItem key={tz.value} value={tz.value}>
													{tz.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormDescription>Timezone for schedule execution</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					{/* Schedule Description */}
					<FormField
						control={form.control}
						name="schedule.description"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Schedule Description</FormLabel>
								<FormControl>
									<Textarea
										placeholder="Optional description of the schedule..."
										className="min-h-[60px]"
										{...field}
									/>
								</FormControl>
								<FormDescription>
									Optional description to help identify the schedule purpose
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
				</CardContent>
			</Card>

			{/* Schedule Preview */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Globe className="h-5 w-5" />
						Schedule Preview
					</CardTitle>
					<CardDescription>Preview of when the report will be executed</CardDescription>
				</CardHeader>
				<CardContent>
					{scheduleData?.cronExpression ? (
						<div className="space-y-4">
							{/* Human-readable description */}
							<div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
								<Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
								<div>
									<p className="text-sm font-medium text-blue-900">
										Schedule: {parseCronExpression(scheduleData.cronExpression)}
									</p>
									<p className="text-xs text-blue-700 mt-1">
										Timezone: {scheduleData.timezone || 'UTC'}
									</p>
								</div>
							</div>

							{/* Validation status */}
							<div className="flex items-center gap-2">
								{isValidCron ? (
									<>
										<CheckCircle2 className="h-4 w-4 text-green-600" />
										<span className="text-sm text-green-700">Valid cron expression</span>
									</>
								) : (
									<>
										<AlertCircle className="h-4 w-4 text-red-600" />
										<span className="text-sm text-red-700">Invalid cron expression</span>
									</>
								)}
							</div>

							{/* Next execution times */}
							{isValidCron && nextExecutions.length > 0 && (
								<div>
									<h4 className="text-sm font-medium mb-2">Next 5 Executions</h4>
									<div className="space-y-1">
										{nextExecutions.map((execution, index) => (
											<div
												key={index}
												className="text-sm text-muted-foreground flex items-center gap-2"
											>
												<span className="w-4 h-4 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs">
													{index + 1}
												</span>
												{execution}
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					) : (
						<div className="text-center py-8 text-muted-foreground">
							<Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
							<p>Configure a cron expression to see the schedule preview</p>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Cron Expression Help */}
			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Cron Expression Reference</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-xs space-y-2">
						<div className="grid grid-cols-5 gap-2 font-mono bg-gray-50 p-2 rounded">
							<div className="text-center">minute</div>
							<div className="text-center">hour</div>
							<div className="text-center">day</div>
							<div className="text-center">month</div>
							<div className="text-center">day-of-week</div>
						</div>
						<div className="grid grid-cols-5 gap-2 text-center text-muted-foreground">
							<div>0-59</div>
							<div>0-23</div>
							<div>1-31</div>
							<div>1-12</div>
							<div>0-7</div>
						</div>
						<Separator />
						<div className="space-y-1 text-muted-foreground">
							<p>
								<code className="bg-gray-100 px-1 rounded">*</code> = any value
							</p>
							<p>
								<code className="bg-gray-100 px-1 rounded">,</code> = list separator (e.g., 1,3,5)
							</p>
							<p>
								<code className="bg-gray-100 px-1 rounded">-</code> = range (e.g., 1-5)
							</p>
							<p>
								<code className="bg-gray-100 px-1 rounded">/</code> = step (e.g., */2 = every 2)
							</p>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
