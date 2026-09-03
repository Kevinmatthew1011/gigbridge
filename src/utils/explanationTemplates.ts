import type { FactMap, ExplanationMessageId, EventFact, AmountFact, DateFact, EligibilityFact, OutcomeFact } from '../types/explanation.ts';
import { formatINR } from './formatters.ts';
import { formatDateDisplay } from './dates.ts';

/**
 * Renders an approved explanation message template using strictly canonical typed facts.
 * Returns plain text string.
 */
export function renderTemplate(
  messageId: ExplanationMessageId,
  facts: FactMap
): string {
  switch (messageId) {
    case 'baseline_essential_shortfall': {
      const shortfall = facts.FACT_BASELINE_ESSENTIAL_SHORTFALL as EventFact | undefined;
      if (!shortfall || shortfall.presence !== 'present' || shortfall.deficitPaise === undefined) {
        throw new Error('Missing required fact for baseline_essential_shortfall');
      }
      const formattedDate = shortfall.date ? formatDateDisplay(shortfall.date) : `Day ${shortfall.dayIndex}`;
      return `Your first essential cash shortfall of ${formatINR(shortfall.deficitPaise)} occurs on Day ${shortfall.dayIndex} (${formattedDate}) when expenses exceed available cash.`;
    }

    case 'baseline_buffer_gap': {
      const buffer = facts.FACT_BASELINE_SAFETY_BUFFER as AmountFact | undefined;
      const shortfall = facts.FACT_BASELINE_ESSENTIAL_SHORTFALL as EventFact | undefined;
      if (!buffer || buffer.presence !== 'present' || buffer.paise === undefined ||
          !shortfall || shortfall.presence !== 'present' || shortfall.bufferInclusiveGapPaise === undefined || shortfall.deficitPaise === undefined) {
        throw new Error('Missing required facts for baseline_buffer_gap');
      }
      return `Reaching your ${formatINR(buffer.paise)} safety buffer cushion on Day ${shortfall.dayIndex} requires ${formatINR(shortfall.bufferInclusiveGapPaise)} total (includes the ${formatINR(shortfall.deficitPaise)} essential deficit; not an extra charge).`;
    }

    case 'baseline_buffer_only_breach': {
      const breach = facts.FACT_BASELINE_BUFFER_BREACH as EventFact | undefined;
      const buffer = facts.FACT_BASELINE_SAFETY_BUFFER as AmountFact | undefined;
      if (!breach || breach.presence !== 'present' || breach.bufferDeficitPaise === undefined || breach.minBalancePaise === undefined ||
          !buffer || buffer.presence !== 'present' || buffer.paise === undefined) {
        throw new Error('Missing required facts for baseline_buffer_only_breach');
      }
      const formattedDate = breach.date ? formatDateDisplay(breach.date) : `Day ${breach.dayIndex}`;
      return `All essential expenses are covered across 14 days, but projected cash dips to ${formatINR(breach.minBalancePaise)} on Day ${breach.dayIndex} (${formattedDate}), which is ${formatINR(breach.bufferDeficitPaise)} below your ${formatINR(buffer.paise)} target cushion.`;
    }

    case 'baseline_no_shortfall': {
      return `All essential expenses are projected to be covered across the full 14-day forecast horizon.`;
    }

    case 'baseline_buffer_protected': {
      const buffer = facts.FACT_BASELINE_SAFETY_BUFFER as AmountFact | undefined;
      const bufferText = buffer && buffer.presence === 'present' && buffer.paise !== undefined
        ? formatINR(buffer.paise)
        : 'safety buffer';
      return `Projected cash maintains at least your ${bufferText} target cushion throughout the 14-day horizon.`;
    }

    case 'original_gap_covered': {
      const comp = facts.FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON as OutcomeFact | undefined;
      const baselineShortfall = facts.FACT_BASELINE_ESSENTIAL_SHORTFALL as EventFact | undefined;
      if (!comp || comp.presence !== 'present' || comp.simulatedBalanceAtEventPaise === undefined ||
          !baselineShortfall || baselineShortfall.presence !== 'present' || baselineShortfall.deficitPaise === undefined) {
        throw new Error('Missing required facts for original_gap_covered');
      }
      return `This sample opportunity covers the original Day ${baselineShortfall.dayIndex} essential deficit of ${formatINR(baselineShortfall.deficitPaise)} (projected balance is ${formatINR(comp.simulatedBalanceAtEventPaise)} at that event).`;
    }

    case 'original_gap_partially_reduced': {
      const comp = facts.FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON as OutcomeFact | undefined;
      const baselineShortfall = facts.FACT_BASELINE_ESSENTIAL_SHORTFALL as EventFact | undefined;
      if (!comp || comp.presence !== 'present' || comp.remainingDeficitAtEventPaise === undefined || comp.deficitReductionPaise === undefined ||
          !baselineShortfall || baselineShortfall.presence !== 'present' || baselineShortfall.deficitPaise === undefined) {
        throw new Error('Missing required facts for original_gap_partially_reduced');
      }
      return `This sample opportunity partially reduces the Day ${baselineShortfall.dayIndex} shortfall from ${formatINR(baselineShortfall.deficitPaise)} to ${formatINR(comp.remainingDeficitAtEventPaise)} (a ${formatINR(comp.deficitReductionPaise)} improvement).`;
    }

    case 'payout_too_late': {
      const payoutDateFact = facts.FACT_OPP_PAYOUT_DATE as DateFact | undefined;
      const shortfall = facts.FACT_BASELINE_ESSENTIAL_SHORTFALL as EventFact | undefined;
      const formattedPayout = payoutDateFact?.date ? formatDateDisplay(payoutDateFact.date) : 'a later date';
      const formattedShortfall = shortfall?.date
        ? `Day ${shortfall.dayIndex} (${formatDateDisplay(shortfall.date)})`
        : shortfall?.dayIndex
        ? `Day ${shortfall.dayIndex}`
        : 'your shortfall';
      return `Expected payout arrives on ${formattedPayout}, which is after the ${formattedShortfall} shortfall. Because payout timing matters, this opportunity does not resolve the immediate deficit.`;
    }

    case 'later_gap_remains': {
      const simShortfall = facts.FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL as EventFact | undefined;
      const baseShortfall = facts.FACT_BASELINE_ESSENTIAL_SHORTFALL as EventFact | undefined;
      if (!simShortfall || simShortfall.presence !== 'present' || simShortfall.deficitPaise === undefined) {
        throw new Error('Missing required facts for later_gap_remains');
      }
      const formattedDate = simShortfall.date ? formatDateDisplay(simShortfall.date) : `Day ${simShortfall.dayIndex}`;
      const isDifferentDay = baseShortfall?.dayIndex !== simShortfall.dayIndex;
      if (isDifferentDay) {
        return `However, a later essential shortfall occurs on Day ${simShortfall.dayIndex} (${formattedDate}) with a deficit of ${formatINR(simShortfall.deficitPaise)}.`;
      }
      return `An essential shortfall remains on Day ${simShortfall.dayIndex} (${formattedDate}) with a deficit of ${formatINR(simShortfall.deficitPaise)}.`;
    }

    case 'simulated_buffer_breach': {
      const breach = facts.FACT_SIM_FIRST_BUFFER_BREACH as EventFact | undefined;
      const buffer = facts.FACT_BASELINE_SAFETY_BUFFER as AmountFact | undefined;
      if (!breach || breach.presence !== 'present' || breach.bufferDeficitPaise === undefined) {
        throw new Error('Missing required facts for simulated_buffer_breach');
      }
      const formattedDate = breach.date ? formatDateDisplay(breach.date) : `Day ${breach.dayIndex}`;
      const bufferText = buffer && buffer.presence === 'present' && buffer.paise !== undefined
        ? `below your ${formatINR(buffer.paise)} target cushion`
        : 'below the safety buffer';
      return `All essential expenses are covered across 14 days, though cash dips ${bufferText} on Day ${breach.dayIndex} (${formattedDate}) with a ${formatINR(breach.bufferDeficitPaise)} gap.`;
    }

    case 'simulated_all_clear': {
      return `All essential expenses and safety buffer targets are maintained across the full 14-day horizon.`;
    }

    case 'eligibility_uncertain': {
      const evalFact = facts.FACT_OPP_EVALUATION as EligibilityFact | undefined;
      const reasons = evalFact?.reasons && evalFact.reasons.length > 0 ? evalFact.reasons.join(', ') : 'Platform onboarding or payment terms unconfirmed';
      return `Opportunity terms or onboarding requirements are unconfirmed (${reasons}). Preview is disabled until terms are confirmed.`;
    }

    case 'ineligible_conflict': {
      const evalFact = facts.FACT_OPP_EVALUATION as EligibilityFact | undefined;
      const reasons = evalFact?.reasons && evalFact.reasons.length > 0 ? evalFact.reasons.join(', ') : 'Schedule, transport, or skill mismatch';
      return `Opportunity cannot be selected due to constraints: ${reasons}.`;
    }

    case 'no_opportunities_available': {
      return `No sample opportunities currently match your schedule, transport, or skill preferences.`;
    }

    case 'fictional_opportunity_disclosure': {
      return `Hypothetical preview with sample money and fictional opportunities. No actual cash or bookings are changed.`;
    }

    case 'work_is_optional_disclosure': {
      return `Extra work is completely optional. You can continue with your baseline cash flow at any time.`;
    }

    default: {
      const _exhaustiveCheck: never = messageId;
      throw new Error(`Unsupported messageId: ${_exhaustiveCheck}`);
    }
  }
}
