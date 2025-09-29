import { useAuditPresets } from '@/hooks/use-audit-presets'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Spinner } from '../ui/spinner'
import { createColumns } from './presets/column'
import { DataTable } from './presets/data-table'
import PresetForm from './presets/form'

import type { AuditPreset } from '@smedrec/audit-client'

function AuditPresets() {
	const { data: presets, loading, presetDelete, presetCreate } = useAuditPresets()
	const queryClient = useQueryClient()
	const [data, setData] = useState<AuditPreset[]>([])
	const [editingPreset, setEditingPreset] = useState<AuditPreset | null>(null)
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const columns = createColumns()

	const handleCreate = (newRecord: AuditPreset) => {
		const record = { ...newRecord }
		setData([...data, record])
		setIsDialogOpen(false)
	}

	const handleUpdate = (updatedPreset: AuditPreset) => {
		setData(data.map((record) => (record.name === updatedPreset.name ? updatedPreset : record)))
		setIsDialogOpen(false)
		setEditingPreset(null)
	}

	const handleDelete = async (name: string) => {
		await presetDelete(name)
		/**if (result.success) {
			toast.success(result.message)
			queryClient.invalidateQueries({ queryKey })
		} else {
			toast.error(result.message)
		}*/
	}

	const handlemultiDelete = (presets: AuditPreset[]) => {
		for (const preset of presets) {
			handleDelete(preset.name)
		}
	}

	const handleEdit = (record: AuditPreset) => {
		setEditingPreset(record)
		setIsDialogOpen(true)
	}

	const openCreateDialog = () => {
		setEditingPreset(null)
		setIsDialogOpen(true)
	}

	return (
		<div className="min-h-[100vh] flex-1 rounded-xl md:min-h-min">
			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{editingPreset ? 'Edit Preset' : 'Create New Preset'}</DialogTitle>
						<DialogDescription>
							Please fill out the form below to{' '}
							{editingPreset ? 'update the preset' : 'create a new preset'}.
						</DialogDescription>
					</DialogHeader>
					<div>
						<PresetForm
							onSubmit={editingPreset ? handleUpdate : handleCreate}
							initialData={editingPreset}
						/>
					</div>
				</DialogContent>
			</Dialog>
			{loading ? (
				<div className="flex flex-1 items-center justify-center">
					<Spinner variant="bars" size={64} />
				</div>
			) : (
				<DataTable
					columns={columns}
					data={presets ? presets : []}
					onAdd={openCreateDialog}
					onEdit={handleEdit}
					onDelete={handleDelete}
					onmultiDelete={handlemultiDelete}
				/>
			)}
		</div>
	)
}

export { AuditPresets }
