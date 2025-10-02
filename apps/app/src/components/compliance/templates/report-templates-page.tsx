/**
 * Report Templates Page Component
 *
 * Manages report templates with CRUD operations, filtering, and pagination
 */

import { CompliancePageHeader } from '@/components/compliance/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { useReportTemplatesUrlState } from '@/hooks/useComplianceUrlState'
import { Link } from '@tanstack/react-router'
import { Copy, Edit, Eye, FileText, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

interface ReportTemplate {
	id: string
	name: string
	description?: string
	reportType: 'HIPAA_AUDIT_TRAIL' | 'GDPR_PROCESSING_ACTIVITIES' | 'INTEGRITY_VERIFICATION'
	category: string
	isPublic: boolean
	createdAt: Date
	updatedAt: Date
	createdBy: string
	usageCount: number
	tags: string[]
}

interface ReportTemplatesPageProps {
	searchParams: {
		page?: number
		limit?: number
		search?: string
		reportType?: 'hipaa' | 'gdpr' | 'custom'
		category?: string
		sortBy?: 'name' | 'reportType' | 'category' | 'createdAt' | 'updatedAt'
		sortOrder?: 'asc' | 'desc'
	}
}

export function ReportTemplatesPage({ searchParams }: ReportTemplatesPageProps) {
	const { state, setParam } = useReportTemplatesUrlState()
	const [templates, setTemplates] = useState<ReportTemplate[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	// Mock data - in real implementation, this would come from API
	useEffect(() => {
		const mockTemplates: ReportTemplate[] = [
			{
				id: 'template-1',
				name: 'Standard HIPAA Audit',
				description: 'Comprehensive HIPAA compliance audit template with all required sections',
				reportType: 'HIPAA_AUDIT_TRAIL',
				category: 'hippa',
				isPublic: true,
				createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90), // 90 days ago
				updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30 days ago
				createdBy: 'admin@example.com',
				usageCount: 45,
				tags: ['hipaa', 'healthcare', 'audit', 'standard'],
			},
			{
				id: 'template-2',
				name: 'GDPR Data Processing Report',
				description: 'Template for GDPR data processing activities reporting',
				reportType: 'GDPR_PROCESSING_ACTIVITIES',
				category: 'privacy',
				isPublic: true,
				createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120), // 120 days ago
				updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15), // 15 days ago
				createdBy: 'privacy@example.com',
				usageCount: 32,
				tags: ['gdpr', 'privacy', 'data-processing', 'eu'],
			},
			{
				id: 'template-3',
				name: 'Custom Integrity Check',
				description: 'Custom template for data integrity verification with advanced parameters',
				reportType: 'INTEGRITY_VERIFICATION',
				category: 'security',
				isPublic: false,
				createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60), // 60 days ago
				updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
				createdBy: 'security@example.com',
				usageCount: 18,
				tags: ['integrity', 'security', 'verification', 'custom'],
			},
		]

		// Simulate API call
		setTimeout(() => {
			setTemplates(mockTemplates)
			setLoading(false)
		}, 1000)
	}, [])

	const getReportTypeLabel = (type: ReportTemplate['reportType']) => {
		switch (type) {
			case 'HIPAA_AUDIT_TRAIL':
				return 'HIPAA Audit'
			case 'GDPR_PROCESSING_ACTIVITIES':
				return 'GDPR Processing'
			case 'INTEGRITY_VERIFICATION':
				return 'Integrity Check'
			default:
				return type
		}
	}

	const getReportTypeBadgeVariant = (type: ReportTemplate['reportType']) => {
		switch (type) {
			case 'HIPAA_AUDIT_TRAIL':
				return 'default'
			case 'GDPR_PROCESSING_ACTIVITIES':
				return 'secondary'
			case 'INTEGRITY_VERIFICATION':
				return 'outline'
			default:
				return 'default'
		}
	}

	const formatDate = (date: Date) => {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		}).format(date)
	}

	const handleSearch = (value: string) => {
		setParam('search', value || undefined)
		setParam('page', 1) // Reset to first page when searching
	}

	const handleReportTypeFilter = (value: string) => {
		setParam('reportType', value === 'all' ? undefined : (value as any))
		setParam('page', 1)
	}

	const handleCategoryFilter = (value: string) => {
		setParam('category', value === 'all' ? undefined : value)
		setParam('page', 1)
	}

	const handleCreateFromTemplate = (templateId: string) => {
		// TODO: Navigate to create report with template pre-selected
		console.log('Creating report from template:', templateId)
	}

	const handleDuplicateTemplate = (templateId: string) => {
		// TODO: Implement template duplication
		console.log('Duplicating template:', templateId)
	}

	const handleDeleteTemplate = (templateId: string) => {
		// TODO: Implement template deletion
		console.log('Deleting template:', templateId)
	}

	if (loading) {
		return (
			<div className="flex flex-col gap-6 p-6">
				<CompliancePageHeader title="Report Templates" description="Loading templates..." />
				<div className="flex items-center justify-center h-64">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex flex-col gap-6 p-6">
				<CompliancePageHeader title="Report Templates" description="Error loading templates" />
				<Card>
					<CardContent className="pt-6">
						<div className="text-center text-red-600">
							<p>Error: {error}</p>
						</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-6 p-6">
			<CompliancePageHeader
				title="Report Templates"
				description="Manage and create report templates for automated compliance reporting"
				actions={[
					{
						label: 'Create Template',
						href: '/compliance/report-templates/create',
						icon: Plus,
					},
				]}
			/>

			{/* Filters */}
			<Card>
				<CardHeader>
					<CardTitle>Filters</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col gap-4 md:flex-row md:items-center">
						<div className="flex-1">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Search templates..."
									value={state.search || ''}
									onChange={(e) => handleSearch(e.target.value)}
									className="pl-10"
								/>
							</div>
						</div>

						<Select value={state.reportType || 'all'} onValueChange={handleReportTypeFilter}>
							<SelectTrigger className="w-48">
								<SelectValue placeholder="Report Type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Types</SelectItem>
								<SelectItem value="hipaa">HIPAA Audit</SelectItem>
								<SelectItem value="gdpr">GDPR Processing</SelectItem>
								<SelectItem value="custom">Integrity Check</SelectItem>
							</SelectContent>
						</Select>

						<Select value={state.category || 'all'} onValueChange={handleCategoryFilter}>
							<SelectTrigger className="w-48">
								<SelectValue placeholder="Category" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Categories</SelectItem>
								<SelectItem value="Healthcare">Healthcare</SelectItem>
								<SelectItem value="Privacy">Privacy</SelectItem>
								<SelectItem value="Security">Security</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>

			{/* Templates Table */}
			<Card>
				<CardHeader>
					<CardTitle>Templates ({templates.length})</CardTitle>
					<CardDescription>
						Available report templates for creating scheduled reports
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Category</TableHead>
								<TableHead>Visibility</TableHead>
								<TableHead>Usage</TableHead>
								<TableHead>Updated</TableHead>
								<TableHead className="w-[70px]">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{templates.map((template) => (
								<TableRow key={template.id}>
									<TableCell>
										<div>
											<div className="font-medium">{template.name}</div>
											{template.description && (
												<p className="text-sm text-muted-foreground">{template.description}</p>
											)}
											{template.tags.length > 0 && (
												<div className="flex flex-wrap gap-1 mt-1">
													{template.tags.slice(0, 3).map((tag) => (
														<Badge key={tag} variant="outline" className="text-xs">
															{tag}
														</Badge>
													))}
													{template.tags.length > 3 && (
														<Badge variant="outline" className="text-xs">
															+{template.tags.length - 3}
														</Badge>
													)}
												</div>
											)}
										</div>
									</TableCell>
									<TableCell>
										<Badge variant={getReportTypeBadgeVariant(template.reportType)}>
											{getReportTypeLabel(template.reportType)}
										</Badge>
									</TableCell>
									<TableCell>{template.category}</TableCell>
									<TableCell>
										<Badge variant={template.isPublic ? 'default' : 'secondary'}>
											{template.isPublic ? 'Public' : 'Private'}
										</Badge>
									</TableCell>
									<TableCell>{template.usageCount} uses</TableCell>
									<TableCell>{formatDate(template.updatedAt)}</TableCell>
									<TableCell>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant="ghost" className="h-8 w-8 p-0">
													<MoreHorizontal className="h-4 w-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuLabel>Actions</DropdownMenuLabel>
												<DropdownMenuItem
													onClick={() => handleCreateFromTemplate(template.id)}
													className="flex items-center gap-2"
												>
													<FileText className="h-4 w-4" />
													Create Report
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem className="flex items-center gap-2">
													<Eye className="h-4 w-4" />
													View Details
												</DropdownMenuItem>
												<DropdownMenuItem className="flex items-center gap-2">
													<Edit className="h-4 w-4" />
													Edit Template
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() => handleDuplicateTemplate(template.id)}
													className="flex items-center gap-2"
												>
													<Copy className="h-4 w-4" />
													Duplicate
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													onClick={() => handleDeleteTemplate(template.id)}
													className="flex items-center gap-2 text-red-600"
												>
													<Trash2 className="h-4 w-4" />
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>

					{templates.length === 0 && (
						<div className="text-center py-8">
							<FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
							<p className="text-muted-foreground mb-4">No templates found</p>
							<Button>
								<Plus className="h-4 w-4 mr-2" />
								Create Your First Template
							</Button>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Quick Actions */}
			<Card>
				<CardHeader>
					<CardTitle>Quick Actions</CardTitle>
					<CardDescription>Common template management tasks</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 md:grid-cols-3">
						<Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-2">
							<FileText className="h-6 w-6" />
							<div className="text-left">
								<div className="font-medium">Create HIPAA Template</div>
								<div className="text-sm text-muted-foreground">Start with HIPAA audit template</div>
							</div>
						</Button>

						<Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-2">
							<FileText className="h-6 w-6" />
							<div className="text-left">
								<div className="font-medium">Create GDPR Template</div>
								<div className="text-sm text-muted-foreground">
									Start with GDPR processing template
								</div>
							</div>
						</Button>

						<Button variant="outline" className="h-auto p-4 flex flex-col items-start gap-2">
							<FileText className="h-6 w-6" />
							<div className="text-left">
								<div className="font-medium">Custom Template</div>
								<div className="text-sm text-muted-foreground">Create a custom report template</div>
							</div>
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
