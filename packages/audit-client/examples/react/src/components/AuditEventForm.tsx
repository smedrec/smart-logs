import { zodResolver } from '@hookform/resolvers/zod'
import { AuditEventStatus, CreateAuditEventInput, DataClassification } from '@smedrec/audit-client'
import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { useCreateAuditEvent, useFormAudit } from '../hooks/useAudit'

const auditEventSchema = z.object({
	action: z.string().min(1, 'Action is required'),
	targetResourceType: z.string().min(1, 'Resource type is required'),
	targetResourceId: z.string().optional(),
	principalId: z.string().min(1, 'Principal ID is required'),
	organizationId: z.string().min(1, 'Organization ID is required'),
	status: z.enum(['attempt', 'success', 'failure']),
	outcomeDescription: z.string().optional(),
	dataClassification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']),
	details: z.record(z.any()).optional(),
})

type AuditEventFormData = z.infer<typeof auditEventSchema>

interface AuditEventFormProps {
	onSuccess?: (event: any) => void
	onError?: (error: any) => void
	initialData?: Partial<AuditEventFormData>
}

export function AuditEventForm({ onSuccess, onError, initialData }: AuditEventFormProps) {
	const { createEvent, creating, error, success, reset } = useCreateAuditEvent()
	const { logFormSubmit, logFormValidation, logFormFieldChange, logFormError } =
		useFormAudit('audit-event-form')

	const {
		register,
		handleSubmit,
		formState: { errors, isValid, isDirty },
		reset: resetForm,
		watch,
		setValue,
	} = useForm<AuditEventFormData>({
		resolver: zodResolver(auditEventSchema),
		defaultValues: {
			status: 'success',
			dataClassification: 'INTERNAL',
			principalId: 'current-user',
			organizationId: 'current-org',
			...initialData,
		},
		mode: 'onChange',
	})

	// Watch for field changes to log them
	const watchedFields = watch()
	useEffect(() => {
		if (isDirty) {
			Object.entries(watchedFields).forEach(([field, value]) => {
				if (value !== initialData?.[field as keyof AuditEventFormData]) {
					logFormFieldChange(field, value)
				}
			})
		}
	}, [watchedFields, isDirty, initialData, logFormFieldChange])

	// Log validation errors
	useEffect(() => {
		if (Object.keys(errors).length > 0) {
			logFormValidation(errors)
		}
	}, [errors, logFormValidation])

	// Handle form submission
	const onSubmit = async (data: AuditEventFormData) => {
		try {
			const eventData: CreateAuditEventInput = {
				...data,
				details: data.details ? JSON.parse(JSON.stringify(data.details)) : undefined,
			}

			await createEvent(eventData)
			logFormSubmit(eventData)

			if (onSuccess) {
				onSuccess(eventData)
			}

			resetForm()
		} catch (err) {
			logFormError(err instanceof Error ? err.message : 'Unknown error')
			if (onError) {
				onError(err)
			}
		}
	}

	// Handle form errors
	useEffect(() => {
		if (error) {
			logFormError(error.message)
			if (onError) {
				onError(error)
			}
		}
	}, [error, onError, logFormError])

	// Handle success
	useEffect(() => {
		if (success && onSuccess) {
			// Success already handled in onSubmit
		}
	}, [success, onSuccess])

	return (
		<div className="audit-event-form">
			<h2>Create Audit Event</h2>

			{error && (
				<div className="error-message" role="alert">
					<strong>Error:</strong> {error.message}
				</div>
			)}

			{success && (
				<div className="success-message" role="status">
					<strong>Success:</strong> Audit event created successfully!
				</div>
			)}

			<form onSubmit={handleSubmit(onSubmit)} noValidate>
				<div className="form-group">
					<label htmlFor="action">Action *</label>
					<input
						id="action"
						type="text"
						{...register('action')}
						placeholder="e.g., user.login, data.access, file.download"
						aria-invalid={errors.action ? 'true' : 'false'}
					/>
					{errors.action && (
						<span className="error-text" role="alert">
							{errors.action.message}
						</span>
					)}
				</div>

				<div className="form-group">
					<label htmlFor="targetResourceType">Resource Type *</label>
					<input
						id="targetResourceType"
						type="text"
						{...register('targetResourceType')}
						placeholder="e.g., user, patient, document"
						aria-invalid={errors.targetResourceType ? 'true' : 'false'}
					/>
					{errors.targetResourceType && (
						<span className="error-text" role="alert">
							{errors.targetResourceType.message}
						</span>
					)}
				</div>

				<div className="form-group">
					<label htmlFor="targetResourceId">Resource ID</label>
					<input
						id="targetResourceId"
						type="text"
						{...register('targetResourceId')}
						placeholder="Optional resource identifier"
					/>
				</div>

				<div className="form-group">
					<label htmlFor="principalId">Principal ID *</label>
					<input
						id="principalId"
						type="text"
						{...register('principalId')}
						placeholder="User or system identifier"
						aria-invalid={errors.principalId ? 'true' : 'false'}
					/>
					{errors.principalId && (
						<span className="error-text" role="alert">
							{errors.principalId.message}
						</span>
					)}
				</div>

				<div className="form-group">
					<label htmlFor="organizationId">Organization ID *</label>
					<input
						id="organizationId"
						type="text"
						{...register('organizationId')}
						placeholder="Organization identifier"
						aria-invalid={errors.organizationId ? 'true' : 'false'}
					/>
					{errors.organizationId && (
						<span className="error-text" role="alert">
							{errors.organizationId.message}
						</span>
					)}
				</div>

				<div className="form-group">
					<label htmlFor="status">Status *</label>
					<select
						id="status"
						{...register('status')}
						aria-invalid={errors.status ? 'true' : 'false'}
					>
						<option value="attempt">Attempt</option>
						<option value="success">Success</option>
						<option value="failure">Failure</option>
					</select>
					{errors.status && (
						<span className="error-text" role="alert">
							{errors.status.message}
						</span>
					)}
				</div>

				<div className="form-group">
					<label htmlFor="dataClassification">Data Classification *</label>
					<select
						id="dataClassification"
						{...register('dataClassification')}
						aria-invalid={errors.dataClassification ? 'true' : 'false'}
					>
						<option value="PUBLIC">Public</option>
						<option value="INTERNAL">Internal</option>
						<option value="CONFIDENTIAL">Confidential</option>
						<option value="PHI">PHI (Protected Health Information)</option>
					</select>
					{errors.dataClassification && (
						<span className="error-text" role="alert">
							{errors.dataClassification.message}
						</span>
					)}
				</div>

				<div className="form-group">
					<label htmlFor="outcomeDescription">Outcome Description</label>
					<textarea
						id="outcomeDescription"
						{...register('outcomeDescription')}
						placeholder="Optional description of the outcome"
						rows={3}
					/>
				</div>

				<div className="form-group">
					<label htmlFor="details">Additional Details (JSON)</label>
					<textarea
						id="details"
						placeholder='{"key": "value", "metadata": "example"}'
						rows={4}
						onChange={(e) => {
							try {
								const parsed = e.target.value ? JSON.parse(e.target.value) : undefined
								setValue('details', parsed)
							} catch {
								// Invalid JSON, don't update
							}
						}}
					/>
					<small>Enter valid JSON for additional event details</small>
				</div>

				<div className="form-actions">
					<button type="submit" disabled={creating || !isValid} className="submit-button">
						{creating ? 'Creating...' : 'Create Audit Event'}
					</button>

					<button
						type="button"
						onClick={() => {
							resetForm()
							reset()
						}}
						className="reset-button"
					>
						Reset
					</button>
				</div>
			</form>

			<style jsx>{`
				.audit-event-form {
					max-width: 600px;
					margin: 0 auto;
					padding: 20px;
				}

				.form-group {
					margin-bottom: 20px;
				}

				label {
					display: block;
					margin-bottom: 5px;
					font-weight: bold;
				}

				input,
				select,
				textarea {
					width: 100%;
					padding: 8px 12px;
					border: 1px solid #ddd;
					border-radius: 4px;
					font-size: 14px;
				}

				input:focus,
				select:focus,
				textarea:focus {
					outline: none;
					border-color: #007bff;
					box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
				}

				.error-text {
					color: #dc3545;
					font-size: 12px;
					margin-top: 4px;
					display: block;
				}

				.error-message {
					background-color: #f8d7da;
					color: #721c24;
					padding: 12px;
					border-radius: 4px;
					margin-bottom: 20px;
					border: 1px solid #f5c6cb;
				}

				.success-message {
					background-color: #d4edda;
					color: #155724;
					padding: 12px;
					border-radius: 4px;
					margin-bottom: 20px;
					border: 1px solid #c3e6cb;
				}

				.form-actions {
					display: flex;
					gap: 10px;
					margin-top: 30px;
				}

				.submit-button {
					background-color: #007bff;
					color: white;
					border: none;
					padding: 10px 20px;
					border-radius: 4px;
					cursor: pointer;
					font-size: 14px;
				}

				.submit-button:disabled {
					background-color: #6c757d;
					cursor: not-allowed;
				}

				.reset-button {
					background-color: #6c757d;
					color: white;
					border: none;
					padding: 10px 20px;
					border-radius: 4px;
					cursor: pointer;
					font-size: 14px;
				}

				small {
					color: #6c757d;
					font-size: 12px;
					margin-top: 4px;
					display: block;
				}
			`}</style>
		</div>
	)
}
