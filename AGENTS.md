# AGENTS.md - OpenTogetherTube Development Guide

This file provides guidance for AI agents working on the OpenTogetherTube codebase.

## Project Overview

OpenTogetherTube is a real-time video synchronization web application. It uses a hybrid TypeScript/JavaScript + Rust architecture with a monorepo structure using Yarn workspaces and Cargo.

**Monorepo Structure:**

-   `/client` - Vue 3 frontend (Vite)
-   `/server` - Node.js/Express backend (monolith)
-   `/common` - Shared TypeScript code between client and server
-   `/crates/*` - Rust workspace: load balancer, collector, protocol, harness tests
-   `/packages/*` - Grafana visualization plugins

## Build & Development Commands

**Build:**

```bash
yarn build            # Build all workspaces
yarn workspace ott-server build
yarn workspace ott-client build
yarn workspace ott-common build

# Rust crates
cargo build
cargo build -p ott-balancer-bin
```

**Linting:**

```bash
yarn lint             # Lint all with auto-fix
yarn lint-ci          # Lint all without fix (for CI)

# Rust
cargo fmt
cargo clippy
```

**Testing:**

```bash
# Run all tests
yarn test

# Run single test file
yarn workspace ott-server vitest run tests/unit/roommanager.spec.ts
yarn workspace ott-client vitest run tests/unit/component.spec.ts
yarn workspace ott-common vitest run tests/unit/result.spec.ts

# Run tests with coverage
yarn workspace ott-server test
yarn workspace ott-client test
yarn workspace ott-common test

# E2E tests (Cypress)
yarn cy:open           # Open Cypress UI (interactive)
yarn cy:run            # Run E2E tests headless
yarn cy:run:component  # Run component tests

# Rust tests
cargo test
cargo test -p ott-balancer
```

**Database:**

```bash
yarn db:migrate        # Run migrations
yarn db:migrate:undo   # Undo last migration
```

## Load Balancer (Rust)

The load balancer is a Rust application that routes WebSocket connections and HTTP requests to monoliths (Node.js servers). It's located in `/crates/ott-balancer/`.

**Key Components:**

-   `ott-balancer` - Core balancer library
-   `ott-balancer-bin` - Binary executable
-   `ott-balancer-protocol` - Shared protocol definitions
-   `ott-collector` - Metrics collection service
-   `ott-common` - Shared Rust utilities
-   `harness` - Test harness for integration testing

**Running the Balancer:**

```bash
cargo run -p ott-balancer-bin -- --config env/balancer.toml
```

## Grafana Plugins

Located in `/packages/`, these are Grafana visualization plugins for monitoring the OTT system:

-   `ott-vis` - Core visualization library (shared types/utilities)
-   `ott-vis-panel` - Custom Grafana panel plugin (uses React + D3)
-   `ott-vis-datasource` - Custom Grafana datasource plugin

**Plugin Commands:**

```bash
# Run all plugins in dev mode
yarn workspace ott-vis dev

# Build plugins
yarn workspace ott-vis-panel build
yarn workspace ott-vis-datasource build

# Run tests
yarn workspace ott-vis-panel test      # Jest
yarn workspace ott-vis-datasource test
```

## Code Style Guidelines

### Formatting (Prettier)

-   Use tabs (not spaces)
-   Tab width: 4
-   Print width: 100
-   Semicolons: required
-   Single quotes: NO (use double quotes)
-   Trailing commas: es5 style
-   Arrow functions: avoid parentheses when possible

### TypeScript

-   Target: ESNext with ES modules
-   Strict null checks enabled
-   Always use `const` or `let`, never `var`
-   Prefer arrow functions
-   Use `type` imports: `import type { Foo } from "bar"`

### Rust

-   Use `cargo fmt` for formatting
-   Follow standard Rust naming conventions
-   Use ` anyhow` for error handling
-   Prefer `async/await` over callbacks

### Import Order

1. Node.js built-ins (e.g., `node:url`, `node:http`)
2. External dependencies (e.g., `axios`, `lodash`)
3. Internal workspace packages (e.g., `ott-common/*`)
4. Local project imports

### Naming Conventions

-   Files: kebab-case (e.g., `room-manager.ts`)
-   Classes: PascalCase (e.g., `RoomManager`)
-   Functions/Variables: camelCase (e.g., `getVideoInfo`)
-   Constants: UPPER_SNAKE_CASE (e.g., `MAX_ROOM_SIZE`)
-   Types/Interfaces: PascalCase with descriptive names

### Error Handling

-   Use custom exceptions extending `OttException` from `ott-common/exceptions.js`
-   Always use `try/catch` for async operations
-   Use Zod for runtime validation
-   Prefer `await` over `.then()` chains

## Testing Patterns

-   **Unit Tests:** Use Vitest (TypeScript), built-in test runner (Rust)
-   **E2E Tests:** Use Cypress
-   **Integration Tests:** Use harness crate for Rust
-   Test files: `*.spec.ts` or `*.test.ts`
-   Place tests in `/tests/unit/` or `/tests/e2e/`
-   Use `describe` and `it` blocks for organization
-   Mock external dependencies (Redis, DB) in unit tests

## Workspace Commands

Run commands in specific workspaces:

```bash
yarn workspace ott-server <command>
yarn workspace ott-client <command>
yarn workspace ott-common <command>
```

## Important Notes

-   Node.js version: 20-22
-   Package manager: Yarn 4
-   Rust toolchain required for balancer and crates
-   Always run `yarn` after pulling changes
-   Use `corepack enable` to enable Yarn
-   Redis is required for development
-   Configuration in `env/development.toml` (copy from `env/example.toml`)
