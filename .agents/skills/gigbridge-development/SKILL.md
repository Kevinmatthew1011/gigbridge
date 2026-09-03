---
name: gigbridge-development
description: >-
  Development guidelines, architectural boundaries, testing protocols, and safety rules for working on the GigBridge codebase.
---

# GigBridge Development Workflow & Guardrails

Use this skill when developing, refactoring, or verifying features in the GigBridge repository.

## 1. Inspection & Workspace Safety
- Always inspect the repository and current `git status` before making edits.
- Preserve existing user modifications and never overwrite unrelated code or assets.
- Do not commit, push, deploy, or change GitHub repository settings unless explicitly requested.
- Exclude deployment, presentation, or demo-rehearsal tasks from the project scope.

## 2. Determinism & Financial Engine Rules
- All cash-flow projections, opportunity eligibility evaluations, rankings, and single-opportunity simulations must remain 100% deterministic and rule-based.
- Calculations must use integer paise arithmetic (1 INR = 100 paise) to eliminate floating-point precision errors.
- Preserve fictional demo disclaimers across the UI: all monetary values, worker schedules, and opportunity listings are sample data.

## 3. Constrained AI Explanation Gateway
- **Bounded AI Role**: AI models (Groq, Gemini) are strictly limited to selecting approved message IDs and citing verified fact IDs.
- **Application-Owned Rendering**: All user-facing explanations, numbers, and currency formatting are generated solely by application-owned deterministic templates.
- **Provider Hierarchy**: Groq (`openai/gpt-oss-20b`) is the documented primary live provider; Google Gemini (`gemini-3.6-flash`) and offline Mock (`deterministic-mock`) are optional providers.
- **Deterministic Fallback**: If an AI request times out, fails schema validation, fails semantic verification, or errors, return deterministic fallback text immediately without exposing internal payloads.
- **Cache & Concurrency**: Maintain gateway in-memory LRU caching, multi-subscriber request coalescing, cancellation on input changes, and `bypassCache` regeneration logic.

## 4. Secret Protection & Environment Isolation
- Never expose, log, print, commit, or inspect live API keys or credential fragments.
- Keep `.env.server` untracked in `.gitignore` and never import it into client-side code.
- Ensure `.env.server.example` contains only blank placeholders for secrets (`GROQ_API_KEY=`, `GEMINI_API_KEY=`).

## 5. Standard Verification Protocol
Before reporting task completion, always execute the full verification suite:
1. `npm test` — Ensure all unit and integration test suites pass (100%).
2. `npm run typecheck` — Verify clean TypeScript compilation (`tsc --noEmit`).
3. `npm run build` — Verify production Vite bundle builds cleanly.
4. `git diff --check` — Ensure no whitespace, conflict markers, or formatting errors exist.
5. Report exact verification metrics and `git status --short`.
