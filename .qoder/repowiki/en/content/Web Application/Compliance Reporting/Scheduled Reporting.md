# Scheduled Reporting

<cite>
**Referenced Files in This Document**   
- [scheduled-reporting.ts](file://packages/audit/src/report/scheduled-reporting.ts) - *Updated with enhanced scheduling options*
- [scheduled-report-api.ts](file://apps/server/src/routes/scheduled-report-api.ts) - *Enhanced API with execution history support*
- [scheduled-reports.tsx](file://apps/app/src/routes/_authenticated/compliance/scheduled-reports/index.tsx) - *Updated UI implementation*
- [executions.tsx](file://apps/app/src/routes/_authenticated/compliance/scheduled-reports/$reportId/executions.tsx) - *New execution history component*
</cite>

## Update Summary
**Changes Made**   
- Updated scheduling configuration with advanced recurrence options
- Added execution history functionality and API endpoints
- Enhanced delivery configuration with detailed retry and notification settings
- Updated UI route structure to support execution history
- Added new section on execution history monitoring

## Table of Contents
1. [Introduction](#introduction)
2. [Core Components and Architecture](#core-components-and-architecture)
3. [Report Scheduling and Execution](#report-scheduling-and-execution)
4. [Delivery Mechanisms and Retry Logic](#delivery-mechanisms-and-retry-logic)
5. [GraphQL API Interface](#graphql-api-interface)
6. [Report Templates and Configuration](#report-templates-and-configuration)
7. [Error Handling and Monitoring](#error-handling-and-monitoring)
8. [Execution History and Monitoring](#execution-history-and-monitoring)
9. [Testing and Validation](#testing-and-validation)
10. [Best Practices and Recommendations](#best-practices-and-recommendations)

## Introduction

The Scheduled Reporting system enables automated generation and delivery of compliance reports based on predefined schedules. It supports various report types including HIPAA, GDPR, and integrity verification reports, with flexible delivery options such as email, webhook, and storage. The system is designed to run in the background using worker processes, ensuring efficient resource utilization while maintaining reliability through robust error handling and retry mechanisms.

This document provides a comprehensive overview of the implementation, covering the architecture, scheduling logic, delivery mechanisms, API interfaces, and operational considerations for managing scheduled compliance reports.

## Core Components and Architecture

The Scheduled Reporting system consists of several interconnected components that work together to automate report generation and delivery:

- **ScheduledReportingService**: Core service responsible for managing scheduled reports, executing them, and handling delivery
- **GraphQL Resolvers**: API layer that exposes scheduled reporting functionality through GraphQL queries and mutations
- **Database Layer**: Stores scheduled report configurations, execution history, and delivery attempts
- **Worker Processes**: Background execution environment for generating reports without blocking the main application

The architecture follows a layered pattern with clear separation of concerns, where the service layer handles business logic, the API layer provides interface access, and external systems handle delivery and storage.

```mermaid
graph TB
subgraph "API Layer"
A[GraphQL Resolvers]
end
subgraph "Service Layer"
B[ScheduledReportingService]
end
subgraph "Data Layer"
C[(Database)]
end
subgraph "External Systems"
D[Email Service]
E[Webhook Endpoint]
F[Storage System]
end
A --> B
B --> C
B --> D
B --> E
B --> F
```

**Diagram sources**
- [scheduled-reporting.ts](file://packages/audit/src/report/scheduled-reporting.ts)
- [scheduled-report-api.ts](file://apps/server/src/routes/scheduled-report-api.ts)

**Section sources**
- [scheduled-reporting.ts](file://packages/audit/src/report/scheduled-reporting.ts)
- [scheduled-report-api.ts](file://apps/server/src/routes/scheduled-report-api.ts)

## Report Scheduling and Execution

The system implements cron-like scheduling through recurrence patterns defined in the report configuration. Reports are executed based on frequency settings including daily, weekly, monthly, and quarterly intervals.

### Scheduling Logic

The `calculateNextRun` method determines when a report should next execute based on its frequency and configured time:

```typescript
private calculateNextRun(schedule: ScheduledReportConfig['schedule']): string {
    const now = new Date()
    const hours = schedule.hour
    const minutes = schedule.minute

    let nextRun = new Date(now)
    nextRun.setHours(hours, minutes, 0, 0)

    if (schedule.timezone) {
        // Note: Proper timezone handling would require a library like 'luxon' or 'date-fns-tz'
        // This is a placeholder implementation assuming server is in UTC
        // In production, convert 'nextRun' to the specified timezone
    }

    // If the time has already passed today, move to the next occurrence
    if (nextRun <= now) {
        switch (schedule.frequency) {
            case 'hourly':
                nextRun.setHours(nextRun.getHours() + 1)
                break
            case 'daily':
                nextRun.setDate(nextRun.getDate() + 1)
                break
            case 'weekly': {
                const targetDay = Number(schedule.dayOfWeek ?? 0) // Default to Sunday
                const currentDay = Number(nextRun.getDay())
                const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7
                nextRun.setDate(nextRun.getDate() + daysUntilTarget)
                break
            }
            case 'monthly': {
                const targetDate = schedule.dayOfMonth || 1
                nextRun.setMonth(nextRun.getMonth() + 1, targetDate)
                break
            }
            case 'quarterly':
                nextRun.setMonth(nextRun.getMonth() + 3, schedule.dayOfMonth || 1)
                break
            case 'yearly':
                nextRun.setFullYear(
                    nextRun.getFullYear() + 1,
                    schedule.monthOfYear || 1,
                    schedule.dayOfMonth || 1
                )
                break
            default:
                throw new Error(`Unsupported schedule frequency: ${schedule.frequency}`)
        }
    }

    return nextRun.toISOString()
}
```

### Execution Process

The `executeReport` method handles the complete report generation workflow:

1. Creates an execution record in the database
2. Generates the report content based on the report type
3. Delivers the report through the configured method
4. Updates execution status and records metrics
5. Calculates the next run time for recurring reports

Timezone handling is supported through the `timezone` field in the schedule configuration, though the current implementation uses UTC by default. The system tracks execution duration, records processed, and maintains a complete history of all report executions.

```mermaid
sequenceDiagram
participant S as ScheduledReportingService
participant DB as Database
participant R as ReportGenerator
participant D as DeliverySystem
S->>DB : Check for due reports
S->>S : Initialize execution record
S->>DB : Insert execution record
S->>R : Generate report
R-->>S : Return report result
S->>D : Deliver report
D-->>S : Delivery confirmation
S->>DB : Update execution status
S->>DB : Update next run time
```

**Diagram sources**
- [scheduled-reporting.ts](file://packages/audit/src/report/scheduled-reporting.ts#L547-L662)

**Section sources**
- [scheduled-reporting.ts](file://packages/audit/src/report/scheduled-reporting.ts#L547-L662)

## Delivery Mechanisms and Retry Logic

The system supports multiple delivery methods for generated reports, each with specific configuration options and delivery tracking.

### Supported Delivery Methods

**Email Delivery**
- Configured with recipient list
- Uses SMTP configuration from service initialization
- Each delivery attempt is recorded with timestamp and status

**Webhook Delivery**
- Sends report data to configured URL endpoint
- Supports custom headers and authentication
- Records response code and response time

**Storage Delivery**
- Saves report to specified location
- Supports various storage providers
- Includes retention policies for automatic cleanup

### Delivery Workflow

The `deliverReport` method orchestrates the delivery process:

```typescript
private async deliverReport(
    config: ScheduledReportConfig,
    reportResult: ExportResult,
    execution: ReportExecution
): Promise<void> {
    const deliveryAttempt: DeliveryAttempt = {
        attemptId: this.generateId('delivery'),
        timestamp: new Date().toISOString(),
        status: 'pending',
        method: config.delivery.method,
        target: this.getDeliveryTarget(config.delivery),
        retryCount: 0,
    }

    execution.deliveryAttempts.push(deliveryAttempt)

    try {
        switch (config.delivery.method) {
            case 'email':
                await this.deliverViaEmail(config.delivery, reportResult, deliveryAttempt)
                break
            case 'webhook':
                await this.deliverViaWebhook(config.delivery, reportResult, deliveryAttempt)
                break
            case 'storage':
                await this.deliverViaStorage(config.delivery, reportResult, deliveryAttempt)
                break
            case 'sftp':
            case 'download':
                console.warn(`Delivery method ${config.delivery.method} not yet implemented`)
                deliveryAttempt.status = 'failed'
                deliveryAttempt.error = `Delivery method ${config.delivery.method} not yet implemented`
                throw new Error(deliveryAttempt.error)
            default:
                throw new Error(`Unsupported delivery method: ${config.delivery.method}`)
        }

        deliveryAttempt.status = 'delivered'
    } catch (error) {
        deliveryAttempt.status = 'failed'
        deliveryAttempt.error = error instanceof Error ? error.message : 'Unknown error'
        throw error
    }
}
```

### Retry Mechanism

Failed deliveries are automatically retried up to three times using the `retryFailedDeliveries` method:

```mermaid
flowchart TD
A[Check Recent Executions] --> B{Has Failed Attempts?}
B --> |Yes| C[Filter Failed Attempts]
C --> D{Retry Count < 3?}
D --> |Yes| E[Increment Retry Count]
E --> F[Attempt Redelivery]
F --> G{Success?}
G --> |Yes| H[Update Status to Delivered]
G --> |No| I[Update Status to Failed]
D --> |No| J[Skip Retry]
B --> |No| K[No Action Needed]
```

The retry process preserves the original execution context and updates the delivery attempts array in the database. Each retry increments the retry count and records the attempt timestamp.

**Diagram sources**
- [scheduled-reporting.ts](file://packages/audit/src/report/scheduled-reporting.ts#L950-L1002)

**Section sources**
- [scheduled-reporting.ts](file://packages/audit/src/report/scheduled-reporting.ts#L950-L1002)

## GraphQL API Interface

The system provides a comprehensive GraphQL API for managing scheduled reports through both UI and programmatic interfaces.

### Query Operations

**Get All Scheduled Reports**
```graphql
query ScheduledReports {
    scheduledReports {
        id
        name
        description
        reportType
        criteria {
            dateRange {
                startDate
                endDate
            }
            organizationIds
            includeMetadata
            format
        }
        schedule {
            frequency
            dayOfWeek
            dayOfMonth
            hour
            minute
            timezone
        }
        deliveryConfig {
            method
            config {
                recipients
                webhookUrl
                storageLocation
            }
        }
        isActive
        createdAt
        updatedAt
    }
}
```

**Get Single Report**
```graphql
query ScheduledReport($id: String!) {
    scheduledReport(id: $id) {
        # Same fields as above
    }
}
```

### Mutation Operations

**Create Scheduled Report**
```graphql
mutation CreateScheduledReport($input: CreateScheduledReportInput!) {
    createScheduledReport(input: $input) {
        id
        name
        # Other fields
    }
}
```

**Update Scheduled Report**
```graphql
mutation UpdateScheduledReport($id: String!, $input: UpdateScheduledReportInput!) {
    updateScheduledReport(id: $id, input: $input) {
        id
        name
        # Other fields
    }
}
}
```

**Delete Scheduled Report**
```graphql
mutation DeleteScheduledReport($id: String!) {
    deleteScheduledReport(id: $id)
}
```

**Execute Report Immediately**
```graphql
mutation ExecuteScheduledReport($id: String!) {
    executeScheduledReport(id: $id) {
        id
        reportId
        startedAt
        completedAt
        status
        error
        downloadUrl
    }
}
```

The resolvers handle authentication, organization-based access control, and data transformation between the GraphQL schema and internal data structures. Error handling includes proper logging and structured error responses with appropriate status codes.

```mermaid
sequenceDiagram
participant Client
participant Resolver
participant Service
participant Database
Client->>Resolver : createScheduledReport(input)
Resolver->>Resolver : Validate authentication
Resolver->>Resolver : Transform input format
Resolver->>Service : createScheduledReport(data)
Service->>Database : Insert report configuration
Database-->>Service : Return created report
Service-->>Resolver : Return report object
Resolver->>Resolver : Map to GraphQL format
Resolver-->>Client : Return scheduled report
```

**Diagram sources**
- [scheduled-report-api.ts](file://apps/server/src/routes/scheduled-report-api.ts)

**Section sources**
- [scheduled-report-api.ts](file://apps/server/src/routes/scheduled-report-api.ts)

## Report Templates and Configuration

The system supports report templates to standardize common reporting configurations and simplify the creation of new scheduled reports.

### Template Structure

A report template includes:
- **Name and description**: Human-readable identification
- **Report type**: HIPAA, GDPR, or other compliance type
- **Default criteria**: Predefined filters and parameters
- **Default format**: Output format (JSON, CSV, XML)
- **Default export configuration**: Metadata and integrity options
- **Tags**: Categorization and searchability

### Template-Based Report Creation

The `createReportFromTemplate` method allows creating scheduled reports from templates with optional overrides:

```typescript
async createReportFromTemplate(
    templateId: string,
    overrides: Partial<ScheduledReportConfig> & { organizationId: string }
): Promise<ScheduledReportConfig> {
    const template = await this.getReportTemplate(templateId)
    if (!template) {
        throw new Error(`Report template not found: ${templateId}`)
    }

    const reportConfig: Omit<
        ScheduledReportConfig,
        'id' | 'createdAt' | 'updatedAt' | 'nextRun' | 'version'
    > & {
        organizationId: string
    } = {
        ...overrides,
        name: overrides.name || `${template.name} - ${new Date().toISOString().split('T')[0]}`,
        description: overrides.description || template.description,
        organizationId: overrides.organizationId,
        templateId,
        reportType: template.reportType,
        criteria: {
            ...template.defaultCriteria,
            ...overrides.criteria,
        } as ReportCriteria,
        format: overrides.format || template.defaultFormat,
        schedule: overrides.schedule || {
            frequency: 'monthly',
            timezone: 'UTC',
            hour: 9,
            minute: 0,
            dayOfMonth: 1,
            skipWeekends: false,
            skipHolidays: false,
            maxMissedRuns: 3,
            catchUpMissedRuns: false,
        },
        delivery: overrides.delivery || {
            method: 'email',
            email: {
                smtpConfig: {
                    host: 'smtp.example.com',
                    port: 587,
                    secure: false,
                    auth: {
                        user: 'user',
                        pass: 'pass',
                    },
                },
                from: 'reports@smedrec.com',
                subject: `Scheduled Report: ${template.name}`,
                bodyTemplate: 'Please find the attached report.',
                attachmentName: `report-${new Date().toISOString().split('T')[0]}.json`,
                recipients: ['teste@exemplo.com'],
            },
        },
        export: overrides.export || {
            format: 'json',
            includeMetadata: true,
            includeIntegrityReport: false,
        },
        notification: overrides.notification || {
            recipients: ['reports@smedrec.com'],
            onSuccess: false,
            onFailure: true,
            onSkip: false,
            includeReport: false,
        },
        enabled: overrides.enabled !== undefined ? overrides.enabled : true,
        createdBy: overrides.createdBy || 'system',
        tags: overrides.tags || template.tags || [],
        metadata: overrides.metadata || {},
    }

    return this.createScheduledReport(reportConfig)
}
```

This approach ensures consistency across reports while allowing necessary customization for specific use cases.

**Section sources**
- [scheduled-reporting.ts](file://packages/audit/src/report/scheduled-reporting.ts#L840-L915)

## Error Handling and Monitoring

The system implements comprehensive error handling to ensure reliability and provide visibility into report execution status.

### Execution Error Handling

When a report execution fails, the system:
1. Captures the error message
2. Updates the execution record with failure status
3. Preserves delivery attempts made before failure
4. Logs the error with context for debugging

```typescript
try {
    // Report execution logic
} catch (error) {
    execution.status = 'failed'
    execution.error = error instanceof Error ? error.message : 'Unknown error'

    await this.db
        .update(this.reportExecutions)
        .set({
            status: 'failed',
            error: execution.error,
            deliveryAttempts: execution.deliveryAttempts,
        })
        .where(eq(this.reportExecutions.id, executionId))
}
```

### Common Issues and Mitigations

**Timezone Handling**
- The system uses UTC as the default timezone
- Schedule times are stored in ISO format with timezone information
- Consider implementing timezone conversion for user-facing displays

**Missed Executions**
- The `processDueReports` method checks for reports where `nextRun <= now`
- This ensures that overdue reports are executed even if the scheduler missed the exact time
- Consider implementing a grace period to avoid duplicate executions

**Resource Utilization**
- Reports are generated in worker processes to avoid blocking the main application
- Consider implementing rate limiting for resource-intensive reports
- Monitor memory usage during large report generation

**Monitoring Integration**
- The system logs key events (creation, execution, delivery)
- Error handling integrates with the centralized error service
- Consider adding metrics for execution duration, success rates, and delivery performance

**Section sources**
- [scheduled-reporting.ts](file://packages/audit/src/report/scheduled-reporting.ts#L547-L662)

## Execution History and Monitoring

The system now provides comprehensive execution history tracking for scheduled reports, allowing users to monitor report execution status and troubleshoot issues.

### Execution History API

The system exposes a dedicated endpoint for retrieving execution history:

```typescript
const getExecutionHistoryRoute = createRoute({
    method: 'get',
    path: '/{id}/executions',
    tags: ['Scheduled Reports'],
    summary: 'Get execution history for a scheduled report',
    description: 'Retrieves the execution history for a specific scheduled report.',
    request: {
        params: z.object({
            id: z.string().startsWith('report-'),
        }),
        query: z.object({
            status: z
                .array(
                    z.enum(['pending', 'running', 'completed', 'failed', 'cancelled', 'skipped', 'timeout'])
                )
                .optional(),
            trigger: z.array(z.enum(['scheduled', 'manual', 'api', 'retry', 'catchup'])).optional(),
            startDate: z.string().datetime().optional(),
            endDate: z.string().datetime().optional(),
            limit: z.string().optional(),
            offset: z.string().optional(),
            sortBy: z.enum(['scheduled_time', 'execution_time', 'duration', 'status']).optional(),
            sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
        }),
    },
    responses: {
        200: {
            description: 'Execution history retrieved successfully',
            content: {
                'application/json': {
                    schema: z.object({
                        data: z.array(
                            z.object({
                                id: z.string().startsWith('execution-'),
                                scheduledReportId: z.string(),
                                status: z.enum([
                                    'pending',
                                    'running',
                                    'completed',
                                    'failed',
                                    'cancelled',
                                    'skipped',
                                    'timeout',
                                ]),
                                trigger: z.enum(['scheduled', 'manual', 'api', 'retry', 'catchup']),
                                scheduledTime: z.string().datetime(),
                                executionTime: z.string().datetime().optional(),
                                duration: z.number().min(0).optional(),
                                reportId: z.string().optional(),
                                recordsProcessed: z.number().int().min(0).optional(),
                                deliveryAttempts: z.array(
                                    z.object({
                                        attemptId: z.string(),
                                        timestamp: z.string().datetime(),
                                        status: z.enum(['pending', 'delivered', 'failed', 'skipped']),
                                        method: z.enum(['email', 'webhook', 'storage', 'download', 'sftp']),
                                        target: z.string(),
                                        error: z
                                            .object({
                                                code: z.string(),
                                                message: z.string(),
                                                details: z.record(z.string(), z.any()).optional(),
                                                stackTrace: z.string().optional(),
                                            })
                                            .optional(),
                                        responseCode: z.number().optional(),
                                        responseTime: z.number().optional(),
                                        retryCount: z.number().int().min(0),
                                    })
                                ),
                                error: z
                                    .object({
                                        code: z.string(),
                                        message: z.string(),
                                        details: z.record(z.string(), z.any()).optional(),
                                        stackTrace: z.string().optional(),
                                    })
                                    .optional(),
                            })
                        ),
                        pagination: z.object({
                            total: z.number().int().min(0),
                            limit: z.number().int().min(1),
                            offset: z.number().int().min(0),
                            hasNext: z.boolean(),
                            hasPrevious: z.boolean(),
                            nextCursor: z.string().optional(),
                            previousCursor: z.string().optional(),
                        }),
                    }),
                },
            },
        },
        ...openApiErrorResponses,
    },
})
```

### UI Implementation

The frontend provides a dedicated interface for viewing execution history:

```typescript
export const Route = createFileRoute(
    '/_authenticated/compliance/scheduled-reports/$reportId/executions'
)({
    component: RouteComponent,
    validateSearch: executionHistorySearchSchema,
    beforeLoad: ({ context, params }) => {
        // Route guard: ensure user has permission to view execution history
        // and validate that reportId is a valid format
        if (!params.reportId || params.reportId.trim() === '') {
            throw new Error('Invalid report ID')
        }
        return context
    },
})

function RouteComponent() {
    const { reportId } = Route.useParams()

    return <ExecutionHistoryPage reportId={reportId} />
}
```

**Section sources**
- [scheduled-report-api.ts](file://apps/server/src/routes/scheduled-report-api.ts#L400-L690)
- [executions.tsx](file://apps/app/src/routes/_authenticated/compliance/scheduled-reports/$reportId/executions.tsx)

## Testing and Validation

The system includes comprehensive test coverage to ensure reliability and validate functionality.

### Test Coverage

The test suite includes:
- **Creation tests**: Validate report creation with various configurations
- **Update tests**: Verify update operations and error handling
- **Deletion tests**: Confirm proper removal of scheduled reports
- **Execution tests**: Test successful and failed report execution
- **Delivery tests**: Validate all delivery methods
- **Template tests**: Ensure template-based creation works correctly
- **Scheduling tests**: Verify next run time calculations

### Example Test Cases

**Schedule Calculation**
```typescript
it('should calculate next run time correctly for daily schedule', async () => {
    const config = {
        // Daily schedule at 09:00
        schedule: { frequency: 'daily', time: '09:00' }
    }
    
    const result = await service.createScheduledReport(config)
    
    expect(result.nextRun).toBeDefined()
    const nextRun = new Date(result.nextRun!)
    expect(nextRun.getHours()).toBe(9)
    expect(nextRun.getMinutes()).toBe(0)
})
```

**Delivery Method Testing**
```typescript
it('should handle email delivery', async () => {
    const config = {
        delivery: {
            method: 'email',
            recipients: ['test1@test.com', 'test2@test.com']
        }
    }
    
    const created = await service.createScheduledReport(config)
    const execution = await service.executeReport(created.id)
    
    expect(execution.deliveryAttempts).toHaveLength(1)
    expect(execution.deliveryAttempts[0].method).toBe('email')
    expect(execution.deliveryAttempts[0].target).toContain('test1@test.com')
})
```

The tests validate both success and error conditions, ensuring the system behaves correctly under various scenarios.

**Section sources**
- [scheduled-reporting.test.ts](file://packages/audit/src/__tests__/scheduled-reporting.test.ts)

## Best Practices and Recommendations

### Creating Scheduled Reports

**Through UI**
1. Navigate to the Reports section
2. Select "Create Scheduled Report"
3. Choose a template or start from scratch
4. Configure schedule, delivery, and criteria
5. Save and enable the report

**Through API**
```javascript
const response = await fetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        query: `
            mutation CreateScheduledReport($input: CreateScheduledReportInput!) {
                createScheduledReport(input: $input) {
                    id
                    name
                    status
                }
            }
        `,
        variables: {
            input: {
                name: "Monthly Compliance Report",
                reportType: "HIPAA",
                criteria: {
                    dateRange: {
                        startDate: "2024-01-01T00:00:00Z",
                        endDate: "2024-01-31T23:59:59Z"
                    },
                    format: "CSV"
                },
                schedule: {
                    frequency: "MONTHLY",
                    dayOfMonth: 1,
                    hour: 9,
                    minute: 0,
                    timezone: "UTC"
                },
                deliveryConfig: {
                    method: "EMAIL",
                    config: {
                        recipients: ["compliance@company.com"]
                    }
                },
                isActive: true
            }
        }
    })
})
```

### Monitoring and Troubleshooting

**Common Issues**
- **Failed deliveries**: Check delivery configuration and target availability
- **Missed executions**: Verify scheduler is running and check system clock
- **Long execution times**: Optimize report criteria or consider resource limits
- **Authentication errors**: Validate API tokens and permissions

**Monitoring Recommendations**
- Set up alerts for failed report executions
- Monitor delivery success rates
- Track execution duration trends
- Review error logs regularly

**Performance Optimization**
- Use appropriate date ranges to limit data processing
- Consider report size when choosing output format
- Schedule resource-intensive reports during off-peak hours
- Implement caching for frequently accessed reports

**Section sources**
- [scheduled-reporting.ts](file://packages/audit/src/report/scheduled-reporting.ts)
- [scheduled-report-api.ts](file://apps/server/src/routes/scheduled-report-api.ts)
- [scheduled-reporting.test.ts](file://packages/audit/src/__tests__/scheduled-reporting.test.ts)