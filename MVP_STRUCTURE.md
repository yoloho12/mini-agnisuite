# Mini-AgniSuite MVP Structure

This document defines the MVP architecture and execution guide for the project as it currently stands in this repo.

## 1. Product Goal

Mini-AgniSuite is a local-first warehouse and dispatch management system for tracking:

- products
- warehouses and sites
- stock quantities
- purchase orders
- dispatches
- returns and write-offs
- alerts and reports

The MVP should be focused on operational flow, not experimental features.

---

## 2. MVP Scope

The MVP should include only the modules that make the product usable in a real warehouse workflow:

### Core modules

1. Dashboard
   - KPI cards
   - stock summary
   - recent activity
   - low-stock alerts

2. Products
   - create/edit product
   - SKU / product code
   - stock visibility
   - basic barcode support

3. Warehouses and Sites
   - location creation
   - stock level by location
   - transfer between locations

4. Purchase Orders
   - create PO
   - receive stock
   - supplier-related items

5. Dispatches
   - create dispatch
   - issue stock from warehouse/site
   - acknowledgment or dispatch notes

6. Returns and Write-offs
   - site returns to warehouse
   - supplier returns
   - damaged/lost stock removal

7. Alerts
   - low stock
   - out of stock
   - threshold-based warnings

8. Reports
   - basic movement report
   - stock summary export
   - CSV export

### Defer for later

- advanced barcode batch printing workflows
- camera-first scanning UX polish
- deep audit workflows
- large analytics dashboards
- complex backup/recovery orchestration
- large-scale role customizations

---

## 3. Recommended Product Architecture

The project already follows a solid layered structure.

### App Layer

Responsible for rendering pages and routes.

Main folder:
- [src/app](src/app)

Key subareas:
- [src/app/(auth)](src/app/(auth)) — login and registration flows
- [src/app/(dashboard)](src/app/(dashboard)) — protected product areas
- [src/app/actions](src/app/actions) — server actions and business entry points
- [src/app/api](src/app/api) — API routes
- [src/app/auth](src/app/auth) — auth callback logic

### Presentation Layer

Reusable UI and shared layout pieces.

Main folder:
- [src/components](src/components)

Key subareas:
- [src/components/layout](src/components/layout) — sidebar, topbar, breadcrumbs
- [src/components/ui](src/components/ui) — shared reusable UI
- dashboard-specific modules under [src/components/dashboard](src/components/dashboard)

### Domain / Data Layer

This is where the real business logic and data access live.

Main folders:
- [src/repositories](src/repositories)
- [src/services](src/services)
- [src/types](src/types)
- [src/lib](src/lib)

Purpose:
- repositories: database fetch/save logic
- services: rules, validations, workflow logic
- types: product and domain interfaces
- lib: helper logic, utilities, local database helpers

### Config and Infra

- [package.json](package.json) — scripts and dependencies
- [supabase](supabase) — database migrations and setup files
- [src/middleware.ts](src/middleware.ts) — auth middleware
- [next.config.ts](next.config.ts) — app config

---

## 4. MVP Module Priorities

### Priority 1: Inventory foundation

These are the essential modules for the app to be useful:

- Products
- Warehouses
- Sites
- Stock ledger / movement tracking

This should be the first milestone.

### Priority 2: Operations

- Purchase orders
- Receiving
- Dispatches
- Site returns
- Supplier returns

This gives daily operational workflow.

### Priority 3: Control layer

- Alerts
- Dashboard metrics
- Reports
- CSV export

### Priority 4: Optional quality of life

- barcode generation
- scanner UX
- offline resilience
- advanced backups

---

## 5. Recommended Route Map

These are the main user-facing areas to keep in MVP:

- /dashboard
- /dashboard/products
- /dashboard/warehouses
- /dashboard/sites
- /dashboard/purchase-orders
- /dashboard/dispatches
- /dashboard/site-returns
- /dashboard/returns
- /dashboard/write-offs
- /dashboard/reports
- /dashboard/alerts
- /dashboard/settings

The current project already has these under [src/app/(dashboard)](src/app/(dashboard)).

---

## 6. File-by-File Reading Guide

To understand the restructure and how the app is organized, read in this order:

### Step 1: Start at the top-level project docs
- [README.md](README.md) — product summary and setup
- [package.json](package.json) — available scripts and dependencies

### Step 2: Understand routes
- [src/app/(dashboard)/page.tsx](src/app/(dashboard)/page.tsx) — dashboard entry point
- [src/app/(dashboard)/layout.tsx](src/app/(dashboard)/layout.tsx) — protected app shell

### Step 3: Understand the app shell and UI
- [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx)
- [src/components/layout/Topbar.tsx](src/components/layout/Topbar.tsx)
- [src/components/layout/Breadcrumbs.tsx](src/components/layout/Breadcrumbs.tsx)

### Step 4: Understand domain logic
- [src/repositories](src/repositories)
- [src/services](src/services)
- [src/actions](src/app/actions)

### Step 5: Understand data contract
- [src/types](src/types)
- [src/lib](src/lib)

### Step 6: Understand infrastructure
- [supabase/setup_all.sql](supabase/setup_all.sql)
- [supabase/migrations](supabase/migrations)

This reading order tells you how the app is structured from route → layout → domain logic → data layer → storage.

---

## 7. Command List

Use these in the project root.

### Install dependencies

```bash
pnpm install
```

### Start development server

```bash
pnpm dev
```

### Run linting

```bash
pnpm lint
```

### Run TypeScript validation

```bash
pnpm typecheck
```

### Production build

```bash
pnpm build
```

### Start production build locally

```bash
pnpm start
```

### If you want to inspect the app with Next.js

```bash
npx next dev
```

---

## 8. How to Understand the Restructure

Think of the repo as five layers:

1. Route layer
   - user pages and screens
   - everything under [src/app](src/app)

2. UI layer
   - reusable visuals and layout
   - everything under [src/components](src/components)

3. Business layer
   - rules and workflows
   - everything under [src/services](src/services) and [src/app/actions](src/app/actions)

4. Data layer
   - persistent storage interfaces
   - everything under [src/repositories](src/repositories)

5. Infrastructure layer
   - database + auth + config + middleware
   - [supabase](supabase), [src/lib](src/lib), [src/middleware.ts](src/middleware.ts)

A good mental model:

- user clicks a page
- page calls a server action or view logic
- action calls a service
- service uses a repository
- repository reads or writes data
- domain result is shown in UI

This is the clean mental map for understanding the entire app.

---

## 9. Suggested MVP Execution Order

### Phase 1: Foundation
- set up auth
- confirm local-first DB workflow
- validate dashboard and protected route shell

### Phase 2: Inventory core
- create product model
- create warehouse/site models
- enable stock levels

### Phase 3: Operations
- purchase orders
- receiving
- dispatches
- stock movement tracking

### Phase 4: Control and visibility
- alerts
- reports
- CSV export

### Phase 5: Polish
- improved scanner UX
- barcode generation
- quality-of-life improvements

---

## 10. Final Recommendation

For this repo, the correct MVP is not “build everything.”

The correct MVP is:

- product catalog
- stock locations
- movement history
- purchase ordering and receiving
- dispatching and returns
- alert and report visibility

That is the smallest design that makes the app operational and valuable.

If you continue with a sprint plan, start from the modules already present under [src/app/(dashboard)](src/app/(dashboard)) and build the product around the flow:

Product -> Location -> Movement -> Dispatch/Receive -> Report

This will keep the app consistent with the current architecture and minimize rework.
