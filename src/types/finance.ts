export type Paise = number; // Integer paise (1 INR = 100 paise)

export interface Bill {
  id: string;
  title: string;
  amountPaise: Paise;
  dueDate: string; // YYYY-MM-DD
}

export interface Payout {
  id: string;
  title: string;
  amountPaise: Paise;
  expectedDate: string; // YYYY-MM-DD
}

export interface FinancialInputs {
  currentCashPaise: Paise;
  dailyEssentialPaise: Paise;
  safetyBufferPaise: Paise;
  bills: Bill[];
  payouts: Payout[];
  startDate: string; // YYYY-MM-DD
  forecastDays?: number; // default 14
}

export interface DayForecast {
  dayIndex: number; // 1 to 14
  date: string; // YYYY-MM-DD
  formattedDate: string;
  startingBalancePaise: Paise;
  dailyEssentialPaise: Paise;
  datedBills: Bill[];
  totalDayBillsPaise: Paise;
  overdueBillsApplied: Bill[];
  totalOverdueBillsPaise: Paise;
  totalExpensesPaise: Paise;
  minIntradayBalancePaise: Paise; // Balance after day's expenses but before income
  expectedPayouts: Payout[];
  totalPayoutsPaise: Paise;
  closingBalancePaise: Paise;
  hasEssentialShortfall: boolean;
  essentialShortfallPaise: number; // Deficit below ₹0 (0 if none)
  hasBufferBreach: boolean;
  bufferGapPaise: number; // Deficit below safety buffer (0 if none)
  notes: string[];
}

export interface ExcludedPayout {
  payout: Payout;
  reason: string;
}

export interface CashFlowSummary {
  startDate: string;
  endDate: string;
  forecastDays: number;
  days: DayForecast[];
  earliestEssentialShortfall: {
    dayIndex: number;
    date: string;
    formattedDate: string;
    deficitPaise: Paise;
    bufferInclusiveGapPaise: Paise;
    eventDescription: string;
  } | null;
  earliestBufferBreach: {
    dayIndex: number;
    date: string;
    formattedDate: string;
    minBalancePaise: Paise;
    bufferDeficitPaise: Paise;
    eventDescription: string;
  } | null;
  overdueBillsReservedOnDay1: Bill[];
  excludedPayouts: ExcludedPayout[];
  futureEventsOutsideHorizon: {
    bills: Bill[];
    payouts: Payout[];
  };
  minHorizonBalancePaise: Paise;
  finalClosingBalancePaise: Paise;
  explanation: string;
}
