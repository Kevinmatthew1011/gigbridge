import { FinancialInputs, Bill, Payout } from '../types/finance';
import { Opportunity, WorkerPreferences } from '../types/opportunity';
import { SimulationResult, OriginalShortfallComparison } from '../types/simulation';
import { calculate14DayCashFlow } from './cashFlowEngine';
import { evaluateOpportunity } from './opportunityEngine';
import { formatINR } from './formatters';

/**
 * Pure deterministic single-opportunity simulation engine.
 *
 * Reuses financial calculation rules:
 * - Integer paise arithmetic
 * - Chronological event ordering
 * - Same-day expenses before income
 * - Independent preview without mutating baseline inputs, preferences, or opportunity
 */
export function simulateOpportunity(
  baselineInputs: FinancialInputs,
  opportunity: Opportunity,
  workerPreferences: WorkerPreferences
): SimulationResult {
  // 1. Calculate baseline cash flow without mutations
  const baselineSummary = calculate14DayCashFlow(baselineInputs);

  // 2. Evaluate eligibility, constraints, and affordability
  const evaluation = evaluateOpportunity(
    opportunity,
    workerPreferences,
    baselineInputs,
    baselineSummary
  );

  // Reject infeasible, unaffordable, or uncertain opportunities
  if (evaluation.category === 'ineligible_conflict' || evaluation.category === 'uncertain_terms') {
    return {
      opportunity,
      isFeasible: false,
      rejectionReasons: evaluation.reasons,
      baselineSummary,
      simulatedSummary: baselineSummary,
      originalShortfallComparison: null,
      simulatedEarliestEssentialShortfall: baselineSummary.earliestEssentialShortfall,
      simulatedFirstBelowSafetyBuffer: baselineSummary.earliestBufferBreach,
      hasRemainingOrLaterShortfall: !!baselineSummary.earliestEssentialShortfall,
      explanation: `Simulation cannot proceed: ${evaluation.reasons.join(' ')}`,
    };
  }

  // 3. Build simulated financial inputs (strictly cloned, non-mutating)
  // Add incremental costs on their payment dates
  const simulatedBills: Bill[] = [
    ...baselineInputs.bills,
    ...opportunity.incrementalCosts.map((cost) => ({
      id: `sim-cost-${cost.id}`,
      title: `${opportunity.title} Cost: ${cost.description}`,
      amountPaise: cost.amountPaise,
      dueDate: cost.paymentDate,
    })),
  ];

  // Add conservative gross earnings on expected payout date
  const simulatedPayouts: Payout[] = [...baselineInputs.payouts];
  if (
    opportunity.expectedPayout.date &&
    opportunity.expectedPayout.timingKnown &&
    opportunity.earnings.grossAmountPaise > 0
  ) {
    simulatedPayouts.push({
      id: `sim-payout-${opportunity.id}`,
      title: `${opportunity.title} (Hypothetical Payout)`,
      amountPaise: opportunity.earnings.grossAmountPaise,
      expectedDate: opportunity.expectedPayout.date,
    });
  }

  const simulatedInputs: FinancialInputs = {
    ...baselineInputs,
    bills: simulatedBills,
    payouts: simulatedPayouts,
  };

  // 4. Calculate simulated 14-day cash flow
  const simulatedSummary = calculate14DayCashFlow(simulatedInputs);

  // 5. Compare at the specific event of baseline shortfall
  let originalShortfallComparison: OriginalShortfallComparison | null = null;
  const originalShortfall = baselineSummary.earliestEssentialShortfall;

  if (originalShortfall) {
    const targetDayIndex = originalShortfall.dayIndex;
    const simulatedDay = simulatedSummary.days[targetDayIndex - 1];

    if (simulatedDay) {
      const simulatedLowestBalance = Math.min(
        simulatedDay.minIntradayBalancePaise,
        simulatedDay.closingBalancePaise
      );
      const remainingDeficit = Math.max(0, -simulatedLowestBalance);
      const bufferInclusiveGap = Math.max(
        0,
        baselineInputs.safetyBufferPaise - simulatedLowestBalance
      );

      originalShortfallComparison = {
        dayIndex: targetDayIndex,
        date: originalShortfall.date,
        formattedDate: originalShortfall.formattedDate,
        baselineDeficitPaise: originalShortfall.deficitPaise,
        baselineBufferInclusiveGapPaise: originalShortfall.bufferInclusiveGapPaise,
        simulatedBalanceAtEventPaise: simulatedLowestBalance,
        remainingDeficitAtEventPaise: remainingDeficit,
        bufferInclusiveGapAtEventPaise: bufferInclusiveGap,
        isOriginalDeficitResolved: remainingDeficit === 0,
        isOriginalBufferGapResolved: bufferInclusiveGap === 0,
      };
    }
  }

  // 6. Check for remaining or later shortfalls in simulated timeline
  const simulatedEarliestShortfall = simulatedSummary.earliestEssentialShortfall;
  const simulatedFirstBufferBreach = simulatedSummary.earliestBufferBreach;
  const hasRemainingOrLaterShortfall = !!simulatedEarliestShortfall;

  // 7. Formulate clear, factual explanation
  let explanation = '';
  if (originalShortfallComparison) {
    if (originalShortfallComparison.isOriginalDeficitResolved) {
      explanation = `Opportunity covers the original Day ${originalShortfallComparison.dayIndex} essential deficit of ${formatINR(
        originalShortfallComparison.baselineDeficitPaise
      )} (projected balance ${formatINR(
        originalShortfallComparison.simulatedBalanceAtEventPaise
      )} at that event).`;
    } else {
      const reducedAmount =
        originalShortfallComparison.baselineDeficitPaise -
        originalShortfallComparison.remainingDeficitAtEventPaise;
      if (reducedAmount > 0) {
        explanation = `Opportunity partially reduces the Day ${originalShortfallComparison.dayIndex} deficit from ${formatINR(
          originalShortfallComparison.baselineDeficitPaise
        )} to ${formatINR(originalShortfallComparison.remainingDeficitAtEventPaise)}.`;
      } else {
        explanation = `Opportunity payout arrives too late to reduce the Day ${originalShortfallComparison.dayIndex} deficit of ${formatINR(
          originalShortfallComparison.baselineDeficitPaise
        )}.`;
      }
    }

    if (simulatedEarliestShortfall) {
      if (simulatedEarliestShortfall.dayIndex === originalShortfallComparison.dayIndex) {
        explanation += ` An essential shortfall remains on Day ${simulatedEarliestShortfall.dayIndex} (${
          simulatedEarliestShortfall.formattedDate
        }) with a deficit of ${formatINR(simulatedEarliestShortfall.deficitPaise)}.`;
      } else {
        explanation += ` However, a later essential shortfall occurs on Day ${simulatedEarliestShortfall.dayIndex} (${
          simulatedEarliestShortfall.formattedDate
        }) with a deficit of ${formatINR(simulatedEarliestShortfall.deficitPaise)}.`;
      }
    } else if (simulatedFirstBufferBreach) {
      explanation += ` All essential expenses are covered across 14 days, though cash dips below safety buffer on Day ${simulatedFirstBufferBreach.dayIndex} (${simulatedFirstBufferBreach.formattedDate}).`;
    } else {
      explanation += ` All essential expenses and safety buffer targets are maintained across the full 14-day horizon.`;
    }
  } else {
    if (simulatedEarliestShortfall) {
      explanation = `Simulation introduces an essential shortfall on Day ${simulatedEarliestShortfall.dayIndex} (${formatINR(
        simulatedEarliestShortfall.deficitPaise
      )} deficit).`;
    } else {
      explanation = `Projected balance remains positive and all essentials are covered throughout the 14-day horizon.`;
    }
  }

  return {
    opportunity,
    isFeasible: true,
    rejectionReasons: [],
    baselineSummary,
    simulatedSummary,
    originalShortfallComparison,
    simulatedEarliestEssentialShortfall: simulatedEarliestShortfall,
    simulatedFirstBelowSafetyBuffer: simulatedFirstBufferBreach,
    hasRemainingOrLaterShortfall,
    explanation,
  };
}
