# Alert Management UI Components

This directory contains all components related to the Alert Management UI system. The structure is organized following the established patterns from the compliance components.

## Directory Structure

```
alerts/
├── core/                    # Core alert components
│   ├── AlertDashboard.tsx   # Main dashboard container
│   ├── AlertList.tsx        # Alert listing component
│   ├── AlertCard.tsx        # Individual alert display
│   └── AlertDetails.tsx     # Detailed alert view
├── forms/                   # Form components
│   ├── AlertFilters.tsx     # Filtering controls
│   ├── AlertActions.tsx     # Action buttons and dialogs
│   ├── BulkActions.tsx      # Bulk operation controls
│   └── AlertActionDialog.tsx # Action confirmation dialogs
├── notifications/           # Notification system
│   ├── NotificationBell.tsx # Header notification component
│   ├── NotificationPanel.tsx# Notification dropdown/panel
│   └── NotificationItem.tsx # Individual notification
├── data/                    # Data management
│   ├── AlertDataTable.tsx   # Advanced data table
│   ├── AlertColumns.tsx     # Table column definitions
│   ├── AlertPagination.tsx  # Pagination controls
│   └── AlertTableToolbar.tsx# Table toolbar with filters
├── ui/                      # Reusable UI components
│   ├── AlertBadge.tsx       # Status and severity badges
│   ├── AlertIcon.tsx        # Alert type icons
│   ├── AlertSkeleton.tsx    # Loading skeletons
│   └── AlertEmptyState.tsx  # Empty state component
├── error/                   # Error handling
│   ├── AlertErrorBoundary.tsx # Error boundary
│   ├── AlertErrorAlert.tsx  # Error alert component
│   ├── AlertLoadingStates.tsx # Loading states
│   └── AlertValidationFeedback.tsx # Form validation
├── layout/                  # Layout components
│   ├── AlertLayout.tsx      # Base layout
│   ├── AlertPage.tsx        # Page wrapper
│   └── AlertSection.tsx     # Section wrapper
├── hooks/                   # Alert-specific hooks
│   ├── use-alert-filters.ts # Filter management
│   ├── use-alert-actions.ts # Action handling
│   ├── use-alert-notifications.ts # Notification state
│   └── use-alert-realtime.ts # Real-time updates
├── types/                   # Type definitions
│   ├── alert-types.ts       # Alert interfaces
│   ├── notification-types.ts # Notification interfaces
│   ├── filter-types.ts      # Filter interfaces
│   └── api-types.ts         # API interfaces
└── index.ts                 # Main export file
```

## Design Principles

1. **Modularity**: Components are small, focused, and reusable
2. **Consistency**: Follows established patterns from compliance components
3. **Accessibility**: All components include proper ARIA labels and keyboard navigation
4. **Type Safety**: Comprehensive TypeScript interfaces for all data structures
5. **Performance**: Optimized for large datasets with virtual scrolling and pagination

## Integration

The alert system integrates with:

- Existing Audit Client for API communication
- TanStack Query for data management
- TanStack Router for navigation
- shadcn-ui components for consistent styling
- Existing authentication and authorization systems

## Usage

```typescript
import { AlertDashboard, AlertFilters, NotificationBell } from '@/components/alerts'

// Use in your pages
<AlertDashboard initialFilters={filters} />
```

## Development Status

This structure represents the foundation for the Alert Management UI. Components will be implemented according to the tasks defined in the implementation plan.

## Legacy Components

The following legacy components will be replaced:

- `columns.tsx` → `data/AlertColumns.tsx`
- `data-table.tsx` → `data/AlertDataTable.tsx`
- `data-table-resolved.tsx` → Integrated into `AlertDataTable.tsx`
- `form.tsx` → `forms/AlertActions.tsx` and related components
- `data.tsx` → `types/alert-types.ts`
