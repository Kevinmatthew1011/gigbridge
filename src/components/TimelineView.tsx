import React, { useState } from 'react';
import { CashFlowSummary, Paise } from '../types/finance';
import { formatINR } from '../utils/formatters';

interface TimelineViewProps {
  summary: CashFlowSummary;
  safetyBufferPaise: Paise;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  summary,
  safetyBufferPaise,
}) => {
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);
  const { days, earliestEssentialShortfall, earliestBufferBreach } = summary;

  return (
    <div id="timeline-section" className="card">
      <div className="card-header" style={{ marginBottom: '0.75rem' }}>
        <div>
          <h2 className="card-title" style={{ fontSize: '1.25rem' }}>
            14-Day Cash Flow Runway
          </h2>
          <div className="form-hint">
            Daily cash projection from Day 1 to Day 14. Expenses precede payouts on each day.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsTimelineExpanded(!isTimelineExpanded)}
          className="btn btn-secondary btn-sm"
          aria-expanded={isTimelineExpanded}
        >
          {isTimelineExpanded ? 'Hide Full Timeline ▲' : 'View Full 14-Day Table ▼'}
        </button>
      </div>

      {/* Concise Timeline Overview */}
      <div
        style={{
          background: 'var(--color-surface-subtle)',
          padding: '0.85rem 1rem',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.875rem',
          marginBottom: isTimelineExpanded ? '1rem' : 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <span style={{ color: 'var(--color-text-muted)' }}>14-Day Trajectory: </span>
          <strong>{days.length} Days Forecasted</strong>
          {earliestEssentialShortfall ? (
            <span className="amount-negative" style={{ marginLeft: '0.5rem' }}>
              • First shortfall: Day {earliestEssentialShortfall.dayIndex} ({formatINR(earliestEssentialShortfall.deficitPaise)})
            </span>
          ) : earliestBufferBreach ? (
            <span style={{ color: 'var(--color-warning)', marginLeft: '0.5rem', fontWeight: 600 }}>
              • First below buffer: Day {earliestBufferBreach.dayIndex}
            </span>
          ) : (
            <span className="amount-positive" style={{ marginLeft: '0.5rem' }}>
              • All essentials covered
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.825rem', color: 'var(--color-text-dim)' }}>
          Target Buffer: {formatINR(safetyBufferPaise)}
        </div>
      </div>

      {/* Expandable 14-Day Timeline Table */}
      {isTimelineExpanded && (
        <div style={{ marginTop: '0.5rem' }}>
          <div className="table-wrapper">
            <table className="timeline-table" aria-label="14-day cash flow runway">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Date</th>
                  <th className="text-right">Starting Cash</th>
                  <th className="text-right">Daily Essentials</th>
                  <th className="text-right">Bills Due</th>
                  <th className="text-right">Expected Payouts</th>
                  <th className="text-right">Lowest Cash That Day</th>
                  <th className="text-right">Closing Cash</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {days.map((day) => {
                  const isShortfall = day.hasEssentialShortfall;
                  const isBufferBreach = !isShortfall && day.hasBufferBreach;

                  let rowClass = '';
                  if (isShortfall) rowClass = 'row-shortfall';
                  else if (isBufferBreach) rowClass = 'row-buffer-breach';

                  return (
                    <tr key={day.dayIndex} className={rowClass}>
                      <td>
                        <strong>Day {day.dayIndex}</strong>
                      </td>
                      <td>{day.formattedDate}</td>
                      <td className="text-right">{formatINR(day.startingBalancePaise)}</td>
                      <td className="text-right amount-negative">
                        -{formatINR(day.dailyEssentialPaise)}
                      </td>
                      <td className="text-right">
                        {day.totalDayBillsPaise > 0 ? (
                          <span className="amount-negative">-{formatINR(day.totalDayBillsPaise)}</span>
                        ) : (
                          <span className="amount-muted">—</span>
                        )}
                      </td>
                      <td className="text-right">
                        {day.totalPayoutsPaise > 0 ? (
                          <span className="amount-positive">+{formatINR(day.totalPayoutsPaise)}</span>
                        ) : (
                          <span className="amount-muted">—</span>
                        )}
                      </td>
                      <td className="text-right">
                        <span className={day.minIntradayBalancePaise < 0 ? 'amount-negative' : ''}>
                          {formatINR(day.minIntradayBalancePaise)}
                        </span>
                      </td>
                      <td className="text-right">
                        <strong
                          className={
                            day.closingBalancePaise < 0
                              ? 'amount-negative'
                              : day.closingBalancePaise < safetyBufferPaise
                              ? ''
                              : 'amount-positive'
                          }
                        >
                          {formatINR(day.closingBalancePaise)}
                        </strong>
                      </td>
                      <td className="text-center">
                        {isShortfall ? (
                          <span className="badge badge-danger">
                            Shortfall ({formatINR(day.essentialShortfallPaise)})
                          </span>
                        ) : isBufferBreach ? (
                          <span className="badge badge-warning">
                            Below Buffer ({formatINR(day.bufferGapPaise)})
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
          <div className="form-hint" style={{ marginTop: '0.6rem', fontSize: '0.8rem' }}>
            * Lowest Cash That Day reflects balance after essential expenses and bills are deducted, before same-day payouts arrive.
          </div>
        </div>
      )}
    </div>
  );
};
