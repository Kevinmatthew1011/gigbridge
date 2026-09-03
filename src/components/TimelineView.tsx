import React from 'react';
import { CashFlowSummary, Paise } from '../types/finance';
import { formatINR } from '../utils/formatters';

interface TimelineViewProps {
  summary: CashFlowSummary;
  safetyBufferPaise: Paise;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ summary, safetyBufferPaise }) => {
  const { days, startDate, endDate } = summary;

  return (
    <div className="card timeline-card">
      <div className="card-header">
        <div>
          <h2 className="card-title">14-Day Cash-Flow Timeline</h2>
          <div className="form-hint">
            Forecast Horizon: {days[0]?.formattedDate || startDate} to {days[days.length - 1]?.formattedDate || endDate} (Day 1 to Day 14)
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="timeline-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Date</th>
              <th className="text-right">Starting Cash</th>
              <th className="text-right">Daily Essentials</th>
              <th>Dated Bills & Expenses</th>
              <th>Expected Payouts</th>
              <th className="text-right" title="Expenses are counted before payouts when timing is unknown">
                Lowest Cash That Day
              </th>
              <th className="text-right">Closing Cash</th>
              <th className="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const hasEssentialShortfall = day.hasEssentialShortfall;
              const hasBufferBreach = !hasEssentialShortfall && day.hasBufferBreach;

              let rowClass = '';
              if (hasEssentialShortfall) rowClass = 'row-shortfall';
              else if (hasBufferBreach) rowClass = 'row-buffer-breach';

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
                  <td>
                    {day.overdueBillsApplied.length > 0 && (
                      <div className="amount-negative" style={{ fontSize: '0.85rem' }}>
                        Overdue: {day.overdueBillsApplied.map((b) => `${b.title} (-${formatINR(b.amountPaise)})`).join(', ')}
                      </div>
                    )}
                    {day.datedBills.length > 0 ? (
                      <div className="amount-negative" style={{ fontSize: '0.85rem' }}>
                        {day.datedBills.map((b) => `${b.title} (-${formatINR(b.amountPaise)})`).join(', ')}
                      </div>
                    ) : (
                      day.overdueBillsApplied.length === 0 && <span className="amount-muted">—</span>
                    )}
                  </td>
                  <td>
                    {day.expectedPayouts.length > 0 ? (
                      <div className="amount-positive" style={{ fontSize: '0.85rem' }}>
                        {day.expectedPayouts.map((p) => `${p.title} (+${formatINR(p.amountPaise)})`).join(', ')}
                      </div>
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
                    <strong className={day.closingBalancePaise < 0 ? 'amount-negative' : 'amount-positive'}>
                      {formatINR(day.closingBalancePaise)}
                    </strong>
                  </td>
                  <td className="text-center">
                    {hasEssentialShortfall ? (
                      <span className="badge badge-danger">
                        Shortfall ({formatINR(day.essentialShortfallPaise)})
                      </span>
                    ) : hasBufferBreach ? (
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

      <div style={{ marginTop: '0.85rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <div>• <strong>Lowest Cash That Day:</strong> Expenses are counted before payouts when timing is unknown.</div>
        <div>• <strong>Negative Balances:</strong> Negative projected cash represents an unmet funding need, not authorized borrowing.</div>
        <div>• <strong>Safety Buffer Target:</strong> {formatINR(safetyBufferPaise)} cushion.</div>
      </div>
    </div>
  );
};
