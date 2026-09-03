import type { CashFlowSummary, FinancialInputs } from '../types/finance.ts';
import type { Opportunity, OpportunityEvaluation } from '../types/opportunity.ts';
import type { SimulationResult } from '../types/simulation.ts';
import type { OpportunityRankingResult } from '../types/ranking.ts';
import type {
  FactMap,
  AmountFact,
  DateFact,
  EventFact,
  EligibilityFact,
  OutcomeFact,
} from '../types/explanation.ts';
import { isValidDateString } from './dates.ts';

/**
 * Deterministically extracts typed canonical facts from baseline financial state.
 */
export function extractBaselineFacts(
  inputs: FinancialInputs,
  summary: CashFlowSummary
): FactMap {
  const facts: FactMap = {};

  // Current cash
  facts.FACT_BASELINE_CURRENT_CASH = {
    type: 'amount',
    presence: 'present',
    paise: inputs.currentCashPaise,
  } as AmountFact;

  // Daily essential
  facts.FACT_BASELINE_DAILY_ESSENTIAL = {
    type: 'amount',
    presence: 'present',
    paise: inputs.dailyEssentialPaise,
  } as AmountFact;

  // Safety buffer
  facts.FACT_BASELINE_SAFETY_BUFFER = {
    type: 'amount',
    presence: 'present',
    paise: inputs.safetyBufferPaise,
  } as AmountFact;

  // Earliest essential shortfall
  if (summary.earliestEssentialShortfall) {
    facts.FACT_BASELINE_ESSENTIAL_SHORTFALL = {
      type: 'event',
      presence: 'present',
      dayIndex: summary.earliestEssentialShortfall.dayIndex,
      date: summary.earliestEssentialShortfall.date,
      deficitPaise: summary.earliestEssentialShortfall.deficitPaise,
      bufferInclusiveGapPaise: summary.earliestEssentialShortfall.bufferInclusiveGapPaise,
    } as EventFact;
  } else {
    facts.FACT_BASELINE_ESSENTIAL_SHORTFALL = {
      type: 'event',
      presence: 'absent',
    } as EventFact;
  }

  // Earliest buffer breach
  if (summary.earliestBufferBreach) {
    facts.FACT_BASELINE_BUFFER_BREACH = {
      type: 'event',
      presence: 'present',
      dayIndex: summary.earliestBufferBreach.dayIndex,
      date: summary.earliestBufferBreach.date,
      minBalancePaise: summary.earliestBufferBreach.minBalancePaise,
      bufferDeficitPaise: summary.earliestBufferBreach.bufferDeficitPaise,
    } as EventFact;
  } else {
    facts.FACT_BASELINE_BUFFER_BREACH = {
      type: 'event',
      presence: 'absent',
    } as EventFact;
  }

  // Lowest horizon cash
  facts.FACT_BASELINE_LOWEST_HORIZON_CASH = {
    type: 'amount',
    presence: 'present',
    paise: summary.minHorizonBalancePaise,
  } as AmountFact;

  // Final closing cash
  facts.FACT_BASELINE_FINAL_CLOSING_CASH = {
    type: 'amount',
    presence: 'present',
    paise: summary.finalClosingBalancePaise,
  } as AmountFact;

  return facts;
}

/**
 * Deterministically extracts typed canonical facts from an opportunity and its evaluation.
 */
export function extractOpportunityFacts(
  opportunity: Opportunity | null,
  evaluation?: OpportunityEvaluation | null
): FactMap {
  const facts: FactMap = {};

  if (!opportunity) {
    facts.FACT_OPP_TITLE = { type: 'eligibility', presence: 'absent' };
    facts.FACT_OPP_GROSS_EARNINGS = { type: 'amount', presence: 'absent' };
    facts.FACT_OPP_TOTAL_COSTS = { type: 'amount', presence: 'absent' };
    facts.FACT_OPP_NET_EARNINGS = { type: 'amount', presence: 'absent' };
    facts.FACT_OPP_WORK_DATE = { type: 'date', presence: 'absent' };
    facts.FACT_OPP_PAYOUT_DATE = { type: 'date', presence: 'absent' };
    facts.FACT_OPP_EVALUATION = { type: 'eligibility', presence: 'absent' };
    return facts;
  }

  const totalCostsPaise = opportunity.incrementalCosts.reduce((s, c) => s + c.amountPaise, 0);
  const netEarningsPaise = opportunity.earnings.grossAmountPaise - totalCostsPaise;

  facts.FACT_OPP_GROSS_EARNINGS = {
    type: 'amount',
    presence: 'present',
    paise: opportunity.earnings.grossAmountPaise,
  } as AmountFact;

  facts.FACT_OPP_TOTAL_COSTS = {
    type: 'amount',
    presence: 'present',
    paise: totalCostsPaise,
  } as AmountFact;

  facts.FACT_OPP_NET_EARNINGS = {
    type: 'amount',
    presence: 'present',
    paise: netEarningsPaise,
  } as AmountFact;

  facts.FACT_OPP_WORK_DATE = {
    type: 'date',
    presence: isValidDateString(opportunity.workDate) ? 'present' : 'unknown',
    date: opportunity.workDate,
    unknownReason: isValidDateString(opportunity.workDate) ? undefined : 'Work date is unspecified or invalid',
  } as DateFact;

  if (opportunity.expectedPayout.timingKnown && opportunity.expectedPayout.date) {
    facts.FACT_OPP_PAYOUT_DATE = {
      type: 'date',
      presence: 'present',
      date: opportunity.expectedPayout.date,
    } as DateFact;
  } else {
    facts.FACT_OPP_PAYOUT_DATE = {
      type: 'date',
      presence: 'unknown',
      unknownReason: opportunity.expectedPayout.description || 'Payout timing is unconfirmed or unknown',
    } as DateFact;
  }

  if (evaluation) {
    facts.FACT_OPP_EVALUATION = {
      type: 'eligibility',
      presence: 'present',
      category: evaluation.category,
      isEligible: evaluation.isEligible,
      reasons: evaluation.reasons,
    } as EligibilityFact;
  }

  return facts;
}

/**
 * Deterministically extracts typed canonical facts from a single-opportunity simulation.
 */
export function extractSimulationFacts(
  simulationResult: SimulationResult | null
): FactMap {
  const facts: FactMap = {};

  if (!simulationResult) {
    facts.FACT_SIM_FEASIBILITY = { type: 'eligibility', presence: 'absent' };
    facts.FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON = { type: 'outcome', presence: 'absent' };
    facts.FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL = { type: 'event', presence: 'absent' };
    facts.FACT_SIM_FIRST_BUFFER_BREACH = { type: 'event', presence: 'absent' };
    facts.FACT_SIM_OUTCOME = { type: 'outcome', presence: 'absent' };
    return facts;
  }

  facts.FACT_SIM_FEASIBILITY = {
    type: 'eligibility',
    presence: 'present',
    isEligible: simulationResult.isFeasible,
    reasons: simulationResult.rejectionReasons,
  } as EligibilityFact;

  if (!simulationResult.isFeasible) {
    facts.FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON = { type: 'outcome', presence: 'absent' };
    facts.FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL = { type: 'event', presence: 'absent' };
    facts.FACT_SIM_FIRST_BUFFER_BREACH = { type: 'event', presence: 'absent' };
    facts.FACT_SIM_OUTCOME = {
      type: 'outcome',
      presence: 'unknown',
      unknownReason: `Simulation not feasible: ${simulationResult.rejectionReasons.join(' ')}`,
    } as OutcomeFact;
    return facts;
  }

  // Original shortfall comparison at target event
  const comp = simulationResult.originalShortfallComparison;
  if (comp) {
    const deficitReduction = comp.baselineDeficitPaise - comp.remainingDeficitAtEventPaise;
    facts.FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON = {
      type: 'outcome',
      presence: 'present',
      isOriginalDeficitResolved: comp.isOriginalDeficitResolved,
      isOriginalBufferGapResolved: comp.isOriginalBufferGapResolved,
      remainingDeficitAtEventPaise: comp.remainingDeficitAtEventPaise,
      deficitReductionPaise: deficitReduction,
      simulatedBalanceAtEventPaise: comp.simulatedBalanceAtEventPaise,
    } as OutcomeFact;
  } else {
    facts.FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON = {
      type: 'outcome',
      presence: 'absent',
    } as OutcomeFact;
  }

  // Earliest remaining shortfall in simulated horizon
  if (simulationResult.simulatedEarliestEssentialShortfall) {
    facts.FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL = {
      type: 'event',
      presence: 'present',
      dayIndex: simulationResult.simulatedEarliestEssentialShortfall.dayIndex,
      date: simulationResult.simulatedEarliestEssentialShortfall.date,
      deficitPaise: simulationResult.simulatedEarliestEssentialShortfall.deficitPaise,
      bufferInclusiveGapPaise: simulationResult.simulatedEarliestEssentialShortfall.bufferInclusiveGapPaise,
    } as EventFact;
  } else {
    facts.FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL = {
      type: 'event',
      presence: 'absent',
    } as EventFact;
  }

  // First below safety buffer in simulated horizon
  if (simulationResult.simulatedFirstBelowSafetyBuffer) {
    facts.FACT_SIM_FIRST_BUFFER_BREACH = {
      type: 'event',
      presence: 'present',
      dayIndex: simulationResult.simulatedFirstBelowSafetyBuffer.dayIndex,
      date: simulationResult.simulatedFirstBelowSafetyBuffer.date,
      minBalancePaise: simulationResult.simulatedFirstBelowSafetyBuffer.minBalancePaise,
      bufferDeficitPaise: simulationResult.simulatedFirstBelowSafetyBuffer.bufferDeficitPaise,
    } as EventFact;
  } else {
    facts.FACT_SIM_FIRST_BUFFER_BREACH = {
      type: 'event',
      presence: 'absent',
    } as EventFact;
  }

  // Overall simulated outcome
  facts.FACT_SIM_OUTCOME = {
    type: 'outcome',
    presence: 'present',
    hasRemainingOrLaterShortfall: simulationResult.hasRemainingOrLaterShortfall,
    isOriginalDeficitResolved: comp ? comp.isOriginalDeficitResolved : true,
    isOriginalBufferGapResolved: comp ? comp.isOriginalBufferGapResolved : true,
    simulatedBalanceAtEventPaise: comp ? comp.simulatedBalanceAtEventPaise : undefined,
    remainingDeficitAtEventPaise: comp ? comp.remainingDeficitAtEventPaise : undefined,
  } as OutcomeFact;

  return facts;
}

/**
 * Aggregates all deterministic facts into a unified FactMap.
 */
export function extractAllFacts(params: {
  inputs: FinancialInputs;
  summary: CashFlowSummary;
  opportunity?: Opportunity | null;
  evaluation?: OpportunityEvaluation | null;
  simulationResult?: SimulationResult | null;
  rankingResult?: OpportunityRankingResult | null;
}): FactMap {
  return {
    ...extractBaselineFacts(params.inputs, params.summary),
    ...extractOpportunityFacts(params.opportunity || null, params.evaluation || null),
    ...extractSimulationFacts(params.simulationResult || null),
  };
}
