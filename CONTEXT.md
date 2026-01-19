# Context

Jetline Machines - Comprehensive Printer Fleet Management System for Jetline stores.

## Architecture

- **Main Application**: `/webapp` - Next.js 16 with App Router, Prisma ORM, Recharts
- **Analysis Scripts**: `/scripts` - Python scripts for volume comparison and reporting
- **Data Files**: `/data` - Excel source data and generated reports
- **Port**: 3003

## Webapp Pages

- **Dashboard** (`/`) - KPI overview, volume trends, category distribution, performance tracking
- **Machines** (`/machines`) - Full inventory with search, filters, sorting, export
- **Stores** (`/stores`) - Store-level fleet management and details
- **Models** (`/models`) - Machine model analytics and breakdowns
- **Contracts** (`/contracts`) - Contract tracking and expiry alerts
- **Lift Planner** (`/lift`) - Scenario planning for machine relocations
- **Sync** (`/sync`) - BMS database synchronization and history
- **Settings** (`/settings`) - Application configuration

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS 4
- **Charts**: Recharts
- **Drag & Drop**: @dnd-kit
- **UI Components**: shadcn/ui (Radix)

## Running the Application

```bash
cd webapp
npm install
npm run dev
```

Opens at http://localhost:3003

## Database Commands

```bash
npm run db:push    # Push schema changes
npm run db:studio  # Open Prisma GUI
npm run db:seed    # Seed initial data
```

## Python Scripts

Analysis scripts for volume comparison with Xerox data:

```bash
python3 scripts/export_comparison_excel.py
```
