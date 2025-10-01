import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangePicker } from '@/components/ui/date-range-picker'
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
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { AlertCircle, Calendar, Eye, Filter, Plus, X } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { toast } from 'sonner'

import type { ReportType } from '../types'

interface FilterCriterion {
	id: string
	field: string
	operator: string
	value: string | string[]
	type: 'string' | 'number' | 'date' | 'boolean' | 'select'
}

interface ReportTypeConfig {
	availableFields: Array<{
		key: string
		label: string
		type: 'string' | 'number' | 'date' | 'boolean' | 'select'
		options?: string[]
		description?: string
	}>
	defaultFilters: FilterCriterion[]
	requiredFields: string[]
}

const REPORT_TYPE_CONFIGS: Record<ReportType, ReportTypeConfig> = {
	HIPAA_AUDIT_TRAIL: {
		availableFields: [
			{
				key: 'userId',
				label: 'User ID',
				type: 'string',
				description: 'Filter by specific user identifier',
			},
			{
				key: 'resourceType',
				label: 'Resource Type',
				type: 'select',
				options: ['PHI', 'System', 'Authentication', 'Access'],
				description: 'Type of resource accessed',
			},
			{
				key: 'action',
				label: 'Action',
				type: 'select',
				options: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'],
				description: 'Action performed',
			},
			{ key: 'ipAddress', label: 'IP Address', type: 'string', description: 'Source IP address' },
			{
				key: 'severity',
				label: 'Severity',
				type: 'select',
				options: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
				description: 'Event severity level',
			},
			{
				key: 'department',
				label: 'Department',
				type: 'string',
				description: 'User department or organizational unit',
			},
			{
				key: 'patientId',
				label: 'Patient ID',
				type: 'string',
				description: 'Patient identifier for PHI access',
			},
		],
		defaultFilters: [],
		requiredFields: ['dateRange'],
	},
	GDPR_PROCESSING_ACTIVITIES: {
		availableFields: [
			{
				key: 'dataSubjectId',
				label: 'Data Subject ID',
				type: 'string',
				description: 'Identifier of the data subject',
			},
			{
				key: 'processingPurpose',
				label: 'Processing Purpose',
				type: 'select',
				options: [
					'Consent',
					'Contract',
					'Legal Obligation',
					'Vital Interests',
					'Public Task',
					'Legitimate Interests',
				],
				description: 'Legal basis for processing',
			},
			{
				key: 'dataCategory',
				label: 'Data Category',
				type: 'select',
				options: ['Personal', 'Sensitive', 'Criminal', 'Biometric'],
				description: 'Category of personal data',
			},
			{
				key: 'processingActivity',
				label: 'Processing Activity',
				type: 'select',
				options: ['Collection', 'Storage', 'Transfer', 'Deletion', 'Anonymization'],
				description: 'Type of processing activity',
			},
			{
				key: 'thirdPartyRecipient',
				label: 'Third Party Recipient',
				type: 'string',
				description: 'External recipient of data',
			},
			{
				key: 'retentionPeriod',
				label: 'Retention Period (days)',
				type: 'number',
				description: 'Data retention period in days',
			},
			{
				key: 'crossBorderTransfer',
				label: 'Cross-border Transfer',
				type: 'boolean',
				description: 'Whether data was transferred outside EU',
			},
		],
		defaultFilters: [],
		requiredFields: ['dateRange'],
	},
	INTEGRITY_VERIFICATION: {
		availableFields: [
			{
				key: 'systemComponent',
				label: 'System Component',
				type: 'string',
				description: 'System component or service',
			},
			{
				key: 'verificationStatus',
				label: 'Verification Status',
				type: 'select',
				options: ['PASSED', 'FAILED', 'WARNING', 'SKIPPED'],
				description: 'Integrity check result',
			},
			{
				key: 'checkType',
				label: 'Check Type',
				type: 'select',
				options: [
					'Hash Verification',
					'Digital Signature',
					'Timestamp Validation',
					'Access Control',
				],
				description: 'Type of integrity check',
			},
			{
				key: 'riskLevel',
				label: 'Risk Level',
				type: 'select',
				options: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
				description: 'Associated risk level',
			},
			{
				key: 'affectedRecords',
				label: 'Affected Records',
				type: 'number',
				description: 'Number of records affected',
			},
			{
				key: 'remediated',
				label: 'Remediated',
				type: 'boolean',
				description: 'Whether issue was remediated',
			},
		],
		defaultFilters: [],
		requiredFields: ['dateRange'],
	},
}

const OPERATORS = {
	string: [
		{ value: 'equals', label: 'Equals' },
		{ value: 'contains', label: 'Contains' },
		{ value: 'startsWith', label: 'Starts with' },
		{ value: 'endsWith', label: 'Ends with' },
		{ value: 'notEquals', label: 'Not equals' },
	],
	number: [
		{ value: 'equals', label: 'Equals' },
		{ value: 'greaterThan', label: 'Greater than' },
		{ value: 'lessThan', label: 'Less than' },
		{ value: 'greaterThanOrEqual', label: 'Greater than or equal' },
		{ value: 'lessThanOrEqual', label: 'Less than or equal' },
	],
	select: [
		{ value: 'equals', label: 'Equals' },
		{ value: 'in', label: 'In list' },
		{ value: 'notIn', label: 'Not in list' },
	],
	boolean: [{ value: 'equals', label: 'Equals' }],
	date: [
		{ value: 'equals', label: 'On date' },
		{ value: 'after', label: 'After' },
		{ value: 'before', label: 'Before' },
		{ value: 'between', label: 'Between' },
	],
}

interface CriteriaBuilderProps {
	className?: string
}

export function CriteriaBuilder({ className }: CriteriaBuilderProps) {
	const form = useFormContext()
	const reportType = form.watch('reportType') as ReportType
	const criteria = form.watch('criteria')

	const [filters, setFilters] = useState<FilterCriterion[]>([])
	const [previewData, setPreviewData] = useState<any>(null)
	const [isPreviewLoading, setIsPreviewLoading] = useState(false)

	const config = REPORT_TYPE_CONFIGS[reportType]

	// Initialize filters when report type changes
	useEffect(() => {
		if (config) {
			setFilters(config.defaultFilters)
		}
	}, [reportType, config])

	// Update form when filters change
	useEffect(() => {
		const filtersObject = filters.reduce(
			(acc, filter) => {
				acc[filter.field] = {
					operator: filter.operator,
					value: filter.value,
				}
				return acc
			},
			{} as Record<string, any>
		)

		form.setValue('criteria.filters', filtersObject, { shouldDirty: true })
	}, [filters, form])

	const addFilter = () => {
		const newFilter: FilterCriterion = {
			id: `filter-${Date.now()}`,
			field: config.availableFields[0]?.key || '',
			operator: 'equals',
			value: '',
			type: config.availableFields[0]?.type || 'string',
		}
		setFilters([...filters, newFilter])
	}

	const removeFilter = (filterId: string) => {
		setFilters(filters.filter((f) => f.id !== filterId))
	}

	const updateFilter = (filterId: string, updates: Partial<FilterCriterion>) => {
		setFilters(filters.map((f) => (f.id === filterId ? { ...f, ...updates } : f)))
	}

	const handleFieldChange = (filterId: string, fieldKey: string) => {
		const field = config.availableFields.find((f) => f.key === fieldKey)
		if (field) {
			updateFilter(filterId, {
				field: fieldKey,
				type: field.type,
				operator: OPERATORS[field.type][0]?.value || 'equals',
				value: field.type === 'boolean' ? false : '',
			})
		}
	}

	const generatePreview = async () => {
		setIsPreviewLoading(true)
		try {
			// Simulate preview generation
			await new Promise((resolve) => setTimeout(resolve, 1000))

			const mockPreview = {
				estimatedRecords: Math.floor(Math.random() * 10000) + 100,
				dateRange: criteria?.dateRange,
				appliedFilters: filters.length,
				processingTime: '~2-5 minutes',
				outputSize: '~15-30 MB',
			}

			setPreviewData(mockPreview)
			toast.success('Preview generated successfully')
		} catch (error) {
			toast.error('Failed to generate preview')
		} finally {
			setIsPreviewLoading(false)
		}
	}

	if (!config) {
		return (
			<div className="flex items-center justify-center h-64 text-muted-foreground">
				Please select a report type first
			</div>
		)
	}

	return (
		<div className={cn('space-y-6', className)}>
			{/* Date Range Selection */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Calendar className="h-5 w-5" />
						Date Range
					</CardTitle>
					<CardDescription>Select the date range for the report data</CardDescription>
				</CardHeader>
				<CardContent>
					<FormField
						control={form.control}
						name="criteria.dateRange"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Report Date Range *</FormLabel>
								<FormControl>
									<DateRangePicker
										initialDateFrom={
											field.value?.startDate ? new Date(field.value.startDate) : new Date()
										}
										initialDateTo={field.value?.endDate ? new Date(field.value.endDate) : undefined}
										onUpdate={({ range }) => {
											field.onChange({
												startDate: range.from?.toISOString(),
												endDate: range.to?.toISOString(),
											})
										}}
										showCompare={false}
									/>
								</FormControl>
								<FormDescription>
									The time period for which to generate the compliance report
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
				</CardContent>
			</Card>

			{/* Advanced Filters */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<Filter className="h-5 w-5" />
								Advanced Filters
							</CardTitle>
							<CardDescription>Add specific criteria to filter the report data</CardDescription>
						</div>
						<Button type="button" variant="outline" size="sm" onClick={addFilter}>
							<Plus className="h-4 w-4 mr-1" />
							Add Filter
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{filters.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							<Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
							<p>No filters added yet</p>
							<p className="text-sm">Click "Add Filter" to add specific criteria</p>
						</div>
					) : (
						<div className="space-y-3">
							{filters.map((filter, index) => {
								const field = config.availableFields.find((f) => f.key === filter.field)
								const operators = OPERATORS[filter.type] || OPERATORS.string

								return (
									<div key={filter.id} className="flex items-start gap-3 p-3 border rounded-lg">
										<div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
											{/* Field Selection */}
											<div>
												<Label className="text-xs text-muted-foreground">Field</Label>
												<Select
													value={filter.field}
													onValueChange={(value) => handleFieldChange(filter.id, value)}
												>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{config.availableFields.map((field) => (
															<SelectItem key={field.key} value={field.key}>
																{field.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												{field?.description && (
													<p className="text-xs text-muted-foreground mt-1">{field.description}</p>
												)}
											</div>

											{/* Operator Selection */}
											<div>
												<Label className="text-xs text-muted-foreground">Operator</Label>
												<Select
													value={filter.operator}
													onValueChange={(value) => updateFilter(filter.id, { operator: value })}
												>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{operators.map((op) => (
															<SelectItem key={op.value} value={op.value}>
																{op.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>

											{/* Value Input */}
											<div>
												<Label className="text-xs text-muted-foreground">Value</Label>
												{filter.type === 'boolean' ? (
													<div className="flex items-center space-x-2 h-10">
														<Switch
															checked={filter.value as boolean}
															onCheckedChange={(checked) =>
																updateFilter(filter.id, { value: checked })
															}
														/>
														<span className="text-sm">{filter.value ? 'True' : 'False'}</span>
													</div>
												) : filter.type === 'select' && field?.options ? (
													<Select
														value={filter.value as string}
														onValueChange={(value) => updateFilter(filter.id, { value })}
													>
														<SelectTrigger>
															<SelectValue placeholder="Select value" />
														</SelectTrigger>
														<SelectContent>
															{field.options.map((option) => (
																<SelectItem key={option} value={option}>
																	{option}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												) : (
													<Input
														type={filter.type === 'number' ? 'number' : 'text'}
														value={filter.value as string}
														onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
														placeholder="Enter value"
													/>
												)}
											</div>
										</div>

										{/* Remove Button */}
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => removeFilter(filter.id)}
											className="mt-6"
										>
											<X className="h-4 w-4" />
										</Button>
									</div>
								)
							})}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Preview Section */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<Eye className="h-5 w-5" />
								Criteria Preview
							</CardTitle>
							<CardDescription>Preview the impact of your selected criteria</CardDescription>
						</div>
						<Button
							type="button"
							variant="outline"
							onClick={generatePreview}
							disabled={isPreviewLoading || !criteria?.dateRange?.startDate}
						>
							{isPreviewLoading ? 'Generating...' : 'Generate Preview'}
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{!criteria?.dateRange?.startDate ? (
						<div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
							<AlertCircle className="h-4 w-4 text-yellow-600" />
							<span className="text-sm text-yellow-800">
								Please select a date range to generate preview
							</span>
						</div>
					) : previewData ? (
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							<div className="text-center p-3 bg-blue-50 rounded-lg">
								<div className="text-2xl font-bold text-blue-600">
									{previewData.estimatedRecords.toLocaleString()}
								</div>
								<div className="text-xs text-blue-600">Estimated Records</div>
							</div>
							<div className="text-center p-3 bg-green-50 rounded-lg">
								<div className="text-2xl font-bold text-green-600">
									{previewData.appliedFilters}
								</div>
								<div className="text-xs text-green-600">Applied Filters</div>
							</div>
							<div className="text-center p-3 bg-purple-50 rounded-lg">
								<div className="text-sm font-bold text-purple-600">
									{previewData.processingTime}
								</div>
								<div className="text-xs text-purple-600">Processing Time</div>
							</div>
							<div className="text-center p-3 bg-orange-50 rounded-lg">
								<div className="text-sm font-bold text-orange-600">{previewData.outputSize}</div>
								<div className="text-xs text-orange-600">Output Size</div>
							</div>
						</div>
					) : (
						<div className="text-center py-8 text-muted-foreground">
							<Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
							<p>Click "Generate Preview" to see criteria impact</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
