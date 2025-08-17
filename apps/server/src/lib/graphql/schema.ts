/**
 * GraphQL Schema Definition
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

export const typeDefs = `#graphql
  # Scalar types
  scalar DateTime
  scalar JSON

  # Enums
  enum AuditEventStatus {
    ATTEMPT
    SUCCESS
    FAILURE
  }

  enum DataClassification {
    PUBLIC
    INTERNAL
    CONFIDENTIAL
    PHI
  }

  enum ComplianceReportType {
    HIPAA
    GDPR
    INTEGRITY
    CUSTOM
  }

  enum ReportFormat {
    JSON
    CSV
    XML
  }

  enum ReportFrequency {
    DAILY
    WEEKLY
    MONTHLY
    QUARTERLY
  }

  enum DeliveryMethod {
    EMAIL
    WEBHOOK
    STORAGE
  }

  enum AlertType {
    SYSTEM
    SECURITY
    COMPLIANCE
    PERFORMANCE
  }

  enum AlertSeverity {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  enum AlertStatus {
    ACTIVE
    ACKNOWLEDGED
    RESOLVED
  }

  enum SortDirection {
    ASC
    DESC
  }

  enum AuditEventSortField {
    TIMESTAMP
    STATUS
    ACTION
    PRINCIPAL_ID
  }

  enum MetricsGroupBy {
    HOUR
    DAY
    WEEK
    MONTH
  }

  enum ReportExecutionStatus {
    PENDING
    RUNNING
    COMPLETED
    FAILED
  }

  # Input types
  input TimeRangeInput {
    startDate: DateTime!
    endDate: DateTime!
  }

  input AuditEventFilter {
    dateRange: TimeRangeInput
    principalIds: [String!]
    organizationIds: [String!]
    actions: [String!]
    statuses: [AuditEventStatus!]
    dataClassifications: [DataClassification!]
    resourceTypes: [String!]
    resourceIds: [String!]
    verifiedOnly: Boolean
    correlationIds: [String!]
  }

  input PaginationInput {
    first: Int
    after: String
    last: Int
    before: String
  }

  input SortInput {
    field: AuditEventSortField!
    direction: SortDirection!
  }

  input SessionContextInput {
    sessionId: String!
    ipAddress: String!
    userAgent: String!
    geolocation: String
  }

  input CreateAuditEventInput {
    action: String!
    targetResourceType: String
    targetResourceId: String
    principalId: String!
    organizationId: String!
    status: AuditEventStatus!
    outcomeDescription: String
    dataClassification: DataClassification
    sessionContext: SessionContextInput
    correlationId: String
    retentionPolicy: String
    metadata: JSON
  }

  input ReportCriteriaInput {
    dateRange: TimeRangeInput!
    organizationIds: [String!]
    includeMetadata: Boolean
    format: ReportFormat
  }

  input ReportScheduleInput {
    frequency: ReportFrequency!
    dayOfWeek: Int
    dayOfMonth: Int
    hour: Int!
    minute: Int!
    timezone: String!
  }

  input DeliveryConfigInput {
    method: DeliveryMethod!
    config: JSON!
  }

  input CreateScheduledReportInput {
    name: String!
    description: String
    reportType: ComplianceReportType!
    criteria: ReportCriteriaInput!
    schedule: ReportScheduleInput!
    deliveryConfig: DeliveryConfigInput!
    isActive: Boolean
  }

  input UpdateScheduledReportInput {
    name: String
    description: String
    criteria: ReportCriteriaInput
    schedule: ReportScheduleInput
    deliveryConfig: DeliveryConfigInput
    isActive: Boolean
  }

  input AlertThresholdsInput {
    errorRate: Float
    responseTime: Float
    volumeThreshold: Float
  }

  input PresetConfigurationInput {
    actions: [String!]!
    dataClassifications: [DataClassification!]!
    retentionPolicy: String!
    encryptionEnabled: Boolean!
    integrityCheckEnabled: Boolean!
    alertThresholds: AlertThresholdsInput
  }

  input CreateAuditPresetInput {
    name: String!
    description: String
    configuration: PresetConfigurationInput!
    isActive: Boolean
  }

  input UpdateAuditPresetInput {
    description: String
    configuration: PresetConfigurationInput
    isActive: Boolean
  }

  input AlertFilter {
    types: [AlertType!]
    severities: [AlertSeverity!]
    status: AlertStatus
    dateRange: TimeRangeInput
  }

  # Object types
  type SessionContext {
    sessionId: String!
    ipAddress: String!
    userAgent: String!
    geolocation: String
  }

  type AuditEvent {
    id: ID!
    timestamp: DateTime!
    action: String!
    targetResourceType: String
    targetResourceId: String
    principalId: String
    organizationId: String
    status: AuditEventStatus!
    outcomeDescription: String
    dataClassification: DataClassification
    sessionContext: SessionContext
    correlationId: String
    retentionPolicy: String
    metadata: JSON
    hash: String
    integrityStatus: String
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  type AuditEventEdge {
    node: AuditEvent!
    cursor: String!
  }

  type AuditEventConnection {
    edges: [AuditEventEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type HealthCheck {
    name: String!
    status: String!
    message: String
    responseTime: Float
  }

  type HealthStatus {
    status: String!
    timestamp: DateTime!
    checks: [HealthCheck!]!
  }

  type MemoryUsage {
    used: Float!
    total: Float!
    percentage: Float!
  }

  type CPUUsage {
    percentage: Float!
    loadAverage: [Float!]!
  }

  type ServerMetrics {
    uptime: Float!
    memoryUsage: MemoryUsage!
    cpuUsage: CPUUsage!
  }

  type DatabaseMetrics {
    connectionCount: Int!
    activeQueries: Int!
    averageQueryTime: Float!
  }

  type RedisMetrics {
    connectionCount: Int!
    memoryUsage: Float!
    keyCount: Int!
  }

  type APIMetrics {
    requestsPerSecond: Float!
    averageResponseTime: Float!
    errorRate: Float!
  }

  type SystemMetrics {
    timestamp: DateTime!
    server: ServerMetrics!
    database: DatabaseMetrics!
    redis: RedisMetrics!
    api: APIMetrics!
  }

  type ReportSummary {
    totalEvents: Int!
    verifiedEvents: Int!
    failedVerifications: Int!
    complianceScore: Float
  }

  type ComplianceReport {
    id: ID!
    type: ComplianceReportType!
    criteria: ReportCriteria!
    generatedAt: DateTime!
    status: String!
    summary: ReportSummary!
    downloadUrl: String
  }

  type ReportCriteria {
    dateRange: TimeRange!
    organizationIds: [String!]
    includeMetadata: Boolean
    format: ReportFormat
  }

  type TimeRange {
    startDate: DateTime!
    endDate: DateTime!
  }

  type ReportSchedule {
    frequency: ReportFrequency!
    dayOfWeek: Int
    dayOfMonth: Int
    hour: Int!
    minute: Int!
    timezone: String!
  }

  type DeliveryConfig {
    method: DeliveryMethod!
    config: JSON!
  }

  type ReportExecution {
    id: ID!
    reportId: ID!
    startedAt: DateTime!
    completedAt: DateTime
    status: ReportExecutionStatus!
    error: String
    downloadUrl: String
  }

  type ScheduledReport {
    id: ID!
    name: String!
    description: String
    reportType: ComplianceReportType!
    criteria: ReportCriteria!
    schedule: ReportSchedule!
    deliveryConfig: DeliveryConfig!
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    lastExecution: ReportExecution
  }

  type AlertThresholds {
    errorRate: Float
    responseTime: Float
    volumeThreshold: Float
  }

  type PresetConfiguration {
    actions: [String!]!
    dataClassifications: [DataClassification!]!
    retentionPolicy: String!
    encryptionEnabled: Boolean!
    integrityCheckEnabled: Boolean!
    alertThresholds: AlertThresholds
  }

  type AuditPreset {
    name: String!
    description: String
    configuration: PresetConfiguration!
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Alert {
    id: ID!
    type: AlertType!
    severity: AlertSeverity!
    title: String!
    description: String!
    createdAt: DateTime!
    acknowledgedAt: DateTime
    resolvedAt: DateTime
    acknowledgedBy: String
    resolvedBy: String
    resolution: String
    metadata: JSON
  }

  type AlertEdge {
    node: Alert!
    cursor: String!
  }

  type AlertConnection {
    edges: [AlertEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type LatencyMetrics {
    average: Float!
    p50: Float!
    p95: Float!
    p99: Float!
  }

  type IntegrityMetrics {
    total: Int!
    passed: Int!
    failed: Int!
    successRate: Float!
  }

  type ComplianceMetrics {
    generated: Int!
    scheduled: Int!
    failed: Int!
    successRate: Float!
  }

  type ErrorMetrics {
    total: Int!
    byType: JSON!
    errorRate: Float!
  }

  type AuditMetrics {
    timestamp: DateTime!
    timeRange: TimeRange!
    eventsProcessed: Int!
    processingLatency: LatencyMetrics!
    integrityVerifications: IntegrityMetrics!
    complianceReports: ComplianceMetrics!
    errorMetrics: ErrorMetrics!
  }

  type IntegrityVerificationResult {
    isValid: Boolean!
    expectedHash: String
    computedHash: String
    timestamp: DateTime!
    eventId: ID!
    verificationChain: [IntegrityVerificationResult!]
  }

  # Query type
  type Query {
    # Health and system status
    health: HealthStatus!
    systemMetrics: SystemMetrics!

    # Audit events with flexible filtering
    auditEvents(
      filter: AuditEventFilter
      pagination: PaginationInput
      sort: SortInput
    ): AuditEventConnection!

    auditEvent(id: ID!): AuditEvent

    # Compliance reports
    complianceReports(
      type: ComplianceReportType!
      criteria: ReportCriteriaInput!
    ): ComplianceReport!

    # Scheduled reports
    scheduledReports: [ScheduledReport!]!
    scheduledReport(id: ID!): ScheduledReport

    # Audit presets
    auditPresets: [AuditPreset!]!
    auditPreset(name: String!): AuditPreset

    # Metrics and analytics
    auditMetrics(
      timeRange: TimeRangeInput!
      groupBy: MetricsGroupBy
    ): AuditMetrics!

    # Alerts
    alerts(
      filter: AlertFilter
      pagination: PaginationInput
    ): AlertConnection!
  }

  # Mutation type
  type Mutation {
    # Audit event operations
    createAuditEvent(input: CreateAuditEventInput!): AuditEvent!
    verifyAuditEvent(id: ID!): IntegrityVerificationResult!

    # Scheduled report operations
    createScheduledReport(input: CreateScheduledReportInput!): ScheduledReport!
    updateScheduledReport(
      id: ID!
      input: UpdateScheduledReportInput!
    ): ScheduledReport!
    deleteScheduledReport(id: ID!): Boolean!
    executeScheduledReport(id: ID!): ReportExecution!

    # Audit preset operations
    createAuditPreset(input: CreateAuditPresetInput!): AuditPreset!
    updateAuditPreset(
      name: String!
      input: UpdateAuditPresetInput!
    ): AuditPreset!
    deleteAuditPreset(name: String!): Boolean!

    # Alert operations
    acknowledgeAlert(id: ID!): Alert!
    resolveAlert(id: ID!, resolution: String!): Alert!
  }

  # Subscription type
  type Subscription {
    # Real-time audit events
    auditEventCreated(filter: AuditEventFilter): AuditEvent!

    # Real-time alerts
    alertCreated(severity: AlertSeverity): Alert!

    # System metrics updates
    systemMetricsUpdated: SystemMetrics!

    # Report execution status
    reportExecutionUpdated(reportId: ID!): ReportExecution!
  }
`
