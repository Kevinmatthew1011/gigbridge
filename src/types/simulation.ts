import { CashFlowSummary, Paise } from './finance';
import { Opportunity } from './opportunity';

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
