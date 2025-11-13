import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { useAuditContext } from '@/contexts/audit-provider'
import {
	transformFormDataToCreateInput,
	transformFormDataToUpdateInput,
	validateFormData,
} from '@/lib/compliance/form-transformers'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Save } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { CriteriaBuilder } from './criteria-builder'
import { DeliveryConfiguration } from './delivery-configuration'
import { PreviewPanel } from './preview-panel'
// Import child components
import { ReportTypeSelector } from './report-type-selector'
import { ScheduleBuilder } from './schedule-builder'

import type { ReportFormData } from '@/lib/compliance/form-transformers'
import type { CreateScheduledReportInput, UpdateScheduledReportInput } from '@smedrec/audit-client'
import type { DeliveryConfig, ReportType, ScheduleConfig } from '../types'

// Form validation schema - aligned with ReportFormData from form-transformers
const reportConfigurationSchema = z.object({
	name: z
		.string()
		.min(1, 'Report name is required')
		.max(255, 'Name must be less than 255 characters'),
	description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
	reportType: z.enum([
		'HIPAA_AUDIT_TRAIL',
		'GDPR_PROCESSING_ACTIVITIES',
		'INTEGRITY_VERIFICATION',
		'GENERAL_COMPLIANCE',
		'CUSTOM_REPORT',
	] as const),
	format: z
		.enum(['PDF', 'CSV', 'JSON', 'XLSX', 'HTML', 'XML'] as const)
		.optional()
		.default('PDF'),
	schedule: z.object({
		frequency: z.enum([
			'once',
			'hourly',
			'daily',
			'weekly',
			'monthly',
			'quarterly',
			'yearly',
			'custom',
		] as const),
		time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
		dayOfWeek: z.number().min(0).max(6).optional(),
		dayOfMonth: z.number().min(1).max(31).optional(),
		timezone: z.string().min(1, 'Timezone is required'),
		cronExpression: z.string().optional(),
		startDate: z.string().optional(),
		endDate: z.string().optional(),
		skipWeekends: z.boolean().optional(),
		skipHolidays: z.boolean().optional(),
		holidayCalendar: z.string().optional(),
		maxMissedRuns: z.number().optional(),
		catchUpMissedRuns: z.boolean().optional(),
	}),
	notifications: z.object({
		onSuccess: z.boolean(),
		onFailure: z.boolean(),
		onSkip: z.boolean().optional(),
		recipients: z.array(z.string().email()),
		includeReport: z.boolean().optional(),
		customMessage: z.string().optional(),
	}),
	parameters: z.object({
		dateRange: z
			.object({
				startDate: z.string(),
				endDate: z.string(),
			})
			.optional(),
		organizationIds: z.array(z.string()).optional(),
		principalIds: z.array(z.string()).optional(),
		actions: z.array(z.string()).optional(),
		resourceTypes: z.array(z.string()).optional(),
		dataClassifications: z
			.array(z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI'] as const))
			.optional(),
		statuses: z.array(z.enum(['attempt', 'success', 'failure'] as const)).optional(),
		verifiedOnly: z.boolean().optional(),
		includeIntegrityFailures: z.boolean().optional(),
		limit: z.number().optional(),
		offset: z.number().optional(),
		sortBy: z.enum(['timestamp', 'status'] as const).optional(),
		sortOrder: z.enum(['asc', 'desc'] as const).optional(),
	}),
	delivery: z
		.object({
			destinations: z.union([z.array(z.string()), z.literal('default')]),
		})
		.optional(),
	export: z
		.object({
			includeMetadata: z.boolean().optional(),
			includeIntegrityReport: z.boolean().optional(),
			compression: z.enum(['none', 'gzip', 'zip', 'bzip2'] as const).optional(),
			encryption: z
				.object({
					enabled: z.boolean(),
					algorithm: z.string().optional(),
					keyId: z.string().optional(),
				})
				.optional(),
		})
		.optional(),
	enabled: z.boolean().default(true),
	tags: z.array(z.string()).optional(),
	metadata: z.record(z.string(), z.any()).optional(),
	templateId: z.string().optional(),
})

type FormData = z.infer<typeof reportConfigurationSchema>

interface ReportConfigurationFormProps {
	initialData?: Partial<ReportFormData>
	mode: 'create' | 'edit'
	reportId?: string
	userId: string
	runId?: string
	onSubmit: (data: CreateScheduledReportInput | UpdateScheduledReportInput) => Promise<void>
	onCancel: () => void
	className?: string
}

// Multi-step form steps
const FORM_STEPS = [
	{ id: 'type', title: 'Report Type', description: 'Select the type of compliance report' },
	{ id: 'criteria', title: 'Criteria', description: 'Configure report parameters and filters' },
	{ id: 'schedule', title: 'Schedule', description: 'Set up report scheduling' },
	{ id: 'delivery', title: 'Delivery', description: 'Configure delivery methods' },
	{ id: 'preview', title: 'Preview', description: 'Review and confirm settings' },
] as const

type FormStep = (typeof FORM_STEPS)[number]['id']

export function ReportConfigurationForm({
	initialData,
	mode,
	reportId,
	userId,
	runId,
	onSubmit,
	onCancel,
	className,
}: ReportConfigurationFormProps) {
	const { client, isConnected } = useAuditContext()
	const [currentStep, setCurrentStep] = useState<FormStep>('type')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [isDirty, setIsDirty] = useState(false)
	const [draftSaved, setDraftSaved] = useState(false)

	// Form setup with validation
	const form = useForm({
		resolver: zodResolver(reportConfigurationSchema),
		defaultValues: {
			name: initialData?.name || '',
			description: initialData?.description || '',
			reportType: initialData?.reportType || 'HIPAA_AUDIT_TRAIL',
			format: (initialData?.format as 'PDF' | 'CSV' | 'JSON' | 'XLSX' | 'HTML' | 'XML') || 'PDF',
			schedule: {
				frequency: initialData?.schedule?.frequency || 'monthly',
				time: initialData?.schedule?.time || '09:00',
				dayOfWeek: initialData?.schedule?.dayOfWeek,
				dayOfMonth: initialData?.schedule?.dayOfMonth || 1,
				timezone:
					initialData?.schedule?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
				cronExpression: initialData?.schedule?.cronExpression,
				startDate: initialData?.schedule?.startDate,
				endDate: initialData?.schedule?.endDate,
				skipWeekends: initialData?.schedule?.skipWeekends ?? false,
				skipHolidays: initialData?.schedule?.skipHolidays ?? false,
				holidayCalendar: initialData?.schedule?.holidayCalendar,
				maxMissedRuns: initialData?.schedule?.maxMissedRuns ?? 3,
				catchUpMissedRuns: initialData?.schedule?.catchUpMissedRuns ?? false,
			},
			notifications: {
				onSuccess: initialData?.notifications?.onSuccess ?? true,
				onFailure: initialData?.notifications?.onFailure ?? true,
				onSkip: initialData?.notifications?.onSkip,
				recipients: initialData?.notifications?.recipients || [],
				includeReport: initialData?.notifications?.includeReport,
				customMessage: initialData?.notifications?.customMessage,
			},
			parameters: {
				dateRange: initialData?.parameters?.dateRange || {
					startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
					endDate: new Date().toISOString(),
				},
				organizationIds: initialData?.parameters?.organizationIds,
				principalIds: initialData?.parameters?.principalIds,
				actions: initialData?.parameters?.actions,
				resourceTypes: initialData?.parameters?.resourceTypes,
				dataClassifications: initialData?.parameters?.dataClassifications,
				statuses: initialData?.parameters?.statuses,
				verifiedOnly: initialData?.parameters?.verifiedOnly,
				includeIntegrityFailures: initialData?.parameters?.includeIntegrityFailures,
				limit: initialData?.parameters?.limit,
				offset: initialData?.parameters?.offset,
				sortBy: initialData?.parameters?.sortBy,
				sortOrder: initialData?.parameters?.sortOrder,
			},
			delivery: initialData?.delivery,
			export: initialData?.export,
			enabled: initialData?.enabled ?? true,
			tags: initialData?.tags || [],
			metadata: initialData?.metadata,
			templateId: initialData?.templateId,
		},
		mode: 'onChange',
	})

	// Watch form changes for dirty state
	const watchedValues = form.watch()
	useEffect(() => {
		setIsDirty(form.formState.isDirty)
	}, [watchedValues, form.formState.isDirty])

	// Get current step index
	const currentStepIndex = FORM_STEPS.findIndex((step) => step.id === currentStep)
	const progress = ((currentStepIndex + 1) / FORM_STEPS.length) * 100

	// Navigation handlers
	const goToNextStep = useCallback(() => {
		if (currentStepIndex < FORM_STEPS.length - 1) {
			setCurrentStep(FORM_STEPS[currentStepIndex + 1].id)
		}
	}, [currentStepIndex])

	const goToPreviousStep = useCallback(() => {
		if (currentStepIndex > 0) {
			setCurrentStep(FORM_STEPS[currentStepIndex - 1].id)
		}
	}, [currentStepIndex])

	const goToStep = useCallback((step: FormStep) => {
		setCurrentStep(step)
	}, [])

	// Draft saving functionality
	const saveDraft = useCallback(async () => {
		if (!isDirty || !client) return

		try {
			const formData = form.getValues()
			const draftKey = `report-draft-${mode}-${reportId || 'new'}`

			// Save to localStorage as a simple draft mechanism
			localStorage.setItem(
				draftKey,
				JSON.stringify({
					data: formData,
					timestamp: new Date().toISOString(),
					step: currentStep,
				})
			)

			setDraftSaved(true)
			toast.success('Draft saved successfully')

			// Clear the saved indicator after 2 seconds
			setTimeout(() => setDraftSaved(false), 2000)
		} catch (error) {
			console.error('Failed to save draft:', error)
			toast.error('Failed to save draft')
		}
	}, [isDirty, client, form, mode, reportId, currentStep])

	// Load draft on mount
	useEffect(() => {
		if (mode === 'create' && !initialData) {
			const draftKey = `report-draft-create-new`
			const savedDraft = localStorage.getItem(draftKey)

			if (savedDraft) {
				try {
					const { data, step } = JSON.parse(savedDraft)
					form.reset(data)
					setCurrentStep(step)
					toast.info('Draft loaded from previous session')
				} catch (error) {
					console.error('Failed to load draft:', error)
					localStorage.removeItem(draftKey)
				}
			}
		}
	}, [mode, initialData, form])

	// Auto-save draft periodically
	useEffect(() => {
		if (!isDirty) return

		const autoSaveInterval = setInterval(saveDraft, 30000) // Auto-save every 30 seconds
		return () => clearInterval(autoSaveInterval)
	}, [isDirty, saveDraft])

	// Form submission handler with proper transformation
	const handleSubmit = async (data: FormData) => {
		if (!client || !isConnected) {
			toast.error('Audit client is not connected')
			return
		}

		// Validate form data using the transformer's validation
		const validation = validateFormData(data as ReportFormData)
		if (!validation.isValid) {
			validation.errors.forEach((error) => toast.error(error))
			return
		}

		setIsSubmitting(true)

		try {
			// Transform form data to API format using the proper transformers
			const submitData =
				mode === 'create'
					? transformFormDataToCreateInput(data as ReportFormData, userId, runId)
					: transformFormDataToUpdateInput(data as ReportFormData, userId, runId)

			await onSubmit(submitData)

			// Clear draft after successful submission
			const draftKey = `report-draft-${mode}-${reportId || 'new'}`
			localStorage.removeItem(draftKey)

			toast.success(`Report ${mode === 'create' ? 'created' : 'updated'} successfully`)
		} catch (error) {
			console.error('Form submission failed:', error)
			const errorMessage = error instanceof Error ? error.message : `Failed to ${mode} report`
			toast.error(errorMessage)
		} finally {
			setIsSubmitting(false)
		}
	}

	// Step validation
	const validateCurrentStep = useCallback(async () => {
		const fieldsToValidate: Record<FormStep, (keyof FormData)[]> = {
			type: ['name', 'description', 'reportType', 'format'],
			criteria: ['parameters'],
			schedule: ['schedule'],
			delivery: ['notifications'], // Notifications are part of delivery in our schema
			preview: [], // No validation needed for preview
		}

		const fields = fieldsToValidate[currentStep]
		if (fields.length === 0) return true

		const result = await form.trigger(fields)
		return result
	}, [currentStep, form])

	// Handle next step with validation
	const handleNextStep = useCallback(async () => {
		const isValid = await validateCurrentStep()
		if (isValid) {
			goToNextStep()
		} else {
			toast.error('Please fix the errors before proceeding')
		}
	}, [validateCurrentStep, goToNextStep])

	return (
		<div className={className}>
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>{mode === 'create' ? 'Create New Report' : 'Edit Report'}</CardTitle>
							<CardDescription>{FORM_STEPS[currentStepIndex].description}</CardDescription>
						</div>
						<div className="flex items-center gap-2">
							{draftSaved && (
								<Badge variant="secondary" className="flex items-center gap-1">
									<CheckCircle2 className="h-3 w-3" />
									Draft Saved
								</Badge>
							)}
							{isDirty && (
								<Button
									variant="outline"
									size="sm"
									onClick={saveDraft}
									disabled={!client || !isConnected}
								>
									<Save className="h-4 w-4 mr-1" />
									Save Draft
								</Button>
							)}
						</div>
					</div>

					{/* Progress indicator */}
					<div className="space-y-2">
						<div className="flex justify-between text-sm text-muted-foreground">
							<span>
								Step {currentStepIndex + 1} of {FORM_STEPS.length}
							</span>
							<span>{Math.round(progress)}% complete</span>
						</div>
						<Progress value={progress} className="h-2" />
					</div>

					{/* Step navigation */}
					<div className="flex gap-2 overflow-x-auto">
						{FORM_STEPS.map((step, index) => (
							<Button
								key={step.id}
								variant={currentStep === step.id ? 'default' : 'outline'}
								size="sm"
								onClick={() => goToStep(step.id)}
								className="whitespace-nowrap"
								disabled={index > currentStepIndex + 1} // Only allow going back or to next step
							>
								{index + 1}. {step.title}
							</Button>
						))}
					</div>
				</CardHeader>

				<CardContent>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
							{/* Connection status warning */}
							{!isConnected && (
								<div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
									<AlertCircle className="h-4 w-4 text-yellow-600" />
									<span className="text-sm text-yellow-800">
										Audit client is not connected. Some features may not work properly.
									</span>
								</div>
							)}

							{/* Step content */}
							<div className="min-h-[400px]">
								{currentStep === 'type' && <ReportTypeSelector />}
								{currentStep === 'criteria' && <CriteriaBuilder />}
								{currentStep === 'schedule' && <ScheduleBuilder />}
								{currentStep === 'delivery' && <DeliveryConfiguration organizationId="" />}
								{currentStep === 'preview' && <PreviewPanel />}
							</div>

							<Separator />

							{/* Navigation buttons */}
							<div className="flex justify-between">
								<div className="flex gap-2">
									<Button type="button" variant="outline" onClick={onCancel}>
										Cancel
									</Button>
									{currentStepIndex > 0 && (
										<Button type="button" variant="outline" onClick={goToPreviousStep}>
											<ArrowLeft className="h-4 w-4 mr-1" />
											Previous
										</Button>
									)}
								</div>

								<div className="flex gap-2">
									{currentStep !== 'preview' ? (
										<Button type="button" onClick={handleNextStep} disabled={isSubmitting}>
											Next
											<ArrowRight className="h-4 w-4 ml-1" />
										</Button>
									) : (
										<Button type="submit" disabled={isSubmitting || !isConnected}>
											{isSubmitting
												? 'Saving...'
												: `${mode === 'create' ? 'Create' : 'Update'} Report`}
										</Button>
									)}
								</div>
							</div>
						</form>
					</Form>
				</CardContent>
			</Card>
		</div>
	)
}
