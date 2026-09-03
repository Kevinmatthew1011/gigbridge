import React from 'react';
import { SimulationResult } from '../types/simulation';
import { Paise } from '../types/finance';
import { formatINR } from '../utils/formatters';
import { formatDateDisplay } from '../utils/dates';

interface OpportunitySimulationPreviewProps {
  simulationResult: SimulationResult;
  safetyBufferPaise: Paise;
  onClosePreview: () => void;
}

export const OpportunitySimulationPreview: React.FC<OpportunitySimulationPreviewProps> = ({
  simulationResult,
  safetyBufferPaise,
  onClosePreview,
}) => {
  const {
    opportunity,
    baselineSummary,
    simulatedSummary,
    originalShortfallComparison,
    simulatedEarliestEssentialShortfall,
    simulatedFirstBelowSafetyBuffer,
    explanation,
  } = simulationResult;

  // Incremental costs summary
  const totalCostsPaise = opportunity.incrementalCosts.reduce((s, c) => s + c.amountPaise, 0);
  const netEarningsPaise = opportunity.earnings.grossAmountPaise - totalCostsPaise;

  return (
    <div
      className="card"
      style={{
        border: '2px solid var(--color-primary)',
        backgroundColor: '#f8fafc',
        boxShadow: 'var(--shadow-md)',
        marginBottom: '1.5rem',
      }}
      aria-labelledby="preview-heading"
    >
      {/* Header with Title and Close Action */}
      <div className="card-header" style={{ borderBottomColor: 'var(--color-border)' }}>
        <div>
          <span className="badge badge-neutral" style={{ marginBottom: '0.35rem' }}>
            Hypothetical Simulation
          </span>
          <h2 id="preview-heading" className="card-title" style={{ color: 'var(--color-primary)' }}>
            With Sample Opportunity: {opportunity.title}
          </h2>
          <div className="form-hint" style={{ fontWeight: 600, color: '#b45309' }}>
            Hypothetical preview — no work booked and no actual cash changed.
          </div>
        </div>
        <button
          type="button"
          onClick={onClosePreview}
          className="btn btn-secondary btn-sm"
          title="Close simulation preview and return to baseline"
        >
          ✕ Close Preview
        </button>
      </div>

      {/* Opportunity Overview Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '0.75rem',
          background: 'var(--color-surface)',
          padding: '0.85rem',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)',
          marginBottom: '1rem',
        }}
      >
        <div>
          <div className="metric-label">Gross Earnings</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            {formatINR(opportunity.earnings.grossAmountPaise)}
          </div>
          <div className="form-hint">
            Expected: {opportunity.expectedPayout.date ? formatDateDisplay(opportunity.expectedPayout.date) : 'Unknown'}
          </div>
        </div>
        <div>
          <div className="metric-label">Incremental Costs</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: totalCostsPaise > 0 ? 'var(--color-danger)' : 'inherit' }}>
            -{formatINR(totalCostsPaise)}
          </div>
          <div className="form-hint">
            {opportunity.incrementalCosts.length > 0 ? opportunity.incrementalCosts.map((c) => c.description).join(', ') : 'No extra cost'}
          </div>
        </div>
        <div>
          <div className="metric-label">Net Projected Pay</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-success)' }}>
            {formatINR(netEarningsPaise)}
          </div>
          <div className="form-hint">
            Work: {formatDateDisplay(opportunity.workDate)}
          </div>
        </div>
      </div>

      {/* Impact on Shortfall & Safety Buffer Grid */}
      <div className="summary-grid" style={{ marginBottom: '1rem' }}>
        {/* Card 1: Original Shortfall Event Comparison */}
        {originalShortfallComparison && (
          <div
            className={`metric-card ${
              originalShortfallComparison.isOriginalDeficitResolved
                ? 'metric-card-success'
                : 'metric-card-warning'
            }`}
          >
            <div className="metric-label">
              Day {originalShortfallComparison.dayIndex} Original Shortfall
            </div>
            <div className="metric-value">
              {originalShortfallComparison.isOriginalDeficitResolved ? (
                <span className="amount-positive">Covered (₹0 Deficit)</span>
              ) : (
                <span className="amount-negative">
                  {formatINR(originalShortfallComparison.remainingDeficitAtEventPaise)} Remaining
                </span>
              )}
            </div>
            <div className="metric-sub">
              Baseline deficit was {formatINR(originalShortfallComparison.baselineDeficitPaise)}. Projected Day {originalShortfallComparison.dayIndex} cash is{' '}
              <strong>{formatINR(originalShortfallComparison.simulatedBalanceAtEventPaise)}</strong>.
            </div>
          </div>
        )}

        {/* Card 2: First Below Buffer in Simulation */}
        <div
          className={`metric-card ${
            simulatedFirstBelowSafetyBuffer ? 'metric-card-warning' : 'metric-card-success'
          }`}
        >
          <div className="metric-label">First Below Buffer (Simulated)</div>
          {simulatedFirstBelowSafetyBuffer ? (
            <>
              <div className="metric-value" style={{ fontSize: '1.25rem' }}>
                Day {simulatedFirstBelowSafetyBuffer.dayIndex} ({simulatedFirstBelowSafetyBuffer.formattedDate})
              </div>
              <div className="metric-sub">
                {formatINR(simulatedFirstBelowSafetyBuffer.bufferDeficitPaise)} gap below {formatINR(safetyBufferPaise)} target cushion.
              </div>
            </>
          ) : (
            <>
              <div className="metric-value amount-positive">Protected</div>
              <div className="metric-sub">Maintains ≥ {formatINR(safetyBufferPaise)} safety buffer all 14 days</div>
            </>
          )}
        </div>

        {/* Card 3: Earliest Remaining Shortfall in Simulation */}
        <div
          className={`metric-card ${
            simulatedEarliestEssentialShortfall ? 'metric-card-danger' : 'metric-card-success'
          }`}
        >
          <div className="metric-label">Remaining Shortfall (Simulated)</div>
          {simulatedEarliestEssentialShortfall ? (
            <>
              <div className="metric-value amount-negative">
                {formatINR(simulatedEarliestEssentialShortfall.deficitPaise)} Deficit
              </div>
              <div className="metric-sub">
                Day {simulatedEarliestEssentialShortfall.dayIndex} ({simulatedEarliestEssentialShortfall.formattedDate})
              </div>
            </>
          ) : (
            <>
              <div className="metric-value amount-positive">None</div>
              <div className="metric-sub">All daily essentials covered across 14 days</div>
            </>
          )}
        </div>
      </div>

      {/* Calculated Impact Explanation */}
      <div
        className="explanation-box"
        style={{
          backgroundColor: '#eff6ff',
          borderColor: '#bfdbfe',
          color: '#1e3a8a',
          marginBottom: '1rem',
        }}
      >
        <strong>Simulated 14-Day Impact:</strong> {explanation}
      </div>

      {/* 14-Day Baseline vs Preview Comparison Table */}
      <div style={{ marginTop: '0.5rem' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          14-Day Baseline vs. Simulation Comparison
        </h4>
        <div className="table-wrapper">
          <table className="timeline-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Date</th>
                <th className="text-right">Baseline Lowest</th>
                <th className="text-right">Baseline Closing</th>
                <th>Sample Opportunity Events</th>
                <th className="text-right">Simulated Lowest</th>
                <th className="text-right">Simulated Closing</th>
                <th className="text-center">Simulated Status</th>
              </tr>
            </thead>
            <tbody>
              {simulatedSummary.days.map((simDay, idx) => {
                const baseDay = baselineSummary.days[idx];
                const isShortfall = simDay.hasEssentialShortfall;
                const isBufferBreach = !isShortfall && simDay.hasBufferBreach;

                // Find candidate events on this day
                const candidateCostsOnDay = opportunity.incrementalCosts.filter(
                  (c) => c.paymentDate === simDay.date
                );
                const hasCandidatePayoutOnDay =
                  opportunity.expectedPayout.date === simDay.date &&
                  opportunity.expectedPayout.timingKnown;

                let rowClass = '';
                if (isShortfall) rowClass = 'row-shortfall';
                else if (isBufferBreach) rowClass = 'row-buffer-breach';

                return (
                  <tr key={simDay.dayIndex} className={rowClass}>
                    <td>
                      <strong>Day {simDay.dayIndex}</strong>
                    </td>
                    <td>{simDay.formattedDate}</td>
                    <td className="text-right">
                      <span className={baseDay.minIntradayBalancePaise < 0 ? 'amount-negative' : ''}>
                        {formatINR(baseDay.minIntradayBalancePaise)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className={baseDay.closingBalancePaise < 0 ? 'amount-negative' : ''}>
                        {formatINR(baseDay.closingBalancePaise)}
                      </span>
                    </td>
                    <td>
                      {candidateCostsOnDay.map((c) => (
                        <div key={c.id} className="amount-negative" style={{ fontSize: '0.8rem' }}>
                          Cost: {c.description} (-{formatINR(c.amountPaise)})
                        </div>
                      ))}
                      {hasCandidatePayoutOnDay && (
                        <div className="amount-positive" style={{ fontSize: '0.8rem' }}>
                          Payout: +{formatINR(opportunity.earnings.grossAmountPaise)}
                        </div>
                      )}
                      {candidateCostsOnDay.length === 0 && !hasCandidatePayoutOnDay && (
                        <span className="amount-muted">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      <span className={simDay.minIntradayBalancePaise < 0 ? 'amount-negative' : ''}>
                        {formatINR(simDay.minIntradayBalancePaise)}
                      </span>
                    </td>
                    <td className="text-right">
                      <strong className={simDay.closingBalancePaise < 0 ? 'amount-negative' : 'amount-positive'}>
                        {formatINR(simDay.closingBalancePaise)}
                      </strong>
                    </td>
                    <td className="text-center">
                      {isShortfall ? (
                        <span className="badge badge-danger">
                          Shortfall ({formatINR(simDay.essentialShortfallPaise)})
                        </span>
                      ) : isBufferBreach ? (
                        <span className="badge badge-warning">
                          Below Buffer ({formatINR(simDay.bufferGapPaise)})
                        </span>
                      ) : (
                        <span className="badge badge-success">Healthy</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Controls */}
      <div
        style={{
          marginTop: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <button
          type="button"
          onClick={onClosePreview}
          className="btn btn-secondary"
        >
          Continue Without Extra Work
        </button>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          Closing preview leaves your baseline cash-flow timeline unchanged.
        </div>
      </div>
    </div>
  );
};
