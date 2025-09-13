# Alert Statistics and Analytics

<cite>
**Referenced Files in This Document**   
- [alerts.ts](file://apps/server/src/routers/alerts.ts)
- [charts.ts](file://apps/web/src/utils/charts.ts)
- [database-alert-handler.ts](file://packages/audit/src/monitor/database-alert-handler.ts)
- [monitoring-types.ts](file://packages/audit/src/monitor/monitoring-types.ts)
- [statistics.tsx](file://apps/web/src/routes/dashboard/alerts/statistics.tsx)
- [dashboard.ts](file://packages/audit/src/observability/dashboard.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Statistical Visualization Implementation](#statistical-visualization-implementation)
3. [Data Aggregation Methods](#data-aggregation-methods)
4. [Time-Range Filtering](#time-range-filtering)
5. [Backend Data Retrieval](#backend-data-retrieval)
6. [Frontend Integration](#frontend-integration)
7. [Performance Metrics](#performance-metrics)
8. [Common Issues and Optimizations](#common-issues-and-optimizations)

## Introduction
The Alert Statistics and Analytics dashboard provides comprehensive insights into system alerts through visual representations of key metrics. This document details the implementation of statistical visualizations, data aggregation methods, time-range filtering, and the integration between frontend charting utilities and backend data retrieval via tRPC procedures. The system tracks various performance metrics including alert frequency, severity distribution, and resolution patterns to enable effective monitoring and analysis.

## Statistical Visualization Implementation

The Alert Statistics and Analytics dashboard implements statistical visualizations using Recharts, a React-based charting library. The primary visualization components are pie charts that display alert distributions by severity and type.

The dashboard renders two main pie charts:
- **By Severity**: Shows the distribution of alerts across four severity levels (LOW, MEDIUM, HIGH, CRITICAL)
- **By Type**: Displays the distribution of alerts across different categories (SECURITY, COMPLIANCE, PERFORMANCE, SYSTEM)

Each chart uses a consistent color scheme defined in the chart configuration, with CSS variables for colors that are applied to the chart segments. The charts are responsive and adapt to different screen sizes, with a maximum height constraint to ensure proper display within the dashboard layout.

The visualization implementation includes:
- Card-based layout for organizing different metrics
- Loading states with spinner animation during data retrieval
- Responsive grid layout that adjusts based on screen size
- Tooltip functionality for additional data inspection
- Summary cards displaying key numerical metrics (total, active, resolved alerts)

**Section sources**
- [statistics.tsx](file://apps/web/src/routes/dashboard/alerts/statistics.tsx)

## Data Aggregation Methods

The system employs server-side data aggregation to efficiently calculate alert statistics from the database. The primary aggregation method is implemented in the `DatabaseAlertHandler` class, which executes a single SQL query to calculate multiple statistical metrics simultaneously.

The aggregation query uses conditional counting with CASE statements to calculate statistics by severity and type in a single database round-trip:

```sql
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN resolved = 'false' THEN 1 END) as active,
  COUNT(CASE WHEN acknowledged = 'true' THEN 1 END) as acknowledged,
  COUNT(CASE WHEN resolved = 'true' THEN 1 END) as resolved,
  COUNT(CASE WHEN severity = 'LOW' THEN 1 END) as low_severity,
  COUNT(CASE WHEN severity = 'MEDIUM' THEN 1 END) as medium_severity,
  -- Additional severity and type counts
FROM alerts
```

This approach minimizes database load and network overhead by consolidating multiple aggregation operations into a single query. The results are then transformed into the `AlertStatistics` interface, which includes both summary counts and detailed breakdowns by severity and type.

For time-series data, the system implements additional aggregation methods that group data by time intervals (minute, hour, day). The `aggregateTimeSeriesData` method groups time-stamped metrics into time buckets and calculates averages for continuous metrics and sums for discrete metrics.

**Section sources**
- [database-alert-handler.ts](file://packages/audit/src/monitor/database-alert-handler.ts#L353-L390)
- [dashboard.ts](file://packages/audit/src/observability/dashboard.ts#L493-L549)

## Time-Range Filtering

The analytics system implements time-range filtering through a combination of frontend date selection components and backend query parameters. The primary time-range filtering is handled by the `DateRangePicker` component, which provides both manual date selection and predefined time period presets.

Available time period presets include:
- Last 7 days
- Last 14 days
- Last 30 days
- This week
- Last week
- This month
- Last month

When a time range is selected, the frontend passes the start and end timestamps to backend procedures, which incorporate these parameters into database queries. The system handles time zone adjustments to ensure accurate date filtering across different geographic locations.

For the Alert Statistics dashboard specifically, the current implementation shows aggregate statistics without time filtering, but the underlying infrastructure supports time-based queries. The system could be extended to show historical trends by incorporating time-range parameters into the alert statistics query.

The time-range filtering system also supports comparison mode, allowing users to compare data from different time periods (e.g., current month vs. previous month).

**Section sources**
- [date-range-picker.tsx](file://apps/web/src/components/ui/date-range-picker.tsx)
- [dashboard.ts](file://packages/audit/src/observability/dashboard.ts#L493-L549)

## Backend Data Retrieval

Alert statistics data is retrieved from the backend through dedicated tRPC procedures defined in the alerts router. The system uses tRPC for type-safe API communication between the frontend and backend.

The primary procedure for retrieving alert statistics is the `statistics` query in the alerts router:

```typescript
statistics: protectedProcedure.query(async ({ ctx }) => {
  const { monitor, logger, error } = ctx.services
  const organizationId = ctx.session?.session.activeOrganizationId as string
  try {
    const statistics = await monitor.alert.getAlertStatistics(organizationId)
    return statistics
  } catch (e) {
    // Error handling logic
  }
})
```

This procedure follows a protected pattern that:
1. Extracts the organization ID from the user session
2. Calls the monitoring service to retrieve alert statistics
3. Implements comprehensive error handling with logging and error reporting
4. Returns the statistics data to the frontend

The data retrieval process involves multiple layers:
- **tRPC Router**: Handles the API endpoint and authentication
- **Monitoring Service**: Orchestrates the alert statistics retrieval
- **Database Alert Handler**: Executes the database query and returns results
- **Database Layer**: Performs the actual data aggregation

The system implements proper error handling with detailed logging and error reporting to monitoring services. Errors are transformed into standardized TRPCError objects that include contextual metadata for debugging.

**Section sources**
- [alerts.ts](file://apps/server/src/routers/alerts.ts)
- [database-alert-handler.ts](file://packages/audit/src/monitor/database-alert-handler.ts)

## Frontend Integration

The frontend integration of the Alert Statistics dashboard follows a React-based architecture with React Query for data fetching and state management. The implementation uses the tRPC client to connect to backend procedures and retrieve alert statistics.

Key integration components include:

### Data Fetching and State Management
The dashboard uses React Query's `useQuery` hook to fetch alert statistics from the backend:

```typescript
const { data: statistics, isLoading } = useQuery(trpc.alerts.statistics.queryOptions())
```

This approach provides automatic loading states, error handling, and caching of results to minimize unnecessary network requests.

### Data Transformation
Raw statistical data is transformed into chart-ready formats using utility functions in the `charts.ts` file:

```typescript
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
```

These transformation functions ensure that data is properly formatted for the Recharts library, including setting appropriate fill colors using CSS variables.

### Component Structure
The dashboard is organized into reusable components:
- **Card components**: For displaying summary metrics
- **ChartContainer**: Wrapper for chart components with consistent styling
- **ChartTooltip**: Custom tooltip component for chart interactions
- **PageBreadcrumb**: Navigation breadcrumb component

The layout uses a responsive grid system that adapts to different screen sizes, with cards arranged in rows of three on larger screens and stacked on smaller devices.

**Section sources**
- [statistics.tsx](file://apps/web/src/routes/dashboard/alerts/statistics.tsx)
- [charts.ts](file://apps/web/src/utils/charts.ts)

## Performance Metrics

The system tracks several key performance metrics related to alert processing and system health:

### Alert Statistics Metrics
- **Total alerts**: Overall count of all alerts in the system
- **Active alerts**: Count of unresolved alerts requiring attention
- **Resolved alerts**: Count of alerts that have been addressed
- **Acknowledged alerts**: Count of alerts that have been acknowledged but not resolved
- **By severity distribution**: Breakdown of alerts by severity level (LOW, MEDIUM, HIGH, CRITICAL)
- **By type distribution**: Breakdown of alerts by category (SECURITY, COMPLIANCE, PERFORMANCE, SYSTEM)

### System Performance Metrics
The underlying monitoring system also tracks broader performance metrics that can impact alert generation:
- Events processed per second
- Processing latency (average, p95, p99)
- Queue depth
- Error rate
- Integrity violations
- Suspicious patterns detected

These metrics help identify performance bottlenecks and system issues that may contribute to alert volume. The system uses these metrics to generate performance-related alerts and to provide context for analyzing alert trends.

The Alert Statistics dashboard currently focuses on the alert-specific metrics, but the infrastructure supports integration with broader system performance metrics for more comprehensive analysis.

**Section sources**
- [monitoring-types.ts](file://packages/audit/src/monitor/monitoring-types.ts)
- [dashboard.ts](file://packages/audit/src/observability/dashboard.ts)

## Common Issues and Optimizations

### Data Accuracy
Data accuracy is maintained through several mechanisms:
- **Atomic database operations**: All alert updates use atomic SQL operations to prevent race conditions
- **Consistent aggregation**: Statistics are calculated from the same data source using consistent logic
- **Caching with invalidation**: Results are cached with appropriate TTL to balance performance and freshness

Potential data accuracy issues and their solutions:
- **Race conditions during concurrent updates**: Addressed through database-level locking and atomic operations
- **Data staleness**: Mitigated through appropriate cache invalidation strategies
- **Count discrepancies**: Prevented by using single-query aggregation rather than multiple separate queries

### Handling Incomplete Time Series
For time-series data, the system handles incomplete data through:
- **Gap filling**: When aggregating time series data, missing intervals are filled with zero values or interpolated data
- **Graceful degradation**: Charts display available data even when some time periods have no data points
- **Clear labeling**: Time periods with no data are clearly indicated to avoid misinterpretation

### Backend Query Optimization
Several optimizations improve the performance of analytical queries:

#### Database-Level Optimizations
- **Indexing**: Database indexes on key columns (organization_id, severity, type, resolved) to speed up filtering and aggregation
- **Partitioning**: Table partitioning by time or organization to improve query performance on large datasets
- **Materialized views**: Potential use of materialized views for frequently accessed statistics

#### Application-Level Optimizations
- **Query caching**: Results of expensive aggregation queries are cached with appropriate TTL
- **Connection pooling**: Database connection pooling to reduce connection overhead
- **Batch operations**: When appropriate, batch operations to reduce round trips

#### Code-Level Optimizations
- **Single-query aggregation**: As mentioned earlier, using a single query with CASE statements instead of multiple queries
- **Efficient data transformation**: Minimizing data processing overhead in the application layer
- **Lazy loading**: Loading only necessary data for the current view

The system also implements monitoring for query performance, with logging of slow queries and error handling for database timeouts or failures.

**Section sources**
- [database-alert-handler.ts](file://packages/audit/src/monitor/database-alert-handler.ts)
- [dashboard.ts](file://packages/audit/src/observability/dashboard.ts)
- [alerts.ts](file://apps/server/src/routers/alerts.ts)