# Mini-AgniSuite

Mini-AgniSuite is a local-first warehouse and dispatch management platform built with Next.js 16, PGlite, Supabase, and Tailwind CSS v4.

The system is designed to manage stock, warehouse and site movement, receiving, dispatching, returns, write-offs, alerts, and reporting in one operational dashboard.

## Product Goal

The core mission of the product is to provide a simple but reliable operational control layer for inventory movement across multiple locations.

At the MVP level, the product should support:

- product catalog management
- stock visibility by warehouse and site
- receiving purchase orders
- dispatching stock to other sites or customers
- handling returns and write-offs
- alerts for low inventory and stock issues
- basic operational reporting

## MVP Scope

This project is best understood as a warehouse operations system, not a generic admin tool.

### In scope for MVP

1. Dashboard
   - KPI cards
   - stock summary
   - low-stock alerts
   - recent activity

2. Products
   - create and edit products
   - SKU / product code support
   - stock visibility
   - barcode-linked flows

3. Warehouses and Sites
   - manage locations
   - maintain stock balances by site
   - support transfers between locations

4. Purchase Orders
   - create purchase orders
   - receive stock against POs
   - track item-level receiving

5. Dispatches
   - issue stock from warehouse or site
   - capture dispatch notes
   - support acknowledgment workflow

6. Returns and Write-offs
   - return stock to warehouse
   - supplier return process
   - remove damaged, expired, or lost stock

7. Alerts
   - low stock warnings
   - zero stock detection
   - operational threshold notifications

8. Reports
   - stock summary
   - movement logs
   - export to CSV / spreadsheet-friendly formats

### Deferred from MVP

- elaborate barcode batch printing workflows
- advanced camera scanning polish
- heavy audit complexity
- large analytics dashboards
- deep backup orchestration beyond simple local-first behavior

---

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- PGlite (local PostgreSQL in WASM)
- Supabase (auth and backup support)
- pnpm

---

## Architecture Overview

The app is structured as a layered system:

### 1. Route layer
This is the user-facing app surface under the app router.

- app/(auth)
- app/(dashboard)
- app/api
- app/auth

### 2. UI layer
Reusable visual building blocks and layout components.

- components/layout
- components/ui
- dashboard feature components

### 3. Business logic layer
Server actions and business rules.

- app/actions
- services

### 4. Data access layer
Persistence and repository logic.

- repositories
- lib
- types

### 5. Infrastructure layer
Database, middleware, config, storage, auth.

- supabase
- middleware.ts
- next.config.ts
- local DB persistence under .data/pglite

---

## Project Structure

```text
mini-agnisuite/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/
│   │   │   ├── alerts/
│   │   │   ├── audits/
│   │   │   ├── contacts/
│   │   │   ├── dispatches/
│   │   │   ├── products/
│   │   │   ├── purchase-orders/
│   │   │   ├── reports/
│   │   │   ├── returns/
│   │   │   ├── scanner/
│   │   │   ├── settings/
│   │   │   ├── site-returns/
│   │   │   ├── sites/
│   │   │   ├── transfers/
│   │   │   ├── warehouses/
│   │   │   ├── write-offs/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── error.tsx
│   │   ├── actions/
│   │   │   ├── alertActions.ts
│   │   │   ├── auditActions.ts
│   │   │   ├── dashboardActions.ts
│   │   │   ├── poActions.ts
│   │   │   ├── productActions.ts
│   │   │   ├── settingsActions.ts
│   │   │   ├── siteActions.ts
│   │   │   ├── siteReturnActions.ts
│   │   │   ├── supplierReturnActions.ts
│   │   │   ├── transferActions.ts
│   │   │   ├── warehouseActions.ts
│   │   │   └── writeOffActions.ts
│   │   ├── api/
│   │   ├── auth/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── not-found.tsx
│   │   └── global-error.tsx
│   ├── components/
│   │   ├── dashboard/
│   │   ├── dispatches/
│   │   ├── layout/
│   │   ├── products/
│   │   ├── purchase-orders/
│   │   ├── scanner/
│   │   ├── settings/
│   │   ├── site-returns/
│   │   └── ui/
│   ├── constants/
│   ├── hooks/
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── csv.ts
│   │   ├── excel.ts
│   │   ├── money.ts
│   │   ├── numberGen.ts
│   │   ├── quick-prefill.ts
│   │   ├── utils.ts
│   │   ├── valuation.ts
│   │   ├── demo/
│   │   └── supabase/
│   ├── repositories/
│   │   ├── auditRepo.ts
│   │   ├── contactRepo.ts
│   │   ├── dispatchRepo.ts
│   │   ├── poRepo.ts
│   │   ├── productRepo.ts
│   │   ├── siteRepo.ts
│   │   ├── siteReturnRepo.ts
│   │   ├── supplierReturnRepo.ts
│   │   ├── transferRepo.ts
│   │   ├── warehouseRepo.ts
│   │   └── writeOffRepo.ts
│   ├── services/
│   │   ├── alertService.ts
│   │   ├── slipService.ts
│   │   ├── stockService.ts
│   │   └── valuationService.ts
│   ├── types/
│   ├── instrumentation.ts
│   ├── middleware.ts
│   └──
│
├── supabase/
│   ├── migrations/
│   └── setup_all.sql
├── public/
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── eslint.config.mjs
├── next-env.d.ts
├── README.md
├── AGENTS.md
├── CLAUDE.md
└── .env.local.example (if present in project)
```

---

## How the App Is Structured

A clean way to understand this project is to follow the flow of a request:

1. A user loads a route in the app folder
2. The route renders a page or section
3. The page calls a server action or data fetch
4. The action calls a service
5. The service uses a repository
6. The repository reads or writes the database
7. The result is returned to the UI

This means the app is organized in a standard layered architecture:

- page and UI: app + components
- workflow and rules: actions + services
- persistence: repositories + lib
- storage and auth: supabase + middleware

---

## MVP Development Priorities

### Priority 1: Inventory and stock foundation

Build these first:

- products
- warehouses
- sites
- stock balances
- movement history

### Priority 2: Operational flow

Next:

- purchase orders
- receiving
- dispatches
- transfers

### Priority 3: Control and reporting

Then add:

- alerts
- dashboard summaries
- low-stock warnings
- reports and exports

### Priority 4: Experience and enhancement

Finally, add:

- scanner UX polish
- barcode generation improvements
- advanced automation and reporting

---

## Recommended MVP Route Map

These are the essential routes the product should keep in the first working release:

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

The app already contains these modules under the dashboard route tree.

---

## Reading Order for Developers

To understand the codebase quickly, read in this order:

1. README.md
2. package.json
3. src/app/(dashboard)/page.tsx
4. src/app/(dashboard)/layout.tsx
5. src/components/layout/Sidebar.tsx
6. src/components/layout/Topbar.tsx
7. src/repositories
8. src/services
9. src/app/actions
10. src/types
11. src/lib
12. supabase/

This order shows the real app flow from screen to storage.

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase project (optional for full functionality, useful for backups/auth)

### Install dependencies

```bash
pnpm install
```

### Run the app in development mode

```bash
pnpm dev
```

### Run linting

```bash
pnpm lint
```

### Run TypeScript checks

```bash
pnpm typecheck
```

### Production build

```bash
pnpm build
```

### Run the production build

```bash
pnpm start
```

---

## Environment Setup

Copy the env template if available and fill in your values.

```bash
cp .env.local.example .env.local
```

Typical required variables:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-secret-key
SUPABASE_JWKS_URL=https://your-project.supabase.co/auth/v1/.well-known/jwks.json
```

For local dev bypass, you can enable:

```bash
NEXT_PUBLIC_DEV_BYPASS=true
```

## Role and Location Visibility

Organization owners and managers can access all organization locations. Other
roles only receive location data for locations assigned to their account;
owner-assigned primary sites are also accessible. Records that reference
multiple locations are visible only when every referenced location is assigned.

Location assignments are managed in Admin, not from a user's profile. The
server actions filter results and validate requested locations, while Supabase
row-level security enforces the same boundary for direct database requests.
Apply `supabase/migrations/00013_location_scoped_access.sql` to existing
Supabase projects, followed by `supabase/migrations/00014_dispatch_sender_name.sql`
to store dispatch sender names. The standalone `supabase/setup_all.sql` includes
both for new setups. Local demo data is scoped by the server actions.

---

## Local-First Database Model

The project is designed to be local-first:

- the app uses PGlite as a local Postgres-style database
- data persists locally under a data directory
- backups can be pushed to Supabase storage
- the app is built to remain usable without depending on a cloud database for primary operations

This means the product is designed for reliable local-first warehouse operations while still allowing external backup and sync workflows.

---

## Demo Credentials

After the app is seeded, demo accounts exist for testing flows.

| Email | Password | Role |
| --- | --- | --- |
| owner@agnisuite.com | password123 | Owner |
| manager@agnisuite.com | password123 | Manager |
| staff@agnisuite.com | password123 | Staff |

With dev bypass enabled, login can be skipped during local development.

---

## Recommended MVP Statement

The right MVP for this project is:

Product → Location → Movement → Dispatch/Receive → Report

In plain English, the app should do these things extremely well:

- track products
- track warehouse and site stock
- receive stock from suppliers
- dispatch stock to sites or outgoing operations
- track returns and write-offs
- show alerts and summaries
- export operational reports

This is the smallest operationally useful system that fits the current codebase and product direction.

---

## Final Notes

This repo already contains a strong starting architecture and a broad feature set. The key is not to build every module at once, but to consolidate around the operational MVP first.

The product should be treated as a real-world warehouse management platform, with strong emphasis on consistency, stock accuracy, and operational visibility.

---

## License

Internal use only.
