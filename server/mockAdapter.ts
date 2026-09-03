import type { ExplanationProviderAdapter, ProviderGenerateOptions } from './types.ts';
import type { ExplanationPayload, ExplanationMessageRef, EventFact, EligibilityFact, OutcomeFact } from '../src/types/explanation.ts';

/**
 * Deterministic Mock Adapter for local testing and development.
 * Never connects to external networks and contains zero credentials.
 */
export class MockExplanationAdapter implements ExplanationProviderAdapter {
  public readonly name = 'mock';

  public async generateExplanation(options: ProviderGenerateOptions): Promise<ExplanationPayload> {
    const { scenario, facts } = options;
    const messages: ExplanationMessageRef[] = [];

    if (scenario === 'baseline_summary') {
      const shortfall = facts.FACT_BASELINE_ESSENTIAL_SHORTFALL as EventFact | undefined;
      const bufferBreach = facts.FACT_BASELINE_BUFFER_BREACH as EventFact | undefined;

      if (shortfall?.presence === 'present') {
        messages.push({
          messageId: 'baseline_essential_shortfall',
          referencedFactIds: ['FACT_BASELINE_ESSENTIAL_SHORTFALL'],
        });
        messages.push({
          messageId: 'baseline_buffer_gap',
          referencedFactIds: ['FACT_BASELINE_SAFETY_BUFFER', 'FACT_BASELINE_ESSENTIAL_SHORTFALL'],
        });
      } else if (bufferBreach?.presence === 'present') {
        messages.push({
          messageId: 'baseline_buffer_only_breach',
          referencedFactIds: ['FACT_BASELINE_BUFFER_BREACH', 'FACT_BASELINE_SAFETY_BUFFER'],
        });
      } else {
        messages.push({
          messageId: 'baseline_no_shortfall',
          referencedFactIds: [],
        });
        messages.push({
          messageId: 'baseline_buffer_protected',
          referencedFactIds: ['FACT_BASELINE_SAFETY_BUFFER'],
        });
      }
    } else if (scenario === 'single_opportunity_preview') {
      const oppEval = facts.FACT_OPP_EVALUATION as EligibilityFact | undefined;
      const simComp = facts.FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON as OutcomeFact | undefined;
      const simShortfall = facts.FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL as EventFact | undefined;
      const simBreach = facts.FACT_SIM_FIRST_BUFFER_BREACH as EventFact | undefined;

      // Check categorical eligibility first
      if (oppEval?.category === 'uncertain_terms') {
        messages.push({
          messageId: 'eligibility_uncertain',
          referencedFactIds: ['FACT_OPP_EVALUATION'],
        });
      } else if (oppEval?.category === 'ineligible_conflict') {
        messages.push({
          messageId: 'ineligible_conflict',
          referencedFactIds: ['FACT_OPP_EVALUATION'],
        });
      } else if (oppEval?.category === 'payout_too_late') {
        messages.push({
          messageId: 'payout_too_late',
          referencedFactIds: ['FACT_OPP_PAYOUT_DATE', 'FACT_BASELINE_ESSENTIAL_SHORTFALL'],
        });
      } else if (simComp?.presence === 'present') {
        // Evaluate simulation impact at baseline event
        if (simComp.isOriginalDeficitResolved) {
          messages.push({
            messageId: 'original_gap_covered',
            referencedFactIds: ['FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON', 'FACT_BASELINE_ESSENTIAL_SHORTFALL'],
          });
        } else if ((simComp.deficitReductionPaise ?? 0) > 0) {
          messages.push({
            messageId: 'original_gap_partially_reduced',
            referencedFactIds: ['FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON', 'FACT_BASELINE_ESSENTIAL_SHORTFALL'],
          });
        } else {
          messages.push({
            messageId: 'payout_too_late',
            referencedFactIds: ['FACT_OPP_PAYOUT_DATE', 'FACT_BASELINE_ESSENTIAL_SHORTFALL'],
          });
        }

        // Evaluate remaining horizon state
        if (simShortfall?.presence === 'present') {
          messages.push({
            messageId: 'later_gap_remains',
            referencedFactIds: ['FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL'],
          });
        } else if (simBreach?.presence === 'present') {
          messages.push({
            messageId: 'simulated_buffer_breach',
            referencedFactIds: ['FACT_SIM_FIRST_BUFFER_BREACH', 'FACT_BASELINE_SAFETY_BUFFER'],
          });
        } else {
          messages.push({
            messageId: 'simulated_all_clear',
            referencedFactIds: [],
          });
        }
      }

      // Mandatory disclosures for single opportunity preview
      messages.push({
        messageId: 'fictional_opportunity_disclosure',
        referencedFactIds: [],
      });
      messages.push({
        messageId: 'work_is_optional_disclosure',
        referencedFactIds: [],
      });
    }

    return { messages };
  }
}
