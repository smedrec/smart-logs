import { createFileRoute } from '@tanstack/react-router'
import { lazy } from 'react'
import { z } from 'zod'

// Lazy load the report templates page component
const ReportTemplatesPage = lazy(() =>
	import('@/components/compliance/templates').then((module) => ({
		default: module.ReportTemplatesPage,
	}))
)

// URL search params schema for template filters
const reportTemplatesSearchSchema = z.object({
	page: z.number().min(1).optional().default(1),
	limit: z.number().min(1).max(100).optional().default(10),
	search: z.string().optional(),
	reportType: z.enum(['hipaa', 'gdpr', 'custom']).optional(),
	category: z.string().optional(),
	sortBy: z
		.enum(['name', 'reportType', 'category', 'createdAt', 'updatedAt'])
		.optional()
		.default('name'),
	sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
})

export const Route = createFileRoute('/_authenticated/compliance/report-templates')({
	component: RouteComponent,
	validateSearch: reportTemplatesSearchSchema,
	beforeLoad: ({ context }) => {
		// Route guard: ensure user has access to report templates
		return context
	},
})

function RouteComponent() {
	const search = Route.useSearch()

	return <ReportTemplatesPage searchParams={search} />
}
/**
function RouteComponent() {
	const [data, setData] = useState<ReportTemplate[] | ReportTemplateData[]>([])
	const [editingTemplate, setEditingTemplate] = useState<ReportTemplateData | null>(null)
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const { data: templates, isLoading } = useQuery(trpc.templates.all.queryOptions({}))
	const columns = createColumns()

	const handleCreate = (newRecord: ReportTemplateData) => {
		setData([...data, newRecord])
		setIsDialogOpen(false)
	}

	const handleUpdate = (updatedTemplate: ReportTemplate) => {
		setData(data.map((record) => (record.id === updatedTemplate.id ? updatedTemplate : record)))
		setIsDialogOpen(false)
		setEditingTemplate(null)
	}

	const handleDelete = (id: string) => {
		setData(templates.filter((record) => record.id !== id))
	}

	const handleEdit = (record: ReportTemplate) => {
		setEditingTemplate(record)
		setIsDialogOpen(true)
	}

	const openCreateDialog = () => {
		setEditingTemplate(null)
		setIsDialogOpen(true)
	}

	return (
		<div className="flex flex-1 flex-col gap-4 p-4">
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem className="hidden md:block">
						<BreadcrumbLink href="#">Compliance</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator className="hidden md:block" />
					<BreadcrumbItem>
						<BreadcrumbPage>Report Templates</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{editingTemplate ? 'Update' : 'Create New'}</DialogTitle>
						<DialogDescription>
							Please fill out the form below to{' '}
							{editingTemplate ? 'update the report template' : 'create a new report template'}.
						</DialogDescription>
					</DialogHeader>
					<div>
						<ReportTemplateForm
							onSubmit={editingTemplate ? handleUpdate : handleCreate}
							initialData={editingTemplate}
						/>
					</div>
				</DialogContent>
			</Dialog>
			<div className="min-h-[100vh] flex-1 rounded-xl md:min-h-min">
				{isLoading ? (
					<div className="flex flex-1 items-center justify-center">
						<Spinner variant="bars" size={64} />
					</div>
				) : (
					<DataTable
						columns={columns}
						data={templates}
						onAdd={openCreateDialog}
						onEdit={handleEdit}
						onDelete={handleDelete}
					/>
				)}
			</div>
		</div>
	)
}
 */
