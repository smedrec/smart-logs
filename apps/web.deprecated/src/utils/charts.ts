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

interface StatusCounts {
	attempt: number
	success: number
	failure: number
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

export interface StatusDataItem {
	status: 'attempt' | 'success' | 'failure'
	value: number
	fill: string
}

export interface SummaryDataItem {
	summary: string
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

function transformStatusData(byStatus: StatusCounts): StatusDataItem[] {
	const statusOrder: Array<keyof StatusCounts> = ['attempt', 'success', 'failure']
	const statusData: StatusDataItem[] = []

	for (const status of statusOrder) {
		statusData.push({
			status: status,
			value: byStatus[status],
			fill: `var(--color-${status.toLowerCase()})`,
		})
	}

	return statusData
}

// Define the input type
interface InputData {
	[key: string]: {
		[key: string]: number
	}
}

export interface OutputDataItem {
	category: string // The "anyString" from the outer object
	itemName: string // The "string1", "string2" from the inner object
	value: number
	fill: string
}

export interface OutputData {
	transformedItems: OutputDataItem[]
}

function transformData(input: InputData): OutputData {
	const result: OutputData = {
		transformedItems: [],
	}

	let color = 0
	for (const anyStringKey in input) {
		if (Object.prototype.hasOwnProperty.call(input, anyStringKey)) {
			const innerObject = input[anyStringKey]

			for (const stringKey in innerObject) {
				color += 1
				if (Object.prototype.hasOwnProperty.call(innerObject, stringKey)) {
					const value = innerObject[stringKey]
					result.transformedItems.push({
						category: anyStringKey, // The outer key
						itemName: stringKey, // The inner key
						value: value,
						fill: `var(--color-${anyStringKey === 'eventsByAction' ? 'success' : stringKey.toLowerCase()})`,
					})
				}
			}
		}
	}

	return result
}

export { transformSeverityData, transformTypeData, transformStatusData, transformData }
