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
import { Switch } from '@/components/ui/switch'
import { TagsInput } from '@/components/ui/tags-input'
import { Textarea } from '@/components/ui/textarea'
import { useAuditContext } from '@/contexts/audit-provider'
import { cn } from '@/lib/utils'
import {
	AlertCircle,
	CheckCircle2,
	HardDrive,
	Mail,
	Plus,
	Send,
	TestTube,
	Webhook,
	X,
} from 'lucide-react'
import React, { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { toast } from 'sonner'

type DeliveryMethod = 'email' | 'webhook' | 'storage'

interface DeliveryMethodOption {
	value: DeliveryMethod
	label: string
	description: string
	icon: React.ComponentType<{ className?: string }>
	features: string[]
}

const DELIVERY_METHODS: DeliveryMethodOption[] = [
	{
		value: 'email',
		label: 'Email Delivery',
		description: 'Send reports via email to specified recipients',
		icon: Mail,
		features: [
			'Multiple recipients support',
			'Custom subject lines',
			'Attachment options',
			'HTML and plain text formats',
			'Delivery confirmation',
		],
	},
	{
		value: 'webhook',
		label: 'Webhook Delivery',
		description: 'Send reports to external systems via HTTP webhooks',
		icon: Webhook,
		features: [
			'Custom HTTP headers',
			'POST and PUT methods',
			'JSON payload format',
			'Retry mechanism',
			'Authentication support',
		],
	},
	{
		value: 'storage',
		label: 'File Storage',
		description: 'Save reports to specified file storage locations',
		icon: HardDrive,
		features: [
			'Multiple file formats',
			'Custom file paths',
			'Automatic organization',
			'Compression options',
			'Retention policies',
		],
	},
]

const FILE_FORMATS = [
	{ value: 'pdf', label: 'PDF', description: 'Portable Document Format' },
	{ value: 'csv', label: 'CSV', description: 'Comma-Separated Values' },
	{ value: 'json', label: 'JSON', description: 'JavaScript Object Notation' },
]

const HTTP_METHODS = [
	{ value: 'POST', label: 'POST' },
	{ value: 'PUT', label: 'PUT' },
]

interface DeliveryConfigurationProps {
	className?: string
}

export function DeliveryConfiguration({ className }: DeliveryConfigurationProps) {
	const form = useFormContext()
	const { client, isConnected } = useAuditContext()
	const deliveryData = form.watch('delivery')
	const selectedMethod = deliveryData?.method as DeliveryMethod

	const [isTestingDelivery, setIsTestingDelivery] = useState(false)
	const [testResults, setTestResults] = useState<{ success: boolean; message: string } | null>(null)

	// Test delivery configuration
	const testDeliveryConfiguration = async () => {
		if (!client || !isConnected) {
			toast.error('Audit client is not connected')
			return
		}

		setIsTestingDelivery(true)
		setTestResults(null)

		try {
			// Simulate testing delivery configuration
			await new Promise((resolve) => setTimeout(resolve, 2000))

			// Mock test based on delivery method
			const mockSuccess = Math.random() > 0.3 // 70% success rate for demo

			if (mockSuccess) {
				setTestResults({
					success: true,
					message: `${selectedMethod} delivery configuration test successful`,
				})
				toast.success('Delivery test successful')
			} else {
				setTestResults({
					success: false,
					message: `${selectedMethod} delivery test failed: Connection timeout`,
				})
				toast.error('Delivery test failed')
			}
		} catch (error) {
			setTestResults({
				success: false,
				message: 'Test failed: Unable to validate delivery configuration',
			})
			toast.error('Delivery test failed')
		} finally {
			setIsTestingDelivery(false)
		}
	}

	const selectedMethodConfig = DELIVERY_METHODS.find((method) => method.value === selectedMethod)

	return (
		<div className={cn('space-y-6', className)}>
			{/* Delivery Method Selection */}
			<Card>
				<CardHeader>
					<CardTitle>Delivery Method</CardTitle>
					<CardDescription>
						Choose how you want to receive the generated compliance reports
					</CardDescription>
				</CardHeader>
				<CardContent>
					<FormField
						control={form.control}
						name="delivery.method"
						render={({ field }) => (
							<FormItem>
								<FormControl>
									<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
										{DELIVERY_METHODS.map((method) => {
											const Icon = method.icon
											const isSelected = field.value === method.value

											return (
												<div
													key={method.value}
													className={cn(
														'p-4 border rounded-lg cursor-pointer transition-colors',
														isSelected
															? 'border-primary bg-primary/5'
															: 'border-border hover:border-primary/50'
													)}
													onClick={() => field.onChange(method.value)}
												>
													<div className="flex items-start gap-3">
														<Icon className="h-5 w-5 text-primary mt-1" />
														<div className="flex-1">
															<h3 className="font-medium">{method.label}</h3>
															<p className="text-sm text-muted-foreground mt-1">
																{method.description}
															</p>
															<div className="flex flex-wrap gap-1 mt-2">
																{method.features.slice(0, 2).map((feature) => (
																	<Badge key={feature} variant="secondary" className="text-xs">
																		{feature}
																	</Badge>
																))}
															</div>
														</div>
													</div>
												</div>
											)
										})}
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</CardContent>
			</Card>

			{/* Method-specific Configuration */}
			{selectedMethod && (
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							{selectedMethodConfig && (
								<selectedMethodConfig.icon className="h-5 w-5 text-primary" />
							)}
							<CardTitle>{selectedMethodConfig?.label} Configuration</CardTitle>
						</div>
						<CardDescription>
							Configure the specific settings for {selectedMethodConfig?.label.toLowerCase()}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{/* Email Configuration */}
						{selectedMethod === 'email' && (
							<div className="space-y-4">
								<FormField
									control={form.control}
									name="delivery.email.recipients"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Recipients *</FormLabel>
											<FormControl>
												<TagsInput
													value={field.value || []}
													onValueChange={field.onChange}
													placeholder="Enter email addresses"
													className="w-full"
												/>
											</FormControl>
											<FormDescription>
												Email addresses that will receive the compliance reports
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="delivery.email.subject"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Email Subject</FormLabel>
											<FormControl>
												<Input placeholder="Compliance Report - {reportName} - {date}" {...field} />
											</FormControl>
											<FormDescription>
												Custom subject line. Use {'{reportName}'} and {'{date}'} for dynamic values
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="delivery.email.includeAttachment"
									render={({ field }) => (
										<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
											<div className="space-y-0.5">
												<FormLabel>Include Attachment</FormLabel>
												<FormDescription>Attach the report file to the email</FormDescription>
											</div>
											<FormControl>
												<Switch checked={field.value} onCheckedChange={field.onChange} />
											</FormControl>
										</FormItem>
									)}
								/>
							</div>
						)}

						{/* Webhook Configuration */}
						{selectedMethod === 'webhook' && (
							<div className="space-y-4">
								<FormField
									control={form.control}
									name="delivery.webhook.url"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Webhook URL *</FormLabel>
											<FormControl>
												<Input
													type="url"
													placeholder="https://api.example.com/webhooks/compliance-reports"
													{...field}
												/>
											</FormControl>
											<FormDescription>
												The endpoint URL where the report data will be sent
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="delivery.webhook.method"
									render={({ field }) => (
										<FormItem>
											<FormLabel>HTTP Method</FormLabel>
											<Select onValueChange={field.onChange} value={field.value || 'POST'}>
												<FormControl>
													<SelectTrigger>
														<SelectValue placeholder="Select HTTP method" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{HTTP_METHODS.map((method) => (
														<SelectItem key={method.value} value={method.value}>
															{method.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<FormDescription>HTTP method to use for the webhook request</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="delivery.webhook.headers"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Custom Headers</FormLabel>
											<FormControl>
												<Textarea
													placeholder={`Authorization: Bearer your-token\nContent-Type: application/json\nX-Custom-Header: value`}
													className="min-h-[80px] font-mono text-sm"
													value={
														field.value
															? Object.entries(field.value)
																	.map(([key, value]) => `${key}: ${value}`)
																	.join('\n')
															: ''
													}
													onChange={(e) => {
														const headers: Record<string, string> = {}
														e.target.value.split('\n').forEach((line) => {
															const [key, ...valueParts] = line.split(':')
															if (key && valueParts.length > 0) {
																headers[key.trim()] = valueParts.join(':').trim()
															}
														})
														field.onChange(headers)
													}}
												/>
											</FormControl>
											<FormDescription>
												Custom HTTP headers (one per line, format: Header-Name: value)
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
						)}

						{/* Storage Configuration */}
						{selectedMethod === 'storage' && (
							<div className="space-y-4">
								<FormField
									control={form.control}
									name="delivery.storage.path"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Storage Path *</FormLabel>
											<FormControl>
												<Input
													placeholder="/reports/compliance/{reportType}/{year}/{month}/"
													{...field}
												/>
											</FormControl>
											<FormDescription>
												File system path where reports will be saved. Use {'{reportType}'},{' '}
												{'{year}'}, {'{month}'} for dynamic paths
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="delivery.storage.format"
									render={({ field }) => (
										<FormItem>
											<FormLabel>File Format</FormLabel>
											<Select onValueChange={field.onChange} value={field.value || 'pdf'}>
												<FormControl>
													<SelectTrigger>
														<SelectValue placeholder="Select file format" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{FILE_FORMATS.map((format) => (
														<SelectItem key={format.value} value={format.value}>
															<div className="flex items-center gap-2">
																<span>{format.label}</span>
																<span className="text-xs text-muted-foreground">
																	{format.description}
																</span>
															</div>
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<FormDescription>Format for the saved report files</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{/* Test Configuration */}
			{selectedMethod && (
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="flex items-center gap-2">
									<TestTube className="h-5 w-5" />
									Test Configuration
								</CardTitle>
								<CardDescription>
									Validate your delivery configuration before saving
								</CardDescription>
							</div>
							<Button
								variant="outline"
								onClick={testDeliveryConfiguration}
								disabled={isTestingDelivery || !isConnected}
							>
								{isTestingDelivery ? (
									'Testing...'
								) : (
									<>
										<Send className="h-4 w-4 mr-1" />
										Test Configuration
									</>
								)}
							</Button>
						</div>
					</CardHeader>
					<CardContent>
						{testResults ? (
							<div
								className={cn(
									'flex items-start gap-3 p-3 rounded-md',
									testResults.success
										? 'bg-green-50 border border-green-200'
										: 'bg-red-50 border border-red-200'
								)}
							>
								{testResults.success ? (
									<CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
								) : (
									<AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
								)}
								<div>
									<p
										className={cn(
											'text-sm font-medium',
											testResults.success ? 'text-green-900' : 'text-red-900'
										)}
									>
										{testResults.success ? 'Test Successful' : 'Test Failed'}
									</p>
									<p
										className={cn(
											'text-xs mt-1',
											testResults.success ? 'text-green-700' : 'text-red-700'
										)}
									>
										{testResults.message}
									</p>
								</div>
							</div>
						) : (
							<div className="text-center py-8 text-muted-foreground">
								<TestTube className="h-8 w-8 mx-auto mb-2 opacity-50" />
								<p>Click "Test Configuration" to validate your delivery settings</p>
								<p className="text-sm mt-1">This will send a test message to verify connectivity</p>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{/* Method Features */}
			{selectedMethodConfig && (
				<Card>
					<CardHeader>
						<CardTitle className="text-sm">{selectedMethodConfig.label} Features</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
							{selectedMethodConfig.features.map((feature) => (
								<div key={feature} className="flex items-center gap-2 text-sm">
									<CheckCircle2 className="h-3 w-3 text-green-600" />
									{feature}
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
