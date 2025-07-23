interface SeverityCounts {
	LOW: number
	MEDIUM: number
	HIGH: number
	CRITICAL: number
}

interface TypeCounts {
	SECURITY: number
	COMPLIANCE: number
	PERFORMANCE: number
	SYSTEM: number
}

export interface SeverityDataItem {
	severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
	value: number
	fill: string
}

export interface TypeDataItem {
	type: 'SECURITY' | 'COMPLIANCE' | 'PERFORMANCE' | 'SYSTEM'
	value: number
	fill: string
}

function transformSeverityData(bySeverity: SeverityCounts): SeverityDataItem[] {
	const severityOrder: Array<keyof SeverityCounts> = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
	const severityData: SeverityDataItem[] = []

	for (const severity of severityOrder) {
		severityData.push({
			severity: severity,
			value: bySeverity[severity],
			fill: `var(--color-${severity.toLowerCase()})`,
		})
	}

	return severityData
}

function transformTypeData(byType: TypeCounts): TypeDataItem[] {
	const typeOrder: Array<keyof TypeCounts> = ['SECURITY', 'COMPLIANCE', 'PERFORMANCE', 'SYSTEM']
	const typeData: TypeDataItem[] = []

	for (const type of typeOrder) {
		typeData.push({
			type: type,
			value: byType[type],
			fill: `var(--color-${type.toLowerCase()})`,
		})
	}

	return typeData
}

export { transformSeverityData, transformTypeData }
