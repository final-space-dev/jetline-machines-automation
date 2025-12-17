# Jetline Machines - Fleet Management System

A comprehensive printer fleet management system for Jetline stores. Track, monitor, and optimize printer deployments across all locations with real-time data visualization and scenario planning.

## Features

### Dashboard
- **KPI Overview**: Total machines, active status, balance remaining, utilization rates
- **Volume Trends**: Monthly print volume analysis with interactive charts
- **Category Distribution**: Visual breakdown of machines by type
- **Performance Tracking**: Identify top and under-performing machines

### Machine Management
- Full machine inventory with search and filters
- Sort by serial, model, company, balance, install date, or status
- Export data to CSV
- Real-time status badges (Active, Inactive, Maintenance, Decommissioned)

### War Room (Scenario Planner)
- **Drag-and-Drop Interface**: Visually plan machine relocations
- **Multi-Store Comparison**: Side-by-side view of different stores
- **Scenario Saving**: Save and load "what-if" configurations
- **Move Tracking**: Track all proposed moves with from/to details
- **Balance Optimization**: See how moves affect store balances

### Data Sync
- Automated BMS database synchronization
- Sync history and status tracking
- Support for daily incremental updates

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Charts**: Recharts
- **Drag & Drop**: @dnd-kit
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

1. Clone the repository and navigate to the webapp directory:
   ```bash
   cd webapp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. Create the database:
   ```bash
   createdb jetline_machines
   ```

5. Push the schema and seed data:
   ```bash
   npm run db:push
   npm run db:seed
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3003](http://localhost:3003) in your browser.

### Database Commands

```bash
# Push schema changes to database
npm run db:push

# Open Prisma Studio (database GUI)
npm run db:studio

# Seed the database with initial data
npm run db:seed
```

## Project Structure

```
webapp/
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.ts          # Seed script
├── src/
│   ├── app/
│   │   ├── api/         # API routes
│   │   ├── layout.tsx   # Root layout
│   │   └── page.tsx     # Main page
│   ├── components/
│   │   ├── dashboard/   # Dashboard components
│   │   ├── layout/      # Navigation & layout
│   │   ├── settings/    # Settings panel
│   │   ├── tables/      # Table components
│   │   ├── ui/          # Reusable UI components
│   │   └── warroom/     # War Room components
│   ├── lib/
│   │   ├── prisma.ts    # Prisma client
│   │   └── utils.ts     # Utility functions
│   └── types/
│       └── index.ts     # TypeScript types
└── package.json
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/machines` | GET | List all machines with filters |
| `/api/machines` | POST | Create a new machine |
| `/api/companies` | GET | List all companies |
| `/api/companies` | POST | Create a new company |
| `/api/categories` | GET | List all categories |
| `/api/dashboard` | GET | Get dashboard statistics |
| `/api/scenarios` | GET | List all scenarios |
| `/api/scenarios` | POST | Save a new scenario |
| `/api/sync` | GET | Get sync history |
| `/api/sync` | POST | Trigger data sync |

## War Room Usage

1. **Select Companies**: Add stores you want to compare from the dropdown
2. **Drag Machines**: Drag machine cards between store columns
3. **Track Moves**: See proposed relocations in the summary panel
4. **Save Scenario**: Name and save your configuration
5. **Load Scenarios**: Reload previously saved scenarios

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/jetline_machines` |
| `NEXT_PUBLIC_APP_URL` | Public app URL | `http://localhost:3003` |

## License

Proprietary - Jetline Internal Use Only
