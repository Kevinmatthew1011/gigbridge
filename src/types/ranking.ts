import { Paise } from './finance';
import { Opportunity, OpportunityCategory } from './opportunity';
import { SimulationResult } from './simulation';

export interface RankingMetrics {
  deficitReductionPaise: Paise;
  remainingDeficitAtEventPaise: Paise;
  simulatedBalanceAtEventPaise: Paise;
  bufferInclusiveGapAtEventPaise: Paise;
  upfrontCostBeforePayoutPaise: Paise;
  workHours: number;
  netEarningsPaise: Paise;
  netEarningsPerHourPaise: Paise;
  totalTravelMinutes: number;
}

export interface RankedOpportunity {
  rank: number; // 1-based index
  opportunity: Opportunity;
  simulationResult: SimulationResult;
  metrics: RankingMetrics;
  rankingReasonSummary: string;
}

export interface ExcludedRankingCandidate {
  opportunity: Opportunity;
  category: OpportunityCategory;
  reason: string;
}

export type RankingStatus =
  | 'ranked'
  | 'no_immediate_essential_gap'
  | 'no_qualifying_opportunities';

export interface OpportunityRankingResult {
  status: RankingStatus;
  hasBaselineGap: boolean;
  baselineShortfall: {
    dayIndex: number;
    date: string;
    formattedDate: string;
    deficitPaise: Paise;
    bufferInclusiveGapPaise: Paise;
  } | null;
  rankedOpportunities: RankedOpportunity[];
  excludedOpportunities: ExcludedRankingCandidate[];
  explanation: string;
}
