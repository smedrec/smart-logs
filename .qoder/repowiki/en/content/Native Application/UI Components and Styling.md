# UI Components and Styling

<cite>
**Referenced Files in This Document**  
- [container.tsx](file://apps/native/components/container.tsx)
- [header-button.tsx](file://apps/native/components/header-button.tsx)
- [global.css](file://apps/native/global.css)
- [tailwind.config.js](file://apps/native/tailwind.config.js)
- [use-color-scheme.ts](file://apps/native/lib/use-color-scheme.ts)
- [_layout.tsx](file://apps/native/app/_layout.tsx)
- [constants.ts](file://apps/native/lib/constants.ts)
- [babel.config.js](file://apps/native/babel.config.js)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Core UI Components](#core-ui-components)
3. [Styling System Overview](#styling-system-overview)
4. [Dark Mode Implementation](#dark-mode-implementation)
5. [Responsive and Platform-Specific Styling](#responsive-and-platform-specific-styling)
6. [Performance and Best Practices](#performance-and-best-practices)

## Introduction
This document provides a comprehensive overview of the UI components and styling architecture in the Native Application. It details the implementation of reusable components, the integration of Tailwind CSS via Nativewind, global styling setup, and support for dark mode and responsive design. The goal is to offer both technical depth and accessibility for developers and designers working with the application.

## Core UI Components

### Container Component
The `Container` component serves as a foundational wrapper for screens and modal views, ensuring consistent layout structure and safe area handling across devices. It uses `SafeAreaView` from React Native to prevent content from overlapping with device notches or status bars.

**Props Interface**
- `children`: React.ReactNode - The content to be rendered within the container.

**Implementation**
```tsx
import React from "react";
import { SafeAreaView } from "react-native";

export const Container = ({ children }: { children: React.ReactNode }) => {
  return (
    <SafeAreaView className="flex-1 bg-background">{children}</SafeAreaView>
  );
};
```

The component applies two key Tailwind classes:
- `flex-1`: Ensures the container takes up the full available space.
- `bg-background`: Applies the background color defined in the theme, supporting both light and dark modes.

**Usage Examples**
The `Container` is used in multiple screens:
- `two.tsx`: Wraps the Tab Two screen content.
- `modal.tsx`: Wraps the modal screen content.

```tsx
<Container>
  <ScrollView className="flex-1 p-6">
    <View className="py-8">
      <Text className="text-3xl font-bold text-foreground mb-2">
        Tab Two
      </Text>
    </View>
  </ScrollView>
</Container>
```

**Section sources**
- [container.tsx](file://apps/native/components/container.tsx#L1-L8)
- [two.tsx](file://apps/native/app/(drawer)/(tabs)/two.tsx#L1-L18)
- [modal.tsx](file://apps/native/app/modal.tsx#L1-L13)

### HeaderButton Component
The `HeaderButton` component is a reusable pressable button designed for header actions, typically displaying an icon. It supports accessibility and visual feedback on press interactions.

**Props Interface**
- `onPress`: Optional callback function triggered when the button is pressed.

**Implementation**
```tsx
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { forwardRef } from "react";
import { Pressable } from "react-native";

export const HeaderButton = forwardRef<
  typeof Pressable,
  { onPress?: () => void }
>(({ onPress }, ref) => {
  return (
    <Pressable
      onPress={onPress}
      className="p-2 mr-2 rounded-lg bg-secondary/50 active:bg-secondary"
    >
      {({ pressed }) => (
        <FontAwesome
          name="info-circle"
          size={20}
          className="text-secondary-foreground"
          style={{
            opacity: pressed ? 0.7 : 1,
          }}
        />
      )}
    </Pressable>
  );
});
```

**Key Features**
- Uses `forwardRef` to allow parent components to access the underlying `Pressable` ref.
- Applies visual feedback via `active:bg-secondary` and opacity changes when pressed.
- Utilizes `bg-secondary/50` for a semi-transparent background in the default state.

**Section sources**
- [header-button.tsx](file://apps/native/components/header-button.tsx#L1-L26)

## Styling System Overview

### Tailwind CSS with Nativewind
The application leverages Tailwind CSS for styling through Nativewind, which enables the use of Tailwind classes directly in React Native components.

**Nativewind Integration**
Nativewind is integrated via Babel and Tailwind configuration:
- `babel.config.js` sets `jsxImportSource` to `nativewind`, enabling the automatic import of styled components.
- The `nativewind/babel` preset is included in the Babel configuration.

```js
// babel.config.js
presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel']
```

**Tailwind Configuration**
The `tailwind.config.js` file extends the default theme with custom colors and spacing based on CSS variables.

```js
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,tsx}", "./components/**/*.{js,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // ... other color mappings
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      borderWidth: {
        hairline: require("nativewind/theme").hairlineWidth(),
      },
    },
  },
  plugins: [],
};
```

**Key Configuration Details**
- **darkMode**: Set to `"class"` to support class-based dark mode toggling.
- **content**: Specifies the file paths where Tailwind classes are used.
- **colors**: Maps Tailwind color utilities to CSS variables defined in `global.css`.
- **borderRadius and borderWidth**: Extends default spacing with dynamic values from CSS variables.

**Section sources**
- [tailwind.config.js](file://apps/native/tailwind.config.js#L1-L60)
- [babel.config.js](file://apps/native/babel.config.js#L1-L12)

### Global CSS Setup
The `global.css` file defines CSS variables for theming and initializes Tailwind layers.

**CSS Variables**
The `:root` and `.dark:root` selectors define HSL-based color variables for light and dark themes.

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    /* ... other variables */
  }

  .dark:root {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... other variables */
  }
}
```

**Tailwind Layers**
The file includes Tailwind's base, components, and utilities layers:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

This setup ensures that Tailwind's base styles are applied first, followed by component and utility classes.

**Section sources**
- [global.css](file://apps/native/global.css#L1-L51)

## Dark Mode Implementation

### use-color-scheme Hook
The `use-color-scheme` hook abstracts the logic for detecting and managing the current color scheme.

```ts
import { useColorScheme as useNativewindColorScheme } from "nativewind";

export function useColorScheme() {
  const { colorScheme, setColorScheme, toggleColorScheme } =
    useNativewindColorScheme();
  return {
    colorScheme: colorScheme ?? "dark",
    isDarkColorScheme: colorScheme === "dark",
    setColorScheme,
    toggleColorScheme,
  };
}
```

**Functionality**
- Uses `useNativewindColorScheme` from Nativewind to access the current color scheme.
- Returns a normalized object with:
  - `colorScheme`: Current scheme ("light" or "dark"), defaults to "dark".
  - `isDarkColorScheme`: Boolean indicating if dark mode is active.
  - `setColorScheme`: Function to programmatically set the theme.
  - `toggleColorScheme`: Function to switch between themes.

### Application-Level Theme Application
The root layout (`_layout.tsx`) applies the theme to React Navigation and sets up Android navigation bar styling.

```tsx
export default function RootLayout() {
  const { colorScheme, isDarkColorScheme } = useColorScheme();
  const [isColorSchemeLoaded, setIsColorSchemeLoaded] = React.useState(false);

  useIsomorphicLayoutEffect(() => {
    if (Platform.OS === "web") {
      document.documentElement.classList.add("bg-background");
    }
    setAndroidNavigationBar(colorScheme);
    setIsColorSchemeLoaded(true);
  }, []);

  if (!isColorSchemeLoaded) return null;

  return (
    <ThemeProvider value={isDarkColorScheme ? DARK_THEME : LIGHT_THEME}>
      <StatusBar style={isDarkColorScheme ? "light" : "dark"} />
      {/* ... rest of layout */}
    </ThemeProvider>
  );
}
```

**Key Actions**
- Adds `bg-background` class to the document element on web for flicker-free theming.
- Calls `setAndroidNavigationBar` to style Android system bars based on the theme.
- Uses `LIGHT_THEME` and `DARK_THEME` objects that extend React Navigation themes with custom colors from `constants.ts`.

**Constants for Navigation Theme**
```ts
export const NAV_THEME = {
  light: {
    background: "hsl(0 0% 100%)",
    primary: "hsl(221.2 83.2% 53.3%)",
    text: "hsl(222.2 84% 4.9%)",
  },
  dark: {
    background: "hsl(222.2 84% 4.9%)",
    primary: "hsl(217.2 91.2% 59.8%)",
    text: "hsl(210 40% 98%)",
  },
};
```

**Section sources**
- [use-color-scheme.ts](file://apps/native/lib/use-color-scheme.ts#L1-L13)
- [_layout.tsx](file://apps/native/app/_layout.tsx#L1-L76)
- [constants.ts](file://apps/native/lib/constants.ts#L1-L19)

## Responsive and Platform-Specific Styling

### Responsive Design Patterns
While the native app primarily targets mobile devices, responsive principles are applied through flexible layouts using Tailwind's flexbox utilities (`flex-1`, `p-6`, etc.). The web application includes a `useIsMobile` hook that detects screen size, but this is not used in the native app.

### Platform-Specific Styling
The application handles platform differences through conditional logic:
- **Android Navigation Bar**: The `setAndroidNavigationBar` function adjusts button and background colors based on the theme.
- **Status Bar**: The `StatusBar` component from `expo-status-bar` sets the text style (`light` or `dark`) depending on the current theme.

```ts
await NavigationBar.setButtonStyleAsync(theme === "dark" ? "light" : "dark");
await NavigationBar.setBackgroundColorAsync(
  theme === "dark" ? NAV_THEME.dark.background : NAV_THEME.light.background,
);
```

**Section sources**
- [android-navigation-bar.tsx](file://apps/native/lib/android-navigation-bar.tsx#L1-L10)
- [_layout.tsx](file://apps/native/app/_layout.tsx#L44-L74)

## Performance and Best Practices

### Style Processing Performance
- **Tailwind JIT**: The use of Tailwind's Just-In-Time compiler ensures only used classes are generated, reducing bundle size.
- **Nativewind Optimization**: Nativewind transforms Tailwind classes into native styles at build time, avoiding runtime overhead.
- **CSS Variables**: Using HSL variables enables dynamic theming without duplicating style rules.

### Best Practices for Reusable Components
1. **Semantic Class Names**: Use descriptive Tailwind class combinations (e.g., `bg-secondary/50`).
2. **Theme Consistency**: Always use theme color variables (`bg-background`, `text-foreground`) instead of hardcoded colors.
3. **Accessibility**: Ensure interactive components provide visual feedback (e.g., `active:bg-secondary`).
4. **Reusability**: Design components with minimal props and clear responsibilities (e.g., `Container` for layout, `HeaderButton` for actions).
5. **Dark Mode Support**: Test all components in both light and dark modes to ensure visual consistency.

### Accessibility Considerations
- The `HeaderButton` uses `Pressable` which provides built-in accessibility features.
- Icon buttons should have accessible labels (not implemented in current code but recommended).
- Ensure sufficient color contrast between text and background in both themes.

**Section sources**
- [container.tsx](file://apps/native/components/container.tsx#L1-L8)
- [header-button.tsx](file://apps/native/components/header-button.tsx#L1-L26)
- [tailwind.config.js](file://apps/native/tailwind.config.js#L1-L60)
- [global.css](file://apps/native/global.css#L1-L51)