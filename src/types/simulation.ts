import type { CashFlowSummary, Paise } from './finance.ts';
import type { Opportunity } from './opportunity.ts';

export interface OriginalShortfallComparison {
  dayIndex: number;
  date: string;
  formattedDate: string;
  baselineDeficitPaise: Paise;
  baselineBufferInclusiveGapPaise: Paise;
  simulatedBalanceAtEventPaise: Paise;
  remainingDeficitAtEventPaise: Paise;
  bufferInclusiveGapAtEventPaise: Paise;
  isOriginalDeficitResolved: boolean;
  isOriginalBufferGapResolved: boolean;
}

export interface SimulationResult {
  opportunity: Opportunity;
  isFeasible: boolean;
  rejectionReasons: string[];
  baselineSummary: CashFlowSummary;
  simulatedSummary: CashFlowSummary;
  originalShortfallComparison: OriginalShortfallComparison | null;
  simulatedEarliestEssentialShortfall: CashFlowSummary['earliestEssentialShortfall'];
  simulatedFirstBelowSafetyBuffer: CashFlowSummary['earliestBufferBreach'];
  hasRemainingOrLaterShortfall: boolean;
  explanation: string;
}
