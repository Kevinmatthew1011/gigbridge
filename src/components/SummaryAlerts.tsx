import React from 'react';
import { CashFlowSummary, Paise } from '../types/finance';
import { formatINR } from '../utils/formatters';

interface SummaryAlertsProps {
  summary: CashFlowSummary;
  safetyBufferPaise: Paise;
}

export const SummaryAlerts: React.FC<SummaryAlertsProps> = ({ summary, safetyBufferPaise }) => {
  const {
    earliestEssentialShortfall,
    earliestBufferBreach,
    overdueBillsReservedOnDay1,
    excludedPayouts,
  } = summary;

  // Shortened dynamic summary based on exact calculated state
  let dynamicSummaryText = '';
  if (earliestEssentialShortfall) {
    dynamicSummaryText = `First essential shortfall: ${formatINR(
      earliestEssentialShortfall.deficitPaise
    )} on Day ${earliestEssentialShortfall.dayIndex}. Reaching the ${formatINR(
      safetyBufferPaise
    )} safety buffer at that point requires ${formatINR(
      earliestEssentialShortfall.bufferInclusiveGapPaise
    )} total. Later days may require more.`;
  } else if (earliestBufferBreach) {
    dynamicSummaryText = `No essential shortfall projected. Cash first falls below your ${formatINR(
      safetyBufferPaise
    )} safety buffer on Day ${earliestBufferBreach.dayIndex} (${
      earliestBufferBreach.formattedDate
    }) with a ${formatINR(earliestBufferBreach.bufferDeficitPaise)} buffer gap.`;
  } else {
    dynamicSummaryText = `No essential shortfall or safety buffer gap projected across all 14 days.`;
  }

  return (
    <div>
      {/* Metric Cards Grid */}
      <div className="summary-grid">
        {/* Card 1: Earliest Essential Shortfall */}
        <div
          className={`metric-card ${
            earliestEssentialShortfall ? 'metric-card-danger' : 'metric-card-success'
          }`}
        >
          <div className="metric-label">Earliest Essential Shortfall</div>
          {earliestEssentialShortfall ? (
            <>
              <div className="metric-value amount-negative">
                {formatINR(earliestEssentialShortfall.deficitPaise)} Deficit
              </div>
              <div className="metric-sub">
                Day {earliestEssentialShortfall.dayIndex} ({earliestEssentialShortfall.formattedDate})
              </div>
            </>
          ) : (
            <>
              <div className="metric-value amount-positive">None</div>
              <div className="metric-sub">All daily essentials covered across 14 days</div>
            </>
          )}
        </div>

        {/* Card 2: Buffer-Inclusive Gap at Shortfall Event */}
        {earliestEssentialShortfall && (
          <div className="metric-card metric-card-warning">
            <div className="metric-label">Buffer-Inclusive Gap (At Shortfall)</div>
            <div className="metric-value">
              {formatINR(earliestEssentialShortfall.bufferInclusiveGapPaise)}
            </div>
            <div className="metric-sub">
              Includes {formatINR(earliestEssentialShortfall.deficitPaise)} essential deficit + {formatINR(safetyBufferPaise)} buffer target.
            </div>
          </div>
        )}

        {/* Card 3: First Below Safety Buffer */}
        <div
          className={`metric-card ${
            earliestBufferBreach ? 'metric-card-warning' : 'metric-card-success'
          }`}
        >
          <div className="metric-label">First Below Safety Buffer</div>
          {earliestBufferBreach ? (
            <>
              <div className="metric-value" style={{ fontSize: '1.25rem' }}>
                Day {earliestBufferBreach.dayIndex} ({earliestBufferBreach.formattedDate})
              </div>
              <div className="metric-sub">
                {formatINR(earliestBufferBreach.bufferDeficitPaise)} below {formatINR(safetyBufferPaise)} buffer. (Cushion deficit; not an extra charge on top of essential shortfall).
              </div>
            </>
          ) : (
            <>
              <div className="metric-value amount-positive">Protected</div>
              <div className="metric-sub">Maintains ≥ {formatINR(safetyBufferPaise)} cushion every day</div>
            </>
          )}
        </div>
      </div>

      {/* Overdue Bills Notice */}
      {overdueBillsReservedOnDay1.length > 0 && (
        <div className="notice-box">
          <strong>Overdue Bills Accounted:</strong> Reserved {overdueBillsReservedOnDay1.length} overdue bill(s) totaling{' '}
          {formatINR(overdueBillsReservedOnDay1.reduce((sum, b) => sum + b.amountPaise, 0))} on Day 1.
        </div>
      )}

      {/* Excluded Overdue Payouts Notice */}
      {excludedPayouts.length > 0 && (
        <div className="notice-box" style={{ backgroundColor: '#fff1f2', borderColor: '#fecdd3', color: '#9f1239' }}>
          <strong>Past Payouts Excluded:</strong> {excludedPayouts.length} payout(s) have past expected dates and are excluded from automatic forecast credit (e.g.{' '}
          {excludedPayouts.map((e) => `"${e.payout.title}"`).join(', ')}).
        </div>
      )}

      {/* Dynamic Calculated Summary */}
      <div className="explanation-box">
        <strong>14-Day Forecast Summary:</strong> {dynamicSummaryText}
      </div>
    </div>
  );
};
