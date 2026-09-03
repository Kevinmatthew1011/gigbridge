import { describe, it, expect } from 'vitest';
import { getSeedInputs, calculate14DayCashFlow } from './cashFlowEngine';
import {
  getSeedWorkerPreferences,
  getSeedOpportunities,
  evaluateOpportunity,
} from './opportunityEngine';
import { simulateOpportunity } from './simulationEngine';
import { extractAllFacts, extractBaselineFacts } from './factExtractor';
import { validateAndRenderExplanation, checkMessageApplicability } from './explanationValidator';
import { ExplanationPayload, EventFact, AmountFact, OutcomeFact } from '../types/explanation';
import { FinancialInputs } from '../types/finance';
import { Opportunity } from '../types/opportunity';
import { addDays } from './dates';

describe('AI Explanation Phase 1 - Fact Extraction, Validation & Templating', () => {
  const startDate = '2026-09-03';

  // --------------------------------------------------------------------------
  // 1. SEED BASELINE SCENARIO
  // --------------------------------------------------------------------------
  describe('Seed Baseline Scenario', () => {
    it('extracts correct ground-truth facts: Day 3 shortfall of ₹400 and buffer-inclusive gap of ₹500', () => {
      const inputs = getSeedInputs(startDate);
      const summary = calculate14DayCashFlow(inputs);
      const facts = extractBaselineFacts(inputs, summary);

      // Verify baseline essential shortfall
      const shortfall = facts.FACT_BASELINE_ESSENTIAL_SHORTFALL as EventFact;
      expect(shortfall.presence).toBe('present');
      expect(shortfall.dayIndex).toBe(3);
      expect(shortfall.deficitPaise).toBe(40000); // ₹400
      expect(shortfall.bufferInclusiveGapPaise).toBe(50000); // ₹500

      // Verify buffer breach on Day 3 (deficit ₹500 below safety buffer)
      const breach = facts.FACT_BASELINE_BUFFER_BREACH as EventFact;
      expect(breach.presence).toBe('present');
      expect(breach.dayIndex).toBe(3);
      expect(breach.bufferDeficitPaise).toBe(50000); // ₹500 (₹100 buffer - (-₹400 lowest))

      // Verify amounts
      const cashFact = facts.FACT_BASELINE_CURRENT_CASH as AmountFact;
      expect(cashFact.paise).toBe(70000); // ₹700

      const bufferFact = facts.FACT_BASELINE_SAFETY_BUFFER as AmountFact;
      expect(bufferFact.paise).toBe(10000); // ₹100
    });

    it('renders valid baseline explanation with essential gap and buffer gap', () => {
      const inputs = getSeedInputs(startDate);
      const summary = calculate14DayCashFlow(inputs);
      const facts = extractBaselineFacts(inputs, summary);

      const payload: ExplanationPayload = {
        messages: [
          {
            messageId: 'baseline_essential_shortfall',
            referencedFactIds: ['FACT_BASELINE_ESSENTIAL_SHORTFALL'],
          },
          {
            messageId: 'baseline_buffer_gap',
            referencedFactIds: ['FACT_BASELINE_SAFETY_BUFFER', 'FACT_BASELINE_ESSENTIAL_SHORTFALL'],
          },
        ],
      };

      const result = validateAndRenderExplanation(payload, facts, {
        fallbackText: summary.explanation,
      });

      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.source).toBe('ai_constrained');
        expect(result.renderedText).toContain('first essential cash shortfall of ₹400 occurs on Day 3');
        expect(result.renderedText).toContain('requires ₹500 total (includes the ₹400 essential deficit');
      }
    });

    it('rejects baseline_no_shortfall when baseline shortfall exists', () => {
      const inputs = getSeedInputs(startDate);
      const summary = calculate14DayCashFlow(inputs);
      const facts = extractBaselineFacts(inputs, summary);

      const payload: ExplanationPayload = {
        messages: [
          {
            messageId: 'baseline_no_shortfall',
            referencedFactIds: ['FACT_BASELINE_ESSENTIAL_SHORTFALL'],
          },
        ],
      };

      const result = validateAndRenderExplanation(payload, facts, {
        fallbackText: summary.explanation,
      });

      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.source).toBe('deterministic_fallback');
        expect(result.errors[0]).toContain('cannot claim no shortfall');
        expect(result.fallbackText).toBe(summary.explanation);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 2. SEED OPPORTUNITY A (PACKING SHIFT)
  // --------------------------------------------------------------------------
  describe('Seed Opportunity A (Packing Shift)', () => {
    it('extracts ground-truth simulation facts: covers Day 3, Day 4 buffer breach ₹50, Day 5 shortfall ₹150', () => {
      const inputs = getSeedInputs(startDate);
      const preferences = getSeedWorkerPreferences(startDate);
      const opportunities = getSeedOpportunities(startDate);
      const oppA = opportunities.find((o) => o.id === 'seed-opp-a')!;

      const summary = calculate14DayCashFlow(inputs);
      const simResult = simulateOpportunity(inputs, oppA, preferences);
      const facts = extractAllFacts({
        inputs,
        summary,
        opportunity: oppA,
        simulationResult: simResult,
      });

      // Ground truth checks from simulation engine
      const comp = facts.FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON as OutcomeFact;
      expect(comp.presence).toBe('present');
      expect(comp.isOriginalDeficitResolved).toBe(true);
      expect(comp.simulatedBalanceAtEventPaise).toBe(25000); // ₹250 on Day 3

      // First remaining shortfall occurs on Day 5 with ₹150 deficit
      const simShortfall = facts.FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL as EventFact;
      expect(simShortfall.presence).toBe('present');
      expect(simShortfall.dayIndex).toBe(5);
      expect(simShortfall.deficitPaise).toBe(15000); // ₹150

      // First buffer breach in simulation is Day 4 with ₹50 gap
      const simBreach = facts.FACT_SIM_FIRST_BUFFER_BREACH as EventFact;
      expect(simBreach.presence).toBe('present');
      expect(simBreach.dayIndex).toBe(4);
      expect(simBreach.bufferDeficitPaise).toBe(5000); // ₹50

      // A does NOT cover the entire horizon
      const outcome = facts.FACT_SIM_OUTCOME as OutcomeFact;
      expect(outcome.hasRemainingOrLaterShortfall).toBe(true);
    });

    it('validates and renders accurate simulation explanation with required disclosures and remaining gap', () => {
      const inputs = getSeedInputs(startDate);
      const preferences = getSeedWorkerPreferences(startDate);
      const opportunities = getSeedOpportunities(startDate);
      const oppA = opportunities.find((o) => o.id === 'seed-opp-a')!;
      const summary = calculate14DayCashFlow(inputs);
      const simResult = simulateOpportunity(inputs, oppA, preferences);
      const facts = extractAllFacts({
        inputs,
        summary,
        opportunity: oppA,
        simulationResult: simResult,
      });

      const payload: ExplanationPayload = {
        messages: [
          {
            messageId: 'original_gap_covered',
            referencedFactIds: ['FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON', 'FACT_BASELINE_ESSENTIAL_SHORTFALL'],
          },
          {
            messageId: 'later_gap_remains',
            referencedFactIds: ['FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL'],
          },
          {
            messageId: 'fictional_opportunity_disclosure',
            referencedFactIds: [],
          },
          {
            messageId: 'work_is_optional_disclosure',
            referencedFactIds: [],
          },
        ],
      };

      const result = validateAndRenderExplanation(payload, facts, {
        fallbackText: simResult.explanation,
        requireDisclosures: true,
        requireRemainingGapStatement: true,
      });

      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.renderedText).toContain('covers the original Day 3 essential deficit of ₹400');
        expect(result.renderedText).toContain('projected balance is ₹250 at that event');
        expect(result.renderedText).toContain('later essential shortfall occurs on Day 5');
        expect(result.renderedText).toContain('deficit of ₹150');
        expect(result.renderedText).toContain('Hypothetical preview with sample money');
        expect(result.renderedText).toContain('Extra work is completely optional');
      }
    });

    it('rejects false claim of simulated_all_clear for Opportunity A', () => {
      const inputs = getSeedInputs(startDate);
      const preferences = getSeedWorkerPreferences(startDate);
      const oppA = getSeedOpportunities(startDate).find((o) => o.id === 'seed-opp-a')!;
      const summary = calculate14DayCashFlow(inputs);
      const simResult = simulateOpportunity(inputs, oppA, preferences);
      const facts = extractAllFacts({
        inputs,
        summary,
        opportunity: oppA,
        simulationResult: simResult,
      });

      const payload: ExplanationPayload = {
        messages: [
          {
            messageId: 'original_gap_covered',
            referencedFactIds: ['FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON', 'FACT_BASELINE_ESSENTIAL_SHORTFALL'],
          },
          {
            messageId: 'simulated_all_clear', // False claim!
            referencedFactIds: [],
          },
          {
            messageId: 'fictional_opportunity_disclosure',
            referencedFactIds: [],
          },
          {
            messageId: 'work_is_optional_disclosure',
            referencedFactIds: [],
          },
        ],
      };

      const result = validateAndRenderExplanation(payload, facts, {
        fallbackText: simResult.explanation,
        requireDisclosures: true,
        requireRemainingGapStatement: true,
      });

      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errors.some((e) => e.includes('Simulated shortfall exists; cannot claim all clear'))).toBe(true);
      }
    });

    it('rejects explanation if remaining gap statement is omitted', () => {
      const inputs = getSeedInputs(startDate);
      const preferences = getSeedWorkerPreferences(startDate);
      const oppA = getSeedOpportunities(startDate).find((o) => o.id === 'seed-opp-a')!;
      const summary = calculate14DayCashFlow(inputs);
      const simResult = simulateOpportunity(inputs, oppA, preferences);
      const facts = extractAllFacts({
        inputs,
        summary,
        opportunity: oppA,
        simulationResult: simResult,
      });

      const payload: ExplanationPayload = {
        messages: [
          {
            messageId: 'original_gap_covered',
            referencedFactIds: ['FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON', 'FACT_BASELINE_ESSENTIAL_SHORTFALL'],
          },
          {
            messageId: 'fictional_opportunity_disclosure',
            referencedFactIds: [],
          },
          {
            messageId: 'work_is_optional_disclosure',
            referencedFactIds: [],
          },
        ],
      };

      const result = validateAndRenderExplanation(payload, facts, {
        fallbackText: simResult.explanation,
        requireDisclosures: true,
        requireRemainingGapStatement: true,
      });

      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errors.some((e) => e.includes('"later_gap_remains" was omitted'))).toBe(true);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3. SEED OPPORTUNITY B (LATE PAYOUT)
  // --------------------------------------------------------------------------
  describe('Seed Opportunity B (Late Payout)', () => {
    it('validates payout_too_late message and rejects original_gap_covered', () => {
      const inputs = getSeedInputs(startDate);
      const preferences = getSeedWorkerPreferences(startDate);
      const oppB = getSeedOpportunities(startDate).find((o) => o.id === 'seed-opp-b')!;
      const summary = calculate14DayCashFlow(inputs);
      const evaluation = evaluateOpportunity(oppB, preferences, inputs, summary);
      const facts = extractAllFacts({
        inputs,
        summary,
        opportunity: oppB,
        evaluation,
      });

      expect(evaluation.category).toBe('payout_too_late');

      // 1. payout_too_late message is applicable
      const lateCheck = checkMessageApplicability('payout_too_late', facts);
      expect(lateCheck.isApplicable).toBe(true);

      // 2. original_gap_covered is NOT applicable
      const coveredCheck = checkMessageApplicability('original_gap_covered', facts);
      expect(coveredCheck.isApplicable).toBe(false);

      const payload: ExplanationPayload = {
        messages: [
          {
            messageId: 'payout_too_late',
            referencedFactIds: ['FACT_OPP_PAYOUT_DATE', 'FACT_BASELINE_ESSENTIAL_SHORTFALL'],
          },
          {
            messageId: 'fictional_opportunity_disclosure',
            referencedFactIds: [],
          },
          {
            messageId: 'work_is_optional_disclosure',
            referencedFactIds: [],
          },
        ],
      };

      const result = validateAndRenderExplanation(payload, facts, {
        fallbackText: 'Deterministic fallback',
        requireDisclosures: true,
      });

      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.renderedText).toContain('after the Day 3 (Sat, 5 Sept) shortfall');
        expect(result.renderedText).toContain('Because payout timing matters');
      }
    });
  });

  // --------------------------------------------------------------------------
  // 4. SEED OPPORTUNITY C (UNCERTAIN ONBOARDING)
  // --------------------------------------------------------------------------
  describe('Seed Opportunity C (Uncertain Onboarding)', () => {
    it('validates eligibility_uncertain message and marks simulation infeasible', () => {
      const inputs = getSeedInputs(startDate);
      const preferences = getSeedWorkerPreferences(startDate);
      const oppC = getSeedOpportunities(startDate).find((o) => o.id === 'seed-opp-c')!;
      const summary = calculate14DayCashFlow(inputs);
      const evaluation = evaluateOpportunity(oppC, preferences, inputs, summary);
      const simResult = simulateOpportunity(inputs, oppC, preferences);
      const facts = extractAllFacts({
        inputs,
        summary,
        opportunity: oppC,
        evaluation,
        simulationResult: simResult,
      });

      expect(evaluation.category).toBe('uncertain_terms');
      expect(simResult.isFeasible).toBe(false);

      const payload: ExplanationPayload = {
        messages: [
          {
            messageId: 'eligibility_uncertain',
            referencedFactIds: ['FACT_OPP_EVALUATION'],
          },
          {
            messageId: 'work_is_optional_disclosure',
            referencedFactIds: [],
          },
          {
            messageId: 'fictional_opportunity_disclosure',
            referencedFactIds: [],
          },
        ],
      };

      const result = validateAndRenderExplanation(payload, facts, {
        fallbackText: simResult.explanation,
        requireDisclosures: true,
      });

      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.renderedText).toContain('unconfirmed');
        expect(result.renderedText).toContain('Preview is disabled until terms are confirmed');
      }
    });
  });

  // --------------------------------------------------------------------------
  // 5. PARTIAL COVERAGE SCENARIO
  // --------------------------------------------------------------------------
  describe('Partial Coverage Scenario', () => {
    it('validates original_gap_partially_reduced and rejects original_gap_covered', () => {
      // Create baseline with ₹500 deficit on Day 3
      const customInputs: FinancialInputs = {
        currentCashPaise: 50000, // ₹500
        dailyEssentialPaise: 20000, // ₹200
        safetyBufferPaise: 10000, // ₹100
        bills: [
          {
            id: 'bill-1',
            title: 'Bill',
            amountPaise: 50000, // ₹500
            dueDate: addDays(startDate, 2), // Day 3
          },
        ],
        payouts: [],
        startDate,
      };

      // Opportunity earning net ₹300 on Day 2
      const partialOpp: Opportunity = {
        id: 'partial-opp',
        title: 'Partial Gig',
        platformName: 'Platform',
        workDate: addDays(startDate, 1),
        startTime: '09:00',
        endTime: '12:00',
        approximateArea: 'Koramangala',
        estimatedTravel: { outboundMinutes: 0, returnMinutes: 0, costPaise: 0 },
        requiredTransport: ['two_wheeler'],
        requiredSkills: ['packing'],
        requiredOnboardingPlatform: null,
        earnings: { type: 'fixed', grossAmountPaise: 30000 }, // ₹300
        incrementalCosts: [],
        expectedPayout: {
          date: addDays(startDate, 1),
          timingKnown: true,
          description: 'Payout on Day 2',
        },
        isFictional: true,
      };

      const preferences = getSeedWorkerPreferences(startDate);
      const summary = calculate14DayCashFlow(customInputs);
      const simResult = simulateOpportunity(customInputs, partialOpp, preferences);
      const facts = extractAllFacts({
        inputs: customInputs,
        summary,
        opportunity: partialOpp,
        simulationResult: simResult,
      });

      // Baseline deficit on Day 3: starting 500 - 200 (D1) - 200 (D2) - 200 (D3) - 500 (Bill) = -600 (Deficit ₹600)
      // With +300 on D2: lowest on D3 becomes -300 (Deficit ₹300) -> partially reduced by ₹300
      const comp = facts.FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON as OutcomeFact;
      expect(comp.isOriginalDeficitResolved).toBe(false);
      expect(comp.remainingDeficitAtEventPaise).toBe(30000); // ₹300
      expect(comp.deficitReductionPaise).toBe(30000); // ₹300

      const payload: ExplanationPayload = {
        messages: [
          {
            messageId: 'original_gap_partially_reduced',
            referencedFactIds: ['FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON', 'FACT_BASELINE_ESSENTIAL_SHORTFALL'],
          },
          {
            messageId: 'later_gap_remains',
            referencedFactIds: ['FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL'],
          },
          {
            messageId: 'fictional_opportunity_disclosure',
            referencedFactIds: [],
          },
          {
            messageId: 'work_is_optional_disclosure',
            referencedFactIds: [],
          },
        ],
      };

      const result = validateAndRenderExplanation(payload, facts, {
        fallbackText: simResult.explanation,
        requireDisclosures: true,
        requireRemainingGapStatement: true,
      });

      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.renderedText).toContain('partially reduces the Day 3 shortfall from ₹600 to ₹300');
      }

      // Claiming original_gap_covered must be rejected
      const falsePayload: ExplanationPayload = {
        messages: [
          {
            messageId: 'original_gap_covered',
            referencedFactIds: ['FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON', 'FACT_BASELINE_ESSENTIAL_SHORTFALL'],
          },
        ],
      };
      const falseResult = validateAndRenderExplanation(falsePayload, facts, {
        fallbackText: simResult.explanation,
      });
      expect(falseResult.isValid).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 6. NO ESSENTIAL SHORTFALL SCENARIO
  // --------------------------------------------------------------------------
  describe('No Essential Shortfall Scenario', () => {
    it('validates baseline_no_shortfall and baseline_buffer_protected when finances are healthy', () => {
      const healthyInputs: FinancialInputs = {
        currentCashPaise: 500000, // ₹5,000
        dailyEssentialPaise: 20000, // ₹200 (14 days = ₹2,800)
        safetyBufferPaise: 50000, // ₹500
        bills: [],
        payouts: [],
        startDate,
      };

      const summary = calculate14DayCashFlow(healthyInputs);
      const facts = extractBaselineFacts(healthyInputs, summary);

      const payload: ExplanationPayload = {
        messages: [
          {
            messageId: 'baseline_no_shortfall',
            referencedFactIds: [],
          },
          {
            messageId: 'baseline_buffer_protected',
            referencedFactIds: ['FACT_BASELINE_SAFETY_BUFFER'],
          },
        ],
      };

      const result = validateAndRenderExplanation(payload, facts, {
        fallbackText: summary.explanation,
      });

      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.renderedText).toContain('All essential expenses are projected to be covered');
        expect(result.renderedText).toContain('maintains at least your ₹500 target cushion');
      }
    });
  });

  // --------------------------------------------------------------------------
  // 7. BUFFER-ONLY BREACH SCENARIO
  // --------------------------------------------------------------------------
  describe('Buffer-Only Breach Scenario', () => {
    it('validates baseline_buffer_only_breach and rejects baseline_buffer_protected', () => {
      // Cash starts at ₹3,000, daily ₹200 (14 days = ₹2,800), final closing = ₹200.
      // Safety buffer is ₹500. Balance dips below ₹500 on Day 13 without any essential shortfall (< ₹0).
      const bufferBreachInputs: FinancialInputs = {
        currentCashPaise: 300000, // ₹3,000
        dailyEssentialPaise: 20000, // ₹200
        safetyBufferPaise: 50000, // ₹500
        bills: [],
        payouts: [],
        startDate,
      };

      const summary = calculate14DayCashFlow(bufferBreachInputs);
      const facts = extractBaselineFacts(bufferBreachInputs, summary);

      expect(summary.earliestEssentialShortfall).toBeNull();
      expect(summary.earliestBufferBreach).not.toBeNull();

      const payload: ExplanationPayload = {
        messages: [
          {
            messageId: 'baseline_buffer_only_breach',
            referencedFactIds: ['FACT_BASELINE_BUFFER_BREACH', 'FACT_BASELINE_SAFETY_BUFFER'],
          },
        ],
      };

      const result = validateAndRenderExplanation(payload, facts, {
        fallbackText: summary.explanation,
      });

      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.renderedText).toContain('All essential expenses are covered across 14 days');
        expect(result.renderedText).toContain('below your ₹500 target cushion');
      }

      // Reject claiming buffer is protected
      const protectedCheck = checkMessageApplicability('baseline_buffer_protected', facts);
      expect(protectedCheck.isApplicable).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 8. MALFORMED / INVALID / HALLUCINATED RESPONSES & FALLBACK
  // --------------------------------------------------------------------------
  describe('Validation Robustness & Fallback Handling', () => {
    const inputs = getSeedInputs(startDate);
    const summary = calculate14DayCashFlow(inputs);
    const facts = extractBaselineFacts(inputs, summary);

    it('rejects null or non-object payloads', () => {
      const result = validateAndRenderExplanation(null, facts, { fallbackText: 'Fallback' });
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.source).toBe('deterministic_fallback');
        expect(result.fallbackText).toBe('Fallback');
      }
    });

    it('rejects unknown message IDs', () => {
      const payload = {
        messages: [{ messageId: 'invented_ai_financial_advice', referencedFactIds: [] }],
      };
      const result = validateAndRenderExplanation(payload, facts, { fallbackText: 'Fallback' });
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errors[0]).toContain('unapproved messageId');
      }
    });

    it('rejects unknown Fact IDs', () => {
      const payload: ExplanationPayload = {
        messages: [
          {
            messageId: 'baseline_essential_shortfall',
            referencedFactIds: ['FACT_NON_EXISTENT' as any],
          },
        ],
      };
      const result = validateAndRenderExplanation(payload, facts, { fallbackText: 'Fallback' });
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errors[0]).toContain('unknown Fact ID');
      }
    });

    it('rejects missing required disclosures when requested', () => {
      const payload: ExplanationPayload = {
        messages: [
          {
            messageId: 'baseline_essential_shortfall',
            referencedFactIds: ['FACT_BASELINE_ESSENTIAL_SHORTFALL'],
          },
        ],
      };
      const result = validateAndRenderExplanation(payload, facts, {
        fallbackText: 'Fallback',
        requireDisclosures: true,
      });
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errors.some((e: string) => e.includes('Missing required disclosure'))).toBe(true);
      }
    });
  });
});
