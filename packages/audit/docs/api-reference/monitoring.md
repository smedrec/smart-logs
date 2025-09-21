# Monitoring API Reference

Complete API documentation for the monitoring and observability system in the `@repo/audit` package. This reference provides detailed information about real-time metrics collection, health checks, alert management, and performance tracking.

## 📋 Overview

The monitoring system provides comprehensive real-time monitoring and observability for audit system components, including metrics collection, health checks, alert management, and performance tracking with suspicious pattern detection.

## 🔍 Core Interfaces

### Metrics Interfaces

Core metrics collection interfaces for system monitoring.

```typescript
interface AuditMetrics {
  /** Number of events processed */
  eventsProcessed: number
  
  /** Current queue depth */
  queueDepth: number
  
  /** Number of errors generated */
  errorsGenerated: number
  
  /** Error rate percentage (0-1) */
  errorRate: number
  
  /** Number of integrity violations detected */
  integrityViolations: number
  
  /** Metrics timestamp */
  timestamp: string
  
  /** Number of alerts generated */
  alertsGenerated: number
  
  /** Number of suspicious patterns detected */
  suspiciousPatterns: number
  
  /** Processing latency metrics */
  processingLatency: {
    average: number
    p95: number
    p99: number
  }
  
  /** Integrity verification metrics */
  integrityVerifications: {
    total: number
    passed: number
    failed: number
  }
  
  /** Compliance report metrics */
  complianceReports: {
    generated: number
    scheduled: number
    failed: number
  }
}

interface SystemMetrics {
  /** Metrics timestamp */
  timestamp: string
  
  /** Server performance metrics */
  server: {
    uptime: number
    memoryUsage: {
      used: number
      total: number
      percentage: number
    }
    cpuUsage: {
      percentage: number
      loadAverage: number[]
    }
  }
  
  /** Database performance metrics */
  database: {
    connectionCount: number
    activeQueries: number
    averageQueryTime: number
  }
  
  /** Redis cache metrics */
  redis: {
    connectionCount: number
    memoryUsage: number
    keyCount: number
  }
  
  /** API performance metrics */
  api: {
    requestsPerSecond: number
    averageResponseTime: number
    errorRate: number
  }
}
```

### Health Check Interfaces

Health monitoring interfaces for system components.

```typescript
interface HealthStatus {
  /** Overall system health status */
  status: 'OK' | 'WARNING' | 'CRITICAL'
  
  /** Individual component health statuses */
  components: {
    [componentName: string]: ComponentHealth
  }
  
  /** Health check timestamp */
  timestamp: string
}

interface ComponentHealth {
  /** Component health status */
  status: 'OK' | 'WARNING' | 'CRITICAL'
  
  /** Health status message */
  message?: string
  
  /** Additional health details */
  details?: Record<string, any>
  
  /** Response time for health check */
  responseTime?: number
  
  /** Last health check timestamp */
  lastCheck: string
}

interface ComponentHealthCheck {
  /** Component name */
  name: string
  
  /** Perform health check */
  check(): Promise<ComponentHealth>
}
```

### Alert Management Interfaces

Alert system interfaces for security and operational notifications.

```typescript
type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
type AlertType = 'SECURITY' | 'COMPLIANCE' | 'PERFORMANCE' | 'SYSTEM' | 'METRICS'

interface Alert {
  /** Unique alert identifier */
  id: string
  
  /** Alert severity level */
  severity: AlertSeverity
  
  /** Alert type category */
  type: AlertType
  
  /** Alert title */
  title: string
  
  /** Detailed alert description */
  description: string
  
  /** Alert creation timestamp */
  timestamp: string
  
  /** Alert source component */
  source: string
  
  /** Additional alert metadata */
  metadata: Record<string, any>
  
  /** Alert acknowledgment status */
  acknowledged: boolean
  
  /** Acknowledgment timestamp */
  acknowledgedAt?: string
  
  /** User who acknowledged alert */
  acknowledgedBy?: string
  
  /** Alert resolution status */
  resolved: boolean
  
  /** Resolution timestamp */
  resolvedAt?: string
  
  /** User who resolved alert */
  resolvedBy?: string
  
  /** Correlation ID for related alerts */
  correlationId?: string
}

interface OrganizationalAlert extends Alert {
  /** Organization identifier for multi-tenant systems */
  organizationId: string
}

interface AlertStatistics {
  /** Total number of alerts */
  total: number
  
  /** Number of active alerts */
  active: number
  
  /** Number of acknowledged alerts */
  acknowledged: number
  
  /** Number of resolved alerts */
  resolved: number
  
  /** Alert count by severity level */
  bySeverity: Record<AlertSeverity, number>
  
  /** Alert count by type */
  byType: Record<AlertType, number>
}
```

## 📊 MonitoringService Class

The main monitoring service class providing real-time monitoring and alerting capabilities.

```typescript
class MonitoringService {
  constructor(
    config: MonitoringConfig, 
    metricsCollector?: MetricsCollector, 
    logger?: any
  )
  
  /** Add an alert handler for external notifications */
  addAlertHandler(handler: AlertHandler): void
  
  /** Send external alert */
  sendExternalAlert(alert: Alert): Promise<void>
  
  /** Process audit event for monitoring and pattern detection */
  processEvent(event: AuditLogEvent): Promise<void>
  
  /** Detect suspicious patterns in audit events */
  detectSuspiciousPatterns(events: AuditLogEvent[]): Promise<PatternDetectionResult>
  
  /** Generate alert from detected pattern */
  generateAlert(alert: Alert): Promise<void>
  
  /** Get current audit metrics */
  getAuditMetrics(): Promise<AuditMetrics>
  
  /** Get alert statistics */
  getAlertStatistics(organizationId?: string): Promise<AlertStatistics>
  
  /** Acknowledge alert */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean>
  
  /** Resolve alert */
  resolveAlert(
    alertId: string, 
    resolvedBy: string, 
    resolutionData?: AlertResolution
  ): Promise<boolean>
  
  /** Get active alerts */
  getActiveAlerts(organizationId?: string): Promise<Alert[]>
  
  /** Get number of active alerts */
  getNumberOfActiveAlerts(organizationId?: string): Promise<number>
}
```

### Suspicious Pattern Detection

The monitoring service includes advanced pattern detection for security threats.

```typescript
interface PatternDetectionResult {
  /** Detected suspicious patterns */
  patterns: SuspiciousPattern[]
  
  /** Generated alerts from patterns */
  alerts: Alert[]
}

interface SuspiciousPattern {
  /** Pattern type */
  type: 'FAILED_AUTH' | 'UNAUTHORIZED_ACCESS' | 'DATA_VELOCITY' | 'BULK_OPERATION' | 'OFF_HOURS'
  
  /** Pattern severity */
  severity: AlertSeverity
  
  /** Pattern description */
  description: string
  
  /** Related audit events */
  events: AuditLogEvent[]
  
  /** Pattern metadata */
  metadata: Record<string, any>
  
  /** Detection timestamp */
  timestamp: string
}
```

**Pattern Detection Types:**

1. **FAILED_AUTH**: Multiple failed authentication attempts from same principal/IP
2. **UNAUTHORIZED_ACCESS**: Repeated unauthorized access attempts to restricted resources
3. **DATA_VELOCITY**: Abnormally high rate of data access operations
4. **BULK_OPERATION**: Large-scale data operations that may indicate data exfiltration
5. **OFF_HOURS**: Unusual access patterns outside business hours

## 🏥 Health Check System

### HealthCheckService Class

Comprehensive health monitoring for all audit system components.

```typescript
class HealthCheckService {
  constructor(config: HealthCheckConfig)
  
  /** Register component health check */
  registerHealthCheck(healthCheck: ComponentHealthCheck): void
  
  /** Check all registered components */
  checkAll(): Promise<HealthStatus>
  
  /** Check specific component */
  checkComponent(componentName: string): Promise<ComponentHealth>
  
  /** Get overall system health */
  getSystemHealth(): Promise<HealthStatus>
  
  /** Start periodic health checks */
  startPeriodicChecks(interval: number): void
  
  /** Stop periodic health checks */
  stopPeriodicChecks(): void
}

interface HealthCheckConfig {
  /** Health check timeout in milliseconds */
  timeout: number
  
  /** Number of retry attempts */
  retryAttempts: number
  
  /** Delay between retries in milliseconds */
  retryDelay: number
  
  /** Warning thresholds */
  warningThresholds: {
    responseTime: number
    errorRate: number
    queueDepth: number
  }
  
  /** Critical thresholds */
  criticalThresholds: {
    responseTime: number
    errorRate: number
    queueDepth: number
  }
}
```

### Built-in Health Checks

#### DatabaseHealthCheck

Monitors database connectivity and performance.

```typescript
class DatabaseHealthCheck implements ComponentHealthCheck {
  name = 'database'
  
  constructor(checkConnection: () => Promise<boolean>)
  
  async check(): Promise<ComponentHealth>
}

// Usage
const dbHealthCheck = new DatabaseHealthCheck(async () => {
  try {
    await db.query('SELECT 1')
    return true
  } catch {
    return false
  }
})

healthService.registerHealthCheck(dbHealthCheck)
```

#### RedisHealthCheck

Monitors Redis cache connectivity and status.

```typescript
class RedisHealthCheck implements ComponentHealthCheck {
  name = 'redis'
  
  constructor(getConnectionStatus: () => string)
  
  async check(): Promise<ComponentHealth>
}

// Usage
const redisHealthCheck = new RedisHealthCheck(() => {
  return redis.status // 'ready', 'connecting', 'reconnecting', etc.
})

healthService.registerHealthCheck(redisHealthCheck)
```

#### QueueHealthCheck

Monitors queue depth and processing rates.

```typescript
class QueueHealthCheck implements ComponentHealthCheck {
  name = 'queue'
  
  constructor(
    getQueueDepth: () => Promise<number>,
    getProcessingRate: () => Promise<number>
  )
  
  async check(): Promise<ComponentHealth>
}

// Usage
const queueHealthCheck = new QueueHealthCheck(
  async () => await queue.getDepth(),
  async () => await queue.getProcessingRate()
)

healthService.registerHealthCheck(queueHealthCheck)
```

## 📈 Metrics Collection System

### MetricsCollector Interface

Interface for collecting and storing metrics data.

```typescript
interface MetricsCollector {
  /** Record processed event */
  recordEvent(): void
  
  /** Record processing latency */
  recordProcessingLatency(latency: number): void
  
  /** Record queue depth */
  recordQueueDepth(depth: number): void
  
  /** Record error occurrence */
  recordError(error: Error): void
  
  /** Record suspicious pattern detection */
  recordSuspiciousPattern(count: number): void
  
  /** Record integrity verification result */
  recordIntegrityVerification(passed: boolean): void
  
  /** Record compliance report generation */
  recordComplianceReport(status: 'generated' | 'scheduled' | 'failed'): void
  
  /** Get current metrics */
  getMetrics(): Promise<AuditMetrics>
  
  /** Get metrics for time range */
  getMetricsForTimeRange(
    startTime: string, 
    endTime: string
  ): Promise<AuditMetrics[]>
  
  /** Reset metrics */
  resetMetrics(): Promise<void>
}
```

### RedisMetricsCollector Implementation

Redis-based metrics collection with persistence and aggregation.

```typescript
class RedisMetricsCollector implements MetricsCollector {
  constructor(redis: Redis, keyPrefix: string = 'audit:metrics')
  
  // Implementation of MetricsCollector interface
  recordEvent(): void
  recordProcessingLatency(latency: number): void
  recordQueueDepth(depth: number): void
  recordError(error: Error): void
  recordSuspiciousPattern(count: number): void
  recordIntegrityVerification(passed: boolean): void
  recordComplianceReport(status: 'generated' | 'scheduled' | 'failed'): void
  
  async getMetrics(): Promise<AuditMetrics>
  async getMetricsForTimeRange(startTime: string, endTime: string): Promise<AuditMetrics[]>
  async resetMetrics(): Promise<void>
  
  /** Get performance metrics by endpoint */
  async getPerformanceMetrics(): Promise<PerformanceMetrics[]>
  
  /** Get system metrics */
  async getSystemMetrics(): Promise<SystemMetrics>
  
  /** Get endpoint-specific metrics */
  async getEndpointMetrics(endpoint: string): Promise<EndpointMetrics>
}
```

## 🚨 Alert Management System

### AlertHandler Interface

Interface for handling alert notifications and lifecycle management.

```typescript
interface AlertHandler {
  /** Get handler name */
  handlerName(): string
  
  /** Send alert notification */
  sendAlert(alert: Alert): Promise<void>
  
  /** Acknowledge alert */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<{ success: boolean }>
  
  /** Resolve alert */
  resolveAlert(
    alertId: string, 
    resolvedBy: string, 
    resolutionData?: AlertResolution
  ): Promise<{ success: boolean }>
  
  /** Get active alerts */
  getActiveAlerts(organizationId?: string): Promise<Alert[]>
  
  /** Get number of active alerts */
  numberOfActiveAlerts(organizationId?: string): Promise<number>
  
  /** Get alert statistics */
  getAlertStatistics(organizationId?: string): Promise<AlertStatistics>
}

interface AlertResolution {
  /** Resolution notes */
  notes?: string
  
  /** Resolution action taken */
  action?: string
  
  /** Additional resolution metadata */
  metadata?: Record<string, any>
}
```

### Database Alert Handler

Database-backed alert management with persistence and organizational filtering.

```typescript
class DatabaseAlertHandler implements AlertHandler {
  constructor(db: DatabaseConnection)
  
  handlerName(): string
  
  async sendAlert(alert: Alert): Promise<void>
  
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<{ success: boolean }>
  
  async resolveAlert(
    alertId: string, 
    resolvedBy: string, 
    resolutionData?: AlertResolution
  ): Promise<{ success: boolean }>
  
  async getActiveAlerts(organizationId?: string): Promise<Alert[]>
  
  async numberOfActiveAlerts(organizationId?: string): Promise<number>
  
  async getAlertStatistics(organizationId?: string): Promise<AlertStatistics>
  
  /** Get alert history */
  async getAlertHistory(
    organizationId?: string, 
    startTime?: string, 
    endTime?: string
  ): Promise<Alert[]>
  
  /** Get alerts by severity */
  async getAlertsBySeverity(
    severity: AlertSeverity, 
    organizationId?: string
  ): Promise<Alert[]>
  
  /** Get alerts by type */
  async getAlertsByType(
    type: AlertType, 
    organizationId?: string
  ): Promise<Alert[]>
}
```

## 💡 Usage Examples

### Basic Monitoring Setup

```typescript
import { 
  MonitoringService, 
  HealthCheckService,
  DatabaseHealthCheck,
  RedisHealthCheck,
  RedisMetricsCollector
} from '@repo/audit'

// Initialize metrics collector
const metricsCollector = new RedisMetricsCollector(redis)

// Initialize monitoring service
const monitoringService = new MonitoringService(
  monitoringConfig,
  metricsCollector,
  logger
)

// Initialize health check service
const healthService = new HealthCheckService(healthConfig)

// Register health checks
healthService.registerHealthCheck(
  new DatabaseHealthCheck(async () => {
    try {
      await db.query('SELECT 1')
      return true
    } catch {
      return false
    }
  })
)

healthService.registerHealthCheck(
  new RedisHealthCheck(() => redis.status)
)

// Start periodic health checks
healthService.startPeriodicChecks(30000) // Every 30 seconds
```

### Alert Handler Configuration

```typescript
import { DatabaseAlertHandler, EmailAlertHandler, SlackAlertHandler } from '@repo/audit'

// Initialize alert handlers
const dbAlertHandler = new DatabaseAlertHandler(db)
const emailAlertHandler = new EmailAlertHandler(emailConfig)
const slackAlertHandler = new SlackAlertHandler(slackConfig)

// Register alert handlers
monitoringService.addAlertHandler(dbAlertHandler)
monitoringService.addAlertHandler(emailAlertHandler)
monitoringService.addAlertHandler(slackAlertHandler)

// Process audit events with monitoring
await monitoringService.processEvent(auditEvent)
```

### Metrics Collection and Retrieval

```typescript
// Record various metrics
metricsCollector.recordEvent()
metricsCollector.recordProcessingLatency(150) // 150ms
metricsCollector.recordQueueDepth(25)
metricsCollector.recordIntegrityVerification(true)

// Get current metrics
const currentMetrics = await metricsCollector.getMetrics()
console.log('Current metrics:', currentMetrics)

// Get metrics for time range
const historicalMetrics = await metricsCollector.getMetricsForTimeRange(
  '2023-10-26T00:00:00.000Z',
  '2023-10-26T23:59:59.999Z'
)

// Get system performance metrics
const systemMetrics = await metricsCollector.getSystemMetrics()
console.log('System performance:', systemMetrics)
```

### Health Check Monitoring

```typescript
// Check overall system health
const systemHealth = await healthService.getSystemHealth()
console.log('System health:', systemHealth.status)

// Check specific component
const dbHealth = await healthService.checkComponent('database')
if (dbHealth.status === 'CRITICAL') {
  console.error('Database is down:', dbHealth.message)
}

// Get all component statuses
const allHealth = await healthService.checkAll()
for (const [component, health] of Object.entries(allHealth.components)) {
  console.log(`${component}: ${health.status} (${health.responseTime}ms)`)
}
```

### Alert Management

```typescript
// Get active alerts
const activeAlerts = await monitoringService.getActiveAlerts('org-123')
console.log(`Active alerts: ${activeAlerts.length}`)

// Acknowledge an alert
await monitoringService.acknowledgeAlert(
  'alert-456', 
  'security-team@example.com'
)

// Resolve an alert
await monitoringService.resolveAlert(
  'alert-456',
  'security-team@example.com',
  {
    notes: 'False positive - legitimate bulk operation',
    action: 'Whitelist IP address',
    metadata: { 
      whitelistedIp: '192.168.1.100',
      reviewedBy: 'security-analyst'
    }
  }
)

// Get alert statistics
const alertStats = await monitoringService.getAlertStatistics('org-123')
console.log('Alert statistics:', alertStats)
```

### Suspicious Pattern Detection

```typescript
// Custom pattern detection configuration
const patternConfig: PatternDetectionConfig = {
  failedAuthThreshold: 5,
  failedAuthTimeWindow: 300000, // 5 minutes
  unauthorizedAccessThreshold: 3,
  unauthorizedAccessTimeWindow: 600000, // 10 minutes
  dataAccessThreshold: 100,
  dataAccessTimeWindow: 60000, // 1 minute
  bulkOperationThreshold: 50,
  bulkOperationTimeWindow: 300000, // 5 minutes
  offHoursStart: 18, // 6 PM
  offHoursEnd: 8 // 8 AM
}

// Process events for pattern detection
const detectionResult = await monitoringService.detectSuspiciousPatterns([
  ...recentAuditEvents
])

// Handle detected patterns
for (const pattern of detectionResult.patterns) {
  console.log(`Suspicious pattern detected: ${pattern.type}`)
  console.log(`Severity: ${pattern.severity}`)
  console.log(`Description: ${pattern.description}`)
  console.log(`Related events: ${pattern.events.length}`)
}

// Generate alerts for patterns
for (const alert of detectionResult.alerts) {
  await monitoringService.generateAlert(alert)
}
```

## 🔗 Related APIs

- **[Configuration](./configuration.md)** - Monitoring configuration setup
- **[Audit Class](./audit-class.md)** - Integration with audit service
- **[Compliance](./compliance.md)** - Compliance monitoring and alerting
- **[Utilities](./utilities.md)** - Monitoring utility functions

## 📚 Monitoring Best Practices

### Performance Optimization

- **Batch Processing**: Process multiple events together for pattern detection
- **Metrics Aggregation**: Use Redis for efficient metrics storage and retrieval
- **Alerting Throttling**: Implement cooldown periods to prevent alert spam
- **Health Check Intervals**: Balance frequency with system load

### Security Considerations

- **Alert Authentication**: Secure alert endpoints with proper authentication
- **Sensitive Data**: Avoid including sensitive information in alerts
- **Rate Limiting**: Implement rate limiting on alert generation
- **Access Control**: Restrict health check and metrics endpoints

### Operational Guidelines

- **Monitoring Coverage**: Ensure all critical components have health checks
- **Alert Severity**: Use appropriate severity levels for different issues
- **Documentation**: Maintain runbooks for common alerts
- **Testing**: Regularly test alert handlers and health checks

For detailed monitoring setup and configuration guides, see the [Monitoring Setup Guide](../guides/monitoring-setup.md).