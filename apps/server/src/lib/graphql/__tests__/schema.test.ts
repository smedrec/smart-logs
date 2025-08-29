/**
 * GraphQL Schema Tests
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { buildSchema, graphql, parse, validate } from 'graphql'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { testUtils } from '../../../__tests__/setup'
import { typeDefs } from '../schema'

describe('GraphQL Schema', () => {
	let schema: any
	let mockContext: any

	beforeEach(() => {
		// Build schema from type definitions
		schema = buildSchema(typeDefs)

		// Create mock context
		mockContext = {
			...testUtils.mockTRPCContext,
			services: {
				...testUtils.mockServices,
				health: {
					checkAllComponents: vi.fn().mockResolvedValue({
						status: 'OK',
						timestamp: new Date().toISOString(),
						checks: [
							{ name: 'database', status: 'OK', responseTime: 10 },
							{ name: 'redis', status: 'OK', responseTime: 5 },
						],
					}),
				},
			},
		}
	})

	describe('Schema Validation', () => {
		it('should have valid GraphQL schema', () => {
			expect(schema).toBeDefined()
			expect(schema.getQueryType()).toBeDefined()
			expect(schema.getMutationType()).toBeDefined()
			expect(schema.getSubscriptionType()).toBeDefined()
		})

		it('should validate query syntax', () => {
			const query = `
				query {
					health {
						status
						timestamp
					}
				}
			`

			const document = parse(query)
			const errors = validate(schema, document)

			expect(errors).toHaveLength(0)
		})

		it('should validate mutation syntax', () => {
			const mutation = `
				mutation {
					createAuditEvent(input: {
						action: "test.action"
						principalId: "user-123"
						organizationId: "org-456"
						status: success
					}) {
						id
						action
						status
					}
				}
			`

			const document = parse(mutation)
			const errors = validate(schema, document)

			expect(errors).toHaveLength(0)
		})

		it('should validate subscription syntax', () => {
			const subscription = `
				subscription {
					auditEventCreated {
						id
						action
						timestamp
					}
				}
			`

			const document = parse(subscription)
			const errors = validate(schema, document)

			expect(errors).toHaveLength(0)
		})
	})

	describe('Type Definitions', () => {
		it('should define all required scalar types', () => {
			const scalarTypes = ['DateTime', 'JSON']

			scalarTypes.forEach((scalarType) => {
				const type = schema.getType(scalarType)
				expect(type).toBeDefined()
			})
		})

		it('should define all required enum types', () => {
			const enumTypes = [
				'AuditEventStatus',
				'DataClassification',
				'ComplianceReportType',
				'ReportFormat',
				'ReportFrequency',
				'DeliveryMethod',
				'AlertType',
				'AlertSeverity',
				'AlertStatus',
				'SortDirection',
				'AuditEventSortField',
				'MetricsGroupBy',
				'ReportExecutionStatus',
			]

			enumTypes.forEach((enumType) => {
				const type = schema.getType(enumType)
				expect(type).toBeDefined()
				expect(type.astNode.kind).toBe('EnumTypeDefinition')
			})
		})

		it('should define all required input types', () => {
			const inputTypes = [
				'TimeRangeInput',
				'AuditEventFilter',
				'PaginationInput',
				'SortInput',
				'SessionContextInput',
				'CreateAuditEventInput',
				'ReportCriteriaInput',
				'CreateScheduledReportInput',
				'UpdateScheduledReportInput',
				'CreateAuditPresetInput',
				'UpdateAuditPresetInput',
				'AlertFilter',
				'GDPRExportInput',
				'GDPRPseudonymizeInput',
				'GDPRDeleteInput',
			]

			inputTypes.forEach((inputType) => {
				const type = schema.getType(inputType)
				expect(type).toBeDefined()
				expect(type.astNode.kind).toBe('InputObjectTypeDefinition')
			})
		})

		it('should define all required object types', () => {
			const objectTypes = [
				'AuditEvent',
				'AuditEventConnection',
				'AuditEventEdge',
				'PageInfo',
				'HealthStatus',
				'HealthCheck',
				'SystemMetrics',
				'ComplianceReport',
				'ScheduledReport',
				'AuditPreset',
				'Alert',
				'AlertConnection',
				'AuditMetrics',
				'IntegrityVerificationResult',
				'GDPRExportResult',
				'GDPRPseudonymizeResult',
				'GDPRDeleteResult',
			]

			objectTypes.forEach((objectType) => {
				const type = schema.getType(objectType)
				expect(type).toBeDefined()
				expect(type.astNode.kind).toBe('ObjectTypeDefinition')
			})
		})
	})

	describe('Query Type', () => {
		it('should define all required query fields', () => {
			const queryType = schema.getQueryType()
			const fields = queryType.getFields()

			const requiredFields = [
				'health',
				'systemMetrics',
				'auditEvents',
				'auditEvent',
				'complianceReports',
				'scheduledReports',
				'scheduledReport',
				'auditPresets',
				'auditPreset',
				'auditMetrics',
				'alerts',
			]

			requiredFields.forEach((fieldName) => {
				expect(fields[fieldName]).toBeDefined()
			})
		})

		it('should have correct field types for queries', () => {
			const queryType = schema.getQueryType()
			const fields = queryType.getFields()

			expect(fields.health.type.toString()).toBe('HealthStatus!')
			expect(fields.systemMetrics.type.toString()).toBe('SystemMetrics!')
			expect(fields.auditEvents.type.toString()).toBe('AuditEventConnection!')
			expect(fields.auditEvent.type.toString()).toBe('AuditEvent')
		})

		it('should have correct arguments for query fields', () => {
			const queryType = schema.getQueryType()
			const fields = queryType.getFields()

			// auditEvents should have filter, pagination, and sort arguments
			const auditEventsArgs = fields.auditEvents.args
			expect(auditEventsArgs.find((arg) => arg.name === 'filter')).toBeDefined()
			expect(auditEventsArgs.find((arg) => arg.name === 'pagination')).toBeDefined()
			expect(auditEventsArgs.find((arg) => arg.name === 'sort')).toBeDefined()

			// auditEvent should have id argument
			const auditEventArgs = fields.auditEvent.args
			expect(auditEventArgs.find((arg) => arg.name === 'id')).toBeDefined()
		})
	})

	describe('Mutation Type', () => {
		it('should define all required mutation fields', () => {
			const mutationType = schema.getMutationType()
			const fields = mutationType.getFields()

			const requiredFields = [
				'createAuditEvent',
				'verifyAuditEvent',
				'createScheduledReport',
				'updateScheduledReport',
				'deleteScheduledReport',
				'executeScheduledReport',
				'createAuditPreset',
				'updateAuditPreset',
				'deleteAuditPreset',
				'acknowledgeAlert',
				'resolveAlert',
				'gdprExportUserData',
				'gdprPseudonymizeUserData',
				'gdprDeleteUserData',
			]

			requiredFields.forEach((fieldName) => {
				expect(fields[fieldName]).toBeDefined()
			})
		})

		it('should have correct field types for mutations', () => {
			const mutationType = schema.getMutationType()
			const fields = mutationType.getFields()

			expect(fields.createAuditEvent.type.toString()).toBe('AuditEvent!')
			expect(fields.verifyAuditEvent.type.toString()).toBe('IntegrityVerificationResult!')
			expect(fields.createScheduledReport.type.toString()).toBe('ScheduledReport!')
			expect(fields.deleteScheduledReport.type.toString()).toBe('Boolean!')
		})

		it('should have correct arguments for mutation fields', () => {
			const mutationType = schema.getMutationType()
			const fields = mutationType.getFields()

			// createAuditEvent should have input argument
			const createAuditEventArgs = fields.createAuditEvent.args
			expect(createAuditEventArgs.find((arg) => arg.name === 'input')).toBeDefined()
			expect(createAuditEventArgs.find((arg) => arg.name === 'input').type.toString()).toBe(
				'CreateAuditEventInput!'
			)

			// verifyAuditEvent should have id argument
			const verifyAuditEventArgs = fields.verifyAuditEvent.args
			expect(verifyAuditEventArgs.find((arg) => arg.name === 'id')).toBeDefined()
			expect(verifyAuditEventArgs.find((arg) => arg.name === 'id').type.toString()).toBe('ID!')
		})
	})

	describe('Subscription Type', () => {
		it('should define all required subscription fields', () => {
			const subscriptionType = schema.getSubscriptionType()
			const fields = subscriptionType.getFields()

			const requiredFields = [
				'auditEventCreated',
				'alertCreated',
				'systemMetricsUpdated',
				'reportExecutionUpdated',
			]

			requiredFields.forEach((fieldName) => {
				expect(fields[fieldName]).toBeDefined()
			})
		})

		it('should have correct field types for subscriptions', () => {
			const subscriptionType = schema.getSubscriptionType()
			const fields = subscriptionType.getFields()

			expect(fields.auditEventCreated.type.toString()).toBe('AuditEvent!')
			expect(fields.alertCreated.type.toString()).toBe('Alert!')
			expect(fields.systemMetricsUpdated.type.toString()).toBe('SystemMetrics!')
			expect(fields.reportExecutionUpdated.type.toString()).toBe('ReportExecution!')
		})

		it('should have correct arguments for subscription fields', () => {
			const subscriptionType = schema.getSubscriptionType()
			const fields = subscriptionType.getFields()

			// auditEventCreated should have filter argument
			const auditEventCreatedArgs = fields.auditEventCreated.args
			expect(auditEventCreatedArgs.find((arg) => arg.name === 'filter')).toBeDefined()

			// alertCreated should have severity argument
			const alertCreatedArgs = fields.alertCreated.args
			expect(alertCreatedArgs.find((arg) => arg.name === 'severity')).toBeDefined()

			// reportExecutionUpdated should have reportId argument
			const reportExecutionUpdatedArgs = fields.reportExecutionUpdated.args
			expect(reportExecutionUpdatedArgs.find((arg) => arg.name === 'reportId')).toBeDefined()
		})
	})

	describe('Field Relationships', () => {
		it('should have correct field relationships in AuditEvent', () => {
			const auditEventType = schema.getType('AuditEvent')
			const fields = auditEventType.getFields()

			expect(fields.id.type.toString()).toBe('ID!')
			expect(fields.timestamp.type.toString()).toBe('DateTime!')
			expect(fields.action.type.toString()).toBe('String!')
			expect(fields.status.type.toString()).toBe('AuditEventStatus!')
			expect(fields.dataClassification.type.toString()).toBe('DataClassification')
			expect(fields.sessionContext.type.toString()).toBe('SessionContext')
		})

		it('should have correct field relationships in AuditEventConnection', () => {
			const connectionType = schema.getType('AuditEventConnection')
			const fields = connectionType.getFields()

			expect(fields.edges.type.toString()).toBe('[AuditEventEdge!]!')
			expect(fields.pageInfo.type.toString()).toBe('PageInfo!')
			expect(fields.totalCount.type.toString()).toBe('Int!')
		})

		it('should have correct field relationships in ComplianceReport', () => {
			const reportType = schema.getType('ComplianceReport')
			const fields = reportType.getFields()

			expect(fields.id.type.toString()).toBe('ID!')
			expect(fields.type.type.toString()).toBe('ComplianceReportType!')
			expect(fields.criteria.type.toString()).toBe('ReportCriteria!')
			expect(fields.generatedAt.type.toString()).toBe('DateTime!')
			expect(fields.summary.type.toString()).toBe('ReportSummary!')
		})
	})

	describe('Enum Values', () => {
		it('should have correct values for AuditEventStatus enum', () => {
			const enumType = schema.getType('AuditEventStatus')
			const values = enumType.getValues()

			const expectedValues = ['attempt', 'success', 'failure']
			expectedValues.forEach((value) => {
				expect(values.find((v) => v.name === value)).toBeDefined()
			})
		})

		it('should have correct values for DataClassification enum', () => {
			const enumType = schema.getType('DataClassification')
			const values = enumType.getValues()

			const expectedValues = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']
			expectedValues.forEach((value) => {
				expect(values.find((v) => v.name === value)).toBeDefined()
			})
		})

		it('should have correct values for ComplianceReportType enum', () => {
			const enumType = schema.getType('ComplianceReportType')
			const values = enumType.getValues()

			const expectedValues = ['HIPAA', 'GDPR', 'INTEGRITY', 'CUSTOM']
			expectedValues.forEach((value) => {
				expect(values.find((v) => v.name === value)).toBeDefined()
			})
		})

		it('should have correct values for AlertSeverity enum', () => {
			const enumType = schema.getType('AlertSeverity')
			const values = enumType.getValues()

			const expectedValues = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
			expectedValues.forEach((value) => {
				expect(values.find((v) => v.name === value)).toBeDefined()
			})
		})
	})

	describe('Input Validation', () => {
		it('should validate CreateAuditEventInput structure', () => {
			const inputType = schema.getType('CreateAuditEventInput')
			const fields = inputType.getFields()

			expect(fields.action.type.toString()).toBe('String!')
			expect(fields.principalId.type.toString()).toBe('String!')
			expect(fields.organizationId.type.toString()).toBe('String!')
			expect(fields.status.type.toString()).toBe('AuditEventStatus!')
			expect(fields.dataClassification.type.toString()).toBe('DataClassification')
			expect(fields.sessionContext.type.toString()).toBe('SessionContextInput')
		})

		it('should validate AuditEventFilter structure', () => {
			const inputType = schema.getType('AuditEventFilter')
			const fields = inputType.getFields()

			expect(fields.dateRange.type.toString()).toBe('TimeRangeInput')
			expect(fields.principalIds.type.toString()).toBe('[String!]')
			expect(fields.actions.type.toString()).toBe('[String!]')
			expect(fields.statuses.type.toString()).toBe('[AuditEventStatus!]')
			expect(fields.dataClassifications.type.toString()).toBe('[DataClassification!]')
		})

		it('should validate PaginationInput structure', () => {
			const inputType = schema.getType('PaginationInput')
			const fields = inputType.getFields()

			expect(fields.first.type.toString()).toBe('Int')
			expect(fields.after.type.toString()).toBe('String')
			expect(fields.last.type.toString()).toBe('Int')
			expect(fields.before.type.toString()).toBe('String')
		})
	})

	describe('Schema Introspection', () => {
		it('should support introspection queries', () => {
			const introspectionQuery = `
				query {
					__schema {
						types {
							name
							kind
						}
					}
				}
			`

			const document = parse(introspectionQuery)
			const errors = validate(schema, document)

			expect(errors).toHaveLength(0)
		})

		it('should provide type information through introspection', () => {
			const typeQuery = `
				query {
					__type(name: "AuditEvent") {
						name
						kind
						fields {
							name
							type {
								name
							}
						}
					}
				}
			`

			const document = parse(typeQuery)
			const errors = validate(schema, document)

			expect(errors).toHaveLength(0)
		})
	})
})
