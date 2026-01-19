# Jetline Machines - Fleet Management System

Comprehensive printer fleet management system for Jetline stores. Track, monitor, and optimize printer deployments across all locations with real-time data visualization and scenario planning.

## Features

### Dashboard
- **KPI Overview**: Total machines, active status, balance remaining, utilization rates
- **Volume Trends**: Monthly print volume analysis with interactive charts
- **Category Distribution**: Visual breakdown of machines by type
- **Performance Tracking**: Identify top and under-performing machines
- **Contract Alerts**: Expiring contracts with days remaining

### Machine Management
- Full machine inventory with search and filters
- Sort by serial, model, company, balance, install date, or status
- Export data to Excel
- Real-time status badges (Active, Inactive, Maintenance, Decommissioned)

### Store Analytics
- Store-level fleet breakdown
- Machine counts and balance summaries
- Export store data to Excel

### Model Analytics
- Model-wise distribution and counts
- Performance metrics by model type

### Lift Planner (Scenario Planning)
- **Drag-and-Drop Interface**: Visually plan machine relocations
- **Multi-Store Comparison**: Side-by-side view of different stores
- **Scenario Saving**: Save and load "what-if" configurations
- **Move Tracking**: Track all proposed moves with from/to details

### Data Sync
- Automated BMS database synchronization
- Sync history and status tracking

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS 4
- **Database**: PostgreSQL with Prisma ORM
- **Charts**: Recharts
- **Drag & Drop**: @dnd-kit
- **UI Components**: shadcn/ui (Radix)
- **Icons**: Lucide React

## Quick Start

```bash
cd webapp
npm install
npm run dev
```

Open [http://localhost:3003](http://localhost:3003)

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Installation

1. Navigate to the webapp:
   ```bash
   cd webapp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. Setup database:
   ```bash
   npm run db:push
   npm run db:seed
   ```

5. Start development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
jetline-machines-automation/
├── webapp/                 # Main Next.js application
│   ├── prisma/             # Database schema & seeds
│   ├── src/
│   │   ├── app/            # App Router pages & API routes
│   │   ├── components/     # React components
│   │   ├── lib/            # Utilities & Prisma client
│   │   └── types/          # TypeScript types
│   └── package.json
├── scripts/                # Python analysis scripts
├── CONTEXT.md              # Project context
└── README.md
```

## Analysis Scripts

Python scripts for volume comparison with Xerox data:

```bash
pip3 install -r requirements.txt
python3 scripts/export_comparison_excel.py
```

## License

Proprietary - Jetline Internal Use Only
