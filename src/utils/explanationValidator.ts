import type {
  FactMap,
  FactId,
  ExplanationMessageId,
  ExplanationPayload,
  ExplanationValidationResult,
  EventFact,
  EligibilityFact,
  OutcomeFact,
  RenderedMessage,
  SemanticRejectionReason,
} from '../types/explanation.ts';
import { renderTemplate } from './explanationTemplates.ts';

export const APPROVED_MESSAGE_IDS: ReadonlySet<ExplanationMessageId> = new Set([
  'baseline_essential_shortfall',
  'baseline_buffer_gap',
  'baseline_buffer_only_breach',
  'baseline_no_shortfall',
  'baseline_buffer_protected',
  'original_gap_covered',
  'original_gap_partially_reduced',
  'payout_too_late',
  'later_gap_remains',
  'simulated_buffer_breach',
  'simulated_all_clear',
  'eligibility_uncertain',
  'ineligible_conflict',
  'no_opportunities_available',
  'fictional_opportunity_disclosure',
  'work_is_optional_disclosure',
]);

export const APPROVED_FACT_IDS: ReadonlySet<FactId> = new Set([
  'FACT_BASELINE_CURRENT_CASH',
  'FACT_BASELINE_DAILY_ESSENTIAL',
  'FACT_BASELINE_SAFETY_BUFFER',
  'FACT_BASELINE_ESSENTIAL_SHORTFALL',
  'FACT_BASELINE_BUFFER_BREACH',
  'FACT_BASELINE_LOWEST_HORIZON_CASH',
  'FACT_BASELINE_FINAL_CLOSING_CASH',
  'FACT_OPP_TITLE',
  'FACT_OPP_GROSS_EARNINGS',
  'FACT_OPP_TOTAL_COSTS',
  'FACT_OPP_NET_EARNINGS',
  'FACT_OPP_WORK_DATE',
  'FACT_OPP_PAYOUT_DATE',
  'FACT_OPP_EVALUATION',
  'FACT_SIM_FEASIBILITY',
  'FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON',
  'FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL',
  'FACT_SIM_FIRST_BUFFER_BREACH',
  'FACT_SIM_OUTCOME',
]);

/**
 * Checks deterministic applicability of a message ID against a FactMap.
 * Returns true if the message logically and mathematically matches the verified facts.
 */
export function checkMessageApplicability(
  messageId: ExplanationMessageId,
  facts: FactMap
): { isApplicable: boolean; reason?: string } {
  const baseShortfall = facts.FACT_BASELINE_ESSENTIAL_SHORTFALL as EventFact | undefined;
  const baseBreach = facts.FACT_BASELINE_BUFFER_BREACH as EventFact | undefined;
  const oppEval = facts.FACT_OPP_EVALUATION as EligibilityFact | undefined;
  const simComp = facts.FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON as OutcomeFact | undefined;
  const simShortfall = facts.FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL as EventFact | undefined;
  const simBreach = facts.FACT_SIM_FIRST_BUFFER_BREACH as EventFact | undefined;

  switch (messageId) {
    case 'baseline_essential_shortfall':
    case 'baseline_buffer_gap':
      if (baseShortfall?.presence !== 'present') {
        return { isApplicable: false, reason: 'No baseline essential shortfall exists in facts.' };
      }
      return { isApplicable: true };

    case 'baseline_buffer_only_breach':
      if (baseShortfall?.presence === 'present') {
        return { isApplicable: false, reason: 'Essential shortfall exists; buffer-only breach is not applicable.' };
      }
      if (baseBreach?.presence !== 'present') {
        return { isApplicable: false, reason: 'No buffer breach exists in facts.' };
      }
      return { isApplicable: true };

    case 'baseline_no_shortfall':
      if (baseShortfall?.presence === 'present') {
        return { isApplicable: false, reason: 'Baseline has an essential shortfall; cannot claim no shortfall.' };
      }
      return { isApplicable: true };

    case 'baseline_buffer_protected':
      if (baseBreach?.presence === 'present' || baseShortfall?.presence === 'present') {
        return { isApplicable: false, reason: 'Buffer is breached or shortfall exists; cannot claim buffer is protected.' };
      }
      return { isApplicable: true };

    case 'original_gap_covered':
      if (simComp?.presence !== 'present') {
        return { isApplicable: false, reason: 'No original shortfall comparison fact available.' };
      }
      if (!simComp.isOriginalDeficitResolved) {
        return { isApplicable: false, reason: 'Original deficit was not fully resolved.' };
      }
      return { isApplicable: true };

    case 'original_gap_partially_reduced':
      if (simComp?.presence !== 'present') {
        return { isApplicable: false, reason: 'No original shortfall comparison fact available.' };
      }
      if (simComp.isOriginalDeficitResolved) {
        return { isApplicable: false, reason: 'Original deficit was fully resolved; use original_gap_covered.' };
      }
      if ((simComp.deficitReductionPaise ?? 0) <= 0) {
        return { isApplicable: false, reason: 'Deficit was not reduced by this opportunity.' };
      }
      return { isApplicable: true };

    case 'payout_too_late': {
      const isCatLate = oppEval?.category === 'payout_too_late';
      const isUnreduced = simComp?.presence === 'present' && (simComp.deficitReductionPaise ?? 0) === 0;
      if (!isCatLate && !isUnreduced) {
        return { isApplicable: false, reason: 'Opportunity payout is not late for the shortfall.' };
      }
      return { isApplicable: true };
    }

    case 'later_gap_remains':
      if (simShortfall?.presence !== 'present') {
        return { isApplicable: false, reason: 'No simulated shortfall exists in horizon.' };
      }
      return { isApplicable: true };

    case 'simulated_buffer_breach':
      if (simShortfall?.presence === 'present') {
        return { isApplicable: false, reason: 'Simulated essential shortfall exists; buffer-only breach not applicable.' };
      }
      if (simBreach?.presence !== 'present') {
        return { isApplicable: false, reason: 'No simulated buffer breach exists.' };
      }
      return { isApplicable: true };

    case 'simulated_all_clear':
      if (simShortfall?.presence === 'present') {
        return { isApplicable: false, reason: 'Simulated shortfall exists; cannot claim all clear.' };
      }
      if (simBreach?.presence === 'present') {
        return { isApplicable: false, reason: 'Simulated buffer breach exists; cannot claim all clear.' };
      }
      return { isApplicable: true };

    case 'eligibility_uncertain':
      if (oppEval?.category !== 'uncertain_terms') {
        return { isApplicable: false, reason: 'Opportunity is not categorized as uncertain terms.' };
      }
      return { isApplicable: true };

    case 'ineligible_conflict':
      if (oppEval?.category !== 'ineligible_conflict') {
        return { isApplicable: false, reason: 'Opportunity is not categorized as ineligible conflict.' };
      }
      return { isApplicable: true };

    case 'no_opportunities_available':
    case 'fictional_opportunity_disclosure':
    case 'work_is_optional_disclosure':
      return { isApplicable: true };

    default:
      return { isApplicable: false, reason: `Unknown messageId: ${messageId}` };
  }
}

/**
 * Validates an explanation payload against facts and renders plain text.
 * Categorizes failure reasons with safe SemanticRejectionReason subcodes.
 */
export function validateAndRenderExplanation(
  payload: unknown,
  facts: FactMap,
  options: {
    fallbackText: string;
    requireDisclosures?: boolean;
    requireRemainingGapStatement?: boolean;
    requireBaselineShortfallStatement?: boolean;
  }
): ExplanationValidationResult {
  const errors: string[] = [];
  let rejectionReason: SemanticRejectionReason | undefined;

  // 1. Basic JSON object validation
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      isValid: false,
      errors: ['Payload must be a non-null JSON object.'],
      fallbackText: options.fallbackText,
      source: 'deterministic_fallback',
    };
  }

  const typedPayload = payload as Partial<ExplanationPayload>;
  if (!Array.isArray(typedPayload.messages) || typedPayload.messages.length === 0) {
    return {
      isValid: false,
      errors: ['Payload must contain a non-empty messages array.'],
      semanticRejectionReason: 'REQUIRED_MESSAGE_MISSING',
      fallbackText: options.fallbackText,
      source: 'deterministic_fallback',
    };
  }

  const renderedMessages: RenderedMessage[] = [];
  const allReferencedFactIds = new Set<FactId>();
  const messageIdSet = new Set<ExplanationMessageId>();
  const selectedMessageIds: ExplanationMessageId[] = [];

  // 2. Validate individual messages
  for (let i = 0; i < typedPayload.messages.length; i++) {
    const msg = typedPayload.messages[i];
    if (!msg || typeof msg !== 'object') {
      errors.push(`Message at index ${i} is not a valid object.`);
      continue;
    }

    if (!APPROVED_MESSAGE_IDS.has(msg.messageId)) {
      errors.push(`Message at index ${i} has unapproved messageId: "${msg.messageId}".`);
      rejectionReason = rejectionReason || 'MESSAGE_NOT_APPLICABLE';
      continue;
    }

    selectedMessageIds.push(msg.messageId);

    // Duplicate check
    if (messageIdSet.has(msg.messageId)) {
      errors.push(`Duplicate messageId "${msg.messageId}" is not allowed.`);
      rejectionReason = rejectionReason || 'DUPLICATE_MESSAGE';
    }
    messageIdSet.add(msg.messageId);

    // Check referenced fact IDs
    if (!Array.isArray(msg.referencedFactIds)) {
      errors.push(`Message at index ${i} must contain a referencedFactIds array.`);
      rejectionReason = rejectionReason || 'FACT_REFERENCE_MISSING';
      continue;
    }

    // Check if fact references are required for this message
    const factsRequiredMessages = new Set<ExplanationMessageId>([
      'baseline_essential_shortfall',
      'baseline_buffer_gap',
      'baseline_buffer_only_breach',
      'original_gap_covered',
      'original_gap_partially_reduced',
      'payout_too_late',
      'later_gap_remains',
      'simulated_buffer_breach',
    ]);

    if (factsRequiredMessages.has(msg.messageId) && msg.referencedFactIds.length === 0) {
      errors.push(`Message "${msg.messageId}" requires at least one referenced Fact ID.`);
      rejectionReason = rejectionReason || 'FACT_REFERENCE_MISSING';
    }

    for (const factId of msg.referencedFactIds) {
      if (!APPROVED_FACT_IDS.has(factId)) {
        errors.push(`Message "${msg.messageId}" references unknown Fact ID: "${factId}".`);
        rejectionReason = rejectionReason || 'FACT_TYPE_MISMATCH';
      } else if (!facts[factId] || facts[factId]?.presence === 'absent') {
        errors.push(`Message "${msg.messageId}" references absent or missing Fact ID: "${factId}".`);
        rejectionReason = rejectionReason || 'FACT_TYPE_MISMATCH';
      } else {
        allReferencedFactIds.add(factId);
      }
    }

    // Check applicability condition (truthfulness check)
    const applicability = checkMessageApplicability(msg.messageId, facts);
    if (!applicability.isApplicable) {
      errors.push(
        `Message "${msg.messageId}" is contradictory/inapplicable: ${applicability.reason || 'condition failed'}.`
      );
      rejectionReason = rejectionReason || 'MESSAGE_NOT_APPLICABLE';
      continue;
    }

    // Render message via deterministic template
    try {
      const text = renderTemplate(msg.messageId, facts);
      // Ensure plain text, no HTML tags
      if (/<[a-z][\s\S]*>/i.test(text)) {
        errors.push(`Message "${msg.messageId}" rendered prohibited HTML content.`);
      } else {
        renderedMessages.push({
          messageId: msg.messageId,
          text,
          referencedFactIds: msg.referencedFactIds,
        });
      }
    } catch (renderError) {
      errors.push(
        `Failed to render message "${msg.messageId}": ${
          renderError instanceof Error ? renderError.message : String(renderError)
        }`
      );
    }
  }

  // 3. Contradictory combination checks
  if (messageIdSet.has('baseline_essential_shortfall') && messageIdSet.has('baseline_no_shortfall')) {
    errors.push('Cannot combine "baseline_essential_shortfall" with "baseline_no_shortfall".');
    rejectionReason = 'CONTRADICTORY_MESSAGE_COMBINATION';
  }
  if (messageIdSet.has('baseline_essential_shortfall') && messageIdSet.has('baseline_buffer_only_breach')) {
    errors.push('Cannot combine "baseline_essential_shortfall" with "baseline_buffer_only_breach".');
    rejectionReason = 'CONTRADICTORY_MESSAGE_COMBINATION';
  }
  if (messageIdSet.has('original_gap_covered') && messageIdSet.has('payout_too_late')) {
    errors.push('Cannot combine "original_gap_covered" with "payout_too_late".');
    rejectionReason = 'CONTRADICTORY_MESSAGE_COMBINATION';
  }
  if (messageIdSet.has('simulated_all_clear') && messageIdSet.has('later_gap_remains')) {
    errors.push('Cannot combine "simulated_all_clear" with "later_gap_remains".');
    rejectionReason = 'CONTRADICTORY_MESSAGE_COMBINATION';
  }

  // 4. Baseline essential shortfall requirement (for baseline scenario)
  if (options.requireBaselineShortfallStatement) {
    const baseShortfall = facts.FACT_BASELINE_ESSENTIAL_SHORTFALL as EventFact | undefined;
    if (baseShortfall?.presence === 'present' && !messageIdSet.has('baseline_essential_shortfall')) {
      errors.push('A baseline essential cash deficit exists but "baseline_essential_shortfall" was omitted.');
      rejectionReason = rejectionReason || 'REQUIRED_MESSAGE_MISSING';
    }
  }

  // 5. Required disclosures check for opportunity/simulation contexts
  if (options.requireDisclosures) {
    if (!messageIdSet.has('fictional_opportunity_disclosure')) {
      errors.push('Missing required disclosure: "fictional_opportunity_disclosure".');
      rejectionReason = rejectionReason || 'REQUIRED_DISCLOSURE_MISSING';
    }
    if (!messageIdSet.has('work_is_optional_disclosure')) {
      errors.push('Missing required disclosure: "work_is_optional_disclosure".');
      rejectionReason = rejectionReason || 'REQUIRED_DISCLOSURE_MISSING';
    }
  }

  // 6. Required remaining gap statement check (applicable to feasible simulations)
  if (options.requireRemainingGapStatement) {
    const simFeasibility = facts.FACT_SIM_FEASIBILITY as EligibilityFact | undefined;
    const simComp = facts.FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON as OutcomeFact | undefined;
    const isFeasibleSimulation = simFeasibility?.isEligible === true || simComp?.presence === 'present';

    if (isFeasibleSimulation) {
      const simShortfall = facts.FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL as EventFact | undefined;
      const simBreach = facts.FACT_SIM_FIRST_BUFFER_BREACH as EventFact | undefined;

      if (simShortfall?.presence === 'present' && !messageIdSet.has('later_gap_remains')) {
        errors.push('A remaining/later essential shortfall exists in simulation but "later_gap_remains" was omitted.');
        rejectionReason = rejectionReason || 'REQUIRED_MESSAGE_MISSING';
      } else if (simShortfall?.presence === 'absent' && simBreach?.presence === 'present' && !messageIdSet.has('simulated_buffer_breach')) {
        errors.push('A simulated buffer breach exists in simulation but "simulated_buffer_breach" was omitted.');
        rejectionReason = rejectionReason || 'REQUIRED_MESSAGE_MISSING';
      } else if (simShortfall?.presence === 'absent' && simBreach?.presence === 'absent' && !messageIdSet.has('simulated_all_clear')) {
        errors.push('All essentials and buffer are clear in simulation but "simulated_all_clear" was omitted.');
        rejectionReason = rejectionReason || 'REQUIRED_MESSAGE_MISSING';
      }
    }
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      semanticRejectionReason: rejectionReason || 'MESSAGE_NOT_APPLICABLE',
      selectedMessageIds,
      fallbackText: options.fallbackText,
      source: 'deterministic_fallback',
    };
  }

  const combinedText = renderedMessages.map((m) => m.text).join(' ');

  return {
    isValid: true,
    renderedText: combinedText,
    renderedMessages,
    referencedFactIds: Array.from(allReferencedFactIds),
    source: 'ai_constrained',
  };
}
