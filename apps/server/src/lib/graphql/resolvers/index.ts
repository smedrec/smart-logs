/**
 * GraphQL Resolvers Index
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { GraphQLScalarType, Kind } from 'graphql'

import { alertResolvers } from './alerts'
import { auditEventResolvers } from './audit-events'
import { auditPresetResolvers } from './audit-presets'
import { complianceResolvers } from './compliance'
import { gdprResolvers } from './gdpr'
import { healthResolvers } from './health'
import { metricsResolvers } from './metrics'
import { scheduledReportResolvers } from './scheduled-reports'
import { subscriptionResolvers } from './subscriptions'

// Custom scalar types
const DateTimeScalar = new GraphQLScalarType({
	name: 'DateTime',
	description: 'Date custom scalar type',
	serialize(value: any) {
		if (value instanceof Date) {
			return value.toISOString()
		}
		if (typeof value === 'string') {
			return value
		}
		throw new Error('Value must be a Date or ISO string')
	},
	parseValue(value: any) {
		if (typeof value === 'string') {
			return new Date(value)
		}
		throw new Error('Value must be a string')
	},
	parseLiteral(ast) {
		if (ast.kind === Kind.STRING) {
			return new Date(ast.value)
		}
		throw new Error('Value must be a string')
	},
})

const JSONScalar = new GraphQLScalarType({
	name: 'JSON',
	description: 'JSON custom scalar type',
	serialize(value: any) {
		return value
	},
	parseValue(value: any) {
		return value
	},
	parseLiteral(ast) {
		switch (ast.kind) {
			case Kind.STRING:
				return JSON.parse(ast.value)
			case Kind.OBJECT:
				// Convert ObjectValueNode to plain object
				const obj: any = {}
				ast.fields.forEach((field) => {
					obj[field.name.value] = field.value
				})
				return obj
			default:
				return null
		}
	},
})

// Combine all resolvers
export const resolvers = {
	// Custom scalars
	DateTime: DateTimeScalar,
	JSON: JSONScalar,

	// Query resolvers
	Query: {
		...healthResolvers.Query,
		...auditEventResolvers.Query,
		...complianceResolvers.Query,
		...scheduledReportResolvers.Query,
		...auditPresetResolvers.Query,
		...alertResolvers.Query,
		...metricsResolvers.Query,
	},

	// Mutation resolvers
	Mutation: {
		...auditEventResolvers.Mutation,
		...scheduledReportResolvers.Mutation,
		...auditPresetResolvers.Mutation,
		...alertResolvers.Mutation,
		...gdprResolvers.Mutation,
	},

	// Subscription resolvers
	Subscription: {
		...subscriptionResolvers,
	},

	// Type resolvers
	AuditEvent: auditEventResolvers.AuditEvent,
	ScheduledReport: scheduledReportResolvers.ScheduledReport,
	ComplianceReport: complianceResolvers.ComplianceReport,
	Alert: alertResolvers.Alert,
}
