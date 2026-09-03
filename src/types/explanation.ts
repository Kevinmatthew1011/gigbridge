import type { Paise } from './finance.ts';
import type { OpportunityCategory } from './opportunity.ts';

export type FactType = 'amount' | 'date' | 'event' | 'eligibility' | 'outcome';

export type FactPresence = 'present' | 'absent' | 'unknown';

export interface BaseFact {
  type: FactType;
  presence: FactPresence;
  unknownReason?: string;
}

export interface AmountFact extends BaseFact {
  type: 'amount';
  paise?: Paise;
}

export interface DateFact extends BaseFact {
  type: 'date';
  date?: string; // YYYY-MM-DD
  dayIndex?: number;
}

export interface EventFact extends BaseFact {
  type: 'event';
  dayIndex?: number;
  date?: string; // YYYY-MM-DD
  deficitPaise?: Paise;
  bufferInclusiveGapPaise?: Paise;
  minBalancePaise?: Paise;
  bufferDeficitPaise?: Paise;
  description?: string;
}

export interface EligibilityFact extends BaseFact {
  type: 'eligibility';
  category?: OpportunityCategory;
  isEligible?: boolean;
  reasons?: string[];
}

export interface OutcomeFact extends BaseFact {
  type: 'outcome';
  isOriginalDeficitResolved?: boolean;
  isOriginalBufferGapResolved?: boolean;
  hasRemainingOrLaterShortfall?: boolean;
  remainingDeficitAtEventPaise?: Paise;
  deficitReductionPaise?: Paise;
  simulatedBalanceAtEventPaise?: Paise;
}

export type Fact = AmountFact | DateFact | EventFact | EligibilityFact | OutcomeFact;

export type FactId =
  | 'FACT_BASELINE_CURRENT_CASH'
  | 'FACT_BASELINE_DAILY_ESSENTIAL'
  | 'FACT_BASELINE_SAFETY_BUFFER'
  | 'FACT_BASELINE_ESSENTIAL_SHORTFALL'
  | 'FACT_BASELINE_BUFFER_BREACH'
  | 'FACT_BASELINE_LOWEST_HORIZON_CASH'
  | 'FACT_BASELINE_FINAL_CLOSING_CASH'
  | 'FACT_OPP_TITLE'
  | 'FACT_OPP_GROSS_EARNINGS'
  | 'FACT_OPP_TOTAL_COSTS'
  | 'FACT_OPP_NET_EARNINGS'
  | 'FACT_OPP_WORK_DATE'
  | 'FACT_OPP_PAYOUT_DATE'
  | 'FACT_OPP_EVALUATION'
  | 'FACT_SIM_FEASIBILITY'
  | 'FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON'
  | 'FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL'
  | 'FACT_SIM_FIRST_BUFFER_BREACH'
  | 'FACT_SIM_OUTCOME';

export type FactMap = Partial<Record<FactId, Fact>>;

export type ExplanationMessageId =
  | 'baseline_essential_shortfall'
  | 'baseline_buffer_gap'
  | 'baseline_buffer_only_breach'
  | 'baseline_no_shortfall'
  | 'baseline_buffer_protected'
  | 'original_gap_covered'
  | 'original_gap_partially_reduced'
  | 'payout_too_late'
  | 'later_gap_remains'
  | 'simulated_buffer_breach'
  | 'simulated_all_clear'
  | 'eligibility_uncertain'
  | 'ineligible_conflict'
  | 'no_opportunities_available'
  | 'fictional_opportunity_disclosure'
  | 'work_is_optional_disclosure';

export interface ExplanationMessageRef {
  messageId: ExplanationMessageId;
  referencedFactIds: FactId[];
}

export interface ExplanationPayload {
  messages: ExplanationMessageRef[];
}

export interface RenderedMessage {
  messageId: ExplanationMessageId;
  text: string;
  referencedFactIds: FactId[];
}

export interface ValidationSuccess {
  isValid: true;
  renderedText: string;
  renderedMessages: RenderedMessage[];
  referencedFactIds: FactId[];
  source: 'ai_constrained';
}

export type SemanticRejectionReason =
  | 'MESSAGE_NOT_APPLICABLE'
  | 'REQUIRED_MESSAGE_MISSING'
  | 'REQUIRED_DISCLOSURE_MISSING'
  | 'FACT_REFERENCE_MISSING'
  | 'FACT_TYPE_MISMATCH'
  | 'CONTRADICTORY_MESSAGE_COMBINATION'
  | 'DUPLICATE_MESSAGE';

export interface ValidationFailure {
  isValid: false;
  errors: string[];
  semanticRejectionReason?: SemanticRejectionReason;
  selectedMessageIds?: ExplanationMessageId[];
  fallbackText: string;
  source: 'deterministic_fallback';
}

export type ExplanationValidationResult = ValidationSuccess | ValidationFailure;
