import { describe, it, expect } from 'vitest';
import { simulateOpportunity } from './simulationEngine';
import { getSeedInputs } from './cashFlowEngine';
import { getSeedWorkerPreferences, getSeedOpportunities } from './opportunityEngine';
import { Opportunity } from '../types/opportunity';
import { FinancialInputs } from '../types/finance';
import { addDays } from './dates';

describe('simulationEngine', () => {
  const START_DATE = '2026-09-03';

  function getBaseSetup() {
    const inputs = getSeedInputs(START_DATE);
    const preferences = getSeedWorkerPreferences(START_DATE);
    const opportunities = getSeedOpportunities(START_DATE);
    return { inputs, preferences, opportunities };
  }

  describe('Exact Seed Verification (Opportunity A)', () => {
    it('accurately computes simulated closing balances and remaining gaps for Seed Opportunity A', () => {
      const { inputs, preferences, opportunities } = getBaseSetup();
      const oppA = opportunities[0]; // Sample Packing Shift: Gross ₹800 Day 2, Travel ₹150 Day 1

      const result = simulateOpportunity(inputs, oppA, preferences);

      expect(result.isFeasible).toBe(true);
      expect(result.rejectionReasons).toHaveLength(0);

      const days = result.simulatedSummary.days;
      expect(days).toHaveLength(14);

      // Expected simulated closing balances:
      // Day 1: 700 - 200 (daily) - 150 (travel) = ₹350
      expect(days[0].closingBalancePaise).toBe(35000);

      // Day 2: 350 - 200 (daily) + 800 (gross payout) = ₹950
      expect(days[1].closingBalancePaise).toBe(95000);

      // Day 3: 950 - 200 (daily) - 500 (bill) = ₹250
      expect(days[2].closingBalancePaise).toBe(25000);

      // Day 4: 250 - 200 (daily) = ₹50
      // First below ₹100 buffer on Day 4, gap = 100 - 50 = ₹50
      expect(days[3].closingBalancePaise).toBe(5000);

      // Day 5: 50 - 200 (daily) = -₹150
      // First remaining essential shortfall on Day 5, deficit ₹150
      expect(days[4].closingBalancePaise).toBe(-15000);

      // Check comparison at original Day 3 shortfall event:
      expect(result.originalShortfallComparison).not.toBeNull();
      expect(result.originalShortfallComparison?.dayIndex).toBe(3);
      expect(result.originalShortfallComparison?.baselineDeficitPaise).toBe(40000); // ₹400
      expect(result.originalShortfallComparison?.simulatedBalanceAtEventPaise).toBe(25000); // ₹250
      expect(result.originalShortfallComparison?.remainingDeficitAtEventPaise).toBe(0); // ₹0 deficit
      expect(result.originalShortfallComparison?.bufferInclusiveGapAtEventPaise).toBe(0); // ₹0 gap (250 >= 100)
      expect(result.originalShortfallComparison?.isOriginalDeficitResolved).toBe(true);

      // First below buffer in simulation is Day 4, gap ₹50
      expect(result.simulatedFirstBelowSafetyBuffer?.dayIndex).toBe(4);
      expect(result.simulatedFirstBelowSafetyBuffer?.bufferDeficitPaise).toBe(5000); // ₹50

      // Earliest remaining shortfall in simulation is Day 5, deficit ₹150
      expect(result.simulatedEarliestEssentialShortfall?.dayIndex).toBe(5);
      expect(result.simulatedEarliestEssentialShortfall?.deficitPaise).toBe(15000); // ₹150
      expect(result.hasRemainingOrLaterShortfall).toBe(true);
    });
  });

  describe('Partial Coverage of the Original Gap', () => {
    it('reports remaining deficit at the original event when opportunity income is smaller than the shortfall', () => {
      const { inputs, preferences, opportunities } = getBaseSetup();

      // Make Day 3 bill ₹1,200 (baseline deficit on Day 3 becomes 300 - 200 - 1200 = -1100)
      const highBillInputs: FinancialInputs = {
        ...inputs,
        bills: [
          {
            id: 'huge-bill',
            title: 'Large Bill',
            amountPaise: 120000, // ₹1,200
            dueDate: addDays(START_DATE, 2), // Day 3
          },
        ],
      };

      const oppA = opportunities[0]; // Net +₹650
      const result = simulateOpportunity(highBillInputs, oppA, preferences);

      expect(result.isFeasible).toBe(true);
      // On Day 3: starting 950 - 200 daily - 1200 bill = -450 (deficit ₹450)
      expect(result.originalShortfallComparison?.baselineDeficitPaise).toBe(110000); // ₹1,100
      expect(result.originalShortfallComparison?.remainingDeficitAtEventPaise).toBe(45000); // ₹450
      expect(result.originalShortfallComparison?.isOriginalDeficitResolved).toBe(false);
      expect(result.originalShortfallComparison?.bufferInclusiveGapAtEventPaise).toBe(55000); // 100 - (-450) = 550
    });
  });

  describe('Payout Too Late for Earlier Shortfall', () => {
    it('does not reduce the earlier Day 3 shortfall when payout arrives on Day 8', () => {
      const { inputs, preferences, opportunities } = getBaseSetup();
      const oppB = opportunities[1]; // Sample Courier Shift: payout on Day 8 (₹1,200)

      const result = simulateOpportunity(inputs, oppB, preferences);

      // Payout is on Day 8, so Day 3 balance remains unchanged at -₹400
      expect(result.isFeasible).toBe(true);
      expect(result.originalShortfallComparison?.dayIndex).toBe(3);
      expect(result.originalShortfallComparison?.remainingDeficitAtEventPaise).toBe(40000); // Still ₹400
      expect(result.originalShortfallComparison?.isOriginalDeficitResolved).toBe(false);
      // Day 3 closing in simulation is still -₹400
      expect(result.simulatedSummary.days[2].closingBalancePaise).toBe(-40000);
    });
  });

  describe('Same-day Expenses Before Payout', () => {
    it('applies same-day candidate expenses before candidate income', () => {
      const { inputs, preferences } = getBaseSetup();

      const sameDayOpp: Opportunity = {
        id: 'same-day-opp',
        title: 'Same Day Gig',
        platformName: 'Sample Packing Platform',
        workDate: addDays(START_DATE, 1), // Day 2
        startTime: '10:00',
        endTime: '14:00',
        approximateArea: 'Koramangala',
        estimatedTravel: { outboundMinutes: 10, returnMinutes: 10, costPaise: 5000 },
        requiredTransport: ['two_wheeler'],
        requiredSkills: ['packing'],
        requiredOnboardingPlatform: 'Sample Packing Platform',
        earnings: { type: 'fixed', grossAmountPaise: 50000 }, // ₹500
        incrementalCosts: [
          {
            id: 'c1',
            description: 'Same day equipment fee',
            amountPaise: 10000, // ₹100 paid Day 2
            paymentDate: addDays(START_DATE, 1),
            timingKnown: true,
          },
        ],
        expectedPayout: {
          date: addDays(START_DATE, 1), // Day 2
          timingKnown: true,
          description: 'Payout Day 2',
        },
        isFictional: true,
      };

      const result = simulateOpportunity(inputs, sameDayOpp, preferences);
      expect(result.isFeasible).toBe(true);

      // Day 2: starting 500.
      // Expenses occur first: 200 daily + 100 candidate cost = 300 expenses.
      // Min intraday balance = 500 - 300 = 200.
      // Payout 500 arrives: closing balance = 200 + 500 = 700.
      const day2 = result.simulatedSummary.days[1];
      expect(day2.minIntradayBalancePaise).toBe(20000);
      expect(day2.closingBalancePaise).toBe(70000);
    });
  });

  describe('Infeasible, Unaffordable, or Uncertain Opportunities Rejection', () => {
    it('rejects candidate with unaffordable upfront cost', () => {
      const { preferences } = getBaseSetup();

      // Tight cash: ₹100 current cash, ₹100 daily essentials
      const tightCashInputs: FinancialInputs = {
        currentCashPaise: 10000, // ₹100
        dailyEssentialPaise: 10000, // ₹100
        safetyBufferPaise: 5000,
        startDate: START_DATE,
        bills: [],
        payouts: [],
      };

      const expensiveCostOpp: Opportunity = {
        ...getSeedOpportunities(START_DATE)[0],
        incrementalCosts: [
          {
            id: 'c-expensive',
            description: 'High upfront tool rental',
            amountPaise: 20000, // ₹200 paid Day 1
            paymentDate: START_DATE,
            timingKnown: true,
          },
        ],
      };

      const result = simulateOpportunity(tightCashInputs, expensiveCostOpp, preferences);
      expect(result.isFeasible).toBe(false);
      expect(result.rejectionReasons.length).toBeGreaterThan(0);
      expect(result.explanation).toContain('creates or deepens a cash shortfall');
    });

    it('rejects candidate with unconfirmed onboarding or unknown terms', () => {
      const { inputs, preferences, opportunities } = getBaseSetup();
      const oppC = opportunities[2]; // Sample Quick Warehouse Shift (onboarding pending)

      const result = simulateOpportunity(inputs, oppC, preferences);
      expect(result.isFeasible).toBe(false);
      expect(result.rejectionReasons.some((r) => r.includes('pending or unconfirmed'))).toBe(true);
    });
  });

  describe('Single-deduction of Costs & Non-mutating Isolation', () => {
    it('does not deduct costs twice and maintains strict baseline immutability across repeated calls', () => {
      const { inputs, preferences, opportunities } = getBaseSetup();
      const oppA = opportunities[0];
      const oppB = opportunities[1];

      // Clone original snapshot
      const baselineSnapshot = JSON.stringify(inputs);

      // Run simulation A
      const resA = simulateOpportunity(inputs, oppA, preferences);
      expect(resA.simulatedSummary.days[0].closingBalancePaise).toBe(35000); // 700 - 200 - 150 = 350

      // Run simulation B
      const resB = simulateOpportunity(inputs, oppB, preferences);
      expect(resB.simulatedSummary.days[0].closingBalancePaise).toBe(50000); // 700 - 200 = 500 (no travel on Day 1)

      // Run simulation A again
      const resA2 = simulateOpportunity(inputs, oppA, preferences);
      expect(resA2.simulatedSummary.days[0].closingBalancePaise).toBe(35000);

      // Verify baseline inputs were never mutated
      expect(JSON.stringify(inputs)).toBe(baselineSnapshot);
    });
  });
});
