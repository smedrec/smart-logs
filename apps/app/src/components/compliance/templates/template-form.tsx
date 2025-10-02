/**
 * Template Creation and Editing Form
 *
 * Multi-step form for creating and editing report templates
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, ArrowLeft, ArrowRight, Check, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'

import type {
	CreateTemplateInput,
	ReportType,
	TEMPLATE_CATEGORIES,
	TEMPLATE_PRESETS,
	TemplateCategory,
	TemplateFormState,
	UpdateTemplateInput,
} from './template-types'

const templateFormSchema = z.object({
	name: z.string().min(1, 'Template name is required').max(100, 'Name too long'),
	description: z.string().max(500, 'Description too long').optional(),
	reportType: z.enum(['HIPAA_AUDIT_TRAIL', 'GDPR_PROCESSING_ACTIVITIES', 'INTEGRITY_VERIFICATION']),
	category: z.string().min(1, 'Category is required'),
	tags: z.array(z.string()).max(10, 'Too many tags'),
	isPublic: z.boolean().default(false),
	shareSettings: z.object({
		isPublic: z.boolean(),
		allowPublicUse: z.boolean(),
		allowPublicEdit: z.boolean(),
		requireApproval: z.boolean(),
		maxShares: z.number().optional(),
	}),
	configuration: z.object({
		criteria: z.object({
			dateRange: z
				.object({
					type: z.enum(['relative', 'absolute', 'custom']),
					value: z.string().optional(),
					startDate: z.string().optional(),
					endDate: z.string().optional(),
				})
				.optional(),
			filters: z.record(z.any()).optional(),
			includeFields: z.array(z.string()).optional(),
			excludeFields: z.array(z.string()).optional(),
			groupBy: z.array(z.string()).optional(),
			sortBy: z.array(z.string()).optional(),
		}),
		output: z.object({
			format: z.enum(['pdf', 'csv', 'json', 'xlsx']),
			includeCharts: z.boolean().optional(),
			includeRawData: z.boolean().optional(),
			customSections: z.array(z.any()).optional(),
		}),
		scheduleTemplate: z
			.object({
				cronExpression: z.string().optional(),
				timezone: z.string().optional(),
				enabled: z.boolean(),
			})
			.optional(),
		deliveryTemplate: z
			.object({
				method: z.enum(['email', 'webhook', 'storage']),
				configuration: z.record(z.any()),
			})
			.optional(),
		validation: z
			.object({
				required: z.array(z.string()),
				rules: z.array(z.any()),
			})
			.optional(),
	}),
})

interface TemplateFormProps {
	initialData?: Partial<CreateTemplateInput | UpdateTemplateInput>
	mode: 'create' | 'edit'
	onSubmit: (data: CreateTemplateInput | UpdateTemplateInput) => Promise<void>
	onCancel: () => void
	loading?: boolean
}

const FORM_STEPS = [
	{ id: 1, title: 'Basic Information', description: 'Template name, type, and category' },
	{ id: 2, title: 'Report Configuration', description: 'Configure report criteria and output' },
	{ id: 3, title: 'Advanced Settings', description: 'Schedule and delivery templates' },
	{ id: 4, title: 'Sharing & Permissions', description: 'Configure sharing and access' },
	{ id: 5, title: 'Review & Save', description: 'Review and save template' },
]

export function TemplateForm({
	initialData,
	mode,
	onSubmit,
	onCancel,
	loading,
}: TemplateFormProps) {
	const [formState, setFormState] = useState<TemplateFormState>({
		data: {
			name: '',
			description: '',
			reportType: 'HIPAA_AUDIT_TRAIL',
			category: 'healthcare',
			tags: [],
			isPublic: false,
			shareSettings: {
				isPublic: false,
				allowPublicUse: false,
				allowPublicEdit: false,
				requireApproval: true,
				maxShares: undefined,
			},
			configuration: {
				criteria: {
					dateRange: { type: 'relative', value: '30d' },
					includeFields: [],
					excludeFields: [],
					groupBy: [],
					sortBy: [],
				},
				output: {
					format: 'pdf',
					includeCharts: true,
					includeRawData: false,
					customSections: [],
				},
				scheduleTemplate: {
					enabled: false,
				},
				validation: {
					required: [],
					rules: [],
				},
			},
			...initialData,
		},
		errors: {},
		touched: {},
		isSubmitting: false,
		isDirty: false,
		currentStep: 1,
		totalSteps: FORM_STEPS.length,
	})

	const [newTag, setNewTag] = useState('')

	// Load preset configuration when report type changes
	useEffect(() => {
		if (formState.data.reportType && !formState.isDirty) {
			const preset = TEMPLATE_PRESETS[formState.data.reportType]
			if (preset) {
				setFormState((prev) => ({
					...prev,
					data: {
						...prev.data,
						configuration: {
							...prev.data.configuration,
							...preset,
						},
					},
				}))
			}
		}
	}, [formState.data.reportType, formState.isDirty])

	const updateFormData = useCallback((updates: Partial<CreateTemplateInput>) => {
		setFormState((prev) => ({
			...prev,
			data: { ...prev.data, ...updates },
			isDirty: true,
		}))
	}, [])

	const updateNestedFormData = useCallback((path: string, value: any) => {
		setFormState((prev) => {
			const newData = { ...prev.data }
			const keys = path.split('.')
			let current: any = newData

			for (let i = 0; i < keys.length - 1; i++) {
				if (!current[keys[i]]) {
					current[keys[i]] = {}
				}
				current = current[keys[i]]
			}

			current[keys[keys.length - 1]] = value

			return {
				...prev,
				data: newData,
				isDirty: true,
			}
		})
	}, [])

	const addTag = useCallback(() => {
		if (newTag.trim() && !formState.data.tags?.includes(newTag.trim())) {
			updateFormData({
				tags: [...(formState.data.tags || []), newTag.trim()],
			})
			setNewTag('')
		}
	}, [newTag, formState.data.tags, updateFormData])

	const removeTag = useCallback(
		(tagToRemove: string) => {
			updateFormData({
				tags: formState.data.tags?.filter((tag) => tag !== tagToRemove) || [],
			})
		},
		[formState.data.tags, updateFormData]
	)

	const validateCurrentStep = useCallback(() => {
		const errors: Record<string, string> = {}

		switch (formState.currentStep) {
			case 1:
				if (!formState.data.name?.trim()) {
					errors.name = 'Template name is required'
				}
				if (!formState.data.reportType) {
					errors.reportType = 'Report type is required'
				}
				if (!formState.data.category) {
					errors.category = 'Category is required'
				}
				break
			case 2:
				if (!formState.data.configuration?.output?.format) {
					errors['configuration.output.format'] = 'Output format is required'
				}
				break
		}

		setFormState((prev) => ({ ...prev, errors }))
		return Object.keys(errors).length === 0
	}, [formState.currentStep, formState.data])

	const nextStep = useCallback(() => {
		if (validateCurrentStep() && formState.currentStep < formState.totalSteps) {
			setFormState((prev) => ({ ...prev, currentStep: prev.currentStep + 1 }))
		}
	}, [validateCurrentStep, formState.currentStep, formState.totalSteps])

	const prevStep = useCallback(() => {
		if (formState.currentStep > 1) {
			setFormState((prev) => ({ ...prev, currentStep: prev.currentStep - 1 }))
		}
	}, [formState.currentStep])

	const handleSubmit = useCallback(async () => {
		if (!validateCurrentStep()) return

		try {
			setFormState((prev) => ({ ...prev, isSubmitting: true }))

			const result = templateFormSchema.safeParse(formState.data)
			if (!result.success) {
				const errors: Record<string, string> = {}
				result.error.errors.forEach((error) => {
					errors[error.path.join('.')] = error.message
				})
				setFormState((prev) => ({ ...prev, errors }))
				return
			}

			await onSubmit(result.data as CreateTemplateInput | UpdateTemplateInput)
		} catch (error) {
			console.error('Form submission error:', error)
		} finally {
			setFormState((prev) => ({ ...prev, isSubmitting: false }))
		}
	}, [validateCurrentStep, formState.data, onSubmit])

	const renderStepContent = () => {
		switch (formState.currentStep) {
			case 1:
				return (
					<div className="space-y-6">
						<div className="space-y-2">
							<Label htmlFor="name">Template Name *</Label>
							<Input
								id="name"
								value={formState.data.name || ''}
								onChange={(e) => updateFormData({ name: e.target.value })}
								placeholder="Enter template name"
								className={formState.errors.name ? 'border-red-500' : ''}
							/>
							{formState.errors.name && (
								<p className="text-sm text-red-600 flex items-center gap-1">
									<AlertCircle className="h-4 w-4" />
									{formState.errors.name}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="description">Description</Label>
							<Textarea
								id="description"
								value={formState.data.description || ''}
								onChange={(e) => updateFormData({ description: e.target.value })}
								placeholder="Describe what this template is for"
								rows={3}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="reportType">Report Type *</Label>
							<Select
								value={formState.data.reportType}
								onValueChange={(value) => updateFormData({ reportType: value as ReportType })}
							>
								<SelectTrigger className={formState.errors.reportType ? 'border-red-500' : ''}>
									<SelectValue placeholder="Select report type" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="HIPAA_AUDIT_TRAIL">HIPAA Audit Trail</SelectItem>
									<SelectItem value="GDPR_PROCESSING_ACTIVITIES">
										GDPR Processing Activities
									</SelectItem>
									<SelectItem value="INTEGRITY_VERIFICATION">Integrity Verification</SelectItem>
								</SelectContent>
							</Select>
							{formState.errors.reportType && (
								<p className="text-sm text-red-600 flex items-center gap-1">
									<AlertCircle className="h-4 w-4" />
									{formState.errors.reportType}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="category">Category *</Label>
							<Select
								value={formState.data.category}
								onValueChange={(value) => updateFormData({ category: value })}
							>
								<SelectTrigger className={formState.errors.category ? 'border-red-500' : ''}>
									<SelectValue placeholder="Select category" />
								</SelectTrigger>
								<SelectContent>
									{TEMPLATE_CATEGORIES.map((category) => (
										<SelectItem key={category.value} value={category.value}>
											<div>
												<div className="font-medium">{category.label}</div>
												<div className="text-sm text-muted-foreground">{category.description}</div>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{formState.errors.category && (
								<p className="text-sm text-red-600 flex items-center gap-1">
									<AlertCircle className="h-4 w-4" />
									{formState.errors.category}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label>Tags</Label>
							<div className="flex flex-wrap gap-2 mb-2">
								{formState.data.tags?.map((tag) => (
									<Badge key={tag} variant="secondary" className="flex items-center gap-1">
										{tag}
										<X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />
									</Badge>
								))}
							</div>
							<div className="flex gap-2">
								<Input
									value={newTag}
									onChange={(e) => setNewTag(e.target.value)}
									placeholder="Add tag"
									onKeyPress={(e) => e.key === 'Enter' && addTag()}
								/>
								<Button type="button" variant="outline" onClick={addTag}>
									<Plus className="h-4 w-4" />
								</Button>
							</div>
						</div>
					</div>
				)

			case 2:
				return (
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle>Report Criteria</CardTitle>
								<CardDescription>Configure what data to include in reports</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label>Date Range Type</Label>
									<Select
										value={formState.data.configuration?.criteria?.dateRange?.type || 'relative'}
										onValueChange={(value) =>
											updateNestedFormData('configuration.criteria.dateRange.type', value)
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="relative">Relative (e.g., last 30 days)</SelectItem>
											<SelectItem value="absolute">Absolute dates</SelectItem>
											<SelectItem value="custom">Custom range</SelectItem>
										</SelectContent>
									</Select>
								</div>

								{formState.data.configuration?.criteria?.dateRange?.type === 'relative' && (
									<div className="space-y-2">
										<Label>Relative Period</Label>
										<Select
											value={formState.data.configuration?.criteria?.dateRange?.value || '30d'}
											onValueChange={(value) =>
												updateNestedFormData('configuration.criteria.dateRange.value', value)
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="1d">Last 1 day</SelectItem>
												<SelectItem value="7d">Last 7 days</SelectItem>
												<SelectItem value="30d">Last 30 days</SelectItem>
												<SelectItem value="90d">Last 90 days</SelectItem>
												<SelectItem value="1y">Last 1 year</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Output Configuration</CardTitle>
								<CardDescription>Configure how reports are generated</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label>Output Format *</Label>
									<Select
										value={formState.data.configuration?.output?.format || 'pdf'}
										onValueChange={(value) =>
											updateNestedFormData('configuration.output.format', value)
										}
									>
										<SelectTrigger
											className={
												formState.errors['configuration.output.format'] ? 'border-red-500' : ''
											}
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="pdf">PDF Document</SelectItem>
											<SelectItem value="csv">CSV Spreadsheet</SelectItem>
											<SelectItem value="json">JSON Data</SelectItem>
											<SelectItem value="xlsx">Excel Workbook</SelectItem>
										</SelectContent>
									</Select>
									{formState.errors['configuration.output.format'] && (
										<p className="text-sm text-red-600 flex items-center gap-1">
											<AlertCircle className="h-4 w-4" />
											{formState.errors['configuration.output.format']}
										</p>
									)}
								</div>

								<div className="flex items-center space-x-2">
									<Checkbox
										id="includeCharts"
										checked={formState.data.configuration?.output?.includeCharts || false}
										onCheckedChange={(checked) =>
											updateNestedFormData('configuration.output.includeCharts', checked)
										}
									/>
									<Label htmlFor="includeCharts">Include charts and visualizations</Label>
								</div>

								<div className="flex items-center space-x-2">
									<Checkbox
										id="includeRawData"
										checked={formState.data.configuration?.output?.includeRawData || false}
										onCheckedChange={(checked) =>
											updateNestedFormData('configuration.output.includeRawData', checked)
										}
									/>
									<Label htmlFor="includeRawData">Include raw data tables</Label>
								</div>
							</CardContent>
						</Card>
					</div>
				)

			case 3:
				return (
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle>Schedule Template</CardTitle>
								<CardDescription>Optional default scheduling configuration</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex items-center space-x-2">
									<Switch
										id="scheduleEnabled"
										checked={formState.data.configuration?.scheduleTemplate?.enabled || false}
										onCheckedChange={(checked) =>
											updateNestedFormData('configuration.scheduleTemplate.enabled', checked)
										}
									/>
									<Label htmlFor="scheduleEnabled">Include schedule template</Label>
								</div>

								{formState.data.configuration?.scheduleTemplate?.enabled && (
									<>
										<div className="space-y-2">
											<Label>Default Schedule</Label>
											<Select
												value={formState.data.configuration?.scheduleTemplate?.cronExpression || ''}
												onValueChange={(value) =>
													updateNestedFormData(
														'configuration.scheduleTemplate.cronExpression',
														value
													)
												}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select schedule" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="0 0 * * *">Daily at midnight</SelectItem>
													<SelectItem value="0 0 * * 1">Weekly on Monday</SelectItem>
													<SelectItem value="0 0 1 * *">Monthly on 1st</SelectItem>
													<SelectItem value="0 0 1 1,4,7,10 *">Quarterly</SelectItem>
												</SelectContent>
											</Select>
										</div>

										<div className="space-y-2">
											<Label>Timezone</Label>
											<Select
												value={formState.data.configuration?.scheduleTemplate?.timezone || 'UTC'}
												onValueChange={(value) =>
													updateNestedFormData('configuration.scheduleTemplate.timezone', value)
												}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="UTC">UTC</SelectItem>
													<SelectItem value="America/New_York">Eastern Time</SelectItem>
													<SelectItem value="America/Chicago">Central Time</SelectItem>
													<SelectItem value="America/Denver">Mountain Time</SelectItem>
													<SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
												</SelectContent>
											</Select>
										</div>
									</>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Delivery Template</CardTitle>
								<CardDescription>Optional default delivery configuration</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label>Default Delivery Method</Label>
									<Select
										value={formState.data.configuration?.deliveryTemplate?.method || ''}
										onValueChange={(value) =>
											updateNestedFormData('configuration.deliveryTemplate.method', value)
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select delivery method" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="">None</SelectItem>
											<SelectItem value="email">Email</SelectItem>
											<SelectItem value="webhook">Webhook</SelectItem>
											<SelectItem value="storage">File Storage</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</CardContent>
						</Card>
					</div>
				)

			case 4:
				return (
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle>Template Visibility</CardTitle>
								<CardDescription>Control who can see and use this template</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex items-center space-x-2">
									<Switch
										id="isPublic"
										checked={formState.data.shareSettings?.isPublic || false}
										onCheckedChange={(checked) =>
											updateNestedFormData('shareSettings.isPublic', checked)
										}
									/>
									<Label htmlFor="isPublic">Make template public</Label>
								</div>

								{formState.data.shareSettings?.isPublic && (
									<>
										<div className="flex items-center space-x-2">
											<Checkbox
												id="allowPublicUse"
												checked={formState.data.shareSettings?.allowPublicUse || false}
												onCheckedChange={(checked) =>
													updateNestedFormData('shareSettings.allowPublicUse', checked)
												}
											/>
											<Label htmlFor="allowPublicUse">Allow others to use this template</Label>
										</div>

										<div className="flex items-center space-x-2">
											<Checkbox
												id="allowPublicEdit"
												checked={formState.data.shareSettings?.allowPublicEdit || false}
												onCheckedChange={(checked) =>
													updateNestedFormData('shareSettings.allowPublicEdit', checked)
												}
											/>
											<Label htmlFor="allowPublicEdit">Allow others to edit this template</Label>
										</div>

										<div className="flex items-center space-x-2">
											<Checkbox
												id="requireApproval"
												checked={formState.data.shareSettings?.requireApproval || false}
												onCheckedChange={(checked) =>
													updateNestedFormData('shareSettings.requireApproval', checked)
												}
											/>
											<Label htmlFor="requireApproval">Require approval for sharing</Label>
										</div>
									</>
								)}
							</CardContent>
						</Card>
					</div>
				)

			case 5:
				return (
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle>Review Template</CardTitle>
								<CardDescription>Review your template configuration before saving</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<div>
										<Label className="text-sm font-medium">Name</Label>
										<p className="text-sm text-muted-foreground">{formState.data.name}</p>
									</div>
									<div>
										<Label className="text-sm font-medium">Report Type</Label>
										<p className="text-sm text-muted-foreground">{formState.data.reportType}</p>
									</div>
									<div>
										<Label className="text-sm font-medium">Category</Label>
										<p className="text-sm text-muted-foreground">{formState.data.category}</p>
									</div>
									<div>
										<Label className="text-sm font-medium">Output Format</Label>
										<p className="text-sm text-muted-foreground">
											{formState.data.configuration?.output?.format}
										</p>
									</div>
								</div>

								{formState.data.tags && formState.data.tags.length > 0 && (
									<div>
										<Label className="text-sm font-medium">Tags</Label>
										<div className="flex flex-wrap gap-1 mt-1">
											{formState.data.tags.map((tag) => (
												<Badge key={tag} variant="outline">
													{tag}
												</Badge>
											))}
										</div>
									</div>
								)}

								{formState.data.description && (
									<div>
										<Label className="text-sm font-medium">Description</Label>
										<p className="text-sm text-muted-foreground">{formState.data.description}</p>
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				)

			default:
				return null
		}
	}

	const currentStepInfo = FORM_STEPS.find((step) => step.id === formState.currentStep)
	const progress = (formState.currentStep / formState.totalSteps) * 100

	return (
		<div className="max-w-4xl mx-auto space-y-6">
			{/* Progress Header */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>{mode === 'create' ? 'Create Template' : 'Edit Template'}</CardTitle>
							<CardDescription>
								Step {formState.currentStep} of {formState.totalSteps}: {currentStepInfo?.title}
							</CardDescription>
						</div>
						<Badge variant="outline">{Math.round(progress)}% Complete</Badge>
					</div>
					<Progress value={progress} className="mt-4" />
				</CardHeader>
			</Card>

			{/* Form Content */}
			<Card>
				<CardHeader>
					<CardTitle>{currentStepInfo?.title}</CardTitle>
					<CardDescription>{currentStepInfo?.description}</CardDescription>
				</CardHeader>
				<CardContent>{renderStepContent()}</CardContent>
			</Card>

			{/* Navigation */}
			<Card>
				<CardContent className="pt-6">
					<div className="flex justify-between">
						<Button
							variant="outline"
							onClick={formState.currentStep === 1 ? onCancel : prevStep}
							disabled={formState.isSubmitting}
						>
							<ArrowLeft className="h-4 w-4 mr-2" />
							{formState.currentStep === 1 ? 'Cancel' : 'Previous'}
						</Button>

						{formState.currentStep < formState.totalSteps ? (
							<Button onClick={nextStep} disabled={formState.isSubmitting}>
								Next
								<ArrowRight className="h-4 w-4 ml-2" />
							</Button>
						) : (
							<Button onClick={handleSubmit} disabled={formState.isSubmitting || loading}>
								{formState.isSubmitting || loading ? (
									<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
								) : (
									<Check className="h-4 w-4 mr-2" />
								)}
								{mode === 'create' ? 'Create Template' : 'Save Changes'}
							</Button>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
