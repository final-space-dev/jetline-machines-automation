# Jetline Machines Automation

Automated system for comparing meter reading volumes from Jetline's database systems with Xerox-provided volume data.

## Overview

This project compares machine meter readings across multiple company database schemas with volumes provided by Xerox. It implements Qlik Sense transformation logic to calculate incremental volumes and provides detailed Excel reports with sub-meter breakdowns.

## Features

- Queries 63+ company MySQL database schemas
- Implements Qlik logic: `FirstSortedValue(DISTINCT totalamt,-reading_date_time)`
- Calculates incremental monthly volumes from cumulative meter readings
- Compares DB volumes with Xerox-provided volumes
- Generates detailed Excel reports with sub-meter breakdowns (A3, Black, Large, Colour, XL)
- Tracks machine models and company entities

## Setup

### Prerequisites

- Node.js 18+ (for Next.js app)
- Python 3.8+ (for analysis scripts)
- MySQL database access

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd jetline-machines-automation
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Install Python dependencies:
```bash
pip3 install -r requirements.txt
```

4. Create `.env` file from example:
```bash
cp .env.example .env
```

5. Configure environment variables in `.env`:
```
DB_USER=your_db_user
DB_PASSWORD=your_db_password
```

## Usage

### Run Volume Comparison

Compare all serials across databases with Xerox data:

```bash
python3 scripts/export_comparison_excel.py
```

Generates: `Volume_Comparison_Report.xlsx`

### Analyze Specific Serial

Detailed analysis of a single serial number:

```bash
python3 scripts/analyze_3135455511.py
```

Generates: `Serial_3135455511_Analysis.xlsx`

### Next.js Application

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
.
├── app/                    # Next.js app directory
├── lib/                    # Shared libraries
│   ├── companies.ts        # Company/schema configurations
│   └── query.ts            # Database query utilities
├── scripts/                # Python analysis scripts
│   ├── export_comparison_excel.py
│   ├── analyze_3135455511.py
│   └── analyze_with_subtotals.py
├── tests/                  # Test files
└── Volumes from Xerox.xlsx # Source data from Xerox
```

## Report Columns

### Volume Comparison Report

- **Serial**: Machine serial number
- **Model**: Machine model from DB
- **Company**: Entity/company name
- **Month**: Month-Year
- **DB A3, DB Black, DB Large, DB Colour, DB XL**: Individual meter movements from DB
- **DB Total**: Total DB movement (calculated incrementally)
- **Xerox A3 Mono, A4 Mono, A3 Color, A4 Color**: Xerox sub-meters
- **Xerox Total**: Total Xerox movement
- **Difference**: DB Total - Xerox Total
- **DB Balance**: Cumulative meter balance

## Qlik Logic Implementation

The system replicates Qlik Sense transformations:

1. **Last Reading Per Day**: Takes last reading by `createdtime` DESC
2. **Monthly Aggregation**: Takes last day's reading per month
3. **Incremental Calculation**: Current month - previous month
4. **Filtering**: Only includes active machines (`machinestatus = 1`)

## License

Proprietary - Jetline Network Support Centre
