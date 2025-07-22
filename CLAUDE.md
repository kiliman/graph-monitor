# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Graph Monitor is a system monitoring tool that captures metrics by executing shell commands, stores the results in SQLite, and generates static PNG charts for visualization.

## Architecture

The system consists of two main components:

1. **Data Capture Component** (`/src`):
   - Executes configured shell commands periodically
   - Stores metrics in SQLite database (`/data/metrics.db`)
   - Performs automatic data rollups (5m, 30m, 1h, 2h, 4h, 12h, 24h intervals)
   - Generates static PNG charts using Chart.js

2. **Web Server Component** (`/web/serve-charts.ts`):
   - Serves static chart PNG files from `/web/charts` directory
   - Provides index.html for viewing charts
   - Runs on port 8080

## Key Commands

```bash
# Install dependencies
npm install

# Run data capture only
npm run capture

# Run web server only  
npm run serve

# Run both components
npm start

# Run in development mode with file watching
npm run dev
```

## Important Technical Details

### Data Flow
1. `config.json` defines metrics (shell commands) and graph specifications
2. Scheduler (`src/scheduler.ts`) executes commands based on intervals
3. Executor (`src/executor.ts`) parses command output for duration and status
4. Database (`src/database.ts`) stores raw metrics and manages rollups
5. Chart generator (`src/chartGenerator.ts`) creates PNG files from data
6. HTTP server serves charts from `/web/charts` directory

### Database Schema
- `metrics` table: Raw metric data (id, timestamp, name, value, status)
- `rollup_*` tables: Aggregated data at various intervals

### Current Configuration
The system currently monitors:
- `mail.bigdeskenergy.com` response time
- `google.com` response time

### Implementation Notes
- Uses TypeScript with ESM modules (requires Node.js v24+ with --experimental-strip-types)
- Winston logger writes to `/logs` directory
- No test framework is configured
- Generates static PNG charts served by a simple HTTP server