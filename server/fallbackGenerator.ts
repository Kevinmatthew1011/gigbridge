import { renderTemplate } from '../src/utils/explanationTemplates.ts';
import type { FactMap, EventFact, EligibilityFact, OutcomeFact } from '../src/types/explanation.ts';
import type { ExplanationScenario } from './types.ts';

/**
 * Constructs deterministic fallback explanations purely from verified facts
 * and application-owned templates on the server side.
 * Never echoes client-supplied free-text.
 */
export function generateServerDeterministicFallback(
  scenario: ExplanationScenario,
  facts: FactMap
): string {
  const parts: string[] = [];

  if (scenario === 'baseline_summary') {
    const shortfall = facts.FACT_BASELINE_ESSENTIAL_SHORTFALL as EventFact | undefined;
    const bufferBreach = facts.FACT_BASELINE_BUFFER_BREACH as EventFact | undefined;

    if (shortfall?.presence === 'present') {
      parts.push(renderTemplate('baseline_essential_shortfall', facts));
      parts.push(renderTemplate('baseline_buffer_gap', facts));
    } else if (bufferBreach?.presence === 'present') {
      parts.push(renderTemplate('baseline_buffer_only_breach', facts));
    } else {
      parts.push(renderTemplate('baseline_no_shortfall', facts));
      parts.push(renderTemplate('baseline_buffer_protected', facts));
    }
  } else if (scenario === 'single_opportunity_preview') {
    const oppEval = facts.FACT_OPP_EVALUATION as EligibilityFact | undefined;
    const simComp = facts.FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON as OutcomeFact | undefined;
    const simShortfall = facts.FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL as EventFact | undefined;
    const simBreach = facts.FACT_SIM_FIRST_BUFFER_BREACH as EventFact | undefined;

    if (oppEval?.category === 'uncertain_terms') {
      parts.push(renderTemplate('eligibility_uncertain', facts));
    } else if (oppEval?.category === 'ineligible_conflict') {
      parts.push(renderTemplate('ineligible_conflict', facts));
    } else if (oppEval?.category === 'payout_too_late') {
      parts.push(renderTemplate('payout_too_late', facts));
    } else if (simComp?.presence === 'present') {
      if (simComp.isOriginalDeficitResolved) {
        parts.push(renderTemplate('original_gap_covered', facts));
      } else if ((simComp.deficitReductionPaise ?? 0) > 0) {
        parts.push(renderTemplate('original_gap_partially_reduced', facts));
      } else {
        parts.push(renderTemplate('payout_too_late', facts));
      }

      if (simShortfall?.presence === 'present') {
        parts.push(renderTemplate('later_gap_remains', facts));
      } else if (simBreach?.presence === 'present') {
        parts.push(renderTemplate('simulated_buffer_breach', facts));
      } else {
        parts.push(renderTemplate('simulated_all_clear', facts));
      }
    }

    parts.push(renderTemplate('fictional_opportunity_disclosure', facts));
    parts.push(renderTemplate('work_is_optional_disclosure', facts));
  }

  return parts.join(' ');
}
