import React from 'react';
import { OpportunityCatalogEvaluation, OpportunityEvaluation } from '../types/opportunity';
import { formatINR } from '../utils/formatters';
import { formatDateDisplay } from '../utils/dates';

interface OpportunityCatalogProps {
  catalogEvaluation: OpportunityCatalogEvaluation;
}

const OpportunityCard: React.FC<{ evaluation: OpportunityEvaluation }> = ({ evaluation }) => {
  const {
    opportunity,
    category,
    isEligible,
    conservativeGrossPaise,
    totalIncrementalCostsPaise,
    netEarningsPaise,
    reasons,
  } = evaluation;

  const getBadge = () => {
    switch (category) {
      case 'eligible_immediate':
        return <span className="badge badge-success">Eligible Candidate (Pre-Shortfall)</span>;
      case 'eligible_general':
        return <span className="badge badge-success">Eligible Opportunity</span>;
      case 'payout_too_late':
        return <span className="badge badge-warning">Payout Too Late for Immediate Gap</span>;
      case 'uncertain_terms':
        return <span className="badge badge-warning">Uncertain / Onboarding Pending</span>;
      case 'ineligible_conflict':
        return <span className="badge badge-danger">Ineligible / Conflict</span>;
    }
  };

  return (
    <div
      className="card"
      style={{
        borderLeft: isEligible
          ? '4px solid var(--color-success)'
          : category === 'ineligible_conflict'
          ? '4px solid var(--color-danger)'
          : '4px solid var(--color-warning)',
        marginBottom: '1rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{opportunity.title}</h3>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Platform: {opportunity.platformName} • Area: {opportunity.approximateArea}
          </div>
        </div>
        <div>{getBadge()}</div>
      </div>

      {/* Work Schedule & Travel */}
      <div style={{ fontSize: '0.85rem', marginBottom: '0.75rem', background: 'var(--color-surface-subtle)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
        <div>
          <strong>Work Date & Hours:</strong> {formatDateDisplay(opportunity.workDate)} ({opportunity.startTime} – {opportunity.endTime})
        </div>
        <div>
          <strong>Estimated Travel (Fictional):</strong> {opportunity.estimatedTravel.outboundMinutes}m outbound + {opportunity.estimatedTravel.returnMinutes}m return
          {opportunity.estimatedTravel.costPaise > 0 && ` (Cost: ${formatINR(opportunity.estimatedTravel.costPaise)})`}
        </div>
      </div>

      {/* Financial Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div style={{ background: 'var(--color-bg)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Gross Pay</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>
            {formatINR(conservativeGrossPaise)}
            {opportunity.earnings.type === 'range' && <span style={{ fontSize: '0.75rem', fontWeight: 'normal' }}> (min)</span>}
          </div>
        </div>
        <div style={{ background: 'var(--color-bg)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Incremental Costs</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: totalIncrementalCostsPaise > 0 ? 'var(--color-danger)' : 'inherit' }}>
            -{formatINR(totalIncrementalCostsPaise)}
          </div>
        </div>
        <div style={{ background: 'var(--color-bg)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Net Earnings</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-success)' }}>
            {formatINR(netEarningsPaise)}
          </div>
        </div>
      </div>

      {/* Itemized Incremental Costs */}
      {opportunity.incrementalCosts.length > 0 && (
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
          <strong>Cost details:</strong> {opportunity.incrementalCosts.map((c) => `${c.description} (${formatINR(c.amountPaise)})`).join(', ')}
        </div>
      )}

      {/* Expected Payout Timing */}
      <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
        <strong>Expected Payout:</strong> {opportunity.expectedPayout.description}
      </div>

      {/* Reasons & Evaluation Notes */}
      {reasons.length > 0 && (
        <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--color-border)', fontSize: '0.825rem' }}>
          <strong>Assessment Details:</strong>
          <ul style={{ paddingLeft: '1.2rem', marginTop: '0.25rem', color: isEligible ? 'var(--color-text-muted)' : '#991b1b' }}>
            {reasons.map((r, idx) => (
              <li key={idx}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export const OpportunityCatalog: React.FC<OpportunityCatalogProps> = ({ catalogEvaluation }) => {
  const { groupedEvaluations, hasEarliestGap, earliestGapDayIndex } = catalogEvaluation;
  const { eligibleCandidates, payoutTooLate, uncertainTerms, ineligibleConflicts } = groupedEvaluations;

  return (
    <div style={{ marginTop: '2rem' }}>
      <div className="card-header" style={{ borderBottom: 'none', marginBottom: '0.5rem' }}>
        <div>
          <h2 className="card-title" style={{ fontSize: '1.35rem' }}>
            Fictional Sample Opportunities Catalog
          </h2>
          <div className="form-hint" style={{ fontSize: '0.85rem' }}>
            Sample extra work opportunities to evaluate against worker availability and cash runway. All terms and shifts are fictional.
          </div>
        </div>
      </div>

      {/* Neutral Action Note */}
      <div className="notice-box" style={{ backgroundColor: 'var(--color-surface-subtle)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
        <strong>Neutral Planning Choice:</strong> Considering extra work is optional. Choosing <em>“Continue without extra work”</em> leaves your baseline cash flow forecast unchanged.
      </div>

      {/* Group 1: Eligible Candidates */}
      <div style={{ marginTop: '1.25rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-success)', marginBottom: '0.75rem' }}>
          {hasEarliestGap
            ? `Eligible Candidates (Pre-Day ${earliestGapDayIndex} Shortfall)`
            : 'Eligible Candidates'}
        </h3>
        {eligibleCandidates.length === 0 ? (
          <div className="card" style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            No eligible matches found for your current schedule, skills, and confirmed onboarding.
          </div>
        ) : (
          eligibleCandidates.map((evaluation) => (
            <OpportunityCard key={evaluation.opportunity.id} evaluation={evaluation} />
          ))
        )}
      </div>

      {/* Group 2: Payout Too Late for Immediate Gap */}
      {payoutTooLate.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-warning)', marginBottom: '0.75rem' }}>
            Payout Arrives Too Late for Earliest Shortfall
          </h3>
          <p style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            These opportunities match your schedule and skills, but their expected payout arrives after your earliest essential shortfall. They cannot resolve the immediate Day {earliestGapDayIndex} deficit, though they provide later income.
          </p>
          {payoutTooLate.map((evaluation) => (
            <OpportunityCard key={evaluation.opportunity.id} evaluation={evaluation} />
          ))}
        </div>
      )}

      {/* Group 3: Uncertain Terms or Onboarding Pending */}
      {uncertainTerms.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#b45309', marginBottom: '0.75rem' }}>
            Uncertain Terms / Onboarding Pending
          </h3>
          <p style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            These opportunities require confirmed platform onboarding or have uncertain settlement timing that cannot be verified.
          </p>
          {uncertainTerms.map((evaluation) => (
            <OpportunityCard key={evaluation.opportunity.id} evaluation={evaluation} />
          ))}
        </div>
      )}

      {/* Group 4: Ineligible or Schedule/Skill Conflicts */}
      {ineligibleConflicts.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-danger)', marginBottom: '0.75rem' }}>
            Ineligible / Schedule & Skill Conflicts
          </h3>
          {ineligibleConflicts.map((evaluation) => (
            <OpportunityCard key={evaluation.opportunity.id} evaluation={evaluation} />
          ))}
        </div>
      )}
    </div>
  );
};
