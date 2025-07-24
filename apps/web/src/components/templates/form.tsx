'use client'

import { Button } from '@/components/ui/button'
import {
	Form,
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
import { cn } from '@/lib/utils'
import { reportTemplate } from '@/types/report-templates'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import type { ReportTemplateData } from '@/types/report-templates'

interface ReportTemplateFormProps {
	onSubmit: (data: ReportTemplateData) => void
	initialData?: ReportTemplateData | null
}

export default function ReportTemplateForm({ onSubmit, initialData }: ReportTemplateFormProps) {
	const form = useForm<ReportTemplateData>({
		resolver: zodResolver(reportTemplate),
		defaultValues: initialData || {
			name: '',
			description: '',
			reportType: 'HIPAA_AUDIT_TRAIL',
		},
	})

	function handleSubmit(values: ReportTemplateData) {
		try {
			onSubmit(values as ReportTemplateData)
			form.reset()
			toast.success('User data submitted successfully!')
		} catch (error) {
			console.error('Form submission error', error)
			toast.error('Failed to submit the form. Please try again.')
		}
	}

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(handleSubmit)}
				className="space-y-8 max-w-3xl mx-auto py-10"
			>
				<div className="grid grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input placeholder="shadcn" type="text" {...field} />
									</FormControl>
									<FormDescription>This is your public display name.</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className="col-span-6">
						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Description</FormLabel>
									<FormControl>
										<Input placeholder="template description" type="textarea" {...field} />
									</FormControl>
									<FormDescription>This is your public display name.</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
				</div>

				<div className="grid grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="reportType"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Type</FormLabel>
									<Select onValueChange={field.onChange} defaultValue={field.value}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select the report type" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value="HIPAA_AUDIT_TRAIL">HIPAA_AUDIT_TRAIL</SelectItem>
											<SelectItem value="GDPR_PROCESSING_ACTIVITIES">
												GDPR_PROCESSING_ACTIVITIES
											</SelectItem>
											<SelectItem value="GENERAL_COMPLIANCE">GENERAL_COMPLIANCE</SelectItem>
											<SelectItem value="INTEGRITY_VERIFICATION">INTEGRITY_VERIFICATION</SelectItem>
										</SelectContent>
									</Select>
									<FormDescription>
										You can manage email addresses in your email settings.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
				</div>
				<Button type="submit">{initialData ? 'Update' : 'Create'}</Button>
			</form>
		</Form>
	)
}
