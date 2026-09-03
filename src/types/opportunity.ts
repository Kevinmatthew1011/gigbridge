import type { Paise } from './finance.ts';

export type TransportType = 'two_wheeler' | 'bicycle' | 'walking' | 'public_transport' | 'four_wheeler';

export interface TimeSlot {
  startTime: string; // "HH:MM" 24h format, e.g. "09:00"
  endTime: string; // "HH:MM" 24h format, e.g. "17:00"
}

export interface DayAvailability {
  date: string; // "YYYY-MM-DD"
  slots: TimeSlot[];
}

export interface WorkerPreferences {
  availability: DayAvailability[];
  approximateArea: string; // e.g. "Koramangala"
  availableTransport: TransportType[];
  skills: string[]; // e.g. ["packing", "delivery"]
  confirmedOnboarding: string[]; // platform names where onboarding is confirmed, e.g. ["QuickPack Platform"]
}

export interface IncrementalCost {
  id: string;
  description: string;
  amountPaise: Paise;
  paymentDate: string; // "YYYY-MM-DD"
  timingKnown: boolean;
  isTravelCost?: boolean;
}

export interface Opportunity {
  id: string;
  title: string;
  platformName: string;
  workDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  approximateArea: string;
  estimatedTravel: {
    outboundMinutes: number;
    returnMinutes: number;
    costPaise: Paise; // Included in incrementalCosts or tracked once
  };
  requiredTransport: TransportType[];
  requiredSkills: string[];
  requiredOnboardingPlatform: string | null; // Platform name or null if none required
  onboardingConfirmed?: boolean | 'unknown'; // Override or checked against worker preferences
  earnings: {
    type: 'fixed' | 'range';
    grossAmountPaise: Paise; // Fixed gross, or lower-bound gross for range
    maxGrossAmountPaise?: Paise; // Upper bound for range
  };
  incrementalCosts: IncrementalCost[];
  expectedPayout: {
    date: string | null; // "YYYY-MM-DD" or null if unknown
    timingKnown: boolean;
    description: string; // e.g. "Expected Day 2 after shift completion"
  };
  isFictional: true;
}

export type OpportunityCategory =
  | 'eligible_immediate' // Meets all criteria and payout arrives on/before earliest essential shortfall
  | 'eligible_general' // Meets all criteria, but no immediate essential shortfall exists to solve
  | 'payout_too_late' // Eligible in schedule/skills, but payout arrives after earliest essential gap
  | 'uncertain_terms' // Unknown onboarding or unknown financial/payout timing
  | 'ineligible_conflict'; // Schedule, transport, skill mismatch, or unaffordable upfront cost

export interface OpportunityEvaluation {
  opportunity: Opportunity;
  category: OpportunityCategory;
  isEligible: boolean;
  conservativeGrossPaise: Paise;
  totalIncrementalCostsPaise: Paise;
  netEarningsPaise: Paise;
  scheduleConflict: boolean;
  scheduleReason?: string;
  transportMismatch: boolean;
  skillsMismatch: boolean;
  missingSkills?: string[];
  missingTransport?: TransportType[];
  onboardingPending: boolean;
  onboardingReason?: string;
  timingUncertain: boolean;
  timingReason?: string;
  isTooLateForGap: boolean;
  tooLateReason?: string;
  isUnaffordable: boolean;
  affordabilityReason?: string;
  reasons: string[];
}

export interface OpportunityCatalogEvaluation {
  evaluations: OpportunityEvaluation[];
  groupedEvaluations: {
    eligibleCandidates: OpportunityEvaluation[];
    payoutTooLate: OpportunityEvaluation[];
    uncertainTerms: OpportunityEvaluation[];
    ineligibleConflicts: OpportunityEvaluation[];
  };
  hasEarliestGap: boolean;
  earliestGapDayIndex: number | null;
  earliestGapDate: string | null;
}
