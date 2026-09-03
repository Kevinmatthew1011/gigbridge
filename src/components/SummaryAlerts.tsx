import React from 'react';
import type { CashFlowSummary, Paise } from '../types/finance.ts';
import { formatINR } from '../utils/formatters.ts';
import { ExplanationBox } from './ExplanationBox.tsx';
import { CashRunwayChart } from './CashRunwayChart.tsx';

interface SummaryAlertsProps {
  summary: CashFlowSummary;
  safetyBufferPaise: Paise;
  explanationStatus?: 'idle' | 'loading' | 'success' | 'fallback';
  explanationSource?: 'ai' | 'mock' | 'fallback' | null;
  explanationProvider?: 'gemini' | 'groq' | 'mock' | 'fallback' | null;
  explanationDiagnosticCode?: string;
  explanationCacheHit?: boolean;
  explanationText?: string | null;
  onRequestExplanation?: () => void;
  onRegenerateExplanation?: () => void;
  isExplanationDisabled?: boolean;
  isExplanationCooldownActive?: boolean;
  explanationDisabledReason?: string;
}

export const SummaryAlerts: React.FC<SummaryAlertsProps> = ({
  summary,
  safetyBufferPaise,
  explanationStatus = 'idle',
  explanationSource = null,
  explanationProvider = null,
  explanationDiagnosticCode,
  explanationCacheHit = false,
  explanationText = null,
  onRequestExplanation,
  onRegenerateExplanation,
  isExplanationDisabled = false,
  isExplanationCooldownActive = false,
  explanationDisabledReason,
}) => {
  const {
    earliestEssentialShortfall,
    earliestBufferBreach,
    minHorizonBalancePaise,
    finalClosingBalancePaise,
    days,
  } = summary;

  const hasShortfall = !earliestEssentialShortfall ? false : true;
  const hasBufferBreach = !earliestBufferBreach ? false : true;

  // Find the day corresponding to the lowest projected cash over 14 days
  const lowestCashDay = days.find(
    (d) => d.minIntradayBalancePaise === minHorizonBalancePaise
  );

  return (
    <div id="financial-summary" className="card" style={{ marginBottom: '1.25rem' }}>
      {/* Primary Result Headline */}
      <div
        className={`metric-card ${
          hasShortfall
            ? 'metric-card-danger'
            : hasBufferBreach
            ? 'metric-card-warning'
            : 'metric-card-success'
        }`}
        style={{ marginBottom: '1rem' }}
      >
        <div className="metric-label" style={{ marginBottom: '0.25rem' }}>
          {hasShortfall
            ? 'Earliest Essential Shortfall'
            : hasBufferBreach
            ? 'First Below Safety Buffer Target'
            : '14-Day Essential Expense Coverage'}
        </div>

        {hasShortfall && earliestEssentialShortfall ? (
          <div>
            <div className="metric-value amount-negative" style={{ fontSize: '1.65rem' }}>
              Your first essentials gap is {formatINR(earliestEssentialShortfall.deficitPaise)} on Day {earliestEssentialShortfall.dayIndex} ({earliestEssentialShortfall.formattedDate})
            </div>
            <div className="metric-sub" style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
              Projected cash falls below ₹0 at this point. Reaching your {formatINR(safetyBufferPaise)} safety buffer cushion on the same day requires{' '}
              <strong>{formatINR(earliestEssentialShortfall.bufferInclusiveGapPaise)}</strong> total (includes the {formatINR(earliestEssentialShortfall.deficitPaise)} essential deficit; not an extra charge).
            </div>
          </div>
        ) : hasBufferBreach && earliestBufferBreach ? (
          <div>
            <div className="metric-value" style={{ color: 'var(--color-warning)', fontSize: '1.45rem' }}>
              First below safety buffer on Day {earliestBufferBreach.dayIndex} ({earliestBufferBreach.formattedDate})
            </div>
            <div className="metric-sub" style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
              All essential expenses are covered, but projected cash dips to {formatINR(earliestBufferBreach.minBalancePaise)} ({formatINR(earliestBufferBreach.bufferDeficitPaise)} below your {formatINR(safetyBufferPaise)} target cushion).
            </div>
          </div>
        ) : (
          <div>
            <div className="metric-value amount-positive" style={{ fontSize: '1.45rem' }}>
              All essential expenses covered across 14 days
            </div>
            <div className="metric-sub" style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
              Projected cash maintains at least your {formatINR(safetyBufferPaise)} safety buffer cushion through the forecast horizon.
            </div>
          </div>
        )}
      </div>

      {/* Visual 14-Day Cash Runway Chart */}
      <div style={{ marginBottom: '1rem' }}>
        <CashRunwayChart
          baselineDays={days}
          safetyBufferPaise={safetyBufferPaise}
          title="Baseline 14-Day Cash Flow Runway"
          earliestShortfallDayIndex={earliestEssentialShortfall?.dayIndex}
        />
      </div>

      {/* Secondary Context Metric Cards */}
      <div className="summary-grid" style={{ marginBottom: onRequestExplanation ? '0.75rem' : 0 }}>
        {/* Card 1: Buffer Status */}
        <div
          className={`metric-card ${
            earliestBufferBreach ? 'metric-card-warning' : 'metric-card-success'
          }`}
        >
          <div className="metric-label">Safety Buffer Status</div>
          {earliestBufferBreach ? (
            <>
              <div className="metric-value" style={{ fontSize: '1.2rem' }}>
                Day {earliestBufferBreach.dayIndex} ({earliestBufferBreach.formattedDate})
              </div>
              <div className="metric-sub">
                {formatINR(earliestBufferBreach.bufferDeficitPaise)} cushion gap relative to {formatINR(safetyBufferPaise)} target.
              </div>
            </>
          ) : (
            <>
              <div className="metric-value amount-positive" style={{ fontSize: '1.2rem' }}>
                Protected
              </div>
              <div className="metric-sub">
                Cushion remains ≥ {formatINR(safetyBufferPaise)} all 14 days.
              </div>
            </>
          )}
        </div>

        {/* Card 2: Lowest Projected Cash Over 14 Days */}
        <div className="metric-card">
          <div className="metric-label">Lowest projected cash over 14 days</div>
          <div
            className={`metric-value ${
              minHorizonBalancePaise < 0 ? 'amount-negative' : ''
            }`}
            style={{ fontSize: '1.2rem' }}
          >
            {formatINR(minHorizonBalancePaise)}
            {lowestCashDay && (
              <span style={{ fontSize: '0.825rem', fontWeight: 500, marginLeft: '0.4rem', color: 'var(--color-text-muted)' }}>
                on Day {lowestCashDay.dayIndex} ({lowestCashDay.formattedDate})
              </span>
            )}
          </div>
          <div className="metric-sub">
            Lowest balance during the 14-day forecast (expenses counted before payouts).
          </div>
        </div>

        {/* Card 3: Final 14-Day Closing Cash */}
        <div className="metric-card">
          <div className="metric-label">Day 14 Projected Cash</div>
          <div
            className={`metric-value ${
              finalClosingBalancePaise < 0 ? 'amount-negative' : 'amount-positive'
            }`}
            style={{ fontSize: '1.2rem' }}
          >
            {formatINR(finalClosingBalancePaise)}
          </div>
          <div className="metric-sub">
            Projected end-of-period cash balance after all 14 days.
          </div>
        </div>
      </div>

      {/* On-Demand Explanation Section */}
      {onRequestExplanation && (
        <ExplanationBox
          scenarioLabel="14-day cash flow"
          status={explanationStatus}
          source={explanationSource}
          provider={explanationProvider}
          diagnosticCode={explanationDiagnosticCode}
          cacheHit={explanationCacheHit}
          renderedText={explanationText}
          onRequestExplanation={onRequestExplanation}
          onRegenerateExplanation={onRegenerateExplanation}
          isDisabled={isExplanationDisabled}
          isCooldownActive={isExplanationCooldownActive}
          disabledReason={explanationDisabledReason}
        />
      )}
    </div>
  );
};
