import { Badge } from '@/components/ui/badge'
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
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { FileCheck, Globe, Info, Shield } from 'lucide-react'
import React from 'react'
import { useFormContext } from 'react-hook-form'

import type { ReportType } from '../types'

interface ReportTypeOption {
	value: ReportType
	label: string
	description: string
	icon: React.ComponentType<{ className?: string }>
	features: string[]
	compliance: string[]
	dataTypes: string[]
	helpText: string
}

const REPORT_TYPE_OPTIONS: ReportTypeOption[] = [
	{
		value: 'HIPAA_AUDIT_TRAIL',
		label: 'HIPAA Audit Trail',
		description: 'Comprehensive audit trail reporting for HIPAA compliance requirements',
		icon: Shield,
		features: [
			'Access logs and authentication events',
			'PHI access tracking',
			'User activity monitoring',
			'Security incident reporting',
			'Breach detection alerts',
		],
		compliance: ['HIPAA Security Rule', 'HIPAA Privacy Rule', '45 CFR 164.312(b)'],
		dataTypes: ['Authentication events', 'Access logs', 'PHI interactions', 'System events'],
		helpText:
			'This report type generates comprehensive audit trails required for HIPAA compliance, including all access to protected health information (PHI) and security-related events.',
	},
	{
		value: 'GDPR_PROCESSING_ACTIVITIES',
		label: 'GDPR Processing Activities',
		description: 'Data processing activity reports for GDPR Article 30 compliance',
		icon: Globe,
		features: [
			'Data processing records',
			'Legal basis tracking',
			'Data subject rights monitoring',
			'Cross-border transfer logs',
			'Consent management tracking',
		],
		compliance: ['GDPR Article 30', 'GDPR Article 5', 'GDPR Article 6'],
		dataTypes: [
			'Processing activities',
			'Personal data categories',
			'Legal basis records',
			'Transfer logs',
		],
		helpText:
			'This report type documents all data processing activities as required by GDPR Article 30, including records of processing activities and data subject rights exercises.',
	},
	{
		value: 'INTEGRITY_VERIFICATION',
		label: 'Data Integrity Verification',
		description: 'Custom integrity verification and audit reports for organizational compliance',
		icon: FileCheck,
		features: [
			'Data integrity checks',
			'Custom compliance rules',
			'Audit trail verification',
			'System health monitoring',
			'Custom reporting criteria',
		],
		compliance: ['Custom organizational policies', 'Industry-specific requirements'],
		dataTypes: ['System integrity data', 'Custom audit events', 'Verification results'],
		helpText:
			"This report type allows for custom integrity verification and audit reporting based on your organization's specific compliance requirements and policies.",
	},
]

interface ReportTypeSelectorProps {
	className?: string
}

export function ReportTypeSelector({ className }: ReportTypeSelectorProps) {
	const form = useFormContext()
	const selectedType = form.watch('reportType') as ReportType
	const selectedOption = REPORT_TYPE_OPTIONS.find((option) => option.value === selectedType)

	return (
		<div className={cn('space-y-6', className)}>
			{/* Basic Information */}
			<Card>
				<CardHeader>
					<CardTitle>Basic Information</CardTitle>
					<CardDescription>Provide basic details about your compliance report</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<FormField
						control={form.control}
						name="name"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Report Name *</FormLabel>
								<FormControl>
									<Input placeholder="e.g., Monthly HIPAA Audit Report" {...field} />
								</FormControl>
								<FormDescription>A descriptive name for this scheduled report</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="description"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Description</FormLabel>
								<FormControl>
									<Textarea
										placeholder="Optional description of the report purpose and scope..."
										className="min-h-[80px]"
										{...field}
									/>
								</FormControl>
								<FormDescription>
									Optional description to help identify the report's purpose
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
				</CardContent>
			</Card>

			{/* Report Type Selection */}
			<Card>
				<CardHeader>
					<CardTitle>Report Type</CardTitle>
					<CardDescription>
						Select the type of compliance report you want to generate
					</CardDescription>
				</CardHeader>
				<CardContent>
					<FormField
						control={form.control}
						name="reportType"
						render={({ field }) => (
							<FormItem>
								<FormControl>
									<RadioGroup
										onValueChange={field.onChange}
										value={field.value}
										className="space-y-4"
									>
										{REPORT_TYPE_OPTIONS.map((option) => {
											const Icon = option.icon
											const isSelected = field.value === option.value

											return (
												<div key={option.value} className="space-y-2">
													<div
														className={cn(
															'flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors',
															isSelected
																? 'border-primary bg-primary/5'
																: 'border-border hover:border-primary/50'
														)}
														onClick={() => field.onChange(option.value)}
													>
														<RadioGroupItem
															value={option.value}
															id={option.value}
															className="mt-1"
														/>
														<div className="flex-1 space-y-2">
															<div className="flex items-center gap-2">
																<Icon className="h-5 w-5 text-primary" />
																<Label
																	htmlFor={option.value}
																	className="text-base font-medium cursor-pointer"
																>
																	{option.label}
																</Label>
															</div>
															<p className="text-sm text-muted-foreground">{option.description}</p>

															{/* Compliance badges */}
															<div className="flex flex-wrap gap-1">
																{option.compliance.map((compliance) => (
																	<Badge key={compliance} variant="secondary" className="text-xs">
																		{compliance}
																	</Badge>
																))}
															</div>
														</div>
													</div>
												</div>
											)
										})}
									</RadioGroup>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</CardContent>
			</Card>

			{/* Selected Type Details */}
			{selectedOption && (
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<selectedOption.icon className="h-5 w-5 text-primary" />
							<CardTitle>{selectedOption.label} Details</CardTitle>
						</div>
						<CardDescription>Information about the selected report type</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{/* Help text */}
						<div className="flex gap-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
							<Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
							<p className="text-sm text-blue-800">{selectedOption.helpText}</p>
						</div>

						{/* Features */}
						<div>
							<h4 className="text-sm font-medium mb-2">Key Features</h4>
							<ul className="space-y-1">
								{selectedOption.features.map((feature, index) => (
									<li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
										<span className="w-1 h-1 bg-primary rounded-full mt-2 flex-shrink-0" />
										{feature}
									</li>
								))}
							</ul>
						</div>

						{/* Data Types */}
						<div>
							<h4 className="text-sm font-medium mb-2">Data Types Included</h4>
							<div className="flex flex-wrap gap-1">
								{selectedOption.dataTypes.map((dataType) => (
									<Badge key={dataType} variant="outline" className="text-xs">
										{dataType}
									</Badge>
								))}
							</div>
						</div>

						{/* Compliance Requirements */}
						<div>
							<h4 className="text-sm font-medium mb-2">Compliance Requirements</h4>
							<div className="space-y-1">
								{selectedOption.compliance.map((requirement) => (
									<div
										key={requirement}
										className="text-sm text-muted-foreground flex items-start gap-2"
									>
										<Shield className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
										{requirement}
									</div>
								))}
							</div>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
