# Alert Management System

<cite>
**Referenced Files in This Document**   
- [AlertDashboard.tsx](file://apps/app/src/components/alerts/core/AlertDashboard.tsx) - *Updated in recent commit*
- [AlertDataTable.tsx](file://apps/app/src/components/alerts/data/AlertDataTable.tsx) - *Refactored for modularity*
- [details-dialog.tsx](file://apps/app/src/components/alerts/data/details-dialog.tsx) - *Added in recent commit*
- [AlertColumns.tsx](file://apps/app/src/components/alerts/data/AlertColumns.tsx) - *Updated in recent commit*
- [AlertList.tsx](file://apps/app/src/components/alerts/core/AlertList.tsx) - *Standardized properties*
- [app-sidebar.tsx](file://apps/app/src/components/app-sidebar.tsx) - *Added navigation*
- [routes.ts](file://apps/app/src/lib/routes.ts) - *Added new route*
- [page-header.tsx](file://apps/app/src/components/navigation/page-header.tsx) - *Added keyboard shortcuts*
- [active.tsx](file://apps/app/src/routes/_authenticated/alerts/active.tsx) - *Added page header*
- [alerts.ts](file://apps/server/src/routes/alerts.ts) - *Refactored to dedicated service*
- [context.ts](file://apps/server/src/lib/hono/context.ts) - *Modified for new service*
</cite>

## Update Summary
**Changes Made**   
- Updated documentation to reflect new alert details view and all alerts data page
- Added documentation for keyboard shortcuts and page headers
- Updated component structure to reflect refactored data table and standardized properties
- Added new route and navigation documentation
- Updated API integration section to reflect service extraction
- Enhanced source tracking with specific file references and change annotations

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
The Alert Management System is a comprehensive solution for monitoring, managing, and responding to system alerts within the SMEDREC healthcare audit platform. This system provides real-time alert notifications, comprehensive filtering capabilities, and multiple visualization options for alert data. The system is designed to handle various alert types including system, security, performance, compliance, and custom alerts with different severity levels from critical to informational.

The Alert Management System integrates with the existing Audit Client and leverages TanStack Query for efficient data management, TanStack Router for navigation, and WebSocket connections for real-time updates. The system follows a modular architecture with clearly defined components for different aspects of alert management, ensuring maintainability and scalability.

## Project Structure
The Alert Management System is organized in a modular structure within the application's components directory. The system follows a feature-based organization pattern with dedicated subdirectories for different functional areas.

```mermaid
graph TD
A[Alerts] --> B[core]
A --> C[forms]
A --> D[data]
A --> E[ui]
A --> F[error]
A --> G[layout]
A --> H[notifications]
A --> I[types]
A --> J[hooks]
B --> B1[AlertDashboard]
B --> B2[AlertList]
B --> B3[AlertCard]
B --> B4[AlertDetails]
C --> C1[AlertFilters]
C --> C2[AlertActions]
C --> C3[BulkActions]
C --> C4[AlertActionDialog]
D --> D1[AlertDataTable]
D --> D2[AlertColumns]
D --> D3[AlertPagination]
D --> D4[AlertTableToolbar]
D --> D5[details-dialog]
E --> E1[AlertBadge]
E --> E2[AlertIcon]
E --> E3[AlertSkeleton]
E --> E4[AlertEmptyState]
F --> F1[AlertErrorBoundary]
F --> F2[AlertErrorAlert]
F --> F3[AlertLoadingStates]
F --> F4[AlertValidationFeedback]
G --> G1[AlertLayout]
G --> G2[AlertPage]
G --> G3[AlertSection]
H --> H1[NotificationBell]
H --> H2[NotificationPanel]
H --> H3[NotificationItem]
I --> I1[alert-types]
I --> I2[api-types]
I --> I3[filter-types]
I --> I4[notification-types]
I --> I5[settings-types]
J --> J1[use-alert-queries]
J --> J2[use-alert-websocket]
J --> J3[use-alert-keyboard-navigation]
J --> J4[use-alert-responsive]
```

**Diagram sources**
- [AlertDashboard.tsx](file://apps/app/src/components/alerts/core/AlertDashboard.tsx)
- [AlertFilters.tsx](file://apps/app/src/components/alerts/forms/AlertFilters.tsx)
- [AlertDataTable.tsx](file://apps/app/src/components/alerts/data/AlertDataTable.tsx)
- [details-dialog.tsx](file://apps/app/src/components/alerts/data/details-dialog.tsx)
- [alert-types.ts](file://apps/app/src/components/alerts/types/alert-types.ts)

**Section sources**
- [README.md](file://apps/app/src/components/alerts/README.md)

## Core Components
The Alert Management System consists of several core components that work together to provide a comprehensive alert management solution. The system is built around a modular architecture with clearly defined responsibilities for each component.

The AlertDashboard component serves as the main container for the alert management interface, providing navigation between different views (list, board, and statistics) and displaying summary information about the current alert state. The AlertDataTable component provides an advanced data table for displaying alerts with sorting, filtering, and pagination capabilities. The AlertFilters component offers comprehensive filtering options for alerts based on severity, type, status, source, date range, search, and tags.

The system also includes notification components such as NotificationBell and NotificationPanel that provide real-time alert notifications with the ability to mark notifications as read or dismiss them. The AlertCard component displays individual alerts in a compact format suitable for board views, while AlertDetails provides a more comprehensive view of a specific alert.

A new AlertDetailsDialog component has been added to display detailed alert information in a modal dialog, accessible from the data table. The system now includes a dedicated ALERTS_DATA route for viewing all alerts, with navigation available in the app sidebar.

**Section sources**
- [AlertDashboard.tsx](file://apps/app/src/components/alerts/core/AlertDashboard.tsx)
- [AlertDataTable.tsx](file://apps/app/src/components/alerts/data/AlertDataTable.tsx)
- [AlertFilters.tsx](file://apps/app/src/components/alerts/forms/AlertFilters.tsx)
- [NotificationPanel.tsx](file://apps/app/src/components/alerts/notifications/NotificationPanel.tsx)
- [AlertCard.tsx](file://apps/app/src/components/alerts/core/AlertCard.tsx)
- [details-dialog.tsx](file://apps/app/src/components/alerts/data/details-dialog.tsx)

## Architecture Overview
The Alert Management System follows a layered architecture with clear separation of concerns between presentation, business logic, and data access layers. The system leverages React Context for global state management and TanStack Query for data fetching and caching.

```mermaid
graph TD
A[UI Components] --> B[Alert Context]
B --> C[TanStack Query]
C --> D[Alert API Service]
D --> E[Audit Client]
E --> F[REST API]
F --> G[Server]
H[WebSocket] --> I[Alert Context]
I --> A
J[User Actions] --> A
A --> K[Query Client]
K --> L[Cache]
style A fill:#f9f,stroke:#333
style B fill:#bbf,stroke:#333
style C fill:#bbf,stroke:#333
style D fill:#bbf,stroke:#333
style E fill:#bbf,stroke:#333
style F fill:#f96,stroke:#333
style G fill:#f96,stroke:#333
style H fill:#6f9,stroke:#333
style I fill:#bbf,stroke:#333
style J fill:#ff9,stroke:#333
style K fill:#bbf,stroke:#333
style L fill:#bbf,stroke:#333
```

**Diagram sources**
- [alert-provider.tsx](file://apps/app/src/contexts/alert-provider.tsx)
- [alert-api.ts](file://apps/app/src/lib/services/alert-api.ts)
- [use-alert-queries.ts](file://apps/app/src/components/alerts/hooks/use-alert-queries.ts)
- [use-alert-websocket.ts](file://apps/app/src/components/alerts/hooks/use-alert-websocket.ts)

## Detailed Component Analysis

### Alert Context and State Management
The Alert Management System uses a React Context-based approach for global state management, providing a centralized store for alert-related data and functionality.

```mermaid
classDiagram
class AlertContextState {
+isConnected : boolean
+connectionStatus : ConnectionStatus
+lastUpdate : Date | null
+notifications : AlertNotification[]
+unreadCount : number
+newAlertsCount : number
+statistics : AlertStatistics | null
+statisticsLoading : boolean
+organizationId : string | null
+error : string | null
}
class AlertContextActions {
+connect() : Promise~void~
+disconnect() : void
+markNotificationAsRead(notificationId : string) : void
+markAllNotificationsAsRead() : void
+dismissNotification(notificationId : string) : void
+clearNewAlertsCount() : void
+refreshStatistics() : Promise~void~
+setOrganizationId(organizationId : string) : void
+clearError() : void
}
class AlertContextValue {
<<interface>>
+isConnected : boolean
+connectionStatus : ConnectionStatus
+lastUpdate : Date | null
+notifications : AlertNotification[]
+unreadCount : number
+newAlertsCount : number
+statistics : AlertStatistics | null
+statisticsLoading : boolean
+organizationId : string | null
+error : string | null
+connect() : Promise~void~
+disconnect() : void
+markNotificationAsRead(notificationId : string) : void
+markAllNotificationsAsRead() : void
+dismissNotification(notificationId : string) : void
+clearNewAlertsCount() : void
+refreshStatistics() : Promise~void~
+setOrganizationId(organizationId : string) : void
+clearError() : void
}
class AlertProvider {
+children : ReactNode
+organizationId? : string
+enableRealTime? : boolean
+enableNotifications? : boolean
+maxNotifications? : number
}
AlertContextState <|-- AlertContextValue
AlertContextActions <|-- AlertContextValue
AlertProvider --> AlertContextValue : "provides"
```

**Diagram sources**
- [alert-provider.tsx](file://apps/app/src/contexts/alert-provider.tsx)

**Section sources**
- [alert-provider.tsx](file://apps/app/src/contexts/alert-provider.tsx)

### Data Model and Type Definitions
The Alert Management System uses a comprehensive type system to ensure type safety and provide clear interfaces for alert data.

```mermaid
classDiagram
class AlertSeverity {
<<enumeration>>
CRITICAL
HIGH
MEDIUM
LOW
INFO
}
class AlertType {
<<enumeration>>
SYSTEM
SECURITY
PERFORMANCE
COMPLIANCE
METRICS
CUSTOM
}
class AlertStatus {
<<enumeration>>
ACTIVE
ACKNOWLEDGED
RESOLVED
DISMISSED
}
class AlertUI {
+id : string
+title : string
+description? : string
+severity : AlertSeverity
+type : AlertType
+status : AlertStatus
+source : string
+created_at : Date
+acknowledged_at? : Date
+acknowledged_by? : string
+resolved_at? : Date
+resolved_by? : string
+resolution_notes? : string
+metadata : Record~string, any~
+tags : string[]
+correlation_id? : string
}
class AlertStatistics {
+total : number
+active : number
+acknowledged : number
+resolved : number
+dismissed : number
+by_severity : Record~AlertSeverity, number~
+by_type : Record~AlertType, number~
+by_source : Record~string, number~
+trends : {
period : string
created : number
resolved : number
}[]
}
class AlertNotification {
+id : string
+alert_id : string
+title : string
+message : string
+severity : 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
+timestamp : Date
+read : boolean
+action_url? : string
}
AlertUI --> AlertSeverity
AlertUI --> AlertType
AlertUI --> AlertStatus
AlertStatistics --> AlertSeverity
AlertStatistics --> AlertType
AlertNotification --> AlertSeverity
```

**Diagram sources**
- [alert-types.ts](file://apps/app/src/components/alerts/types/alert-types.ts)

**Section sources**
- [alert-types.ts](file://apps/app/src/components/alerts/types/alert-types.ts)

### API Integration and Data Flow
The Alert Management System integrates with the backend through a service layer that handles API communication and data transformation. The API routes have been refactored to a dedicated alerts service for better modularity and standardization.

```mermaid
sequenceDiagram
participant UI as UI Component
participant Context as AlertContext
participant Query as TanStack Query
participant Service as AlertApiService
participant Client as AuditClient
participant API as REST API
participant Server as Server
UI->>Context : Request alert data
Context->>Query : Query with filters
Query->>Service : getAlerts(request)
Service->>Client : metrics.getAlerts(params)
Client->>API : HTTP Request
API->>Server : Process request
Server-->>API : Return data
API-->>Client : Response
Client-->>Service : Alert data
Service-->>Query : Transformed data
Query-->>Context : Data with metadata
Context-->>UI : Alert data
Note over UI,Context : Data fetching flow
Server->>Client : WebSocket message
Client->>Service : onAlertCreated
Service->>Query : setQueryData
Query->>Context : Invalidate queries
Context->>UI : Real-time update
Note over Server,UI : Real-time update flow
```

**Diagram sources**
- [alerts.ts](file://apps/server/src/routes/alerts.ts)
- [context.ts](file://apps/server/src/lib/hono/context.ts)
- [use-alert-queries.ts](file://apps/app/src/components/alerts/hooks/use-alert-queries.ts)
- [use-alert-websocket.ts](file://apps/app/src/components/alerts/hooks/use-alert-websocket.ts)

**Section sources**
- [alerts.ts](file://apps/server/src/routes/alerts.ts)
- [context.ts](file://apps/server/src/lib/hono/context.ts)
- [use-alert-queries.ts](file://apps/app/src/components/alerts/hooks/use-alert-queries.ts)

### API Interface and Integration Patterns
The Alert Management System exposes a comprehensive API interface for integration with other systems and components.

```mermaid
flowchart TD
A[API Request] --> B{Request Type}
B --> C[GET /alerts]
B --> D[GET /alerts/:id]
B --> E[GET /alerts/statistics]
B --> F[POST /alerts/:id/acknowledge]
B --> G[POST /alerts/:id/resolve]
B --> H[POST /alerts/:id/dismiss]
B --> I[POST /alerts/bulk]
C --> J[Apply Filters]
J --> K[Apply Sorting]
K --> L[Apply Pagination]
L --> M[Query Database]
M --> N[Transform Response]
N --> O[Return Alerts]
D --> P[Query Database]
P --> Q[Transform Response]
Q --> R[Return Alert]
E --> S[Aggregate Statistics]
S --> T[Return Statistics]
F --> U[Update Alert Status]
U --> V[Record Action]
V --> W[Return Result]
G --> X[Update Alert Status]
X --> Y[Record Resolution]
Y --> Z[Return Result]
H --> AA[Update Alert Status]
AA --> AB[Record Action]
AB --> AC[Return Result]
I --> AD[Process Each Alert]
AD --> AE{Action Type}
AE --> AF[Acknowledge]
AE --> AG[Resolve]
AE --> AH[Dismiss]
AF --> AI[Update Status]
AG --> AJ[Update Status]
AH --> AK[Update Status]
AI --> AL[Record Action]
AJ --> AM[Record Action]
AK --> AN[Record Action]
AL --> AO[Return Results]
AM --> AO
AN --> AO
```

**Diagram sources**
- [alerts.ts](file://apps/server/src/routes/alerts.ts)
- [context.ts](file://apps/server/src/lib/hono/context.ts)

**Section sources**
- [alerts.ts](file://apps/server/src/routes/alerts.ts)
- [context.ts](file://apps/server/src/lib/hono/context.ts)

## Dependency Analysis
The Alert Management System has a well-defined dependency structure that ensures loose coupling between components while maintaining clear integration points with external systems.

```mermaid
graph TD
A[Alert Components] --> B[Alert Context]
B --> C[TanStack Query]
C --> D[Alert API Service]
D --> E[Audit Client]
E --> F[REST API]
F --> G[Server]
H[WebSocket] --> B
I[User Actions] --> A
J[Theme Provider] --> A
K[Auth Provider] --> B
L[Query Client] --> C
M[Cache] --> C
style A fill:#f9f,stroke:#333
style B fill:#bbf,stroke:#333
style C fill:#bbf,stroke:#333
style D fill:#bbf,stroke:#333
style E fill:#bbf,stroke:#333
style F fill:#f96,stroke:#333
style G fill:#f96,stroke:#333
style H fill:#6f9,stroke:#333
style I fill:#ff9,stroke:#333
style J fill:#99f,stroke:#333
style K fill:#99f,stroke:#333
style L fill:#99f,stroke:#333
style M fill:#99f,stroke:#333
```

**Diagram sources**
- [package.json](file://package.json)

**Section sources**
- [alert-provider.tsx](file://apps/app/src/contexts/alert-provider.tsx)
- [alert-api.ts](file://apps/app/src/lib/services/alert-api.ts)

## Performance Considerations
The Alert Management System incorporates several performance optimizations to ensure responsive user experience even with large datasets:

1. **Caching**: The system uses TanStack Query for efficient data caching with configurable stale and cache times. The AlertApiService also includes an optional cache layer for frequently accessed data like statistics.

2. **Pagination**: All list endpoints support pagination to limit the amount of data transferred and rendered at once. The default page size is 25 items with configurable limits.

3. **Virtual Scrolling**: The AlertDataTable component supports virtual scrolling for large datasets, rendering only visible rows to improve performance.

4. **Debounced Search**: Search inputs use debouncing (300ms) to prevent excessive API calls during typing.

5. **Real-time Updates**: WebSocket connections provide real-time updates without the need for polling, reducing server load and improving responsiveness.

6. **Optimistic Updates**: The system implements optimistic updates for actions like acknowledging or resolving alerts, providing immediate feedback to users while the operation completes in the background.

7. **Code Splitting**: Components are organized to enable code splitting, loading only the necessary code for the current view.

8. **Efficient Re-renders**: The system uses React's memoization features and careful state management to minimize unnecessary re-renders.

## Troubleshooting Guide
This section provides guidance for common issues encountered when working with the Alert Management System.

**Section sources**
- [alert-provider.tsx](file://apps/app/src/contexts/alert-provider.tsx)
- [alert-api.ts](file://apps/app/src/lib/services/alert-api.ts)
- [use-alert-websocket.ts](file://apps/app/src/components/alerts/hooks/use-alert-websocket.ts)

### Common Issues and Solutions

1. **WebSocket Connection Issues**
   - **Symptoms**: Real-time updates not working, connection status showing as disconnected
   - **Causes**: Network connectivity issues, authentication problems, server-side WebSocket configuration
   - **Solutions**: 
     - Verify network connectivity
     - Check authentication token validity
     - Ensure WebSocket URL is correctly configured in environment variables
     - Review server logs for WebSocket connection errors

2. **Slow Data Loading**
   - **Symptoms**: Delays when loading alert lists or statistics
   - **Causes**: Large datasets, network latency, inefficient queries
   - **Solutions**:
     - Implement or verify proper pagination
     - Check database query performance
     - Ensure caching is properly configured
     - Optimize filter conditions to reduce result set size

3. **Missing Real-time Notifications**
   - **Symptoms**: New alerts not appearing in real-time, notification count not updating
   - **Causes**: WebSocket connection issues, event filtering, client-side processing errors
   - **Solutions**:
     - Verify WebSocket connection status
     - Check that the correct organization ID is set
     - Ensure event handlers are properly registered
     - Review browser console for JavaScript errors

4. **Authentication Errors**
   - **Symptoms**: 401 or 403 errors when accessing alert data
   - **Causes**: Expired session, insufficient permissions, incorrect API key
   - **Solutions**:
     - Refresh authentication token
     - Verify user has appropriate role/permissions
     - Check API key validity and scope
     - Ensure authentication headers are properly set

5. **Data Synchronization Issues**
   - **Symptoms**: Inconsistent data between views, stale information
   - **Causes**: Cache invalidation problems, race conditions, network issues
   - **Solutions**:
     - Verify cache invalidation logic
     - Check query refetch configurations
     - Implement proper error handling and retry logic
     - Ensure consistent data transformation across components

### Debugging Tools and Techniques
- **Browser Developer Tools**: Use the Network tab to monitor API requests and WebSocket connections
- **Console Logging**: Enable debug logging in development mode to trace data flow
- **Query Devtools**: Use TanStack Query Devtools to inspect query states and cache contents
- **Error Boundaries**: The system includes AlertErrorBoundary components to catch and display errors gracefully
- **Performance Profiling**: Use React DevTools to identify performance bottlenecks and unnecessary re-renders

## Conclusion
The Alert Management System provides a comprehensive solution for monitoring and managing system alerts within the SMEDREC healthcare audit platform. The system's modular architecture, real-time capabilities, and comprehensive feature set make it well-suited for handling the complex alert management needs of healthcare applications.

Key strengths of the system include its real-time WebSocket integration for immediate alert notifications, flexible filtering and visualization options, and robust error handling. The system's integration with TanStack Query provides efficient data management with caching and background updates, while the modular component structure ensures maintainability and scalability.

The system has been enhanced with new features including a detailed alert view, keyboard shortcuts for improved accessibility, and a dedicated route for viewing all alerts. The API has been refactored to a dedicated service for better modularity and standardization, and alert properties have been standardized to snake_case for consistency.

Overall, the Alert Management System represents a well-designed, production-ready solution that effectively addresses the requirements for comprehensive alert management in a healthcare audit context.