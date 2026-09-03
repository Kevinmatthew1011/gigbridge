import { FinancialInputs } from '../types/finance';
import { Opportunity, WorkerPreferences } from '../types/opportunity';
import {
  OpportunityRankingResult,
  RankedOpportunity,
  ExcludedRankingCandidate,
  RankingMetrics,
} from '../types/ranking';
import { calculate14DayCashFlow } from './cashFlowEngine';
import { simulateOpportunity } from './simulationEngine';
import { compareDateStrings } from './dates';
import { formatINR } from './formatters';

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Pure transparent ranking function for opportunities targeting the baseline's
 * earliest essential shortfall.
 *
 * Sorting Rules (Lexicographical in strict order):
 * 1. Greater reduction of the original essential deficit (higher is better).
 * 2. Smaller buffer-inclusive deficit at that same event (lower is better).
 * 3. Lower upfront cost required before the opportunity payout (lower is better).
 * 4. Higher conservative net earnings per work hour (higher is better).
 * 5. Shorter total outbound + return travel time (lower is better).
 * 6. Stable opportunity ID (lexicographical tie-breaker).
 */
export function rankOpportunitiesForImmediateGap(
  baselineInputs: FinancialInputs,
  opportunities: Opportunity[],
  workerPreferences: WorkerPreferences
): OpportunityRankingResult {
  // 1. Calculate baseline cash flow
  const baselineSummary = calculate14DayCashFlow(baselineInputs);
  const baselineShortfall = baselineSummary.earliestEssentialShortfall;

  // If no baseline shortfall, no immediate gap ranking needed
  if (!baselineShortfall) {
    return {
      status: 'no_immediate_essential_gap',
      hasBaselineGap: false,
      baselineShortfall: null,
      rankedOpportunities: [],
      excludedOpportunities: [],
      explanation:
        'Baseline cash flow has no essential shortfall across the 14-day horizon. No immediate gap ranking is required.',
    };
  }

  const qualifiedList: Array<{
    opportunity: Opportunity;
    simulationResult: ReturnType<typeof simulateOpportunity>;
    metrics: RankingMetrics;
  }> = [];

  const excludedOpportunities: ExcludedRankingCandidate[] = [];

  // 2. Evaluate and simulate each opportunity
  for (const opp of opportunities) {
    const simRes = simulateOpportunity(baselineInputs, opp, workerPreferences);

    // Exclusion A: Infeasible / Unaffordable / Uncertain
    if (!simRes.isFeasible) {
      const isPending = simRes.rejectionReasons.some((r) => r.includes('pending') || r.includes('uncertain'));
      excludedOpportunities.push({
        opportunity: opp,
        category: isPending ? 'uncertain_terms' : 'ineligible_conflict',
        reason: simRes.rejectionReasons.join(' '),
      });
      continue;
    }

    // Exclusion B: Payout arrives after the earliest essential shortfall date
    if (
      !opp.expectedPayout.date ||
      !opp.expectedPayout.timingKnown ||
      compareDateStrings(opp.expectedPayout.date, baselineShortfall.date) > 0
    ) {
      excludedOpportunities.push({
        opportunity: opp,
        category: 'payout_too_late',
        reason: `Payout on ${opp.expectedPayout.date || 'unknown date'} arrives after the Day ${
          baselineShortfall.dayIndex
        } shortfall and cannot resolve this immediate gap.`,
      });
      continue;
    }

    // Exclusion C: Zero deficit reduction at the original shortfall event
    const comp = simRes.originalShortfallComparison;
    const deficitReductionPaise = comp
      ? comp.baselineDeficitPaise - comp.remainingDeficitAtEventPaise
      : 0;

    if (deficitReductionPaise <= 0) {
      excludedOpportunities.push({
        opportunity: opp,
        category: 'eligible_immediate',
        reason: `Provides no essential deficit reduction at the Day ${baselineShortfall.dayIndex} shortfall event.`,
      });
      continue;
    }

    // Compute metrics for qualified candidate
    const payoutDate = opp.expectedPayout.date;
    const upfrontCosts = opp.incrementalCosts.filter(
      (c) => compareDateStrings(c.paymentDate, payoutDate) <= 0
    );
    const upfrontCostBeforePayoutPaise = upfrontCosts.reduce((s, c) => s + c.amountPaise, 0);

    const startMins = parseTimeToMinutes(opp.startTime);
    const endMins = parseTimeToMinutes(opp.endTime);
    const durationMins = endMins > startMins ? endMins - startMins : 60;
    const workHours = Math.max(0.25, durationMins / 60);

    const totalCostsPaise = opp.incrementalCosts.reduce((s, c) => s + c.amountPaise, 0);
    const netEarningsPaise = opp.earnings.grossAmountPaise - totalCostsPaise;
    const netEarningsPerHourPaise = Math.round(netEarningsPaise / workHours);

    const totalTravelMinutes =
      (opp.estimatedTravel.outboundMinutes || 0) + (opp.estimatedTravel.returnMinutes || 0);

    const metrics: RankingMetrics = {
      deficitReductionPaise,
      remainingDeficitAtEventPaise: comp ? comp.remainingDeficitAtEventPaise : 0,
      simulatedBalanceAtEventPaise: comp ? comp.simulatedBalanceAtEventPaise : 0,
      bufferInclusiveGapAtEventPaise: comp ? comp.bufferInclusiveGapAtEventPaise : 0,
      upfrontCostBeforePayoutPaise,
      workHours,
      netEarningsPaise,
      netEarningsPerHourPaise,
      totalTravelMinutes,
    };

    qualifiedList.push({
      opportunity: opp,
      simulationResult: simRes,
      metrics,
    });
  }

  // 3. Lexicographical Sorting
  qualifiedList.sort((a, b) => {
    // 1. Greater reduction of the original essential deficit (higher is better)
    if (a.metrics.deficitReductionPaise !== b.metrics.deficitReductionPaise) {
      return b.metrics.deficitReductionPaise - a.metrics.deficitReductionPaise;
    }

    // 2. Smaller buffer-inclusive deficit at that same event (lower is better)
    if (a.metrics.bufferInclusiveGapAtEventPaise !== b.metrics.bufferInclusiveGapAtEventPaise) {
      return a.metrics.bufferInclusiveGapAtEventPaise - b.metrics.bufferInclusiveGapAtEventPaise;
    }

    // 3. Lower upfront cost required before payout (lower is better)
    if (a.metrics.upfrontCostBeforePayoutPaise !== b.metrics.upfrontCostBeforePayoutPaise) {
      return a.metrics.upfrontCostBeforePayoutPaise - b.metrics.upfrontCostBeforePayoutPaise;
    }

    // 4. Higher conservative net earnings per work hour (higher is better)
    if (a.metrics.netEarningsPerHourPaise !== b.metrics.netEarningsPerHourPaise) {
      return b.metrics.netEarningsPerHourPaise - a.metrics.netEarningsPerHourPaise;
    }

    // 5. Shorter total outbound + return travel time (lower is better)
    if (a.metrics.totalTravelMinutes !== b.metrics.totalTravelMinutes) {
      return a.metrics.totalTravelMinutes - b.metrics.totalTravelMinutes;
    }

    // 6. Stable opportunity ID (lexicographical tie-breaker)
    return a.opportunity.id.localeCompare(b.opportunity.id);
  });

  // 4. Build RankedOpportunity objects with human-readable reason summaries
  const rankedOpportunities: RankedOpportunity[] = qualifiedList.map((item, idx) => {
    const rank = idx + 1;
    const m = item.metrics;
    const isFullyResolved = m.remainingDeficitAtEventPaise === 0;

    let reasonSummary = `Rank ${rank}: ${
      isFullyResolved
        ? `Fully resolves Day ${baselineShortfall.dayIndex} deficit (reduces by ${formatINR(
            m.deficitReductionPaise
          )})`
        : `Partially reduces Day ${baselineShortfall.dayIndex} deficit by ${formatINR(
            m.deficitReductionPaise
          )} (leaving ${formatINR(m.remainingDeficitAtEventPaise)})`
    }. Buffer gap at event: ${formatINR(m.bufferInclusiveGapAtEventPaise)}. Upfront cost: ${formatINR(
      m.upfrontCostBeforePayoutPaise
    )}. Net pay rate: ${formatINR(m.netEarningsPerHourPaise)}/hr across ${m.workHours.toFixed(
      1
    )}h work. Total travel time: ${m.totalTravelMinutes}m.`;

    if (item.simulationResult.simulatedEarliestEssentialShortfall) {
      reasonSummary += ` (Note: A remaining shortfall occurs on Day ${item.simulationResult.simulatedEarliestEssentialShortfall.dayIndex}).`;
    }

    return {
      rank,
      opportunity: item.opportunity,
      simulationResult: item.simulationResult,
      metrics: m,
      rankingReasonSummary: reasonSummary,
    };
  });

  const status: OpportunityRankingResult['status'] =
    rankedOpportunities.length > 0 ? 'ranked' : 'no_qualifying_opportunities';

  let explanation = '';
  if (status === 'ranked') {
    explanation = `Ranked ${rankedOpportunities.length} qualifying opportunity candidate(s) for the Day ${baselineShortfall.dayIndex} essential shortfall of ${formatINR(
      baselineShortfall.deficitPaise
    )}.`;
  } else {
    const hasLate = excludedOpportunities.some((e) => e.category === 'payout_too_late');
    const hasIneligible = excludedOpportunities.some((e) => e.category === 'ineligible_conflict');
    const hasUncertain = excludedOpportunities.some((e) => e.category === 'uncertain_terms');
    const reasons: string[] = [];
    if (hasIneligible) reasons.push('schedule, skill, or upfront cost constraints');
    if (hasUncertain) reasons.push('unconfirmed platform onboarding');
    if (hasLate) reasons.push('payout timing arriving after the shortfall date');

    explanation = `No qualifying opportunities can improve the Day ${baselineShortfall.dayIndex} essential shortfall of ${formatINR(
      baselineShortfall.deficitPaise
    )}${reasons.length > 0 ? ` due to ${reasons.join(' and ')}` : ''}.`;
  }

  return {
    status,
    hasBaselineGap: true,
    baselineShortfall: {
      dayIndex: baselineShortfall.dayIndex,
      date: baselineShortfall.date,
      formattedDate: baselineShortfall.formattedDate,
      deficitPaise: baselineShortfall.deficitPaise,
      bufferInclusiveGapPaise: baselineShortfall.bufferInclusiveGapPaise,
    },
    rankedOpportunities,
    excludedOpportunities,
    explanation,
  };
}
