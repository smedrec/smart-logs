# Gemini Context

This document provides context for the Gemini AI assistant to understand the smart-logs project.

## Project Overview

smart-logs is a monorepo for a comprehensive audit logging system designed for healthcare applications. It provides features for security, compliance, reliability, and monitoring.

The project is a TypeScript monorepo using pnpm workspaces, Turborepo, and a number of modern technologies including:

-   **Frontend:** React, TanStack Router, React Native, Expo, TailwindCSS, shadcn/ui, PWA, Tauri
-   **Backend:** Hono, tRPC, Node.js
-   **Database:** Drizzle ORM, PostgreSQL
-   **Authentication:** Better Auth
-   **Documentation:** Astro Starlight
-   **Tooling:** TypeScript, Turborepo, Vitest

The project is structured into `apps` and `packages`:

-   `apps`: Contains the main applications: `web`, `native`, `docs`, `server`, and `worker`.
-   `packages`: Contains shared code and libraries used across the applications.

## Building and Running

The project uses `pnpm` as the package manager and `turbo` to manage the monorepo.

**Key Commands:**

-   `pnpm install`: Install dependencies.
-   `pnpm dev`: Start all applications in development mode.
-   `pnpm build`: Build all applications.
-   `pnpm test`: Run tests for all applications.
-   `pnpm check-types`: Check TypeScript types across all apps.
-   `pnpm db:push`: Push schema changes to the database.
-   `pnpm db:studio`: Open the database studio UI.

**Running Individual Applications:**

-   `pnpm dev:web`: Start the web application.
-   `pnpm dev:server`: Start the backend server.
-   `pnpm dev:native`: Start the React Native/Expo development server.
-   `pnpm dev:worker`: Start the audit worker.

## Development Conventions

-   **Monorepo:** The project is a monorepo, with shared code in the `packages` directory.
-   **TypeScript:** The entire codebase is written in TypeScript.
-   **Testing:** The project uses Vitest for testing.
-   **Linting:** The project uses ESLint for linting.
-   **Formatting:** The project uses Prettier for code formatting.
-   **Commits:** The project follows the conventional commit specification.
