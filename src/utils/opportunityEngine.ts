import {
  Opportunity,
  WorkerPreferences,
  OpportunityEvaluation,
  OpportunityCatalogEvaluation,
  OpportunityCategory,
} from '../types/opportunity';
import { CashFlowSummary, FinancialInputs } from '../types/finance';
import { addDays, compareDateStrings, formatDateDisplay, isValidDateString } from './dates';
import { formatINR } from './formatters';

/**
 * Returns the default seed worker preferences relative to the forecast start date.
 */
export function getSeedWorkerPreferences(startDate: string): WorkerPreferences {
  // 14 days full availability 08:00 to 20:00
  const availability = Array.from({ length: 14 }, (_, i) => ({
    date: addDays(startDate, i),
    slots: [{ startTime: '08:00', endTime: '20:00' }],
  }));

  return {
    availability,
    approximateArea: 'Koramangala',
    availableTransport: ['two_wheeler'],
    skills: ['packing', 'delivery'],
    confirmedOnboarding: ['Sample Packing Platform', 'Sample Courier Platform'],
  };
}

/**
 * Returns the seed catalog of sample fictional opportunities.
 */
export function getSeedOpportunities(startDate: string): Opportunity[] {
  return [
    // A. Sample packing shift: Day 2, Gross ₹800, Travel ₹150 on Day 1, Net ₹650, Payout Day 2
    {
      id: 'seed-opp-a',
      title: 'Sample Packing Shift (Fictional)',
      platformName: 'Sample Packing Platform',
      workDate: addDays(startDate, 1), // Day 2
      startTime: '09:00',
      endTime: '17:00',
      approximateArea: 'Koramangala',
      estimatedTravel: {
        outboundMinutes: 30,
        returnMinutes: 30,
        costPaise: 15000, // ₹150
      },
      requiredTransport: ['two_wheeler'],
      requiredSkills: ['packing'],
      requiredOnboardingPlatform: 'Sample Packing Platform',
      earnings: {
        type: 'fixed',
        grossAmountPaise: 80000, // ₹800
      },
      incrementalCosts: [
        {
          id: 'cost-opp-a-1',
          description: 'Travel fuel & packing supplies (paid Day 1)',
          amountPaise: 15000, // ₹150
          paymentDate: addDays(startDate, 0), // Day 1
          timingKnown: true,
          isTravelCost: true,
        },
      ],
      expectedPayout: {
        date: addDays(startDate, 1), // Day 2
        timingKnown: true,
        description: `Expected on Day 2 (${formatDateDisplay(addDays(startDate, 1))}) after shift completion`,
      },
      isFictional: true,
    },

    // B. Sample late-payout opportunity: Gross ₹1,200, Payout Day 8 (too late for Day 3 gap)
    {
      id: 'seed-opp-b',
      title: 'Sample Express Courier Shift (Fictional)',
      platformName: 'Sample Courier Platform',
      workDate: addDays(startDate, 1), // Day 2
      startTime: '10:00',
      endTime: '16:00',
      approximateArea: 'Indiranagar',
      estimatedTravel: {
        outboundMinutes: 20,
        returnMinutes: 20,
        costPaise: 0,
      },
      requiredTransport: ['two_wheeler'],
      requiredSkills: ['delivery'],
      requiredOnboardingPlatform: 'Sample Courier Platform',
      earnings: {
        type: 'fixed',
        grossAmountPaise: 120000, // ₹1,200
      },
      incrementalCosts: [],
      expectedPayout: {
        date: addDays(startDate, 7), // Day 8
        timingKnown: true,
        description: `Expected weekly batch payout on Day 8 (${formatDateDisplay(addDays(startDate, 7))})`,
      },
      isFictional: true,
    },

    // C. Sample onboarding-pending opportunity: Gross ₹900, Onboarding unknown/pending
    {
      id: 'seed-opp-c',
      title: 'Sample Quick Warehouse Shift (Fictional)',
      platformName: 'Sample QuickWarehouse Platform',
      workDate: addDays(startDate, 1), // Day 2
      startTime: '08:30',
      endTime: '14:30',
      approximateArea: 'HSR Layout',
      estimatedTravel: {
        outboundMinutes: 15,
        returnMinutes: 15,
        costPaise: 5000, // ₹50
      },
      requiredTransport: ['two_wheeler'],
      requiredSkills: ['packing'],
      requiredOnboardingPlatform: 'Sample QuickWarehouse Platform', // Not in seed confirmed onboarding
      earnings: {
        type: 'fixed',
        grossAmountPaise: 90000, // ₹900
      },
      incrementalCosts: [
        {
          id: 'cost-opp-c-1',
          description: 'Warehouse safety equipment badge fee',
          amountPaise: 5000, // ₹50
          paymentDate: addDays(startDate, 1),
          timingKnown: true,
          isTravelCost: true,
        },
      ],
      expectedPayout: {
        date: addDays(startDate, 1), // Day 2
        timingKnown: true,
        description: `Expected on Day 2 (${formatDateDisplay(addDays(startDate, 1))}) evening`,
      },
      isFictional: true,
    },
  ];
}

/**
 * Converts "HH:MM" string to minutes from midnight (0..1439).
 */
function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Checks whether a candidate opportunity's upfront incremental costs cause or worsen
 * any essential shortfall before its payout arrives.
 */
function checkAffordability(
  opportunity: Opportunity,
  baselineInputs: FinancialInputs,
  baselineSummary: CashFlowSummary
): { isUnaffordable: boolean; reason?: string } {
  // If no incremental costs, it is immediately affordable
  if (opportunity.incrementalCosts.length === 0) {
    return { isUnaffordable: false };
  }

  // Find latest cost date
  const costDates = opportunity.incrementalCosts
    .map((c) => c.paymentDate)
    .filter(isValidDateString);
  const latestCostDate = costDates.sort(compareDateStrings)[costDates.length - 1];

  // If payout date is known, check up to payout date; otherwise check up to latest cost date
  const payoutDate = opportunity.expectedPayout.timingKnown ? opportunity.expectedPayout.date : null;
  const checkUntilDate = payoutDate || latestCostDate || baselineSummary.startDate;

  const daysToCheck = baselineSummary.days.filter((d) => {
    return compareDateStrings(d.date, checkUntilDate) <= 0;
  });

  let runningBalance = baselineInputs.currentCashPaise;

  for (let i = 0; i < daysToCheck.length; i++) {
    const day = daysToCheck[i];
    const dayIndex = i + 1;

    // Costs occurring on this day
    const candidateCostsOnDay = opportunity.incrementalCosts.filter(
      (c) => c.paymentDate === day.date
    );
    const candidateCostPaise = candidateCostsOnDay.reduce((sum, c) => sum + c.amountPaise, 0);

    // Total expenses with candidate cost
    const totalDayExpenses = day.totalExpensesPaise + candidateCostPaise;
    const minBalanceWithCost = runningBalance - totalDayExpenses;

    // Compare with baseline shortfall at this event
    const baselineMin = day.minIntradayBalancePaise;

    // If candidate cost creates a new shortfall (baselineMin >= 0 and minBalanceWithCost < 0)
    // or deepens an existing shortfall (minBalanceWithCost < baselineMin)
    if (candidateCostPaise > 0 && minBalanceWithCost < 0 && (baselineMin >= 0 || minBalanceWithCost < baselineMin)) {
      return {
        isUnaffordable: true,
        reason: `Upfront cost of ${formatINR(candidateCostPaise)} on Day ${dayIndex} (${day.formattedDate}) creates or deepens a cash shortfall of ${formatINR(-minBalanceWithCost)} before income arrives.`,
      };
    }

    // Advance running balance
    let closingBalanceWithCost = minBalanceWithCost + day.totalPayoutsPaise;
    if (payoutDate && day.date === payoutDate) {
      closingBalanceWithCost += opportunity.earnings.grossAmountPaise;
    }

    runningBalance = closingBalanceWithCost;
  }

  return { isUnaffordable: false };
}

/**
 * Pure evaluation function for a single opportunity.
 */
export function evaluateOpportunity(
  opportunity: Opportunity,
  workerPreferences: WorkerPreferences,
  baselineInputs: FinancialInputs,
  baselineSummary: CashFlowSummary
): OpportunityEvaluation {
  const reasons: string[] = [];

  // 1. Conservative Earnings & Net Calculation
  const conservativeGrossPaise = opportunity.earnings.grossAmountPaise;
  // Deduct each incremental cost once
  const totalIncrementalCostsPaise = opportunity.incrementalCosts.reduce(
    (sum, c) => sum + c.amountPaise,
    0
  );
  const netEarningsPaise = conservativeGrossPaise - totalIncrementalCostsPaise;

  // 2. Transport check
  const missingTransport = opportunity.requiredTransport.filter(
    (t) => !workerPreferences.availableTransport.includes(t)
  );
  const transportMismatch = missingTransport.length > 0;
  if (transportMismatch) {
    reasons.push(`Requires ${missingTransport.join(', ')} transport.`);
  }

  // 3. Skills check
  const missingSkills = opportunity.requiredSkills.filter(
    (s) => !workerPreferences.skills.includes(s)
  );
  const skillsMismatch = missingSkills.length > 0;
  if (skillsMismatch) {
    reasons.push(`Requires ${missingSkills.join(', ')} skills.`);
  }

  // 4. Onboarding check
  let onboardingPending = false;
  let onboardingReason: string | undefined;
  if (opportunity.requiredOnboardingPlatform) {
    const isConfirmed = workerPreferences.confirmedOnboarding.includes(
      opportunity.requiredOnboardingPlatform
    );
    if (!isConfirmed) {
      onboardingPending = true;
      onboardingReason = `Onboarding with ${opportunity.requiredOnboardingPlatform} is pending or unconfirmed.`;
      reasons.push(onboardingReason);
    }
  }

  // 5. Schedule & Availability Check (including outbound and return travel)
  let scheduleConflict = false;
  let scheduleReason: string | undefined;

  const dayAvailability = workerPreferences.availability.find(
    (a) => a.date === opportunity.workDate
  );

  if (!dayAvailability || dayAvailability.slots.length === 0) {
    scheduleConflict = true;
    scheduleReason = `No availability declared on ${formatDateDisplay(opportunity.workDate)}.`;
    reasons.push(scheduleReason);
  } else {
    const startMins = parseTimeToMinutes(opportunity.startTime);
    const endMins = parseTimeToMinutes(opportunity.endTime);
    const outboundMins = opportunity.estimatedTravel.outboundMinutes || 0;
    const returnMins = opportunity.estimatedTravel.returnMinutes || 0;

    const requiredStart = startMins - outboundMins;
    const requiredEnd = endMins + returnMins;

    const hasMatchingSlot = dayAvailability.slots.some((slot) => {
      const slotStart = parseTimeToMinutes(slot.startTime);
      const slotEnd = parseTimeToMinutes(slot.endTime);
      return slotStart <= requiredStart && slotEnd >= requiredEnd;
    });

    if (!hasMatchingSlot) {
      scheduleConflict = true;
      scheduleReason = `Requires availability from ${Math.floor(requiredStart / 60)
        .toString()
        .padStart(2, '0')}:${(requiredStart % 60)
        .toString()
        .padStart(2, '0')} to ${Math.floor(requiredEnd / 60)
        .toString()
        .padStart(2, '0')}:${(requiredEnd % 60)
        .toString()
        .padStart(2, '0')} (including ${outboundMins}m outbound + ${returnMins}m return travel).`;
      reasons.push(scheduleReason);
    }
  }

  // 6. Timing Uncertainty
  let timingUncertain = false;
  let timingReason: string | undefined;
  if (
    !opportunity.expectedPayout.timingKnown ||
    !opportunity.expectedPayout.date ||
    !isValidDateString(opportunity.expectedPayout.date)
  ) {
    timingUncertain = true;
    timingReason = 'Expected payout date or timing is uncertain.';
    reasons.push(timingReason);
  }

  const hasUncertainCostTiming = opportunity.incrementalCosts.some((c) => !c.timingKnown);
  if (hasUncertainCostTiming) {
    timingUncertain = true;
    timingReason = (timingReason ? timingReason + ' ' : '') + 'Timing of incremental expenses is unknown.';
    reasons.push('Timing of incremental expenses is unknown.');
  }

  // 7. Affordability Check
  const { isUnaffordable, reason: affordabilityReason } = checkAffordability(
    opportunity,
    baselineInputs,
    baselineSummary
  );
  if (isUnaffordable && affordabilityReason) {
    reasons.push(affordabilityReason);
  }

  // 8. Earliest Gap Timing Check
  let isTooLateForGap = false;
  let tooLateReason: string | undefined;
  const earliestGap = baselineSummary.earliestEssentialShortfall;

  if (earliestGap && opportunity.expectedPayout.date && isValidDateString(opportunity.expectedPayout.date)) {
    if (compareDateStrings(opportunity.expectedPayout.date, earliestGap.date) > 0) {
      isTooLateForGap = true;
      tooLateReason = `Payout on ${formatDateDisplay(
        opportunity.expectedPayout.date
      )} arrives after the Day ${earliestGap.dayIndex} (${earliestGap.formattedDate}) essential shortfall.`;
      reasons.push(tooLateReason);
    }
  }

  // Determine Category
  let category: OpportunityCategory;
  const hasHardIneligibility = transportMismatch || skillsMismatch || scheduleConflict || isUnaffordable;

  if (hasHardIneligibility) {
    category = 'ineligible_conflict';
  } else if (onboardingPending || timingUncertain) {
    category = 'uncertain_terms';
  } else if (isTooLateForGap) {
    category = 'payout_too_late';
  } else if (earliestGap) {
    category = 'eligible_immediate';
  } else {
    category = 'eligible_general';
  }

  const isEligible = category === 'eligible_immediate' || category === 'eligible_general';

  return {
    opportunity,
    category,
    isEligible,
    conservativeGrossPaise,
    totalIncrementalCostsPaise,
    netEarningsPaise,
    scheduleConflict,
    scheduleReason,
    transportMismatch,
    skillsMismatch,
    missingSkills: missingSkills.length > 0 ? missingSkills : undefined,
    missingTransport: missingTransport.length > 0 ? missingTransport : undefined,
    onboardingPending,
    onboardingReason,
    timingUncertain,
    timingReason,
    isTooLateForGap,
    tooLateReason,
    isUnaffordable,
    affordabilityReason,
    reasons,
  };
}

/**
 * Pure evaluation function for the whole catalog.
 */
export function evaluateOpportunityCatalog(
  opportunities: Opportunity[],
  workerPreferences: WorkerPreferences,
  baselineInputs: FinancialInputs,
  baselineSummary: CashFlowSummary
): OpportunityCatalogEvaluation {
  const evaluations = opportunities.map((opp) =>
    evaluateOpportunity(opp, workerPreferences, baselineInputs, baselineSummary)
  );

  const eligibleCandidates = evaluations.filter(
    (e) => e.category === 'eligible_immediate' || e.category === 'eligible_general'
  );
  const payoutTooLate = evaluations.filter((e) => e.category === 'payout_too_late');
  const uncertainTerms = evaluations.filter((e) => e.category === 'uncertain_terms');
  const ineligibleConflicts = evaluations.filter((e) => e.category === 'ineligible_conflict');

  return {
    evaluations,
    groupedEvaluations: {
      eligibleCandidates,
      payoutTooLate,
      uncertainTerms,
      ineligibleConflicts,
    },
    hasEarliestGap: !!baselineSummary.earliestEssentialShortfall,
    earliestGapDayIndex: baselineSummary.earliestEssentialShortfall?.dayIndex || null,
    earliestGapDate: baselineSummary.earliestEssentialShortfall?.date || null,
  };
}
