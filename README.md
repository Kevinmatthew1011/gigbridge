# GigBridge

> **Disclaimer:** Fictional demo — sample money and opportunities.

GigBridge is a liquidity runway, cash-flow forecasting, and fictional sample opportunity evaluation tool designed to help delivery workers understand their 14-day cash flow, evaluate essential expense coverage, track safety buffer cushions, and preview single-opportunity impact.

---

## Tech Stack

- **Framework:** React 18 + TypeScript
- **Bundler & Dev Server:** Vite
- **Styling:** Plain CSS with system font stack and accessible contrast
- **Testing:** Vitest + React Testing Library + jsdom
- **State:** In-memory React state (no backend or local storage)

---

## Prerequisites

- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- **OS:** Linux / Ubuntu (or any standard Node-compatible environment)

---

## Project Setup & Commands

All scripts are configured in `package.json`:

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```
Starts the Vite local development server (typically at `http://localhost:5173`).

### Run Automated Tests
```bash
npm test
```
Runs the Vitest test suite once in non-watch mode.

To run tests in interactive watch mode:
```bash
npm run test:watch
```

### Build for Production
```bash
npm run build
```
Typechecks via `tsc` and bundles optimized production assets into `dist/`.

### Preview Production Build
```bash
npm run preview
```
Spins up a local web server serving the built `dist/` directory.

---

## Implemented Features

### Feature 1: Financial Inputs & 14-Day Timeline
- **Pure Deterministic Calculation Engine (`src/utils/cashFlowEngine.ts`):**
  - Calculations run strictly in integer paise (1 INR = 100 paise) to eliminate floating-point rounding errors.
  - Simulates a 14-day chronological cash flow (Day 1 = Start Date, Day 14 = Start Date + 13 days).
  - Enforces same-day ordering where expenses occur before expected income, catching within-day shortfalls even if closing balances are later restored.
  - Reserves overdue unpaid bills once on Day 1 without duplication on later days.
  - Excludes overdue payouts whose expected date has already passed, providing an explanatory notification.
  - Detects the **earliest essential shortfall** (first event where cash drops below ₹0) and computes the **buffer-inclusive gap** (`safetyBuffer - projectedCash`) at that specific event.
  - Separately reports **First Below Safety Buffer** (cushion deficit, not an extra charge on top of essential shortfall).
  - Dynamically summarizes projected shortfall and buffer requirements.
- **Interactive Financial Inputs & Timeline UI:**
  - Form controls for Current Cash (excluding pending payouts), Daily Essentials, Safety Buffer, Forecast Start Date, Dated Bills/Obligations, and Earned-but-Unpaid Payouts.
  - Input validation enforcing non-negative numbers, ≤2 decimal places, and valid calendar dates without silent defaulting.
  - Responsive 14-day timeline table with **Lowest Cash That Day**, starting cash, essentials, bills, payouts, closing cash, and status badges.
  - Prominent fictional demo disclaimer banner.
  - "Reset to Demo" control restoring the initial seed scenario (₹700 starting cash, ₹200 daily essentials, Day 3 ₹500 bill, Day 7 ₹1,000 payout, ₹100 safety buffer).

### Feature 2: Fictional Opportunities Catalog & Preferences
- **Worker Preferences Panel (`src/components/WorkerPreferencesPanel.tsx`):**
  - Configurable availability by date/time, approximate area, available transport methods, skills, and confirmed platform onboarding.
- **Pure Opportunity Evaluation Engine (`src/utils/opportunityEngine.ts`):**
  - Evaluates sample opportunities against schedule availability (including outbound and return travel legs), transport requirements, skill requirements, confirmed onboarding, and financial terms.
  - Conservative lower-bound earnings used for range earnings.
  - Deducts itemized incremental costs (travel fuel, supplies, badge fees) exactly once without duplication.
  - **Internal Affordability Check:** Verifies that upfront candidate costs do not create or worsen an essential shortfall before payout arrives.
  - **Gap Timing Check:** Identifies whether expected payouts arrive before or after the earliest essential shortfall.
  - Categorizes opportunities into clearly labeled groups in stable catalog order:
    1. *Eligible Candidates* (Pre-Shortfall)
    2. *Payout Arrives Too Late for Earliest Shortfall*
    3. *Uncertain Terms / Onboarding Pending*
    4. *Ineligible / Schedule & Skill Conflicts*
- **Opportunity Catalog UI (`src/components/OpportunityCatalog.tsx`):**
  - Displays structured opportunity cards with gross pay, itemized incremental costs, net pay, schedule with travel duration, expected payout timing, and clear evaluation reasons.
  - Supports *"No eligible matches"* state and neutral *"Continue without extra work"* option (leaving baseline cash flow untouched).
  - Enabled *"Preview impact"* action on confirmed feasible opportunities; disabled preview with clear reasons on uncertain/ineligible options.

### Feature 3: Single-Opportunity Simulation Engine & Impact Preview UI
- **Pure Simulation Engine (`src/utils/simulationEngine.ts`):**
  - Accepts baseline financial inputs, worker preferences, and one candidate opportunity.
  - Reuses financial and eligibility rules, producing a non-mutating simulated forecast.
  - Compares the exact chronological event of the baseline shortfall (baseline deficit vs. remaining deficit at that event).
  - Computes simulated first below-buffer event and earliest remaining shortfall across the 14-day horizon.
- **Single-Opportunity Impact Preview UI (`src/components/OpportunitySimulationPreview.tsx`):**
  - Displays the single active preview with prominent hypothetical preview disclaimer.
  - Shows original shortfall improvement (e.g. Day 3 shortfall covered), first below-buffer event (Day 4), and remaining shortfall (Day 5).
  - Side-by-side 14-day baseline vs. simulation timeline table with candidate cost and payout cash events.
  - Single-preview model: selecting another opportunity cleanly replaces the previous preview without accumulating gigs.
  - Automatic invalidation: editing baseline financial inputs or preferences automatically clears active preview with an explanatory notice.
  - "Close Preview" / "Continue Without Extra Work" action returning cleanly to baseline.

---

## Current Limitations

- **In-Memory State:** All inputs, preferences, and timeline modifications are stored in React component memory; refreshing the page resets state back to the seed demo scenario.
- **Single-Opportunity Preview Only:** Multi-gig combination preview and automatic ranking algorithms are intentionally excluded.
- **No External Integrations:** No backend APIs, database persistence, transaction history tracking, offline synchronization, or banking integrations.
