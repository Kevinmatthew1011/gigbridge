import { describe, it, expect } from 'vitest';
import { calculate14DayCashFlow, getSeedInputs } from './cashFlowEngine';
import { FinancialInputs } from '../types/finance';
import { addDays } from './dates';

describe('cashFlowEngine', () => {
  const START_DATE = '2026-09-03';

  describe('Seed Demo Verification', () => {
    it('accurately calculates baseline closing balances and shortfalls for the seed scenario', () => {
      const inputs = getSeedInputs(START_DATE);
      const result = calculate14DayCashFlow(inputs);

      expect(result.days).toHaveLength(14);

      // Day 1: start 700 - daily 200 = 500
      expect(result.days[0].startingBalancePaise).toBe(70000);
      expect(result.days[0].totalExpensesPaise).toBe(20000);
      expect(result.days[0].closingBalancePaise).toBe(50000);
      expect(result.days[0].hasEssentialShortfall).toBe(false);

      // Day 2: start 500 - daily 200 = 300
      expect(result.days[1].startingBalancePaise).toBe(50000);
      expect(result.days[1].totalExpensesPaise).toBe(20000);
      expect(result.days[1].closingBalancePaise).toBe(30000);
      expect(result.days[1].hasEssentialShortfall).toBe(false);

      // Day 3: start 300 - daily 200 - bill 500 = -400
      expect(result.days[2].startingBalancePaise).toBe(30000);
      expect(result.days[2].dailyEssentialPaise).toBe(20000);
      expect(result.days[2].totalDayBillsPaise).toBe(50000);
      expect(result.days[2].totalExpensesPaise).toBe(70000);
      expect(result.days[2].minIntradayBalancePaise).toBe(-40000);
      expect(result.days[2].closingBalancePaise).toBe(-40000);
      expect(result.days[2].hasEssentialShortfall).toBe(true);
      expect(result.days[2].essentialShortfallPaise).toBe(40000);

      // Earliest essential shortfall is Day 3, deficit ₹400
      expect(result.earliestEssentialShortfall).not.toBeNull();
      expect(result.earliestEssentialShortfall?.dayIndex).toBe(3);
      expect(result.earliestEssentialShortfall?.deficitPaise).toBe(40000); // ₹400

      // Buffer-inclusive funding gap at that point is ₹500 (safety buffer 100 - (-400) = 500)
      expect(result.earliestEssentialShortfall?.bufferInclusiveGapPaise).toBe(50000); // ₹500

      // First below safety buffer is also Day 3 with ₹500 buffer gap
      expect(result.earliestBufferBreach).not.toBeNull();
      expect(result.earliestBufferBreach?.dayIndex).toBe(3);
      expect(result.earliestBufferBreach?.bufferDeficitPaise).toBe(50000); // ₹500 below ₹100 target

      // Day 7: payout arrives (+₹1,000)
      // Day 4: -400 - 200 = -600
      // Day 5: -600 - 200 = -800
      // Day 6: -800 - 200 = -1000
      // Day 7: -1000 - 200 = -1200 + 1000 = -200
      expect(result.days[6].startingBalancePaise).toBe(-100000);
      expect(result.days[6].minIntradayBalancePaise).toBe(-120000);
      expect(result.days[6].totalPayoutsPaise).toBe(100000);
      expect(result.days[6].closingBalancePaise).toBe(-20000);
    });
  });

  describe('Within-day expense-before-income shortfalls', () => {
    it('detects within-day essential shortfall when same-day expense exceeds starting cash even if payout restores closing balance', () => {
      const inputs: FinancialInputs = {
        currentCashPaise: 10000, // ₹100
        dailyEssentialPaise: 5000, // ₹50
        safetyBufferPaise: 5000, // ₹50
        startDate: START_DATE,
        bills: [
          {
            id: 'bill-d2',
            title: 'Electric Bill',
            amountPaise: 15000, // ₹150
            dueDate: addDays(START_DATE, 1), // Day 2
          },
        ],
        payouts: [
          {
            id: 'payout-d2',
            title: 'Delivery Surge Payout',
            amountPaise: 50000, // ₹500 arriving on Day 2
            expectedDate: addDays(START_DATE, 1), // Day 2
          },
        ],
      };

      const result = calculate14DayCashFlow(inputs);

      // Day 1: start 100 - daily 50 = closing 50
      expect(result.days[0].closingBalancePaise).toBe(5000);

      // Day 2: starting 50.
      // Expenses occur first: 50 daily + 150 bill = 200 expenses.
      // Min intraday balance = 50 - 200 = -150 (deficit ₹150!)
      // Payout of 500 arrives later: closing balance = -150 + 500 = +350.
      const day2 = result.days[1];
      expect(day2.startingBalancePaise).toBe(5000);
      expect(day2.totalExpensesPaise).toBe(20000);
      expect(day2.minIntradayBalancePaise).toBe(-15000); // -₹150
      expect(day2.closingBalancePaise).toBe(35000); // +₹350
      expect(day2.hasEssentialShortfall).toBe(true);
      expect(day2.essentialShortfallPaise).toBe(15000); // ₹150 deficit

      // Earliest essential shortfall is flagged on Day 2
      expect(result.earliestEssentialShortfall?.dayIndex).toBe(2);
      expect(result.earliestEssentialShortfall?.deficitPaise).toBe(15000); // ₹150
      expect(result.earliestEssentialShortfall?.bufferInclusiveGapPaise).toBe(20000); // 50 - (-150) = 200 (₹200)
    });
  });

  describe('Earliest buffer breach before essential shortfall', () => {
    it('separately identifies an early buffer breach before an essential shortfall occurs', () => {
      const inputs: FinancialInputs = {
        currentCashPaise: 30000, // ₹300
        dailyEssentialPaise: 10000, // ₹100
        safetyBufferPaise: 25000, // ₹250
        startDate: START_DATE,
        bills: [],
        payouts: [],
      };

      const result = calculate14DayCashFlow(inputs);

      // Day 1: start 300 - daily 100 = 200.
      // 200 > 0 (no essential shortfall), but 200 < 250 buffer (buffer breach occurs on Day 1!)
      // Buffer deficit on Day 1 is 250 - 200 = 50 (₹50)
      expect(result.earliestBufferBreach?.dayIndex).toBe(1);
      expect(result.earliestBufferBreach?.bufferDeficitPaise).toBe(5000); // ₹50

      // Essential shortfall occurs on Day 4:
      // Day 2 closing = 100
      // Day 3 closing = 0
      // Day 4: 0 - 100 = -100
      expect(result.earliestEssentialShortfall?.dayIndex).toBe(4);
      expect(result.earliestEssentialShortfall?.deficitPaise).toBe(10000); // ₹100
    });
  });

  describe('Overdue bills and overdue payouts treatment', () => {
    it('reserves overdue bills once on Day 1 and does not repeat them on Day 2', () => {
      const inputs: FinancialInputs = {
        currentCashPaise: 100000, // ₹1,000
        dailyEssentialPaise: 10000, // ₹100
        safetyBufferPaise: 10000, // ₹100
        startDate: START_DATE,
        bills: [
          {
            id: 'overdue-1',
            title: 'Overdue Phone Bill',
            amountPaise: 30000, // ₹300
            dueDate: addDays(START_DATE, -2), // 2 days before start date
          },
        ],
        payouts: [],
      };

      const result = calculate14DayCashFlow(inputs);

      // Day 1: start 1000 - daily 100 - overdue 300 = closing 600
      expect(result.days[0].overdueBillsApplied).toHaveLength(1);
      expect(result.days[0].totalOverdueBillsPaise).toBe(30000);
      expect(result.days[0].totalExpensesPaise).toBe(40000);
      expect(result.days[0].closingBalancePaise).toBe(60000);

      // Day 2: start 600 - daily 100 = closing 500 (overdue bill NOT applied again)
      expect(result.days[1].overdueBillsApplied).toHaveLength(0);
      expect(result.days[1].totalOverdueBillsPaise).toBe(0);
      expect(result.days[1].totalExpensesPaise).toBe(10000);
      expect(result.days[1].closingBalancePaise).toBe(50000);
    });

    it('excludes overdue payouts whose expected date has passed and documents the reason', () => {
      const inputs: FinancialInputs = {
        currentCashPaise: 50000, // ₹500
        dailyEssentialPaise: 10000, // ₹100
        safetyBufferPaise: 10000, // ₹100
        startDate: START_DATE,
        bills: [],
        payouts: [
          {
            id: 'overdue-payout-1',
            title: 'Past Delivery Earnings',
            amountPaise: 40000, // ₹400
            expectedDate: addDays(START_DATE, -3), // 3 days in the past
          },
        ],
      };

      const result = calculate14DayCashFlow(inputs);

      // Overdue payout must NOT be added to any day's payouts
      expect(result.excludedPayouts).toHaveLength(1);
      expect(result.excludedPayouts[0].payout.id).toBe('overdue-payout-1');
      expect(result.excludedPayouts[0].reason).toContain('already passed');

      // Day 1: start 500 - daily 100 = 400 (not 800)
      expect(result.days[0].closingBalancePaise).toBe(40000);
    });
  });

  describe('Horizon boundaries and events outside horizon', () => {
    it('includes Day 1 and Day 14 events, but excludes Day 15+ events from 14-day calculation', () => {
      const inputs: FinancialInputs = {
        currentCashPaise: 100000, // ₹1,000
        dailyEssentialPaise: 0, // ₹0 for simplicity
        safetyBufferPaise: 0,
        startDate: START_DATE,
        bills: [
          {
            id: 'bill-day-1',
            title: 'Day 1 Bill',
            amountPaise: 10000, // ₹100
            dueDate: START_DATE, // Day 1
          },
          {
            id: 'bill-day-14',
            title: 'Day 14 Bill',
            amountPaise: 20000, // ₹200
            dueDate: addDays(START_DATE, 13), // Day 14
          },
          {
            id: 'bill-day-15',
            title: 'Day 15 Bill',
            amountPaise: 50000, // ₹500
            dueDate: addDays(START_DATE, 14), // Day 15 (outside horizon)
          },
        ],
        payouts: [
          {
            id: 'payout-day-15',
            title: 'Day 15 Payout',
            amountPaise: 80000, // ₹800
            expectedDate: addDays(START_DATE, 14), // Day 15 (outside horizon)
          },
        ],
      };

      const result = calculate14DayCashFlow(inputs);

      // Day 1 includes bill-day-1
      expect(result.days[0].datedBills).toHaveLength(1);
      expect(result.days[0].closingBalancePaise).toBe(90000); // 1000 - 100 = 900

      // Day 14 includes bill-day-14
      expect(result.days[13].datedBills).toHaveLength(1);
      expect(result.days[13].closingBalancePaise).toBe(70000); // 900 - 200 = 700

      // Day 15 events are recorded as outside horizon and not included in finalClosingBalance
      expect(result.finalClosingBalancePaise).toBe(70000);
      expect(result.futureEventsOutsideHorizon.bills).toHaveLength(1);
      expect(result.futureEventsOutsideHorizon.bills[0].id).toBe('bill-day-15');
      expect(result.futureEventsOutsideHorizon.payouts).toHaveLength(1);
      expect(result.futureEventsOutsideHorizon.payouts[0].id).toBe('payout-day-15');
    });
  });

  describe('Delayed Payouts', () => {
    it('shifts cash availability and updates shortfall metrics when a payout is delayed', () => {
      const onTimeInputs: FinancialInputs = {
        currentCashPaise: 20000, // ₹200
        dailyEssentialPaise: 10000, // ₹100
        safetyBufferPaise: 5000, // ₹50
        startDate: START_DATE,
        bills: [],
        payouts: [
          {
            id: 'payout-1',
            title: 'Platform Payout',
            amountPaise: 50000, // ₹500
            expectedDate: addDays(START_DATE, 2), // Day 3
          },
        ],
      };

      const onTimeResult = calculate14DayCashFlow(onTimeInputs);
      // Day 1: 200 - 100 = 100
      // Day 2: 100 - 100 = 0
      // Day 3: 0 - 100 = -100 + 500 = +400.
      // Earliest shortfall is Day 3 intraday (-100)
      expect(onTimeResult.earliestEssentialShortfall?.dayIndex).toBe(3);

      // Now delay payout to Day 6
      const delayedInputs: FinancialInputs = {
        ...onTimeInputs,
        payouts: [
          {
            id: 'payout-1',
            title: 'Platform Payout',
            amountPaise: 50000,
            expectedDate: addDays(START_DATE, 5), // Day 6
          },
        ],
      };

      const delayedResult = calculate14DayCashFlow(delayedInputs);
      // On Day 3 closing balance is -₹100 (without payout)
      expect(delayedResult.days[2].closingBalancePaise).toBe(-10000);
      // On Day 4 closing balance is -₹200
      expect(delayedResult.days[3].closingBalancePaise).toBe(-20000);
      // On Day 5 closing balance is -₹300
      expect(delayedResult.days[4].closingBalancePaise).toBe(-30000);
      // On Day 6 min balance is -₹400, closing balance is -400 + 500 = +100
      expect(delayedResult.days[5].minIntradayBalancePaise).toBe(-40000);
      expect(delayedResult.days[5].closingBalancePaise).toBe(10000);
    });
  });
});
