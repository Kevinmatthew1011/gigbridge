import { APPROVED_FACT_IDS } from '../src/utils/explanationValidator.ts';
import { isValidDateString, compareDateStrings } from '../src/utils/dates.ts';
import type { ExplainApiRequest, ExplanationScenario } from './types.ts';
import type { FactMap, FactId, AmountFact, DateFact, EventFact, OutcomeFact } from '../src/types/explanation.ts';

export interface ValidationResult<T> {
  isValid: boolean;
  data?: T;
  errors?: string[];
}

const ALLOWED_SCENARIOS: ReadonlySet<ExplanationScenario> = new Set([
  'baseline_summary',
  'single_opportunity_preview',
]);

const ALLOWED_TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  'requestId',
  'scenario',
  'facts',
]);

const REQUIRED_BASELINE_FACT_IDS: readonly FactId[] = [
  'FACT_BASELINE_CURRENT_CASH',
  'FACT_BASELINE_DAILY_ESSENTIAL',
  'FACT_BASELINE_SAFETY_BUFFER',
  'FACT_BASELINE_ESSENTIAL_SHORTFALL',
  'FACT_BASELINE_BUFFER_BREACH',
  'FACT_BASELINE_LOWEST_HORIZON_CASH',
  'FACT_BASELINE_FINAL_CLOSING_CASH',
];

const REQUIRED_OPPORTUNITY_FACT_IDS: readonly FactId[] = [
  ...REQUIRED_BASELINE_FACT_IDS,
  'FACT_OPP_GROSS_EARNINGS',
  'FACT_OPP_TOTAL_COSTS',
  'FACT_OPP_NET_EARNINGS',
  'FACT_OPP_WORK_DATE',
  'FACT_OPP_PAYOUT_DATE',
  'FACT_OPP_EVALUATION',
  'FACT_SIM_FEASIBILITY',
];

const ALLOWED_FACT_TYPES = new Set(['amount', 'date', 'event', 'eligibility', 'outcome']);
const ALLOWED_PRESENCE = new Set(['present', 'absent', 'unknown']);
const ALLOWED_OPP_CATEGORIES = new Set([
  'eligible_immediate',
  'eligible_general',
  'payout_too_late',
  'uncertain_terms',
  'ineligible_conflict',
]);

/**
 * Validates untrusted HTTP request payload for POST /api/explain.
 *
 * Trust Boundary Note:
 * In this local demo environment, the gateway verifies the structural schema,
 * fact-specific required fields, and relational consistency of client-submitted facts,
 * but does not independently query banking or identity systems.
 */
export function validateExplainRequest(body: unknown): ValidationResult<ExplainApiRequest> {
  const errors: string[] = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { isValid: false, errors: ['Request body must be a non-null JSON object.'] };
  }

  const raw = body as Record<string, unknown>;

  // Reject unsupported free-text, custom prompts, or client-supplied commentary
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      errors.push(
        `Disallowed field in request: "${key}". Client-supplied fallbackText and custom prompt fields are strictly prohibited.`
      );
    }
  }

  // 1. Validate requestId
  if (typeof raw.requestId !== 'string' || raw.requestId.trim().length === 0) {
    errors.push('requestId must be a non-empty string.');
  } else if (raw.requestId.length > 100) {
    errors.push('requestId exceeds maximum length of 100 characters.');
  } else if (!/^[a-zA-Z0-9_\-\.]+$/.test(raw.requestId)) {
    errors.push('requestId contains invalid characters (only alphanumeric, _, -, . allowed).');
  }

  // 2. Validate scenario
  let scenario: ExplanationScenario | null = null;
  if (typeof raw.scenario !== 'string' || !ALLOWED_SCENARIOS.has(raw.scenario as ExplanationScenario)) {
    errors.push(`scenario must be one of: ${Array.from(ALLOWED_SCENARIOS).join(', ')}.`);
  } else {
    scenario = raw.scenario as ExplanationScenario;
  }

  // 3. Validate facts map existence and structure
  if (!raw.facts || typeof raw.facts !== 'object' || Array.isArray(raw.facts)) {
    errors.push('facts must be a non-null JSON object.');
    return { isValid: false, errors };
  }

  const factsObj = raw.facts as Record<string, unknown>;
  const factKeys = Object.keys(factsObj);

  if (factKeys.length === 0) {
    errors.push('facts object must not be empty.');
    return { isValid: false, errors };
  }

  // Scenario Fact Completeness Check
  if (scenario === 'baseline_summary') {
    for (const reqFact of REQUIRED_BASELINE_FACT_IDS) {
      if (!factsObj[reqFact]) {
        errors.push(`Missing required fact for baseline_summary: "${reqFact}".`);
      }
    }
  } else if (scenario === 'single_opportunity_preview') {
    for (const reqFact of REQUIRED_OPPORTUNITY_FACT_IDS) {
      if (!factsObj[reqFact]) {
        errors.push(`Missing required fact for single_opportunity_preview: "${reqFact}".`);
      }
    }
  }

  // Fact-Specific Validation
  for (const key of factKeys) {
    if (!APPROVED_FACT_IDS.has(key as FactId)) {
      errors.push(`Unapproved Fact ID: "${key}".`);
      continue;
    }

    const factVal = factsObj[key];
    if (!factVal || typeof factVal !== 'object' || Array.isArray(factVal)) {
      errors.push(`Fact "${key}" must be an object.`);
      continue;
    }

    const fact = factVal as Record<string, unknown>;

    if (typeof fact.type !== 'string' || !ALLOWED_FACT_TYPES.has(fact.type)) {
      errors.push(`Fact "${key}" has invalid or missing type.`);
      continue;
    }

    if (typeof fact.presence !== 'string' || !ALLOWED_PRESENCE.has(fact.presence)) {
      errors.push(`Fact "${key}" has invalid or missing presence ('present' | 'absent' | 'unknown').`);
      continue;
    }

    // Fact-Specific Field Checks
    if (fact.presence === 'present') {
      if (fact.type === 'amount') {
        if (typeof fact.paise !== 'number' || !Number.isSafeInteger(fact.paise)) {
          errors.push(`Fact "${key}" amount paise must be a safe integer.`);
        } else {
          // Non-negative amounts for budgets, buffers, costs, gross earnings
          const nonNegativeAmountKeys = new Set([
            'FACT_BASELINE_CURRENT_CASH',
            'FACT_BASELINE_DAILY_ESSENTIAL',
            'FACT_BASELINE_SAFETY_BUFFER',
            'FACT_OPP_GROSS_EARNINGS',
            'FACT_OPP_TOTAL_COSTS',
          ]);
          if (nonNegativeAmountKeys.has(key) && fact.paise < 0) {
            errors.push(`Fact "${key}" must be a non-negative amount.`);
          }
        }
      } else if (fact.type === 'date') {
        if (typeof fact.date !== 'string' || !isValidDateString(fact.date)) {
          errors.push(`Fact "${key}" date must be a valid YYYY-MM-DD string when present.`);
        }
        if (fact.dayIndex !== undefined && (typeof fact.dayIndex !== 'number' || fact.dayIndex < 1 || fact.dayIndex > 14)) {
          errors.push(`Fact "${key}" dayIndex must be an integer between 1 and 14.`);
        }
      } else if (fact.type === 'event') {
        if (typeof fact.dayIndex !== 'number' || fact.dayIndex < 1 || fact.dayIndex > 14) {
          errors.push(`Fact "${key}" dayIndex must be an integer between 1 and 14.`);
        }
        if (typeof fact.date !== 'string' || !isValidDateString(fact.date)) {
          errors.push(`Fact "${key}" date must be a valid YYYY-MM-DD string.`);
        }
        if (fact.deficitPaise !== undefined && (typeof fact.deficitPaise !== 'number' || !Number.isSafeInteger(fact.deficitPaise) || fact.deficitPaise < 0)) {
          errors.push(`Fact "${key}" deficitPaise must be a non-negative safe integer.`);
        }
        if (fact.bufferInclusiveGapPaise !== undefined && (typeof fact.bufferInclusiveGapPaise !== 'number' || !Number.isSafeInteger(fact.bufferInclusiveGapPaise) || fact.bufferInclusiveGapPaise < 0)) {
          errors.push(`Fact "${key}" bufferInclusiveGapPaise must be a non-negative safe integer.`);
        }
        if (fact.bufferDeficitPaise !== undefined && (typeof fact.bufferDeficitPaise !== 'number' || !Number.isSafeInteger(fact.bufferDeficitPaise) || fact.bufferDeficitPaise < 0)) {
          errors.push(`Fact "${key}" bufferDeficitPaise must be a non-negative safe integer.`);
        }
      } else if (fact.type === 'eligibility') {
        if (typeof fact.isEligible !== 'boolean') {
          errors.push(`Fact "${key}" isEligible must be a boolean.`);
        }
        if (fact.category !== undefined && !ALLOWED_OPP_CATEGORIES.has(fact.category as string)) {
          errors.push(`Fact "${key}" category is invalid.`);
        }
        if (fact.reasons !== undefined && !Array.isArray(fact.reasons)) {
          errors.push(`Fact "${key}" reasons must be an array of strings.`);
        }
      } else if (fact.type === 'outcome') {
        if (fact.isOriginalDeficitResolved !== undefined && typeof fact.isOriginalDeficitResolved !== 'boolean') {
          errors.push(`Fact "${key}" isOriginalDeficitResolved must be a boolean.`);
        }
        if (fact.remainingDeficitAtEventPaise !== undefined && (typeof fact.remainingDeficitAtEventPaise !== 'number' || !Number.isSafeInteger(fact.remainingDeficitAtEventPaise) || fact.remainingDeficitAtEventPaise < 0)) {
          errors.push(`Fact "${key}" remainingDeficitAtEventPaise must be a non-negative safe integer.`);
        }
        if (fact.deficitReductionPaise !== undefined && (typeof fact.deficitReductionPaise !== 'number' || !Number.isSafeInteger(fact.deficitReductionPaise) || fact.deficitReductionPaise < 0)) {
          errors.push(`Fact "${key}" deficitReductionPaise must be a non-negative safe integer.`);
        }
      }
    } else if (fact.presence === 'unknown') {
      if (fact.type === 'date' && typeof fact.unknownReason !== 'string') {
        errors.push(`Fact "${key}" unknown presence requires an unknownReason string.`);
      }
    }
  }

  // 4. Relational Consistency Checks
  const typedFacts = raw.facts as FactMap;

  // Relational Check A: Net Earnings Calculation (Gross - Costs == Net)
  const grossFact = typedFacts.FACT_OPP_GROSS_EARNINGS as AmountFact | undefined;
  const costFact = typedFacts.FACT_OPP_TOTAL_COSTS as AmountFact | undefined;
  const netFact = typedFacts.FACT_OPP_NET_EARNINGS as AmountFact | undefined;
  if (grossFact?.presence === 'present' && costFact?.presence === 'present' && netFact?.presence === 'present') {
    if (grossFact.paise !== undefined && costFact.paise !== undefined && netFact.paise !== undefined) {
      if (netFact.paise !== grossFact.paise - costFact.paise) {
        errors.push(`Relational inconsistency: FACT_OPP_NET_EARNINGS (${netFact.paise}) does not equal Gross (${grossFact.paise}) minus Costs (${costFact.paise}).`);
      }
    }
  }

  // Relational Check B: Baseline Shortfall vs Buffer Inclusive Gap
  const baseShortfall = typedFacts.FACT_BASELINE_ESSENTIAL_SHORTFALL as EventFact | undefined;
  if (baseShortfall?.presence === 'present' && baseShortfall.deficitPaise !== undefined && baseShortfall.bufferInclusiveGapPaise !== undefined) {
    if (baseShortfall.bufferInclusiveGapPaise < baseShortfall.deficitPaise) {
      errors.push(`Relational inconsistency: bufferInclusiveGapPaise (${baseShortfall.bufferInclusiveGapPaise}) cannot be less than essential deficitPaise (${baseShortfall.deficitPaise}).`);
    }
  }

  // Relational Check C: Simulation Shortfall Comparison Consistency
  const simComp = typedFacts.FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON as OutcomeFact | undefined;
  if (simComp?.presence === 'present' && baseShortfall?.presence === 'present' && baseShortfall.deficitPaise !== undefined) {
    if (simComp.remainingDeficitAtEventPaise !== undefined) {
      if (simComp.remainingDeficitAtEventPaise > baseShortfall.deficitPaise) {
        errors.push(`Relational inconsistency: remainingDeficitAtEventPaise cannot exceed baseline deficitPaise.`);
      }
      if (simComp.deficitReductionPaise !== undefined) {
        if (simComp.deficitReductionPaise !== baseShortfall.deficitPaise - simComp.remainingDeficitAtEventPaise) {
          errors.push(`Relational inconsistency: deficitReductionPaise must equal baseline deficitPaise minus remainingDeficitAtEventPaise.`);
        }
      }
      if (simComp.isOriginalDeficitResolved === true && simComp.remainingDeficitAtEventPaise !== 0) {
        errors.push(`Relational inconsistency: isOriginalDeficitResolved is true but remainingDeficitAtEventPaise is non-zero.`);
      }
      if (simComp.isOriginalDeficitResolved === false && simComp.remainingDeficitAtEventPaise === 0) {
        errors.push(`Relational inconsistency: isOriginalDeficitResolved is false but remainingDeficitAtEventPaise is 0.`);
      }
    }
  }

  // Relational Check D: Work Date vs Payout Date Order
  const workDateFact = typedFacts.FACT_OPP_WORK_DATE as DateFact | undefined;
  const payoutDateFact = typedFacts.FACT_OPP_PAYOUT_DATE as DateFact | undefined;
  if (workDateFact?.presence === 'present' && workDateFact.date && payoutDateFact?.presence === 'present' && payoutDateFact.date) {
    if (compareDateStrings(payoutDateFact.date, workDateFact.date) < 0) {
      errors.push(`Relational inconsistency: payout date (${payoutDateFact.date}) precedes work date (${workDateFact.date}).`);
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    data: {
      requestId: (raw.requestId as string).trim(),
      scenario: scenario!,
      facts: typedFacts,
    },
  };
}
