# AI Explanation Architecture & Validation Specification

> **Phase 1 Implementation:** Deterministic Fact Extraction, Constrained Explanation Contract, Applicability Verification, and Deterministic Fallback.

---

## 1. Ground Truth & Corrected Seed Baseline

All financial calculations and timeline events are derived exclusively from the deterministic engines (`cashFlowEngine`, `simulationEngine`, `opportunityEngine`, `rankingEngine`).

### 1.1 Seed Baseline Scenario
- **Starting Cash:** ₹700 (70,000 paise)
- **Daily Essentials:** ₹200 (20,000 paise)
- **Safety Buffer Target:** ₹100 (10,000 paise)
- **Bills:** Day 3 Bill of ₹500 (50,000 paise)
- **Payouts:** Day 7 Payout of ₹1,000 (100,000 paise)
- **Ground-Truth Events:**
  - **Day 1:** Expenses ₹200 ➔ Intraday Lowest ₹500 ➔ Closing ₹500
  - **Day 2:** Expenses ₹200 ➔ Intraday Lowest ₹300 ➔ Closing ₹300
  - **Day 3:** Expenses ₹200 + Bill ₹500 = ₹700 ➔ **Intraday Lowest -₹400** (Essential Shortfall = **₹400**)
  - **Buffer-Inclusive Gap on Day 3:** ₹100 buffer - (-₹400 lowest) = **₹500**
  - **First Below Safety Buffer:** Day 3 (deficit ₹500 relative to ₹100 buffer)
  - **14-Day Horizon Minimum Balance:** **-₹1,600** (-160,000 paise on Day 14)
  - **14-Day Final Closing Balance:** **-₹1,600** (-160,000 paise on Day 14)

---

### 1.2 Seed Opportunity Trajectories

#### Seed Opportunity A: Sample Packing Shift (Fictional)
- **Work Date:** Day 2 (09:00 - 17:00)
- **Financial Terms:** Gross ₹800 (payout Day 2), Upfront cost ₹150 (paid Day 1), Net ₹650
- **Simulation Trajectory:**
  - **Day 1:** Expenses ₹200 + Cost ₹150 = ₹350 ➔ Lowest ₹350 ➔ Closing ₹350
  - **Day 2:** Expenses ₹200 ➔ Lowest ₹150 ➔ Payout +₹800 ➔ Closing ₹950
  - **Day 3:** Expenses ₹200 + Bill ₹500 = ₹700 ➔ **Lowest ₹250** (Original Day 3 deficit of ₹400 is **Covered**, ₹250 surplus balance)
  - **Day 4:** Expenses ₹200 ➔ **Lowest ₹50** (Dips below ₹100 buffer; **Buffer Deficit = ₹50**)
  - **Day 5:** Expenses ₹200 ➔ **Lowest -₹150** (**First Remaining Essential Shortfall = ₹150**)
  - **Conclusion:** Opportunity A resolves the Day 3 gap, but **does not cover the entire 14-day horizon**. A remaining gap occurs on Day 5.

#### Seed Opportunity B: Sample Express Courier Shift (Fictional)
- **Financial Terms:** Gross ₹1,200, Payout on Day 8
- **Evaluation:** Categorized as `payout_too_late` because Day 8 payout arrives after the Day 3 shortfall.

#### Seed Opportunity C: Sample Quick Warehouse Shift (Fictional)
- **Terms:** Gross ₹900, Onboarding required on unconfirmed platform.
- **Evaluation:** Categorized as `uncertain_terms`. Simulation is marked infeasible until onboarding is confirmed.

---

## 2. Deterministic Fact Model

Facts are typed and categorized into 5 distinct classes with explicit presence status (`present`, `absent`, `unknown`):

| Fact Type | Key Fields | Example Fact IDs |
| :--- | :--- | :--- |
| **`amount`** | `paise: Paise` (canonical integer) | `FACT_BASELINE_CURRENT_CASH`, `FACT_BASELINE_DAILY_ESSENTIAL`, `FACT_BASELINE_SAFETY_BUFFER`, `FACT_OPP_GROSS_EARNINGS`, `FACT_OPP_TOTAL_COSTS`, `FACT_OPP_NET_EARNINGS` |
| **`date`** | `date: string` (YYYY-MM-DD), `dayIndex?: number` | `FACT_OPP_WORK_DATE`, `FACT_OPP_PAYOUT_DATE` |
| **`event`** | `dayIndex`, `date`, `deficitPaise`, `bufferInclusiveGapPaise`, `minBalancePaise`, `bufferDeficitPaise` | `FACT_BASELINE_ESSENTIAL_SHORTFALL`, `FACT_BASELINE_BUFFER_BREACH`, `FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL`, `FACT_SIM_FIRST_BUFFER_BREACH` |
| **`eligibility`**| `category`, `isEligible`, `reasons` | `FACT_OPP_EVALUATION`, `FACT_SIM_FEASIBILITY` |
| **`outcome`** | `isOriginalDeficitResolved`, `isOriginalBufferGapResolved`, `hasRemainingOrLaterShortfall`, `remainingDeficitAtEventPaise`, `deficitReductionPaise`, `simulatedBalanceAtEventPaise` | `FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON`, `FACT_SIM_OUTCOME` |

> **Formatting Rule:** Currency formatting (`formatINR`) and date displays (`formatDateDisplay`) are derived dynamically on demand from canonical values. No dual numerical and formatted sources are maintained.

---

## 3. Constrained Explanation Contract & Applicability Rules

The future AI system is constrained strictly to selecting approved message IDs referencing verified Fact IDs. It cannot generate free-form financial advice or author ungrounded numbers.

### 3.1 Approved Message IDs & Deterministic Conditions

| Message ID | Deterministic Applicability Rule | Required Fact References |
| :--- | :--- | :--- |
| `baseline_essential_shortfall` | `FACT_BASELINE_ESSENTIAL_SHORTFALL.presence === 'present'` | `FACT_BASELINE_ESSENTIAL_SHORTFALL` |
| `baseline_buffer_gap` | `FACT_BASELINE_ESSENTIAL_SHORTFALL.presence === 'present'` | `FACT_BASELINE_SAFETY_BUFFER`, `FACT_BASELINE_ESSENTIAL_SHORTFALL` |
| `baseline_buffer_only_breach` | Baseline shortfall is `absent` AND `FACT_BASELINE_BUFFER_BREACH.presence === 'present'` | `FACT_BASELINE_BUFFER_BREACH`, `FACT_BASELINE_SAFETY_BUFFER` |
| `baseline_no_shortfall` | Baseline shortfall is `absent` | None |
| `baseline_buffer_protected` | Baseline shortfall and buffer breach are both `absent` | `FACT_BASELINE_SAFETY_BUFFER` |
| `original_gap_covered` | Simulation feasible AND `isOriginalDeficitResolved === true` | `FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON`, `FACT_BASELINE_ESSENTIAL_SHORTFALL` |
| `original_gap_partially_reduced` | Simulation feasible AND `isOriginalDeficitResolved === false` AND `deficitReductionPaise > 0` | `FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON`, `FACT_BASELINE_ESSENTIAL_SHORTFALL` |
| `payout_too_late` | Opportunity category is `payout_too_late` OR deficit reduction is 0 | `FACT_OPP_PAYOUT_DATE`, `FACT_BASELINE_ESSENTIAL_SHORTFALL` |
| `later_gap_remains` | `FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL.presence === 'present'` | `FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL` |
| `simulated_buffer_breach` | Simulated shortfall is `absent` AND simulated buffer breach is `present` | `FACT_SIM_FIRST_BUFFER_BREACH`, `FACT_BASELINE_SAFETY_BUFFER` |
| `simulated_all_clear` | Simulated shortfall is `absent` AND simulated buffer breach is `absent` | None |
| `eligibility_uncertain` | Opportunity category is `uncertain_terms` | `FACT_OPP_EVALUATION` |
| `ineligible_conflict` | Opportunity category is `ineligible_conflict` | `FACT_OPP_EVALUATION` |
| `no_opportunities_available` | Zero feasible opportunities match preferences | None |
| `fictional_opportunity_disclosure` | Mandatory for all opportunity and simulation explanations | None |
| `work_is_optional_disclosure` | Mandatory for all opportunity and simulation explanations | None |

---

## 4. Validation & Deterministic Fallback Mechanism

When an explanation payload is received:
1. **Schema Check:** Verifies non-null object with a non-empty `messages` array.
2. **Message Whitelist Check:** Rejects unapproved message IDs.
3. **Fact ID Whitelist & Presence Check:** Rejects unknown Fact IDs or references to absent/missing facts.
4. **Deterministic Applicability Verification:** Rejects messages whose logical condition evaluates to `false` against the scenario facts (even if all referenced fact IDs exist).
5. **Mandatory Disclosure Verification:** Rejects payloads missing `fictional_opportunity_disclosure` or `work_is_optional_disclosure` when evaluating sample opportunities.
6. **Required Remaining Gap Verification:** Rejects simulation payloads that omit `later_gap_remains` when an essential shortfall remains on the horizon.
7. **HTML Tag Rejection:** Ensures rendered output is pure plain text with zero HTML tags.
8. **Deterministic Fallback:** On any rejection, the system transparently serves the deterministic engine summary (`summary.explanation`, `simulationResult.explanation`, or `rankingResult.explanation`).

---

## 5. Local Explanation Gateway & Provider Boundary (Phase 2)

### 5.1 Local Server Architecture
- **Location:** `server/` (isolated from frontend `src/`).
- **Runtime:** Minimal Node.js HTTP service (`node:http`) binding strictly to `127.0.0.1:3001`.
- **Endpoints:**
  - `GET /api/health`: Health status probe.
  - `POST /api/explain`: Receives untrusted fact snapshot, validates inputs, invokes provider adapter with timeout guard, validates adapter output semantically, and returns constrained rendered explanation.
- **Vite Dev Proxy:** Configured in `vite.config.ts` to route `/api/*` requests seamlessly to `http://127.0.0.1:3001`.
- **Bounded Request Limits:** 64 KB max payload size; 2000 ms adapter timeout guard.

### 5.2 Provider Boundary & Mock Adapter
- **`ExplanationProviderAdapter` Interface:** Contracts returning constrained message arrays (`{ messages: ExplanationMessageRef[] }`).
- **`MockExplanationAdapter`:** Deterministic offline adapter used for testing and local development.
- **Source Labeling:**
  - Mock results: `source: "mock"` (never labeled `"ai"`).
  - Fallback results: `source: "fallback"`.
- **No Credentials / Zero SDKs:** No external model calls or secrets in this phase.

### 5.3 Local-Demo Trust Boundary
- The gateway rigorously validates input structure, data types, safe integers, valid calendar dates, and permitted identifier whitelists.
- In this client-side demo environment, client-submitted facts represent local scenario state and are not independently verified financial records against real-world bank feeds.
- No payload logging or financial fact recording is performed by the server.

### 5.4 Exact Startup Commands
- **Run test suite:** `npm test`
- **Run explicit typecheck:** `npm run typecheck`
- **Build production bundle:** `npm run build`
- **Start local gateway server:** `npm run server` (runs `node server/index.ts` on `127.0.0.1:3001`)
- **Start Vite frontend dev server:** `npm run dev` (proxies `/api` -> `http://127.0.0.1:3001`)

---

## 6. Client Explanation Integration & Truthful Badging (Phase 3)

### 6.1 On-Demand User Action
- Explanations are requested exclusively on user click (`Explain these results` button), never on page load, component mount, or input typing.
- Separate UI states and request handlers exist for the **14-day baseline summary** and **active single-opportunity preview**.
- Disabled with clear feedback when financial inputs or dates are invalid.

### 6.2 Truthful Source Badging
- `source: "mock"` ➔ Displayed with badge: `Demo explanation — no AI model connected` (amber/warm badge).
- `source: "fallback"` ➔ Displayed with badge: `Standard summary` (slate/neutral badge).
- Never displays an `"AI"` badge or implies a live language model is connected.
- Existing deterministic summaries remain visible and functional.

### 6.3 Client-Side Verification & Plain Text Rendering
- Client receives message IDs and referenced fact IDs from the gateway.
- Client performs semantic verification against its local fact snapshot and renders application-owned plain text templates via `renderTemplate`.
- Client never trusts returned `renderedText` as authoritative, eliminating prompt injection or untrusted string rendering risks.
- On network error, gateway failure, or semantic rejection, the client seamlessly renders the local deterministic engine summary.

### 6.4 State Invalidation & Race Condition Prevention
- In-flight requests are immediately cancelled via `AbortController` and explanation states reset to `idle` upon:
  - Editing financial inputs (cash, expenses, safety buffer, bills, payouts).
  - Editing worker availability or transport preferences.
  - Selecting a different opportunity or closing the preview.
  - Clicking "Reset to Demo".
- Stale responses arriving out of order are discarded using unique `requestId` matching.
- Baseline and preview explanation pipelines operate independently without cross-overwriting.

---

## 7. Live Providers Integration & Configuration

### 7.1 Primary Live Provider: Groq Adapter
- **Server Adapter:** [`server/groqAdapter.ts`](file:///home/kiddo/projects/vit/server/groqAdapter.ts) (`GroqExplanationAdapter`).
- **Endpoint:** `https://api.groq.com/openai/v1/chat/completions` (with `Authorization: Bearer ${apiKey}`).
- **Model:** `openai/gpt-oss-20b` (low-latency supported model with JSON mode).
- **Format:** `response_format: { type: "json_object" }`.

### 7.2 Optional Live Provider: Gemini Adapter
- **Server Adapter:** [`server/geminiAdapter.ts`](file:///home/kiddo/projects/vit/server/geminiAdapter.ts) (`GeminiExplanationAdapter`).
- **Official API Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` (with `x-goog-api-key` header authentication).
- **Structured Schema & Thinking Configuration:** Uses Gemini's native `generationConfig.responseSchema` with `responseMimeType: "application/json"`, and `thinkingConfig: { thinkingLevel: "MINIMAL" }` for fast inference.
- **Model:** `gemini-3.6-flash` (configurable).

### 7.3 Configuration & Secret Isolation
- **Environment File:** `.env.server` (strictly ignored in `.gitignore`, never imported by Vite).
- **Tracked Template:** `.env.server.example` provides default configuration fields with blank placeholders.
- **Provider Switching:** `EXPLAIN_PROVIDER=groq` (documented primary), `EXPLAIN_PROVIDER=gemini` (optional), or `EXPLAIN_PROVIDER=mock` (offline default).
- **Model Configuration:** `GROQ_MODEL=openai/gpt-oss-20b`, `GEMINI_MODEL=gemini-3.6-flash`.
- **Timeout Configuration:** `GEMINI_TIMEOUT_MS=30000` (gateway deadline 30s; client deadline 35s).

### 7.4 Source Labels & Disclosures
- **`source: "ai"`, `provider: "groq"`:** Displayed with badge `AI-assisted explanation` and disclosure: *"Groq organizes verified facts; calculations remain rule-based."*
- **`source: "ai"`, `provider: "gemini"`:** Displayed with badge `AI-assisted explanation` and disclosure: *"Gemini organizes verified facts; calculations remain rule-based."*
- **`source: "mock"`:** Displayed with badge `Demo explanation — no AI model connected`.
- **`source: "fallback"`:** Displayed with badge `Standard summary`.

---

## 8. Final Verification & Acceptance Record

- **Live Baseline Gemini Check:** PASSED (`source: "ai"` received and verified with deterministic template rendering).
- **Live Packing Shift Opportunity Gemini Check:** PASSED (`source: "ai"` received and verified with required disclosures and Day 5 remaining shortfall statement).
- **Deterministic Fallback Check:** PASSED (Verified across network errors, timeouts, HTTP 401 auth failures, HTTP 429 quota limits, HTTP 404 model errors, and semantic contradictions).
- **Offline Mock Mode:** PASSED (`source: "mock"` operates without network calls or credentials).
- **Deployment Status:** In-scope local pair programming only; no deployment performed or required.



