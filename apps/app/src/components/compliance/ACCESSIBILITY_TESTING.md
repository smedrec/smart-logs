# Accessibility Testing Guide

This document provides comprehensive guidance on accessibility testing for the compliance reports UI components.

## Table of Contents

1. [Overview](#overview)
2. [Testing Tools](#testing-tools)
3. [Automated Testing](#automated-testing)
4. [Manual Testing](#manual-testing)
5. [Testing Checklist](#testing-checklist)
6. [Common Issues](#common-issues)
7. [Resources](#resources)

## Overview

Accessibility testing ensures that the compliance reports UI is usable by everyone, including people with disabilities. Our testing strategy includes:

- **Automated testing** with jest-axe and Testing Library
- **Linting** with eslint-plugin-jsx-a11y
- **Manual testing** with keyboard navigation and screen readers
- **Continuous monitoring** in CI/CD pipeline

### WCAG 2.1 AA Compliance

All components must meet WCAG 2.1 Level AA standards:

- ✅ Perceivable: Information and UI components must be presentable to users
- ✅ Operable: UI components and navigation must be operable
- ✅ Understandable: Information and UI operation must be understandable
- ✅ Robust: Content must be robust enough for assistive technologies

## Testing Tools

### Installed Dependencies

```json
{
	"devDependencies": {
		"@testing-library/react": "^16.1.0",
		"@testing-library/jest-dom": "^6.6.3",
		"@testing-library/user-event": "^14.5.2",
		"jest-axe": "^9.0.0",
		"eslint-plugin-jsx-a11y": "^6.10.2",
		"jsdom": "^25.0.1",
		"vitest": "^3.2.4"
	}
}
```

### Testing Utilities

Located in `src/__tests__/accessibility-utils.tsx`:

- `testAccessibility()` - Run axe accessibility tests
- `testKeyboardNavigation()` - Test keyboard accessibility
- `testScreenReaderSupport()` - Test screen reader support
- `testResponsiveDesign()` - Test responsive design
- `testFormAccessibility()` - Test form accessibility
- `testAriaLiveRegions()` - Test ARIA live regions
- `describeAccessibility()` - Common accessibility test suite

## Automated Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run tests with UI
pnpm test:ui
```

### Writing Accessibility Tests

#### Basic Component Test

```typescript
import { describe, it } from 'vitest'
import { render } from '@testing-library/react'
import { testAccessibility } from '@/__tests__/accessibility-utils'
import { MyComponent } from './my-component'

describe('MyComponent Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<MyComponent />)
    await testAccessibility(container)
  })
})
```

#### Comprehensive Test Suite

```typescript
import { describeAccessibility } from '@/__tests__/accessibility-utils'
import { MyComponent } from './my-component'

describeAccessibility(
  'MyComponent',
  () => render(<MyComponent />),
  {
    skipAxe: false,
    skipKeyboard: false,
    skipScreenReader: false,
  }
)
```

#### Testing Keyboard Navigation

```typescript
import { testKeyboardNavigation } from '@/__tests__/accessibility-utils'

it('should be keyboard accessible', () => {
  const { container } = render(<MyComponent />)
  const button = container.querySelector('button')

  const keyboard = testKeyboardNavigation(button!)
  expect(keyboard.isFocusable()).toBe(true)
  expect(keyboard.hasFocusIndicator()).toBe(true)
})
```

#### Testing Screen Reader Support

```typescript
import { testScreenReaderSupport } from '@/__tests__/accessibility-utils'

it('should have proper screen reader support', () => {
  const { container } = render(<MyComponent />)
  const element = container.querySelector('[role="button"]')

  const screenReader = testScreenReaderSupport(element!)
  expect(screenReader.hasAccessibleName()).toBe(true)
  expect(screenReader.getAccessibleName()).toBe('Submit Form')
})
```

#### Testing Forms

```typescript
import { testFormAccessibility } from '@/__tests__/accessibility-utils'

it('should have accessible form', () => {
  const { container } = render(<MyForm />)
  const form = container.querySelector('form')

  const formA11y = testFormAccessibility(form!)
  expect(formA11y.allInputsHaveLabels()).toBe(true)
  expect(formA11y.requiredFieldsMarked()).toBe(true)
  expect(formA11y.errorMessagesAssociated()).toBe(true)
})
```

#### Testing ARIA Live Regions

```typescript
import { testAriaLiveRegions } from '@/__tests__/accessibility-utils'

it('should announce status changes', () => {
  const { container } = render(<MyComponent />)

  const liveRegions = testAriaLiveRegions(container)
  expect(liveRegions.hasLiveRegion('polite')).toBe(true)
  expect(liveRegions.getLiveRegionContent()).toContain('Loading...')
})
```

### Custom Axe Configuration

```typescript
import { testAccessibility, strictAxeConfig } from '@/__tests__/accessibility-utils'

it('should pass strict accessibility tests', async () => {
  const { container } = render(<MyComponent />)
  await testAccessibility(container, strictAxeConfig)
})
```

## Manual Testing

### Keyboard Navigation Testing

Test all interactive elements with keyboard only:

1. **Tab Navigation**
   - Press `Tab` to move forward through interactive elements
   - Press `Shift+Tab` to move backward
   - Verify focus order is logical and visible

2. **Action Keys**
   - Press `Enter` or `Space` to activate buttons
   - Press `Escape` to close dialogs and menus
   - Press arrow keys for navigation in lists and menus

3. **Keyboard Shortcuts**
   - Test all custom keyboard shortcuts
   - Verify shortcuts don't conflict with browser/OS shortcuts
   - Press `?` to view keyboard shortcuts help

### Screen Reader Testing

Test with popular screen readers:

#### NVDA (Windows - Free)

```bash
# Download from: https://www.nvaccess.org/download/
# Start NVDA: Ctrl+Alt+N
# Stop NVDA: Insert+Q
```

**Common Commands:**

- `Insert+Down Arrow` - Read next line
- `Insert+Up Arrow` - Read previous line
- `Insert+Space` - Toggle browse/focus mode
- `H` - Navigate by headings
- `B` - Navigate by buttons
- `F` - Navigate by form fields

#### JAWS (Windows - Commercial)

```bash
# Download trial: https://www.freedomscientific.com/
# Start JAWS: Ctrl+Alt+J
```

**Common Commands:**

- `Insert+Down Arrow` - Say all
- `Insert+F5` - List form fields
- `Insert+F6` - List headings
- `Insert+F7` - List links

#### VoiceOver (macOS - Built-in)

```bash
# Enable: System Preferences > Accessibility > VoiceOver
# Start/Stop: Cmd+F5
```

**Common Commands:**

- `VO+A` - Read all (VO = Ctrl+Option)
- `VO+Right Arrow` - Move to next item
- `VO+Left Arrow` - Move to previous item
- `VO+U` - Open rotor (navigation menu)
- `VO+H` - Navigate by headings

### Testing Checklist

Use this checklist for manual accessibility testing:

#### Visual Testing

- [ ] All text has sufficient color contrast (4.5:1 for normal text, 3:1 for large text)
- [ ] Focus indicators are visible on all interactive elements
- [ ] UI is usable at 200% zoom
- [ ] No information conveyed by color alone
- [ ] Text can be resized without loss of functionality

#### Keyboard Testing

- [ ] All functionality available via keyboard
- [ ] Tab order is logical and follows visual flow
- [ ] Focus is visible at all times
- [ ] No keyboard traps (can escape from all components)
- [ ] Keyboard shortcuts are documented and don't conflict

#### Screen Reader Testing

- [ ] All images have appropriate alt text
- [ ] All form inputs have labels
- [ ] Headings are properly structured (h1, h2, h3, etc.)
- [ ] ARIA landmarks are used appropriately
- [ ] Dynamic content changes are announced
- [ ] Error messages are associated with form fields
- [ ] Tables have proper headers and captions

#### Form Testing

- [ ] All form fields have visible labels
- [ ] Required fields are marked with aria-required
- [ ] Error messages are clear and helpful
- [ ] Errors are announced to screen readers
- [ ] Form validation provides specific guidance
- [ ] Success messages are announced

#### Interactive Component Testing

- [ ] Buttons have descriptive labels
- [ ] Links have meaningful text (not "click here")
- [ ] Dialogs trap focus and can be closed with Escape
- [ ] Menus can be navigated with arrow keys
- [ ] Tooltips are keyboard accessible
- [ ] Accordions announce expanded/collapsed state

## Accessibility Linting

### Running ESLint with Accessibility Rules

```bash
# Run accessibility linting
npx eslint --config .eslintrc.accessibility.json src/components/compliance/**/*.tsx

# Fix auto-fixable issues
npx eslint --config .eslintrc.accessibility.json --fix src/components/compliance/**/*.tsx
```

### Common Linting Rules

- `jsx-a11y/alt-text` - Images must have alt text
- `jsx-a11y/anchor-is-valid` - Links must have valid href
- `jsx-a11y/aria-props` - ARIA props must be valid
- `jsx-a11y/aria-role` - ARIA roles must be valid
- `jsx-a11y/label-has-associated-control` - Labels must be associated with controls
- `jsx-a11y/no-autofocus` - Avoid autofocus
- `jsx-a11y/no-static-element-interactions` - Interactive elements need roles

## Common Issues and Solutions

### Issue: Missing Alt Text

**Problem:**

```tsx
<img src="report-icon.png" />
```

**Solution:**

```tsx
<img src="report-icon.png" alt="HIPAA Audit Report" />
// or for decorative images:
<img src="decorative.png" alt="" role="presentation" />
```

### Issue: Missing Form Labels

**Problem:**

```tsx
<input type="text" placeholder="Report name" />
```

**Solution:**

```tsx
<label htmlFor="report-name">Report Name</label>
<input id="report-name" type="text" placeholder="Report name" />
// or with aria-label:
<input type="text" aria-label="Report name" placeholder="Report name" />
```

### Issue: Inaccessible Click Handlers

**Problem:**

```tsx
<div onClick={handleClick}>Click me</div>
```

**Solution:**

```tsx
<button onClick={handleClick}>Click me</button>
// or if div is necessary:
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick()
    }
  }}
>
  Click me
</div>
```

### Issue: Missing ARIA Labels

**Problem:**

```tsx
<button>
	<IconTrash />
</button>
```

**Solution:**

```tsx
<button aria-label="Delete report">
	<IconTrash />
</button>
```

### Issue: Poor Focus Management

**Problem:**

```tsx
// Dialog opens but focus stays on trigger button
<Dialog open={isOpen}>
	<DialogContent>...</DialogContent>
</Dialog>
```

**Solution:**

```tsx
<Dialog open={isOpen}>
	<DialogContent autoFocus>
		<DialogTitle>...</DialogTitle>
		<button autoFocus>First focusable element</button>
	</DialogContent>
</Dialog>
```

### Issue: Missing Live Regions

**Problem:**

```tsx
// Status changes but not announced
<div>{status}</div>
```

**Solution:**

```tsx
<div role="status" aria-live="polite">
  {status}
</div>
// or for urgent updates:
<div role="alert" aria-live="assertive">
  {errorMessage}
</div>
```

## Testing in CI/CD

### GitHub Actions Example

```yaml
name: Accessibility Tests

on: [push, pull_request]

jobs:
  a11y-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run accessibility tests
        run: pnpm test --run

      - name: Run accessibility linting
        run: npx eslint --config .eslintrc.accessibility.json src/components/compliance/**/*.tsx
```

## Resources

### Documentation

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM](https://webaim.org/)

### Testing Tools

- [axe DevTools Browser Extension](https://www.deque.com/axe/devtools/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [Pa11y](https://pa11y.org/)

### Screen Readers

- [NVDA (Windows)](https://www.nvaccess.org/)
- [JAWS (Windows)](https://www.freedomscientific.com/products/software/jaws/)
- [VoiceOver (macOS/iOS)](https://www.apple.com/accessibility/voiceover/)
- [TalkBack (Android)](https://support.google.com/accessibility/android/answer/6283677)

### Learning Resources

- [A11ycasts with Rob Dodson](https://www.youtube.com/playlist?list=PLNYkxOF6rcICWx0C9LVWWVqvHlYJyqw7g)
- [Web Accessibility by Google](https://www.udacity.com/course/web-accessibility--ud891)
- [Inclusive Components](https://inclusive-components.design/)
- [The A11Y Project](https://www.a11yproject.com/)

## Component-Specific Testing

### Dashboard Components

Test focus management, keyboard shortcuts, and live region announcements for real-time updates.

### Data Tables

Test keyboard navigation (arrow keys, Home, End), screen reader announcements for sorting/filtering, and proper table semantics.

### Forms

Test label associations, error announcements, required field indicators, and keyboard navigation through form fields.

### Dialogs and Modals

Test focus trapping, Escape key handling, focus restoration, and proper ARIA attributes.

### Navigation

Test skip links, keyboard shortcuts, breadcrumb navigation, and proper heading hierarchy.

## Continuous Improvement

1. **Regular Audits**: Run accessibility audits monthly
2. **User Testing**: Include users with disabilities in testing
3. **Training**: Provide accessibility training for developers
4. **Documentation**: Keep accessibility documentation up to date
5. **Monitoring**: Track accessibility metrics over time

## Support

For accessibility questions or issues:

1. Check this documentation
2. Review WCAG 2.1 guidelines
3. Test with automated tools (axe, WAVE)
4. Test with screen readers
5. Consult with accessibility experts

---

**Last Updated:** November 2025
**Maintained By:** Compliance UI Team
**Version:** 1.0.0
