# Compliance Components Accessibility Tests

This directory contains accessibility tests for all compliance UI components.

## Test Structure

```
__tests__/
├── dashboard/
│   └── dashboard-stats.test.tsx
├── reports/
│   └── reports-data-table.test.tsx
├── forms/
│   └── report-configuration-form.test.tsx
├── navigation/
│   └── keyboard-shortcuts-dialog.test.tsx
└── error/
    └── error-alert.test.tsx
```

## Running Tests

```bash
# Run all accessibility tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test src/components/compliance/dashboard/__tests__/dashboard-stats.test.tsx

# Run tests with UI
pnpm test:ui
```

## Test Coverage

### Dashboard Components

- ✅ DashboardStats - Accessibility compliance for dashboard statistics

### Reports Components

- ✅ ReportsDataTable - Table accessibility, keyboard navigation, screen reader support

### Forms Components

- ✅ ReportConfigurationForm - Form accessibility, label associations, error handling

### Navigation Components

- ✅ KeyboardShortcutsDialog - Dialog accessibility, focus management, keyboard navigation

### Error Components

- ✅ ErrorAlert - Alert accessibility, ARIA live regions, keyboard actions

## Writing New Tests

Use the accessibility testing utilities from `src/__tests__/accessibility-utils.tsx`:

```typescript
import { describe, it } from 'vitest'
import { render } from '@testing-library/react'
import { testAccessibility } from '@/__tests__/accessibility-utils'
import { MyComponent } from '../my-component'

describe('MyComponent Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<MyComponent />)
    await testAccessibility(container)
  })
})
```

## Test Utilities

- `testAccessibility()` - Run axe accessibility tests
- `testKeyboardNavigation()` - Test keyboard accessibility
- `testScreenReaderSupport()` - Test screen reader support
- `testResponsiveDesign()` - Test responsive design
- `testFormAccessibility()` - Test form accessibility
- `testAriaLiveRegions()` - Test ARIA live regions
- `describeAccessibility()` - Common accessibility test suite

## Documentation

See [ACCESSIBILITY_TESTING.md](../ACCESSIBILITY_TESTING.md) for comprehensive testing guide.

## CI/CD Integration

Accessibility tests run automatically on:

- Every commit
- Pull requests
- Pre-deployment checks

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [jest-axe Documentation](https://github.com/nickcolley/jest-axe)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
