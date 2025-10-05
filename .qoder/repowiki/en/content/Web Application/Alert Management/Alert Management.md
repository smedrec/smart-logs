# Alert Management

<cite>
**Referenced Files in This Document**  
- [AlertDashboard.tsx](file://apps/app/src/components/alerts/core/AlertDashboard.tsx) - *Updated in recent commit*
- [AlertList.tsx](file://apps/app/src/components/alerts/core/AlertList.tsx) - *Updated in recent commit*
- [AlertCard.tsx](file://apps/app/src/components/alerts/core/AlertCard.tsx) - *Updated in recent commit*
- [AlertColumns.tsx](file://apps/app/src/components/alerts/data/AlertColumns.tsx) - *Updated in recent commit*
- [alert.ts](file://apps/app/src/lib/types/alert.ts) - *Updated alert type definitions*
- [collections.ts](file://apps/app/src/lib/collections.ts) - *Updated collection schema*
- [alert-types.ts](file://apps/app/src/components/alerts/types/alert-types.ts) - *Updated enum definitions*
</cite>

## Update Summary
**Changes Made**  
- Updated alert property names from `timestamp` to `created_at` and `acknowledgedBy` to `acknowledged_by` across all components
- Refactored alert severity, status, and type enums to use uppercase constants
- Integrated AlertCard component into dashboard board view
- Removed deprecated /alerts/board route
- Updated field names to use snake_case convention (`acknowledged_by` instead of `acknowledgedBy`)
- Enhanced real-time query integration for live alert updates

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Alert Creation and Resolution Workflow](#alert-creation-and-resolution-workflow)
7. [Data Fetching and State Management](#data-fetching-and-state-management)
8. [Filtering, Sorting, and Pagination](#filtering-sorting-and-pagination)
9. [Real-Time Updates and Notification Handling](#real-time-updates-and-notification-handling)
10. [Performance Optimization](#performance-optimization)
11. [Error Handling and Audit Client Integration](#error-handling-and-audit-client-integration)
12. [Background Jobs and Alert Lifecycle Management](#background-jobs-and-alert-lifecycle-management)
13. [Troubleshooting Guide](#troubleshooting-guide)
14. [Conclusion](#conclusion)

## Introduction
The Alert Management system is a critical component of the Smart Logs platform, designed to monitor, detect, and respond to system anomalies and security events. This document provides a comprehensive analysis of the alert management implementation, covering both frontend and backend components. The system enables users to view active and resolved alerts, create new alerts, acknowledge incidents, and manage alert lifecycle through a responsive web interface. The architecture leverages tRPC for type-safe communication, Inngest for background workflows, and a modular package structure to ensure scalability and maintainability.

## Project Structure
The Alert Management system spans multiple applications and packages within the monorepo, following a clean separation of concerns. The frontend components reside in the `web` application, while the backend logic is distributed across the `server`, `inngest`, and shared `packages`. This structure enables independent development and deployment of different system layers.

```mermaid
graph TB
subgraph "Frontend (web)"
UI[Alert UI Components]
DataTable[Data Table]
Form[Alert Form]
Client[Audit Client]
end
subgraph "Backend (server)"
Router[Alerts Router]
Service[Alert Service]
Context[tRPC Context]
end
subgraph "Background (inngest)"
Function[Cleanup Function]
Scheduler[Inngest Scheduler]
end
subgraph "Shared Packages"
Audit[audit Package]
AuditClient[audit-client Package]
AuditDB[audit-db Package]
end
UI --> Client
Client --> Router
Router --> Service
Service --> Audit
Audit --> AuditDB
Scheduler --> Function
Function --> Audit
```

**Diagram sources**
- [apps/app/src/components/alerts](file://apps/app/src/components/alerts)
- [apps/server/src/routers/alerts.ts](file://apps/server/src/routers/alerts.ts)
- [apps/inngest/src/inngest/functions/alerts](file://apps/inngest/src/inngest/functions/alerts)
- [packages/audit](file://packages/audit)

**Section sources**
- [apps/app/src/components/alerts](file://apps/app/src/components/alerts)
- [apps/server/src/routers](file://apps/server/src/routers)
- [packages/audit](file://packages/audit)

## Core Components
The Alert Management system consists of several core components that work together to provide a complete alerting solution. The frontend includes data tables for displaying active and resolved alerts, form components for alert creation, and column definitions for table rendering. The backend provides tRPC routers for API endpoints, monitoring services for alert generation, and background functions for alert cleanup.

**Section sources**
- [apps/app/src/components/alerts](file://apps/app/src/components/alerts)
- [apps/server/src/routers/alerts.ts](file://apps/server/src/routers/alerts.ts)
- [packages/audit/src/monitor](file://packages/audit/src/monitor)

## Architecture Overview
The Alert Management system follows a layered architecture with clear separation between presentation, application logic, and data layers. The frontend communicates with the backend via tRPC, which provides end-to-end type safety. Alerts are generated by monitoring components in the audit package, stored in the database, and exposed through API endpoints. The UI fetches alert data, allows user interaction, and sends commands back to the server.

```mermaid
sequenceDiagram
participant User as "User"
participant UI as "Alert UI"
participant Client as "Audit Client"
participant Server as "Alerts Router"
participant Service as "Monitoring Service"
participant DB as "Database"
User->>UI : View Alerts
UI->>Client : fetchActiveAlerts()
Client->>Server : tRPC query
Server->>Service : getActiveAlerts()
Service->>DB : SELECT active alerts
DB-->>Service : Alert data
Service-->>Server : Return alerts
Server-->>Client : Response
Client-->>UI : Update state
UI-->>User : Display alerts
User->>UI : Resolve Alert
UI->>Client : resolveAlert(id)
Client->>Server : tRPC mutation
Server->>Service : updateAlertStatus(id, resolved)
Service->>DB : UPDATE alert status
DB-->>Service : Confirmation
Service-->>Server : Success
Server-->>Client : Response
Client-->>UI : Update state
UI-->>User : Show success
```

**Diagram sources**
- [apps/app/src/components/alerts/data-table.tsx](file://apps/app/src/components/alerts/data-table.tsx)
- [apps/server/src/routers/alerts.ts](file://apps/server/src/routers/alerts.ts)
- [packages/audit/src/monitor/monitoring.ts](file://packages/audit/src/monitor/monitoring.ts)

## Detailed Component Analysis

### Alert Data Table Components
The alert display system is implemented using two main data table components: one for active alerts and another for resolved alerts. These components use a shared column configuration and leverage a common data fetching mechanism through the audit client. The system has been updated to use `created_at` instead of `timestamp` for consistency with backend naming conventions.

```mermaid
classDiagram
class ActiveAlertsTable {
+data : Alert[]
+loading : boolean
+error : string | null
+render() : JSX.Element
-fetchData() : Promise<void>
}
class ResolvedAlertsTable {
+data : Alert[]
+loading : boolean
+error : string | null
+render() : JSX.Element
-fetchData() : Promise<void>
}
class AlertColumns {
+id : ColumnDef
+severity : ColumnDef
+message : ColumnDef
+created_at : ColumnDef
+status : ColumnDef
+actions : ColumnDef
+getColumns() : ColumnDef[]
}
ActiveAlertsTable --> AlertColumns : "uses"
ResolvedAlertsTable --> AlertColumns : "uses"
ActiveAlertsTable --> AuditClient : "depends on"
ResolvedAlertsTable --> AuditClient : "depends on"
```

**Diagram sources**
- [apps/app/src/components/alerts/data-table.tsx](file://apps/app/src/components/alerts/data-table.tsx)
- [apps/app/src/components/alerts/data-table-resolved.tsx](file://apps/app/src/components/alerts/data-table-resolved.tsx)
- [apps/app/src/components/alerts/columns.tsx](file://apps/app/src/components/alerts/columns.tsx)

**Section sources**
- [apps/app/src/components/alerts/data-table.tsx](file://apps/app/src/components/alerts/data-table.tsx)
- [apps/app/src/components/alerts/data-table-resolved.tsx](file://apps/app/src/components/alerts/data-table-resolved.tsx)
- [apps/app/src/components/alerts/columns.tsx](file://apps/app/src/components/alerts/columns.tsx)

### Alert Form Component
The alert creation form provides a user interface for manually creating new alerts. It includes validation logic and integrates with the audit client to submit new alerts to the backend system. The form has been updated to use consistent field naming conventions with the backend.

```mermaid
flowchart TD
Start([Form Render]) --> RenderForm["Render Form Fields"]
RenderForm --> UserInput["User Enters Alert Data"]
UserInput --> ValidateInput["Validate Form Input"]
ValidateInput --> Valid{"Input Valid?"}
Valid --> |No| ShowError["Show Validation Errors"]
Valid --> |Yes| SubmitForm["Submit Form"]
SubmitForm --> CallAPI["Call auditClient.createAlert()"]
CallAPI --> Processing["Show Loading State"]
Processing --> APIResponse{"Success?"}
APIResponse --> |No| HandleError["Show Error Message"]
APIResponse --> |Yes| ResetForm["Reset Form Fields"]
ResetForm --> ShowSuccess["Show Success Message"]
ShowSuccess --> End([Form Complete])
ShowError --> UserInput
HandleError --> UserInput
```

**Diagram sources**
- [apps/app/src/components/alerts/form.tsx](file://apps/app/src/components/alerts/form.tsx)
- [apps/app/src/lib/audit-client.ts](file://apps/app/src/lib/audit-client.ts)

**Section sources**
- [apps/app/src/components/alerts/form.tsx](file://apps/app/src/components/alerts/form.tsx)

## Alert Creation and Resolution Workflow
The alert management system supports both automated and manual alert creation, with a well-defined workflow for alert resolution. When an alert is created, it transitions through various states from active to resolved, with proper audit logging at each step. The system now uses uppercase constants for alert severity, status, and type enums.

```mermaid
stateDiagram-v2
[*] --> Idle
Idle --> AlertCreated : "alert triggered"
AlertCreated --> Active : "persisted to DB"
Active --> Acknowledged : "user acknowledges"
Acknowledged --> Resolving : "investigation begins"
Resolving --> Resolved : "issue fixed"
Resolving --> Active : "issue persists"
Resolved --> Closed : "verified and closed"
Closed --> [*]
note right of Active
Notifications sent
Dashboard updated
Real-time alerts
end note
note right of Resolving
Root cause analysis
Remediation steps
Documentation
end note
```

**Diagram sources**
- [apps/app/src/components/alerts/form.tsx](file://apps/app/src/components/alerts/form.tsx)
- [apps/server/src/routers/alerts.ts](file://apps/server/src/routers/alerts.ts)
- [packages/audit/src/monitor/database-alert-handler.ts](file://packages/audit/src/monitor/database-alert-handler.ts)

**Section sources**
- [apps/app/src/components/alerts/form.tsx](file://apps/app/src/components/alerts/form.tsx)
- [apps/server/src/routers/alerts.ts](file://apps/server/src/routers/alerts.ts)

## Data Fetching and State Management
The Alert Management system uses tRPC for data fetching, providing type-safe API communication between the frontend and backend. The audit client encapsulates all API calls, ensuring consistent error handling and authentication. The system has been updated to use real-time queries for live data updates.

```mermaid
sequenceDiagram
participant UI as "Alerts UI"
participant Client as "Audit Client"
participant TRPC as "tRPC Client"
participant Server as "tRPC Server"
participant Router as "Alerts Router"
participant Service as "Alert Service"
UI->>Client : getActiveAlerts(params)
Client->>TRPC : query('alerts.active', params)
TRPC->>Server : HTTP Request
Server->>Router : Route request
Router->>Service : service.getActiveAlerts(params)
Service-->>Router : Return alerts
Router-->>Server : Response
Server-->>TRPC : JSON Response
TRPC-->>Client : Parsed data
Client-->>UI : Update state
```

**Diagram sources**
- [apps/app/src/lib/audit-client.ts](file://apps/app/src/lib/audit-client.ts)
- [apps/server/src/routers/alerts.ts](file://apps/server/src/routers/alerts.ts)
- [apps/app/src/utils/trpc.ts](file://apps/app/src/utils/trpc.ts)

**Section sources**
- [apps/app/src/lib/audit-client.ts](file://apps/app/src/lib/audit-client.ts)
- [apps/server/src/routers/alerts.ts](file://apps/server/src/routers/alerts.ts)

## Filtering, Sorting, and Pagination
The alert tables support comprehensive data manipulation features including filtering, sorting, and pagination. These features are implemented consistently across both active and resolved alert views, with parameters passed through the tRPC API to the backend. The system now sorts by `created_at` field and uses snake_case for all field names.

```mermaid
flowchart TD
A([User Interaction]) --> B["User applies filter/sort/pagination"]
B --> C["Update URL search parameters"]
C --> D["Trigger data refetch"]
D --> E["auditClient.fetchAlerts(filters)"]
E --> F["tRPC request with query params"]
F --> G["Server processes query"]
G --> H["Database query with WHERE, ORDER BY, LIMIT/OFFSET"]
H --> I["Return paginated results"]
I --> J["Update table display"]
J --> K["Update URL with new state"]
K --> L["Enable bookmarking/shareable links"]
```

**Diagram sources**
- [apps/app/src/components/alerts/data-table.tsx](file://apps/app/src/components/alerts/data-table.tsx)
- [apps/app/src/lib/searchParams.ts](file://apps/app/src/lib/searchParams.ts)
- [apps/server/src/routers/alerts.ts](file://apps/server/src/routers/alerts.ts)

**Section sources**
- [apps/app/src/components/alerts/data-table.tsx](file://apps/app/src/components/alerts/data-table.tsx)
- [apps/app/src/lib/searchParams.ts](file://apps/app/src/lib/searchParams.ts)

## Real-Time Updates and Notification Handling
The system handles real-time updates through a combination of polling and background processing. While WebSockets are not explicitly implemented, the architecture supports frequent polling to ensure users see the latest alert status. The system has been enhanced with real-time query integration for live updates.

```mermaid
sequenceDiagram
participant UI as "Alerts UI"
participant Hook as "useEffect Hook"
participant Client as "Audit Client"
participant Server as "Alerts API"
participant DB as "Database"
participant Monitor as "Monitoring Service"
loop Polling Interval (30s)
Hook->>Client : trigger refetch
Client->>Server : GET /alerts/active
Server->>DB : Query active alerts
DB-->>Server : Return results
Server-->>Client : JSON response
Client-->>UI : Update state
alt New alerts detected
UI->>UI : Visual notification
UI->>UI : Play alert sound
end
end
Monitor->>DB : Insert new alert
DB-->>Server : Change detected
Server-->>Client : Next poll returns updated data
```

**Diagram sources**
- [apps/app/src/components/alerts/data-table.tsx](file://apps/app/src/components/alerts/data-table.tsx)
- [packages/audit/src/monitor/monitoring.ts](file://packages/audit/src/monitor/monitoring.ts)
- [apps/server/src/routers/alerts.ts](file://apps/server/src/routers/alerts.ts)

**Section sources**
- [apps/app/src/components/alerts/data-table.tsx](file://apps/app/src/components/alerts/data-table.tsx)
- [packages/audit/src/monitor/monitoring.ts](file://packages/audit/src/monitor/monitoring.ts)

## Performance Optimization
The Alert Management system implements several performance optimizations to handle large volumes of alerts efficiently. These include database indexing, query optimization, and client-side caching strategies. The system uses consistent field naming (`created_at`, `acknowledged_by`) for better query performance.

```mermaid
graph TD
A[Performance Challenges] --> B[Large Alert Volumes]
A --> C[Frequent Queries]
A --> D[Real-time Requirements]
B --> E[Database Partitioning]
C --> F[Query Optimization]
D --> G[Caching Strategy]
E --> H["Partition by created_at"]
E --> I["Index on status, severity"]
F --> J["Use LIMIT/OFFSET"]
F --> K["Optimize WHERE clauses"]
G --> L["Client-side caching"]
G --> M["Cache invalidation on mutation"]
H --> N[Improved query performance]
I --> N
J --> N
K --> N
L --> O[Reduced server load]
M --> O
```

**Diagram sources**
- [packages/audit-db/src/db/partitioning.ts](file://packages/audit-db/src/db/partitioning.ts)
- [packages/audit-db/src/db/schema.ts](file://packages/audit-db/src/db/schema.ts)
- [packages/audit-db/src/cache/redis-query-cache.ts](file://packages/audit-db/src/cache/redis-query-cache.ts)

**Section sources**
- [packages/audit-db/src/db/partitioning.ts](file://packages/audit-db/src/db/partitioning.ts)
- [packages/audit-db/src/cache/redis-query-cache.ts](file://packages/audit-db/src/cache/redis-query-cache.ts)

## Error Handling and Audit Client Integration
The system implements robust error handling through the audit client, which wraps all API calls with consistent error management. This ensures that users receive meaningful feedback when operations fail. The client has been updated to handle the new field naming conventions.

```mermaid
sequenceDiagram
participant UI as "Alerts UI"
participant Client as "Audit Client"
participant TRPC as "tRPC Client"
participant Server as "Server"
participant Error as "Error Handler"
UI->>Client : createAlert(data)
Client->>TRPC : mutation call
TRPC->>Server : HTTP request
alt Success
Server-->>TRPC : 200 OK
TRPC-->>Client : Success result
Client-->>UI : Return success
else Error
Server-->>TRPC : 4xx/5xx
TRPC-->>Client : Error object
Client->>Error : processError()
Error-->>Client : User-friendly message
Client-->>UI : Show error notification
end
```

**Diagram sources**
- [apps/app/src/lib/audit-client.ts](file://apps/app/src/lib/audit-client.ts)
- [apps/server/src/lib/errors/unified-handler.ts](file://apps/server/src/lib/errors/unified-handler.ts)
- [packages/audit/src/error/error-handling.ts](file://packages/audit/src/error/error-handling.ts)

**Section sources**
- [apps/app/src/lib/audit-client.ts](file://apps/app/src/lib/audit-client.ts)
- [apps/server/src/lib/errors/unified-handler.ts](file://apps/server/src/lib/errors/unified-handler.ts)

## Background Jobs and Alert Lifecycle Management
The system uses Inngest to manage background jobs for alert lifecycle management, including automated cleanup of old alerts. This ensures the database remains performant by removing resolved alerts that are no longer needed.

```mermaid
flowchart TD
A[Inngest Scheduler] --> B["Trigger cleanup-old-alerts daily"]
B --> C["Query for resolved alerts older than 30 days"]
C --> D["Delete expired alerts"]
D --> E["Log cleanup operation"]
E --> F["Send summary to admin"]
F --> G["Complete"]
subgraph "Cleanup Function"
C
D
E
F
end
subgraph "Monitoring"
H["Monitor alert volume"]
I["Detect cleanup failures"]
J["Alert on anomalies"]
end
G --> H
H --> I
I --> J
```

**Diagram sources**
- [apps/inngest/src/inngest/functions/alerts/cleanup-old-alerts.ts](file://apps/inngest/src/inngest/functions/alerts/cleanup-old-alerts.ts)
- [packages/audit/src/monitor/database-alert-handler.ts](file://packages/audit/src/monitor/database-alert-handler.ts)

**Section sources**
- [apps/inngest/src/inngest/functions/alerts/cleanup-old-alerts.ts](file://apps/inngest/src/inngest/functions/alerts/cleanup-old-alerts.ts)

## Troubleshooting Guide
This section addresses common issues encountered when working with the Alert Management system and provides solutions for diagnosis and resolution.

### Common Issues and Solutions
- **Alerts not appearing in UI**: Verify that the tRPC query is being called and check browser developer tools for network errors. Ensure the user has appropriate permissions to view alerts.
- **Slow performance with large alert volumes**: Check database indexing on the alerts table, particularly on status and created_at fields. Verify that partitioning is properly configured.
- **Failed alert creation**: Examine the form validation rules and ensure all required fields are provided. Check server logs for validation errors.
- **Real-time updates not working**: Verify the polling interval in the UI component and check that the monitoring service is actively generating alerts.
- **Background cleanup not running**: Check Inngest dashboard for function execution history and verify the schedule is properly configured.

**Section sources**
- [apps/app/src/components/alerts/data-table.tsx](file://apps/app/src/components/alerts/data-table.tsx)
- [apps/server/src/routers/alerts.ts](file://apps/server/src/routers/alerts.ts)
- [apps/inngest/src/inngest/functions/alerts/cleanup-old-alerts.ts](file://apps/inngest/src/inngest/functions/alerts/cleanup-old-alerts.ts)

## Conclusion
The Alert Management system provides a comprehensive solution for monitoring and responding to system events within the Smart Logs platform. Its architecture leverages modern TypeScript patterns with tRPC for type-safe API communication, a clean separation of concerns between frontend and backend components, and background processing for lifecycle management. The system is designed to handle large volumes of alerts efficiently through database optimization and caching strategies. Future enhancements could include real-time WebSocket updates, advanced alert correlation, and machine learning-based anomaly detection to further improve the system's effectiveness.