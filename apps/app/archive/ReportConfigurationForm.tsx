/**
 * Report Configuration Form Component
 *
 * Multi-step form for creating and editing scheduled compliance reports
 */

import { CompliancePageHeader } from '@/components/compliance/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
	transformFormDataToCreateInput,
	transformFormDataToUpdateInput,
	validateFormData,
} from '@/lib/compliance/form-transformers'
import { ArrowLeft, ArrowRight, Check, FileText, Save, X } from 'lucide-react'
import { useState } from 'react'

import type { ReportFormData } from '@/lib/compliance/form-transformers'
import type { CreateScheduledReportInput, UpdateScheduledReportInput } from '@smedrec/audit-client'

interface ReportConfigurationFormProps {
	mode: 'create' | 'edit'
	reportId?: string
	initialData?: Partial<ReportFormData>
	onSubmit: (data: CreateScheduledReportInput | UpdateScheduledReportInput) => void | Promise<void>
	onCancel: () => void
	userId: string
	runId?: string
}

const REPORT_TYPE_OPTIONS = [
	{
		value: 'HIPAA_AUDIT_TRAIL',
		label: 'HIPAA Audit Trail',
		description: 'Comprehensive HIPAA compliance audit report',
	},
	{
		value: 'GDPR_PROCESSING_ACTIVITIES',
		label: 'GDPR Processing Activities',
		description: 'GDPR data processing activities report',
	},
	{
		value: 'INTEGRITY_VERIFICATION',
		label: 'Data Integrity Verification',
		description: 'Data integrity and consistency verification report',
	},
] as const

const FREQUENCY_OPTIONS = [
	{ value: 'daily', label: 'Daily' },
	{ value: 'weekly', label: 'Weekly' },
	{ value: 'monthly', label: 'Monthly' },
	{ value: 'custom', label: 'Custom' },
] as const

export function ReportConfigurationForm({
	mode,
	reportId,
	initialData,
	onSubmit,
	onCancel,
	userId,
	runId,
}: ReportConfigurationFormProps) {
	const [currentStep, setCurrentStep] = useState(1)
	const [formData, setFormData] = useState<ReportFormData>({
		name: initialData?.name || '',
		description: initialData?.description || '',
		reportType: initialData?.reportType || 'HIPAA_AUDIT_TRAIL',
		format: initialData?.format || 'PDF',
		schedule: initialData?.schedule || {
			frequency: 'monthly',
			time: '09:00',
			timezone: 'UTC',
			skipWeekends: false,
			skipHolidays: false,
			maxMissedRuns: 3,
			catchUpMissedRuns: false,
		},
		enabled: initialData?.enabled ?? true,
		notifications: initialData?.notifications || {
			onSuccess: true,
			onFailure: true,
			recipients: [],
		},
		parameters: initialData?.parameters || {
			dateRange: {
				startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
				endDate: new Date().toISOString(),
			},
		},
		delivery: initialData?.delivery,
		export: initialData?.export,
		tags: initialData?.tags || [],
		metadata: initialData?.metadata,
		templateId: initialData?.templateId,
	})
	const [loading, setLoading] = useState(false)
	const [validationErrors, setValidationErrors] = useState<string[]>([])

	const steps = [
		{ number: 1, title: 'Basic Information', description: 'Report name and type' },
		{ number: 2, title: 'Schedule', description: 'Execution schedule' },
		{ number: 3, title: 'Notifications', description: 'Alert settings' },
		{ number: 4, title: 'Parameters', description: 'Report configuration' },
		{ number: 5, title: 'Review', description: 'Confirm settings' },
	]

	const updateFormData = (updates: Partial<ReportFormData>) => {
		setFormData((prev) => ({ ...prev, ...updates }))
		// Clear validation errors when form data changes
		setValidationErrors([])
	}

	const updateSchedule = (updates: Partial<ReportFormData['schedule']>) => {
		setFormData((prev) => ({
			...prev,
			schedule: { ...prev.schedule, ...updates },
		}))
		setValidationErrors([])
	}

	const updateNotifications = (updates: Partial<ReportFormData['notifications']>) => {
		setFormData((prev) => ({
			...prev,
			notifications: { ...prev.notifications, ...updates },
		}))
		setValidationErrors([])
	}

	const updateParameters = (updates: Partial<ReportFormData['parameters']>) => {
		setFormData((prev) => ({
			...prev,
			parameters: { ...prev.parameters, ...updates },
		}))
		setValidationErrors([])
	}

	const handleNext = () => {
		if (currentStep < steps.length) {
			setCurrentStep(currentStep + 1)
		}
	}

	const handlePrevious = () => {
		if (currentStep > 1) {
			setCurrentStep(currentStep - 1)
		}
	}

	const handleSubmit = async () => {
		// Validate form data before submission
		const validation = validateFormData(formData)
		if (!validation.isValid) {
			setValidationErrors(validation.errors)
			return
		}

		setLoading(true)
		setValidationErrors([])

		try {
			// Transform form data to API format
			const transformedData =
				mode === 'create'
					? transformFormDataToCreateInput(formData, userId, runId)
					: transformFormDataToUpdateInput(formData, userId, runId)

			await onSubmit(transformedData)
		} catch (error) {
			console.error('Error submitting form:', error)
			setValidationErrors([
				error instanceof Error ? error.message : 'An error occurred while submitting the form',
			])
		} finally {
			setLoading(false)
		}
	}

	const renderStepContent = () => {
		switch (currentStep) {
			case 1:
				return (
					<div className="space-y-6">
						<div className="space-y-2">
							<Label htmlFor="name">Report Name</Label>
							<Input
								id="name"
								value={formData.name}
								onChange={(e) => updateFormData({ name: e.target.value })}
								placeholder="Enter report name"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="description">Description</Label>
							<Textarea
								id="description"
								value={formData.description}
								onChange={(e) => updateFormData({ description: e.target.value })}
								placeholder="Enter report description"
								rows={3}
							/>
						</div>

						<div className="space-y-2">
							<Label>Report Type</Label>
							<div className="grid gap-3">
								{REPORT_TYPE_OPTIONS.map((option) => (
									<Card
										key={option.value}
										className={`cursor-pointer transition-colors ${
											formData.reportType === option.value
												? 'border-primary bg-primary/5'
												: 'hover:bg-muted/50'
										}`}
										onClick={() => updateFormData({ reportType: option.value })}
									>
										<CardContent className="p-4">
											<div className="flex items-start justify-between">
												<div>
													<h4 className="font-medium">{option.label}</h4>
													<p className="text-sm text-muted-foreground mt-1">{option.description}</p>
												</div>
												{formData.reportType === option.value && (
													<Check className="h-5 w-5 text-primary" />
												)}
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						</div>

						<div className="space-y-2">
							<Label>Output Format</Label>
							<Select
								value={formData.format}
								onValueChange={(value: 'PDF' | 'CSV' | 'JSON') => updateFormData({ format: value })}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="PDF">PDF</SelectItem>
									<SelectItem value="CSV">CSV</SelectItem>
									<SelectItem value="JSON">JSON</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				)

			case 2:
				return (
					<div className="space-y-6">
						<div className="space-y-2">
							<Label>Frequency</Label>
							<Select
								value={formData.schedule.frequency}
								onValueChange={(value: any) => updateSchedule({ frequency: value })}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{FREQUENCY_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label htmlFor="time">Execution Time</Label>
							<Input
								id="time"
								type="time"
								value={formData.schedule.time}
								onChange={(e) => updateSchedule({ time: e.target.value })}
							/>
						</div>

						{formData.schedule.frequency === 'weekly' && (
							<div className="space-y-2">
								<Label>Day of Week</Label>
								<Select
									value={formData.schedule.dayOfWeek?.toString()}
									onValueChange={(value) => updateSchedule({ dayOfWeek: parseInt(value) })}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select day" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="0">Sunday</SelectItem>
										<SelectItem value="1">Monday</SelectItem>
										<SelectItem value="2">Tuesday</SelectItem>
										<SelectItem value="3">Wednesday</SelectItem>
										<SelectItem value="4">Thursday</SelectItem>
										<SelectItem value="5">Friday</SelectItem>
										<SelectItem value="6">Saturday</SelectItem>
									</SelectContent>
								</Select>
							</div>
						)}

						{formData.schedule.frequency === 'monthly' && (
							<div className="space-y-2">
								<Label htmlFor="dayOfMonth">Day of Month</Label>
								<Input
									id="dayOfMonth"
									type="number"
									min="1"
									max="31"
									value={formData.schedule.dayOfMonth || ''}
									onChange={(e) => updateSchedule({ dayOfMonth: parseInt(e.target.value) })}
									placeholder="1-31"
								/>
							</div>
						)}

						<div className="space-y-2">
							<Label>Timezone</Label>
							<Select
								value={formData.schedule.timezone}
								onValueChange={(value) => updateSchedule({ timezone: value })}
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
					</div>
				)

			case 3:
				return (
					<div className="space-y-6">
						<div className="flex items-center justify-between">
							<div>
								<Label>Success Notifications</Label>
								<p className="text-sm text-muted-foreground">
									Send notifications when reports complete successfully
								</p>
							</div>
							<Switch
								checked={formData.notifications.onSuccess}
								onCheckedChange={(checked) => updateNotifications({ onSuccess: checked })}
							/>
						</div>

						<div className="flex items-center justify-between">
							<div>
								<Label>Failure Notifications</Label>
								<p className="text-sm text-muted-foreground">
									Send notifications when reports fail
								</p>
							</div>
							<Switch
								checked={formData.notifications.onFailure}
								onCheckedChange={(checked) => updateNotifications({ onFailure: checked })}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="recipients">Recipients</Label>
							<Textarea
								id="recipients"
								placeholder="Enter email addresses, one per line"
								value={formData.notifications.recipients.join('\n')}
								onChange={(e) =>
									updateNotifications({
										recipients: e.target.value.split('\n').filter((email) => email.trim()),
									})
								}
								rows={4}
							/>
							<p className="text-sm text-muted-foreground">Enter one email address per line</p>
						</div>
					</div>
				)

			case 4:
				return (
					<div className="space-y-6">
						<div className="text-center py-8">
							<FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
							<h3 className="text-lg font-medium">Report Parameters</h3>
							<p className="text-muted-foreground">
								Advanced parameters for{' '}
								{REPORT_TYPE_OPTIONS.find((opt) => opt.value === formData.reportType)?.label}
							</p>
						</div>

						{/* This would be dynamically generated based on report type */}
						<Card>
							<CardContent className="pt-6">
								<p className="text-sm text-muted-foreground text-center">
									Report-specific parameters will be configured here based on the selected report
									type.
								</p>
							</CardContent>
						</Card>
					</div>
				)

			case 5:
				return (
					<div className="space-y-6">
						<div className="text-center">
							<h3 className="text-lg font-medium">Review Configuration</h3>
							<p className="text-muted-foreground">
								Please review your report configuration before{' '}
								{mode === 'create' ? 'creating' : 'updating'}
							</p>
						</div>

						<div className="grid gap-4">
							<Card>
								<CardHeader>
									<CardTitle className="text-base">Basic Information</CardTitle>
								</CardHeader>
								<CardContent className="space-y-2">
									<div className="flex justify-between">
										<span className="text-muted-foreground">Name:</span>
										<span>{formData.name}</span>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">Type:</span>
										<Badge>
											{REPORT_TYPE_OPTIONS.find((opt) => opt.value === formData.reportType)?.label}
										</Badge>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">Format:</span>
										<span>{formData.format}</span>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle className="text-base">Schedule</CardTitle>
								</CardHeader>
								<CardContent className="space-y-2">
									<div className="flex justify-between">
										<span className="text-muted-foreground">Frequency:</span>
										<span className="capitalize">{formData.schedule.frequency}</span>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">Time:</span>
										<span>{formData.schedule.time}</span>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">Timezone:</span>
										<span>{formData.schedule.timezone}</span>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle className="text-base">Notifications</CardTitle>
								</CardHeader>
								<CardContent className="space-y-2">
									<div className="flex justify-between">
										<span className="text-muted-foreground">Success:</span>
										<Badge variant={formData.notifications.onSuccess ? 'default' : 'secondary'}>
											{formData.notifications.onSuccess ? 'Enabled' : 'Disabled'}
										</Badge>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">Failure:</span>
										<Badge variant={formData.notifications.onFailure ? 'default' : 'secondary'}>
											{formData.notifications.onFailure ? 'Enabled' : 'Disabled'}
										</Badge>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">Recipients:</span>
										<span>{formData.notifications.recipients.length} email(s)</span>
									</div>
								</CardContent>
							</Card>
						</div>
					</div>
				)

			default:
				return null
		}
	}

	return (
		<div className="flex flex-col gap-6 p-6">
			<CompliancePageHeader
				title={mode === 'create' ? 'Create Scheduled Report' : 'Edit Scheduled Report'}
				description={
					mode === 'create'
						? 'Configure a new automated compliance report'
						: 'Update report configuration'
				}
				showBackButton
				backButtonHref="/compliance/scheduled-reports"
			/>

			{/* Validation Errors */}
			{validationErrors.length > 0 && (
				<Card className="border-destructive">
					<CardContent className="pt-6">
						<div className="space-y-2">
							<h4 className="font-medium text-destructive">Please fix the following errors:</h4>
							<ul className="list-disc list-inside space-y-1 text-sm text-destructive">
								{validationErrors.map((error, index) => (
									<li key={index}>{error}</li>
								))}
							</ul>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Progress Steps */}
			<Card>
				<CardContent className="pt-6">
					<div className="flex items-center justify-between">
						{steps.map((step, index) => (
							<div key={step.number} className="flex items-center">
								<div
									className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
										currentStep === step.number
											? 'bg-primary text-primary-foreground'
											: currentStep > step.number
												? 'bg-primary/20 text-primary'
												: 'bg-muted text-muted-foreground'
									}`}
								>
									{currentStep > step.number ? <Check className="h-4 w-4" /> : step.number}
								</div>
								<div className="ml-3 hidden sm:block">
									<p
										className={`text-sm font-medium ${
											currentStep >= step.number ? 'text-foreground' : 'text-muted-foreground'
										}`}
									>
										{step.title}
									</p>
									<p className="text-xs text-muted-foreground">{step.description}</p>
								</div>
								{index < steps.length - 1 && (
									<div
										className={`w-12 h-px mx-4 ${
											currentStep > step.number ? 'bg-primary' : 'bg-muted'
										}`}
									/>
								)}
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Form Content */}
			<Card>
				<CardHeader>
					<CardTitle>{steps[currentStep - 1].title}</CardTitle>
					<CardDescription>{steps[currentStep - 1].description}</CardDescription>
				</CardHeader>
				<CardContent>{renderStepContent()}</CardContent>
			</Card>

			{/* Navigation Buttons */}
			<div className="flex justify-between">
				<div className="flex gap-2">
					<Button variant="outline" onClick={onCancel}>
						<X className="h-4 w-4 mr-2" />
						Cancel
					</Button>
					{currentStep > 1 && (
						<Button variant="outline" onClick={handlePrevious}>
							<ArrowLeft className="h-4 w-4 mr-2" />
							Previous
						</Button>
					)}
				</div>

				<div className="flex gap-2">
					{currentStep < steps.length ? (
						<Button onClick={handleNext}>
							Next
							<ArrowRight className="h-4 w-4 ml-2" />
						</Button>
					) : (
						<Button onClick={handleSubmit} disabled={loading}>
							<Save className="h-4 w-4 mr-2" />
							{loading ? 'Saving...' : mode === 'create' ? 'Create Report' : 'Update Report'}
						</Button>
					)}
				</div>
			</div>
		</div>
	)
}

export default ReportConfigurationForm
