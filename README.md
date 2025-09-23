# smart-logs

![Smart Logs](./docs/logo.png)

The Smart Logs Audit System provides comprehensive audit logging capabilities for healthcare applications, ensuring compliance with HIPAA, GDPR, and other regulatory requirements.

## Key Features

### 🔒 Security & Compliance

- Cryptographic integrity verification with SHA-256 hashing
- HMAC signatures for tamper detection
- GDPR compliance with data classification and retention policies
- Automatic data sanitization to prevent injection attacks

### 🚀 Reliability

- Guaranteed delivery with reliable event processor
- Circuit breaker pattern for fault tolerance
- Dead letter queue for failed events
- Automatic retry mechanisms with exponential backoff

### 📊 Monitoring & Observability

- Real-time health checks and metrics
- Performance monitoring with latency tracking
- Queue depth monitoring
- Comprehensive error handling and logging

### 🏥 Healthcare-Specific

- FHIR resource audit events
- Practitioner license verification tracking
- Patient data access logging
- HIPAA-compliant audit trails

## Tools

- **TypeScript** - For type safety and improved developer experience
- **TanStack Router** - File-based routing with full type safety
- **React Native** - Build mobile apps using React
- **Expo** - Tools for React Native development
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Reusable UI components
- **Hono** - Lightweight, performant server framework
- **tRPC** - End-to-end type-safe APIs
- **Node.js** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Email & password authentication with Better Auth
- **PWA** - Progressive Web App support
- **Starlight** - Documentation site with Astro
- **Tauri** - Build native desktop applications
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/server/.env` file with your PostgreSQL connection details.

3. Apply the schema to your database:

```bash
pnpm db:push
```

Then, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
Use the Expo Go app to run the mobile application.
The API is running at [http://localhost:3000](http://localhost:3000).

## Project Structure

```
smart-logs/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Router)
│   ├── native/      # Mobile application (React Native, Expo)
│   ├── docs/        # Documentation site (Astro Starlight)
│   └── server/      # Backend API (Hono, TRPC)
│   └── worker/      # Audit worker (BullMQ, Redis, Hono)
```

## Available Scripts

- `pnpm dev`: Start all applications in development mode
- `pnpm build`: Build all applications
- `pnpm dev:web`: Start only the web application
- `pnpm dev:server`: Start only the server
- `pnpm check-types`: Check TypeScript types across all apps
- `pnpm dev:native`: Start the React Native/Expo development server
- `pnpm db:push`: Push schema changes to database
- `pnpm db:studio`: Open database studio UI
- `cd apps/web && pnpm generate-pwa-assets`: Generate PWA assets
- `cd apps/web && pnpm desktop:dev`: Start Tauri desktop app in development
- `cd apps/web && pnpm desktop:build`: Build Tauri desktop app
- `cd apps/docs && pnpm dev`: Start documentation site
- `cd apps/docs && pnpm build`: Build documentation site
