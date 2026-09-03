import { describe, it, expect } from 'vitest';
import {
  getSeedWorkerPreferences,
  getSeedOpportunities,
  evaluateOpportunity,
  evaluateOpportunityCatalog,
} from './opportunityEngine';
import { calculate14DayCashFlow, getSeedInputs } from './cashFlowEngine';
import { Opportunity, WorkerPreferences } from '../types/opportunity';
import { FinancialInputs } from '../types/finance';
import { addDays } from './dates';

describe('opportunityEngine', () => {
  const START_DATE = '2026-09-03';

  function getBaseContext() {
    const inputs = getSeedInputs(START_DATE);
    const summary = calculate14DayCashFlow(inputs);
    const preferences = getSeedWorkerPreferences(START_DATE);
    const opportunities = getSeedOpportunities(START_DATE);
    return { inputs, summary, preferences, opportunities };
  }

  describe('Seed Catalog Evaluation', () => {
    it('evaluates seed items into appropriate groups for seed financial state', () => {
      const { inputs, summary, preferences, opportunities } = getBaseContext();
      const catalogEval = evaluateOpportunityCatalog(opportunities, preferences, inputs, summary);

      // Item A: Sample Packing Shift -> eligible candidate (Day 2 payout <= Day 3 shortfall)
      expect(catalogEval.groupedEvaluations.eligibleCandidates).toHaveLength(1);
      const oppA = catalogEval.groupedEvaluations.eligibleCandidates[0];
      expect(oppA.opportunity.id).toBe('seed-opp-a');
      expect(oppA.isEligible).toBe(true);
      expect(oppA.netEarningsPaise).toBe(65000); // 800 - 150 = 650
      expect(oppA.category).toBe('eligible_immediate');

      // Item B: Sample Courier Shift -> too late for Day 3 gap (payout on Day 8)
      expect(catalogEval.groupedEvaluations.payoutTooLate).toHaveLength(1);
      const oppB = catalogEval.groupedEvaluations.payoutTooLate[0];
      expect(oppB.opportunity.id).toBe('seed-opp-b');
      expect(oppB.isTooLateForGap).toBe(true);

      // Item C: Sample Quick Warehouse Shift -> uncertain/pending onboarding
      expect(catalogEval.groupedEvaluations.uncertainTerms).toHaveLength(1);
      const oppC = catalogEval.groupedEvaluations.uncertainTerms[0];
      expect(oppC.opportunity.id).toBe('seed-opp-c');
      expect(oppC.onboardingPending).toBe(true);
    });
  });

  describe('Schedule conflict including travel time', () => {
    it('detects conflict when worker availability does not accommodate outbound and return travel', () => {
      const { inputs, summary, preferences } = getBaseContext();

      // Shift is 09:00 to 17:00, with 30m outbound (needs 08:30) and 30m return (needs 17:30)
      // If worker availability on Day 2 is only 09:00 to 17:00:
      const tightPreferences: WorkerPreferences = {
        ...preferences,
        availability: preferences.availability.map((a) =>
          a.date === addDays(START_DATE, 1)
            ? { date: a.date, slots: [{ startTime: '09:00', endTime: '17:00' }] }
            : a
        ),
      };

      const opp = getSeedOpportunities(START_DATE)[0]; // Seed Opp A
      const evaluation = evaluateOpportunity(opp, tightPreferences, inputs, summary);

      expect(evaluation.scheduleConflict).toBe(true);
      expect(evaluation.isEligible).toBe(false);
      expect(evaluation.category).toBe('ineligible_conflict');
      expect(evaluation.scheduleReason).toContain('including 30m outbound + 30m return travel');
    });
  });

  describe('Transport and Skills mismatch', () => {
    it('flags missing transport and missing skills', () => {
      const { inputs, summary, preferences } = getBaseContext();

      const walkingNoPackingPreferences: WorkerPreferences = {
        ...preferences,
        availableTransport: ['walking'], // No two-wheeler
        skills: ['cleaning'], // No packing
      };

      const opp = getSeedOpportunities(START_DATE)[0]; // Requires two_wheeler & packing
      const evaluation = evaluateOpportunity(opp, walkingNoPackingPreferences, inputs, summary);

      expect(evaluation.transportMismatch).toBe(true);
      expect(evaluation.skillsMismatch).toBe(true);
      expect(evaluation.missingTransport).toEqual(['two_wheeler']);
      expect(evaluation.missingSkills).toEqual(['packing']);
      expect(evaluation.category).toBe('ineligible_conflict');
    });
  });

  describe('Unknown financial terms and unknown onboarding', () => {
    it('marks opportunities with unknown payout timing or unknown onboarding as uncertain', () => {
      const { inputs, summary, preferences } = getBaseContext();

      const unknownPayoutOpp: Opportunity = {
        ...getSeedOpportunities(START_DATE)[0],
        id: 'opp-unknown-payout',
        expectedPayout: {
          date: null,
          timingKnown: false,
          description: 'Payout date unknown',
        },
      };

      const evaluation = evaluateOpportunity(unknownPayoutOpp, preferences, inputs, summary);
      expect(evaluation.timingUncertain).toBe(true);
      expect(evaluation.category).toBe('uncertain_terms');
    });
  });

  describe('Unaffordable upfront costs', () => {
    it('detects when an upfront expense creates or worsens an essential shortfall before payout', () => {
      // Scenario: Current cash is ₹100, daily essentials ₹100.
      // Upfront travel cost is ₹150 on Day 1.
      // Day 1 starting 100 - daily 100 - travel 150 = -150 (shortfall created on Day 1!)
      const tightCashInputs = {
        ...getSeedInputs(START_DATE),
        currentCashPaise: 10000, // ₹100
        dailyEssentialPaise: 10000, // ₹100
      };
      const tightSummary = calculate14DayCashFlow(tightCashInputs);
      const preferences = getSeedWorkerPreferences(START_DATE);

      const expensiveUpfrontOpp: Opportunity = {
        ...getSeedOpportunities(START_DATE)[0],
        id: 'opp-expensive-upfront',
        incrementalCosts: [
          {
            id: 'cost-high',
            description: 'Advance equipment deposit',
            amountPaise: 15000, // ₹150 paid Day 1
            paymentDate: START_DATE,
            timingKnown: true,
          },
        ],
      };

      const evaluation = evaluateOpportunity(
        expensiveUpfrontOpp,
        preferences,
        tightCashInputs,
        tightSummary
      );

      expect(evaluation.isUnaffordable).toBe(true);
      expect(evaluation.category).toBe('ineligible_conflict');
      expect(evaluation.affordabilityReason).toContain('creates or deepens a cash shortfall');
    });
  });

  describe('Net earnings without duplicate cost deduction', () => {
    it('calculates net earnings by deducting listed incremental costs exactly once', () => {
      const { inputs, summary, preferences } = getBaseContext();

      const oppWithCosts: Opportunity = {
        ...getSeedOpportunities(START_DATE)[0],
        earnings: {
          type: 'fixed',
          grossAmountPaise: 100000, // ₹1,000
        },
        estimatedTravel: {
          outboundMinutes: 10,
          returnMinutes: 10,
          costPaise: 10000, // ₹100 travel cost recorded in incremental costs
        },
        incrementalCosts: [
          {
            id: 'cost-1',
            description: 'Travel fuel',
            amountPaise: 10000, // ₹100
            paymentDate: START_DATE,
            timingKnown: true,
            isTravelCost: true,
          },
          {
            id: 'cost-2',
            description: 'Platform service fee',
            amountPaise: 5000, // ₹50
            paymentDate: START_DATE,
            timingKnown: true,
          },
        ],
      };

      const evalResult = evaluateOpportunity(oppWithCosts, preferences, inputs, summary);
      // Net = 1,000 - (100 + 50) = 850 (85000 paise). NOT 750 (which would be deducting travel twice)
      expect(evalResult.totalIncrementalCostsPaise).toBe(15000);
      expect(evalResult.netEarningsPaise).toBe(85000);
    });
  });

  describe('Conservative lower-bound earnings for range earnings', () => {
    it('uses lower bound for conservative net earnings and affordability', () => {
      const { inputs, summary, preferences } = getBaseContext();

      const rangeOpp: Opportunity = {
        ...getSeedOpportunities(START_DATE)[0],
        earnings: {
          type: 'range',
          grossAmountPaise: 80000, // ₹800 lower bound
          maxGrossAmountPaise: 120000, // ₹1,200 upper bound
        },
        incrementalCosts: [
          {
            id: 'cost-1',
            description: 'Supplies',
            amountPaise: 10000, // ₹100
            paymentDate: START_DATE,
            timingKnown: true,
          },
        ],
      };

      const evalResult = evaluateOpportunity(rangeOpp, preferences, inputs, summary);
      // Net should be based on ₹800: 800 - 100 = 700 (70000 paise)
      expect(evalResult.conservativeGrossPaise).toBe(80000);
      expect(evalResult.netEarningsPaise).toBe(70000);
    });
  });

  describe('No eligible matches scenario', () => {
    it('handles scenario gracefully when all opportunities are filtered out', () => {
      const { inputs, summary, preferences, opportunities } = getBaseContext();

      // Worker has no skills and no transport
      const noMatchPreferences: WorkerPreferences = {
        ...preferences,
        availableTransport: [],
        skills: [],
      };

      const catalogEval = evaluateOpportunityCatalog(
        opportunities,
        noMatchPreferences,
        inputs,
        summary
      );

      expect(catalogEval.groupedEvaluations.eligibleCandidates).toHaveLength(0);
      expect(catalogEval.groupedEvaluations.ineligibleConflicts.length).toBeGreaterThan(0);
    });
  });

  describe('No essential shortfall scenario', () => {
    it('does not invent an urgent gap when baseline has no shortfall', () => {
      // High starting cash -> no shortfall across all 14 days
      const healthyInputs: FinancialInputs = {
        ...getSeedInputs(START_DATE),
        currentCashPaise: 500000, // ₹5,000
        bills: [],
      };
      const healthySummary = calculate14DayCashFlow(healthyInputs);
      expect(healthySummary.earliestEssentialShortfall).toBeNull();

      const preferences = getSeedWorkerPreferences(START_DATE);
      const opportunities = getSeedOpportunities(START_DATE);

      const catalogEval = evaluateOpportunityCatalog(
        opportunities,
        preferences,
        healthyInputs,
        healthySummary
      );

      expect(catalogEval.hasEarliestGap).toBe(false);
      expect(catalogEval.earliestGapDayIndex).toBeNull();
      // Opp A and Opp B are both generally eligible (no urgent gap to be "too late" for)
      expect(catalogEval.groupedEvaluations.payoutTooLate).toHaveLength(0);
      expect(catalogEval.groupedEvaluations.eligibleCandidates).toHaveLength(2); // Opp A and Opp B
      expect(catalogEval.groupedEvaluations.eligibleCandidates[0].category).toBe('eligible_general');
    });
  });

  describe('Timely payout with hard conflict is excluded from eligible', () => {
    it('excludes an opportunity with missing skills or transport even if payout is timely', () => {
      const { inputs, summary, preferences } = getBaseContext();

      // Payout is timely (Day 2), but missing skill
      const noPackingPreferences: WorkerPreferences = {
        ...preferences,
        skills: ['delivery'], // Missing packing
      };

      const oppA = getSeedOpportunities(START_DATE)[0]; // Requires packing, payout Day 2
      const evaluation = evaluateOpportunity(oppA, noPackingPreferences, inputs, summary);

      expect(evaluation.isEligible).toBe(false);
      expect(evaluation.skillsMismatch).toBe(true);
      expect(evaluation.category).toBe('ineligible_conflict');
    });
  });

  describe('Baseline isolation', () => {
    it('ensures baseline cash flow remains strictly unaffected by preferences or catalog state', () => {
      const { inputs, summary, preferences, opportunities } = getBaseContext();

      // Initial baseline
      const initialClosingDay3 = summary.days[2].closingBalancePaise;
      expect(initialClosingDay3).toBe(-40000);

      // Evaluate catalog
      evaluateOpportunityCatalog(opportunities, preferences, inputs, summary);

      // Verify baseline inputs and calculation remain identical
      const recomputedSummary = calculate14DayCashFlow(inputs);
      expect(recomputedSummary.days[2].closingBalancePaise).toBe(-40000);
      expect(recomputedSummary.earliestEssentialShortfall?.deficitPaise).toBe(40000);
    });
  });
});
