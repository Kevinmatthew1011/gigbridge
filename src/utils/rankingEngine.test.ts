import { describe, it, expect } from 'vitest';
import { rankOpportunitiesForImmediateGap } from './rankingEngine';
import { getSeedInputs } from './cashFlowEngine';
import { getSeedWorkerPreferences, getSeedOpportunities } from './opportunityEngine';
import { Opportunity, WorkerPreferences } from '../types/opportunity';
import { FinancialInputs } from '../types/finance';
import { addDays } from './dates';

describe('rankingEngine', () => {
  const START_DATE = '2026-09-03';

  function getBaseContext() {
    const inputs = getSeedInputs(START_DATE);
    const preferences = getSeedWorkerPreferences(START_DATE);
    const opportunities = getSeedOpportunities(START_DATE);
    return { inputs, preferences, opportunities };
  }

  describe('Seed Catalog Ranking', () => {
    it('ranks Opportunity A as Rank 1 and excludes late and uncertain opportunities', () => {
      const { inputs, preferences, opportunities } = getBaseContext();

      const ranking = rankOpportunitiesForImmediateGap(inputs, opportunities, preferences);

      expect(ranking.status).toBe('ranked');
      expect(ranking.hasBaselineGap).toBe(true);
      expect(ranking.baselineShortfall?.dayIndex).toBe(3);
      expect(ranking.baselineShortfall?.deficitPaise).toBe(40000); // ₹400

      // Only Opp A qualifies
      expect(ranking.rankedOpportunities).toHaveLength(1);
      const rankedA = ranking.rankedOpportunities[0];
      expect(rankedA.rank).toBe(1);
      expect(rankedA.opportunity.id).toBe('seed-opp-a');
      expect(rankedA.metrics.deficitReductionPaise).toBe(40000); // ₹400 reduction
      expect(rankedA.metrics.remainingDeficitAtEventPaise).toBe(0); // ₹0 deficit left
      expect(rankedA.metrics.bufferInclusiveGapAtEventPaise).toBe(0); // ₹0 buffer gap
      expect(rankedA.metrics.upfrontCostBeforePayoutPaise).toBe(15000); // ₹150

      // Opp B (late payout) and Opp C (pending onboarding) are in excluded list
      expect(ranking.excludedOpportunities.some((e) => e.opportunity.id === 'seed-opp-b')).toBe(true);
      expect(ranking.excludedOpportunities.some((e) => e.opportunity.id === 'seed-opp-c')).toBe(true);
    });
  });

  describe('Sorting Criterion 1: Greater Essential Deficit Reduction', () => {
    it('ranks candidate providing higher shortfall reduction first', () => {
      const { inputs, preferences } = getBaseContext();

      // Candidate 1: Net ₹300 (reduces ₹400 deficit by ₹300, leaving ₹100 deficit)
      const candPartial: Opportunity = {
        id: 'cand-partial',
        title: 'Partial Shift',
        platformName: 'Sample Packing Platform',
        workDate: addDays(START_DATE, 1),
        startTime: '09:00',
        endTime: '13:00',
        approximateArea: 'Koramangala',
        estimatedTravel: { outboundMinutes: 10, returnMinutes: 10, costPaise: 0 },
        requiredTransport: ['two_wheeler'],
        requiredSkills: ['packing'],
        requiredOnboardingPlatform: 'Sample Packing Platform',
        earnings: { type: 'fixed', grossAmountPaise: 30000 },
        incrementalCosts: [],
        expectedPayout: { date: addDays(START_DATE, 1), timingKnown: true, description: 'Day 2' },
        isFictional: true,
      };

      // Candidate 2: Net ₹800 (reduces ₹400 deficit by ₹400, leaving ₹0 deficit)
      const candFull: Opportunity = {
        ...candPartial,
        id: 'cand-full',
        title: 'Full Shift',
        earnings: { type: 'fixed', grossAmountPaise: 80000 },
      };

      const ranking = rankOpportunitiesForImmediateGap(
        inputs,
        [candPartial, candFull],
        preferences
      );

      expect(ranking.rankedOpportunities).toHaveLength(2);
      expect(ranking.rankedOpportunities[0].opportunity.id).toBe('cand-full'); // Rank 1
      expect(ranking.rankedOpportunities[1].opportunity.id).toBe('cand-partial'); // Rank 2
    });
  });

  describe('Sorting Criterion 2: Smaller Buffer-Inclusive Deficit', () => {
    it('ranks candidate leaving smaller buffer gap higher when deficit reduction is equal', () => {
      const { inputs, preferences } = getBaseContext();

      // Both cover the ₹400 deficit completely (leaving ₹0 essential deficit), but:
      // Cand Small: Net ₹450 -> Day 3 balance = 300 - 200 + 450 - 200 - 500 = -150 -> wait:
      // Let's compute exact balance:
      // Baseline Day 1 closing: 500.
      // Day 2: 500 - 200 (daily) = 300 + payout.
      // Day 3: start (300 + payout) - 200 (daily) - 500 (bill) = payout - 400.
      // If payout is ₹400 -> Day 3 balance = 0. Buffer gap = 100 - 0 = ₹100.
      // If payout is ₹480 -> Day 3 balance = +₹80. Buffer gap = 100 - 80 = ₹20.
      // In both cases, essential deficit is ₹0 (both reduced by ₹400).
      // Cand Higher Buffer (payout 480) leaves buffer gap of ₹20 vs Cand Lower Buffer (payout 400) leaves buffer gap of ₹100.
      const candSmallBufferGap: Opportunity = {
        id: 'cand-buffer-gap-20',
        title: 'Shift 480',
        platformName: 'Sample Packing Platform',
        workDate: addDays(START_DATE, 1),
        startTime: '09:00',
        endTime: '13:00',
        approximateArea: 'Koramangala',
        estimatedTravel: { outboundMinutes: 10, returnMinutes: 10, costPaise: 0 },
        requiredTransport: ['two_wheeler'],
        requiredSkills: ['packing'],
        requiredOnboardingPlatform: 'Sample Packing Platform',
        earnings: { type: 'fixed', grossAmountPaise: 48000 }, // ₹480
        incrementalCosts: [],
        expectedPayout: { date: addDays(START_DATE, 1), timingKnown: true, description: 'Day 2' },
        isFictional: true,
      };

      const candLargerBufferGap: Opportunity = {
        ...candSmallBufferGap,
        id: 'cand-buffer-gap-100',
        title: 'Shift 400',
        earnings: { type: 'fixed', grossAmountPaise: 40000 }, // ₹400
      };

      const ranking = rankOpportunitiesForImmediateGap(
        inputs,
        [candLargerBufferGap, candSmallBufferGap],
        preferences
      );

      expect(ranking.rankedOpportunities[0].opportunity.id).toBe('cand-buffer-gap-20');
      expect(ranking.rankedOpportunities[0].metrics.bufferInclusiveGapAtEventPaise).toBe(2000); // ₹20
      expect(ranking.rankedOpportunities[1].opportunity.id).toBe('cand-buffer-gap-100');
      expect(ranking.rankedOpportunities[1].metrics.bufferInclusiveGapAtEventPaise).toBe(10000); // ₹100
    });
  });

  describe('Sorting Criterion 3: Lower Upfront Cost Before Payout', () => {
    it('ranks candidate with lower upfront cost higher when shortfall and buffer gap are equal', () => {
      const { inputs, preferences } = getBaseContext();

      // Both give net +₹500 on Day 2:
      // Cand Zero Cost: Gross ₹500, Upfront cost ₹0 -> Net ₹500
      const candZeroCost: Opportunity = {
        id: 'cand-zero-cost',
        title: 'Zero Cost Shift',
        platformName: 'Sample Packing Platform',
        workDate: addDays(START_DATE, 1),
        startTime: '09:00',
        endTime: '14:00',
        approximateArea: 'Koramangala',
        estimatedTravel: { outboundMinutes: 10, returnMinutes: 10, costPaise: 0 },
        requiredTransport: ['two_wheeler'],
        requiredSkills: ['packing'],
        requiredOnboardingPlatform: 'Sample Packing Platform',
        earnings: { type: 'fixed', grossAmountPaise: 50000 }, // ₹500
        incrementalCosts: [],
        expectedPayout: { date: addDays(START_DATE, 1), timingKnown: true, description: 'Day 2' },
        isFictional: true,
      };

      // Cand With Cost: Gross ₹600, Upfront cost ₹100 on Day 1 -> Net ₹500
      const candWithCost: Opportunity = {
        ...candZeroCost,
        id: 'cand-with-cost',
        title: 'Cost Shift',
        earnings: { type: 'fixed', grossAmountPaise: 60000 },
        incrementalCosts: [
          {
            id: 'c-1',
            description: 'Day 1 equipment',
            amountPaise: 10000, // ₹100
            paymentDate: START_DATE,
            timingKnown: true,
          },
        ],
      };

      const ranking = rankOpportunitiesForImmediateGap(
        inputs,
        [candWithCost, candZeroCost],
        preferences
      );

      expect(ranking.rankedOpportunities[0].opportunity.id).toBe('cand-zero-cost');
      expect(ranking.rankedOpportunities[1].opportunity.id).toBe('cand-with-cost');
    });
  });

  describe('Sorting Criterion 4: Higher Net Earnings Per Work Hour', () => {
    it('ranks candidate with higher net/hour higher when gap, buffer, and costs are equal', () => {
      const { inputs, preferences } = getBaseContext();

      // Cand 2 Hours: Gross ₹600 in 2 hours -> ₹300/hr
      const cand2h: Opportunity = {
        id: 'cand-2h',
        title: 'Fast Shift',
        platformName: 'Sample Packing Platform',
        workDate: addDays(START_DATE, 1),
        startTime: '09:00',
        endTime: '11:00', // 2 hours
        approximateArea: 'Koramangala',
        estimatedTravel: { outboundMinutes: 10, returnMinutes: 10, costPaise: 0 },
        requiredTransport: ['two_wheeler'],
        requiredSkills: ['packing'],
        requiredOnboardingPlatform: 'Sample Packing Platform',
        earnings: { type: 'fixed', grossAmountPaise: 60000 }, // ₹600
        incrementalCosts: [],
        expectedPayout: { date: addDays(START_DATE, 1), timingKnown: true, description: 'Day 2' },
        isFictional: true,
      };

      // Cand 6 Hours: Gross ₹600 in 6 hours -> ₹100/hr
      const cand6h: Opportunity = {
        ...cand2h,
        id: 'cand-6h',
        title: 'Long Shift',
        endTime: '15:00', // 6 hours
      };

      const ranking = rankOpportunitiesForImmediateGap(inputs, [cand6h, cand2h], preferences);

      expect(ranking.rankedOpportunities[0].opportunity.id).toBe('cand-2h');
      expect(ranking.rankedOpportunities[0].metrics.netEarningsPerHourPaise).toBe(30000); // ₹300/hr
      expect(ranking.rankedOpportunities[1].opportunity.id).toBe('cand-6h');
      expect(ranking.rankedOpportunities[1].metrics.netEarningsPerHourPaise).toBe(10000); // ₹100/hr
    });
  });

  describe('Sorting Criterion 5: Shorter Total Travel Time', () => {
    it('ranks candidate with shorter travel time higher when other metrics are equal', () => {
      const { inputs, preferences } = getBaseContext();

      const candNear: Opportunity = {
        id: 'cand-near',
        title: 'Near Shift',
        platformName: 'Sample Packing Platform',
        workDate: addDays(START_DATE, 1),
        startTime: '09:00',
        endTime: '13:00',
        approximateArea: 'Koramangala',
        estimatedTravel: { outboundMinutes: 10, returnMinutes: 10, costPaise: 0 }, // 20m travel
        requiredTransport: ['two_wheeler'],
        requiredSkills: ['packing'],
        requiredOnboardingPlatform: 'Sample Packing Platform',
        earnings: { type: 'fixed', grossAmountPaise: 60000 },
        incrementalCosts: [],
        expectedPayout: { date: addDays(START_DATE, 1), timingKnown: true, description: 'Day 2' },
        isFictional: true,
      };

      const candFar: Opportunity = {
        ...candNear,
        id: 'cand-far',
        title: 'Far Shift',
        estimatedTravel: { outboundMinutes: 40, returnMinutes: 40, costPaise: 0 }, // 80m travel
      };

      const ranking = rankOpportunitiesForImmediateGap(inputs, [candFar, candNear], preferences);

      expect(ranking.rankedOpportunities[0].opportunity.id).toBe('cand-near');
      expect(ranking.rankedOpportunities[1].opportunity.id).toBe('cand-far');
    });
  });

  describe('Sorting Criterion 6: Stable Opportunity ID Tie-Breaker', () => {
    it('breaks ties deterministically by lexicographical opportunity ID when all 5 metrics match', () => {
      const { inputs, preferences } = getBaseContext();

      const candAlpha: Opportunity = {
        id: 'alpha-opp',
        title: 'Shift A',
        platformName: 'Sample Packing Platform',
        workDate: addDays(START_DATE, 1),
        startTime: '09:00',
        endTime: '13:00',
        approximateArea: 'Koramangala',
        estimatedTravel: { outboundMinutes: 10, returnMinutes: 10, costPaise: 0 },
        requiredTransport: ['two_wheeler'],
        requiredSkills: ['packing'],
        requiredOnboardingPlatform: 'Sample Packing Platform',
        earnings: { type: 'fixed', grossAmountPaise: 60000 },
        incrementalCosts: [],
        expectedPayout: { date: addDays(START_DATE, 1), timingKnown: true, description: 'Day 2' },
        isFictional: true,
      };

      const candBeta: Opportunity = {
        ...candAlpha,
        id: 'beta-opp',
        title: 'Shift B',
      };

      const ranking = rankOpportunitiesForImmediateGap(inputs, [candBeta, candAlpha], preferences);

      expect(ranking.rankedOpportunities[0].opportunity.id).toBe('alpha-opp');
      expect(ranking.rankedOpportunities[1].opportunity.id).toBe('beta-opp');
    });
  });

  describe('No Essential Shortfall Scenario', () => {
    it('returns no_immediate_essential_gap when baseline has zero shortfalls', () => {
      const { preferences, opportunities } = getBaseContext();

      const healthyInputs: FinancialInputs = {
        ...getSeedInputs(START_DATE),
        currentCashPaise: 500000, // ₹5,000
        bills: [],
      };

      const ranking = rankOpportunitiesForImmediateGap(healthyInputs, opportunities, preferences);

      expect(ranking.status).toBe('no_immediate_essential_gap');
      expect(ranking.hasBaselineGap).toBe(false);
      expect(ranking.rankedOpportunities).toHaveLength(0);
      expect(ranking.explanation).toContain('no essential shortfall');
    });
  });

  describe('No Qualifying Opportunities Scenario', () => {
    it('returns no_qualifying_opportunities when all candidates are excluded', () => {
      const { inputs, opportunities } = getBaseContext();

      // Worker has no transport and no skills
      const noMatchPreferences: WorkerPreferences = {
        availability: [],
        approximateArea: 'Nowhere',
        availableTransport: [],
        skills: [],
        confirmedOnboarding: [],
      };

      const ranking = rankOpportunitiesForImmediateGap(inputs, opportunities, noMatchPreferences);

      expect(ranking.status).toBe('no_qualifying_opportunities');
      expect(ranking.hasBaselineGap).toBe(true);
      expect(ranking.rankedOpportunities).toHaveLength(0);
      expect(ranking.excludedOpportunities.length).toBeGreaterThan(0);
    });
  });

  describe('Input Immutability', () => {
    it('does not mutate baseline inputs or preferences across repeated ranking runs', () => {
      const { inputs, preferences, opportunities } = getBaseContext();
      const inputsSnapshot = JSON.stringify(inputs);
      const preferencesSnapshot = JSON.stringify(preferences);

      rankOpportunitiesForImmediateGap(inputs, opportunities, preferences);
      rankOpportunitiesForImmediateGap(inputs, opportunities, preferences);

      expect(JSON.stringify(inputs)).toBe(inputsSnapshot);
      expect(JSON.stringify(preferences)).toBe(preferencesSnapshot);
    });
  });
});
