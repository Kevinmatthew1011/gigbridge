import type {
  CashFlowSummary,
  DayForecast,
  FinancialInputs,
  Bill,
  Payout,
  ExcludedPayout,
} from '../types/finance.ts';
import { addDays, compareDateStrings, formatDateDisplay, isValidDateString } from './dates.ts';
import { formatINR } from './formatters.ts';

export const SEED_FINANCIAL_INPUTS: FinancialInputs = {
  currentCashPaise: 70000, // ₹700
  dailyEssentialPaise: 20000, // ₹200
  safetyBufferPaise: 10000, // ₹100
  bills: [
    {
      id: 'seed-bill-1',
      title: 'Bill',
      amountPaise: 50000, // ₹500
      dueDate: '', // Dynamic Day 3 relative to start date
    },
  ],
  payouts: [
    {
      id: 'seed-payout-1',
      title: 'Earned Payout',
      amountPaise: 100000, // ₹1,000
      expectedDate: '', // Dynamic Day 7 relative to start date
    },
  ],
  startDate: '', // Dynamic start date (e.g. today's date)
  forecastDays: 14,
};

/**
 * Creates seed demo inputs configured relative to a given start date.
 * Day 1 = startDate
 * Day 3 = startDate + 2 days (Bill ₹500)
 * Day 7 = startDate + 6 days (Payout ₹1,000)
 */
export function getSeedInputs(startDate: string): FinancialInputs {
  return {
    currentCashPaise: 70000, // ₹700
    dailyEssentialPaise: 20000, // ₹200
    safetyBufferPaise: 10000, // ₹100
    bills: [
      {
        id: 'seed-bill-1',
        title: 'Bill',
        amountPaise: 50000, // ₹500
        dueDate: addDays(startDate, 2), // Day 3
      },
    ],
    payouts: [
      {
        id: 'seed-payout-1',
        title: 'Earned Delivery Payout',
        amountPaise: 100000, // ₹1,000
        expectedDate: addDays(startDate, 6), // Day 7
      },
    ],
    startDate,
    forecastDays: 14,
  };
}

/**
 * Pure calculation function for 14-day cash flow simulation.
 */
export function calculate14DayCashFlow(inputs: FinancialInputs): CashFlowSummary {
  const forecastDays = inputs.forecastDays && inputs.forecastDays > 0 ? inputs.forecastDays : 14;
  const startDate = isValidDateString(inputs.startDate) ? inputs.startDate : new Date().toISOString().slice(0, 10);
  const endDate = addDays(startDate, forecastDays - 1);

  // 1. Separate overdue bills (dueDate < startDate) and overdue payouts (expectedDate < startDate)
  const overdueBills: Bill[] = [];
  const activeBills: Bill[] = [];
  const futureBillsOutsideHorizon: Bill[] = [];

  for (const bill of inputs.bills) {
    if (!bill.dueDate || !isValidDateString(bill.dueDate)) continue;
    if (compareDateStrings(bill.dueDate, startDate) < 0) {
      overdueBills.push(bill);
    } else if (compareDateStrings(bill.dueDate, endDate) > 0) {
      futureBillsOutsideHorizon.push(bill);
    } else {
      activeBills.push(bill);
    }
  }

  const excludedPayouts: ExcludedPayout[] = [];
  const activePayouts: Payout[] = [];
  const futurePayoutsOutsideHorizon: Payout[] = [];

  for (const payout of inputs.payouts) {
    if (!payout.expectedDate || !isValidDateString(payout.expectedDate)) continue;
    if (compareDateStrings(payout.expectedDate, startDate) < 0) {
      excludedPayouts.push({
        payout,
        reason: `Expected date (${formatDateDisplay(payout.expectedDate)}) has already passed. Past payouts are not automatically credited into projected cash.`,
      });
    } else if (compareDateStrings(payout.expectedDate, endDate) > 0) {
      futurePayoutsOutsideHorizon.push(payout);
    } else {
      activePayouts.push(payout);
    }
  }

  // 2. Iterate Day 1 to Day 14
  const days: DayForecast[] = [];
  let runningBalance = inputs.currentCashPaise;
  let earliestEssentialShortfall: CashFlowSummary['earliestEssentialShortfall'] = null;
  let earliestBufferBreach: CashFlowSummary['earliestBufferBreach'] = null;
  let minHorizonBalancePaise = inputs.currentCashPaise;

  for (let i = 0; i < forecastDays; i++) {
    const dayIndex = i + 1;
    const currentDate = addDays(startDate, i);
    const formattedDate = formatDateDisplay(currentDate);
    const startingBalancePaise = runningBalance;
    const notes: string[] = [];

    // Bills for current day
    const datedBills = activeBills.filter((b) => b.dueDate === currentDate);
    const totalDayBillsPaise = datedBills.reduce((acc, b) => acc + b.amountPaise, 0);

    // Overdue bills applied once on Day 1
    const overdueBillsApplied = dayIndex === 1 ? overdueBills : [];
    const totalOverdueBillsPaise = overdueBillsApplied.reduce((acc, b) => acc + b.amountPaise, 0);
    if (overdueBillsApplied.length > 0) {
      notes.push(
        `Reserved ${overdueBillsApplied.length} overdue bill(s) totaling ${formatINR(totalOverdueBillsPaise)} on Day 1.`
      );
    }

    // Daily essentials
    const dailyEssentialPaise = inputs.dailyEssentialPaise;

    // Total expenses for the day (expenses precede payouts)
    const totalExpensesPaise = dailyEssentialPaise + totalDayBillsPaise + totalOverdueBillsPaise;

    // Minimum balance during day (balance after expenses, before payouts)
    const minIntradayBalancePaise = startingBalancePaise - totalExpensesPaise;

    // Expected payouts arriving on this day
    const expectedPayouts = activePayouts.filter((p) => p.expectedDate === currentDate);
    const totalPayoutsPaise = expectedPayouts.reduce((acc, p) => acc + p.amountPaise, 0);

    // Closing balance at end of day
    const closingBalancePaise = minIntradayBalancePaise + totalPayoutsPaise;

    // Track minimum horizon balance
    if (minIntradayBalancePaise < minHorizonBalancePaise) {
      minHorizonBalancePaise = minIntradayBalancePaise;
    }
    if (closingBalancePaise < minHorizonBalancePaise) {
      minHorizonBalancePaise = closingBalancePaise;
    }

    // Essential shortfall evaluation
    const lowestBalance = Math.min(minIntradayBalancePaise, closingBalancePaise);
    const hasEssentialShortfall = lowestBalance < 0;
    const essentialShortfallPaise = hasEssentialShortfall ? -lowestBalance : 0;

    // Buffer breach evaluation
    const hasBufferBreach = lowestBalance < inputs.safetyBufferPaise;
    const bufferGapPaise = hasBufferBreach ? inputs.safetyBufferPaise - lowestBalance : 0;

    // Check earliest essential shortfall
    if (hasEssentialShortfall && !earliestEssentialShortfall) {
      const deficitAtEvent = -minIntradayBalancePaise > 0 ? -minIntradayBalancePaise : -closingBalancePaise;
      const bufferInclusiveGapAtEvent = inputs.safetyBufferPaise - Math.min(minIntradayBalancePaise, closingBalancePaise);

      let eventDescription = `Day ${dayIndex} (${formattedDate}) during daily expenses`;
      if (datedBills.length > 0) {
        eventDescription += ` and bill payment (${datedBills.map((b) => b.title || 'Bill').join(', ')})`;
      }
      if (overdueBillsApplied.length > 0) {
        eventDescription += ` including overdue obligations`;
      }

      earliestEssentialShortfall = {
        dayIndex,
        date: currentDate,
        formattedDate,
        deficitPaise: deficitAtEvent,
        bufferInclusiveGapPaise: bufferInclusiveGapAtEvent,
        eventDescription,
      };
    }

    // Check earliest buffer breach
    if (hasBufferBreach && !earliestBufferBreach) {
      const bufferDeficitAtEvent = inputs.safetyBufferPaise - lowestBalance;
      let eventDescription = `Day ${dayIndex} (${formattedDate})`;
      if (minIntradayBalancePaise < inputs.safetyBufferPaise && startingBalancePaise >= inputs.safetyBufferPaise) {
        eventDescription += ` after paying daily expenses`;
      } else if (startingBalancePaise < inputs.safetyBufferPaise) {
        eventDescription += ` starting below safety buffer`;
      }

      earliestBufferBreach = {
        dayIndex,
        date: currentDate,
        formattedDate,
        minBalancePaise: lowestBalance,
        bufferDeficitPaise: bufferDeficitAtEvent,
        eventDescription,
      };
    }

    days.push({
      dayIndex,
      date: currentDate,
      formattedDate,
      startingBalancePaise,
      dailyEssentialPaise,
      datedBills,
      totalDayBillsPaise,
      overdueBillsApplied,
      totalOverdueBillsPaise,
      totalExpensesPaise,
      minIntradayBalancePaise,
      expectedPayouts,
      totalPayoutsPaise,
      closingBalancePaise,
      hasEssentialShortfall,
      essentialShortfallPaise,
      hasBufferBreach,
      bufferGapPaise,
      notes,
    });

    // Advance to next day
    runningBalance = closingBalancePaise;
  }

  // Construct neutral explanation
  let explanation = '';
  if (earliestEssentialShortfall) {
    explanation = `Earliest projected essential shortfall occurs on Day ${earliestEssentialShortfall.dayIndex} (${earliestEssentialShortfall.formattedDate}) with a deficit of ${formatINR(earliestEssentialShortfall.deficitPaise)} at that event. The funding needed at that specific event to also maintain your ${formatINR(inputs.safetyBufferPaise)} safety buffer is ${formatINR(earliestEssentialShortfall.bufferInclusiveGapPaise)}. Note: This reflects the deficit at this single event and does not guarantee covering expenses across the full 14-day horizon.`;
  } else if (earliestBufferBreach) {
    explanation = `No essential shortfall is projected, but cash dips below your ${formatINR(inputs.safetyBufferPaise)} safety buffer on Day ${earliestBufferBreach.dayIndex} (${earliestBufferBreach.formattedDate}) with a buffer gap of ${formatINR(earliestBufferBreach.bufferDeficitPaise)}.`;
  } else {
    explanation = `Projected balance remains positive and above your ${formatINR(inputs.safetyBufferPaise)} safety buffer throughout all 14 days.`;
  }

  return {
    startDate,
    endDate,
    forecastDays,
    days,
    earliestEssentialShortfall,
    earliestBufferBreach,
    overdueBillsReservedOnDay1: overdueBills,
    excludedPayouts,
    futureEventsOutsideHorizon: {
      bills: futureBillsOutsideHorizon,
      payouts: futurePayoutsOutsideHorizon,
    },
    minHorizonBalancePaise,
    finalClosingBalancePaise: runningBalance,
    explanation,
  };
}
