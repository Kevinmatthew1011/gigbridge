import React, { useState } from 'react';
import type { OpportunityCatalogEvaluation, OpportunityEvaluation, Opportunity } from '../types/opportunity.ts';
import type { OpportunityRankingResult, RankedOpportunity } from '../types/ranking.ts';
import { formatINR } from '../utils/formatters.ts';
import { formatDateDisplay } from '../utils/dates.ts';

interface OpportunityCatalogProps {
  catalogEvaluation: OpportunityCatalogEvaluation;
  rankingResult: OpportunityRankingResult;
  selectedOpportunityId: string | null;
  onSelectOpportunity: (opportunity: Opportunity) => void;
}

const RankedOpportunityCard: React.FC<{
  ranked: RankedOpportunity;
  isSelected: boolean;
  onSelect: (opportunity: Opportunity) => void;
}> = ({ ranked, isSelected, onSelect }) => {
  const { opportunity, rank, metrics, simulationResult } = ranked;
  const isFullyResolved = metrics.remainingDeficitAtEventPaise === 0;
  const isTopRank = rank === 1;

  return (
    <div
      className={`card ${isTopRank ? 'ranked-champion-card' : ''}`}
      style={{
        borderLeft: isTopRank ? '6px solid var(--color-primary)' : '4px solid var(--color-primary)',
        borderColor: isSelected ? 'var(--color-primary)' : isTopRank ? 'var(--color-primary-border)' : undefined,
        backgroundColor: isSelected
          ? 'var(--color-primary-subtle)'
          : isTopRank
          ? '#fafffe'
          : undefined,
        marginBottom: '1.25rem',
        boxShadow: isTopRank ? 'var(--shadow-md)' : undefined,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '0.65rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span
              className={`badge ${isTopRank ? 'badge-success' : 'badge-neutral'}`}
              style={{ fontWeight: 700, fontSize: '0.8rem' }}
            >
              Rank #{rank}
            </span>
            <span className="badge badge-neutral">
              {isTopRank ? 'Top-Ranked Candidate for Earliest Gap' : 'Candidate for Earliest Gap'}
            </span>
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text)' }}>
            {opportunity.title}
          </h3>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Platform: {opportunity.platformName} • Area: {opportunity.approximateArea}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelect(opportunity)}
          className={`btn btn-sm ${isSelected ? 'btn-secondary' : 'btn-primary'}`}
          aria-label={`Preview impact for ${opportunity.title}`}
          style={{ minHeight: '38px', padding: '0.45rem 1rem' }}
        >
          {isSelected ? 'Previewing ✓' : 'Preview impact'}
        </button>
      </div>

      {/* Structured "Why this ranks first" highlight section for Rank 1 */}
      {isTopRank && (
        <div
          className="why-ranks-first-box"
          style={{
            background: '#f0fdfa',
            border: '1px solid #ccfbf1',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            marginBottom: '0.85rem',
          }}
        >
          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              color: 'var(--color-primary-text)',
              marginBottom: '0.4rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Why this ranks first
          </div>
          <ul
            style={{
              paddingLeft: '1.2rem',
              margin: 0,
              fontSize: '0.85rem',
              color: '#134e4a',
              lineHeight: 1.6,
            }}
          >
            <li>
              <strong>Deficit Coverage:</strong> Reduces the Day{' '}
              {simulationResult.originalShortfallComparison?.dayIndex} deficit by{' '}
              <strong>{formatINR(metrics.deficitReductionPaise)}</strong> (projected balance becomes{' '}
              <strong>{formatINR(metrics.simulatedBalanceAtEventPaise)}</strong>).
            </li>
            <li>
              <strong>Payout Timing:</strong> Payout expected on{' '}
              <strong>
                {opportunity.expectedPayout.date
                  ? formatDateDisplay(opportunity.expectedPayout.date)
                  : opportunity.expectedPayout.description}
              </strong>{' '}
              (arrives in time before the Day {simulationResult.originalShortfallComparison?.dayIndex} gap).
            </li>
            <li>
              <strong>Upfront Affordability:</strong>{' '}
              <strong>{formatINR(metrics.upfrontCostBeforePayoutPaise)}</strong> initial cost before payout
              (within verified starting cash).
            </li>
            <li>
              <strong>Net Pay Rate:</strong>{' '}
              <strong>{formatINR(metrics.netEarningsPerHourPaise)}/work-hour</strong>{' '}
              <em>({formatINR(metrics.netEarningsPaise)} net ÷ {metrics.workHours} work-hours, excluding travel)</em>.
            </li>
            <li>
              <strong>Travel Time:</strong>{' '}
              <strong>{metrics.totalTravelMinutes} minutes total</strong> (
              {opportunity.estimatedTravel.outboundMinutes}m outbound +{' '}
              {opportunity.estimatedTravel.returnMinutes}m return).
            </li>
          </ul>
        </div>
      )}

      {/* Work Schedule & Travel Details */}
      <div
        style={{
          fontSize: '0.85rem',
          marginBottom: '0.75rem',
          background: 'var(--color-surface-subtle)',
          padding: '0.65rem 0.85rem',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <div>
          <strong>Work Date & Hours:</strong> {formatDateDisplay(opportunity.workDate)} (
          {opportunity.startTime} – {opportunity.endTime})
        </div>
        <div>
          <strong>Estimated Travel (Fictional):</strong> {opportunity.estimatedTravel.outboundMinutes}m outbound +{' '}
          {opportunity.estimatedTravel.returnMinutes}m return ({metrics.totalTravelMinutes}m total)
          {opportunity.estimatedTravel.costPaise > 0 &&
            ` • Travel Cost: ${formatINR(opportunity.estimatedTravel.costPaise)}`}
        </div>
      </div>

      {/* Financial Metrics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}
      >
        <div style={{ background: 'var(--color-bg)', padding: '0.55rem', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Gross Pay
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            {formatINR(metrics.netEarningsPaise + metrics.upfrontCostBeforePayoutPaise)}
            {opportunity.earnings.type === 'range' && (
              <span style={{ fontSize: '0.75rem', fontWeight: 'normal' }}> (min)</span>
            )}
          </div>
        </div>
        <div style={{ background: 'var(--color-bg)', padding: '0.55rem', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Upfront Costs
          </div>
          <div
            style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              color: metrics.upfrontCostBeforePayoutPaise > 0 ? 'var(--color-danger)' : 'inherit',
            }}
          >
            -{formatINR(metrics.upfrontCostBeforePayoutPaise)}
          </div>
        </div>
        <div style={{ background: 'var(--color-bg)', padding: '0.55rem', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Net Earnings
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-success)' }}>
            {formatINR(metrics.netEarningsPaise)}
          </div>
        </div>
      </div>

      {/* Transparent Structured Ranking Metrics Breakdown */}
      <div
        style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 'var(--radius-sm)',
          padding: '0.65rem 0.85rem',
          fontSize: '0.825rem',
          color: '#166534',
          marginBottom: '0.5rem',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
          {isFullyResolved
            ? `✓ Fully covers Day ${simulationResult.originalShortfallComparison?.dayIndex} shortfall (reduces deficit by ${formatINR(metrics.deficitReductionPaise)})`
            : `Partially reduces Day ${simulationResult.originalShortfallComparison?.dayIndex} shortfall by ${formatINR(metrics.deficitReductionPaise)} (leaving ${formatINR(metrics.remainingDeficitAtEventPaise)})`}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', color: '#15803d' }}>
          <span>
            • Buffer gap at event: <strong>{formatINR(metrics.bufferInclusiveGapAtEventPaise)}</strong>
          </span>
          <span>
            • Upfront cost: <strong>{formatINR(metrics.upfrontCostBeforePayoutPaise)}</strong>
          </span>
          <span>
            • Net pay rate: <strong>{formatINR(metrics.netEarningsPerHourPaise)}/work-hour</strong>{' '}
            <em style={{ fontSize: '0.75rem' }}>(excluding travel)</em>
          </span>
          <span>
            • Total travel time: <strong>{metrics.totalTravelMinutes}m</strong>
          </span>
        </div>
        {simulationResult.simulatedEarliestEssentialShortfall && (
          <div style={{ marginTop: '0.35rem', color: '#b45309', fontSize: '0.8rem', fontWeight: 500 }}>
            ⚠️ Note: A remaining essential shortfall occurs on Day{' '}
            {simulationResult.simulatedEarliestEssentialShortfall.dayIndex} (
            {simulationResult.simulatedEarliestEssentialShortfall.formattedDate}).
          </div>
        )}
      </div>

      {/* Expected Payout Timing */}
      <div style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)' }}>
        <strong>Expected Payout:</strong> {opportunity.expectedPayout.description}
      </div>
    </div>
  );
};

const OpportunityCard: React.FC<{
  evaluation: OpportunityEvaluation;
  isSelected: boolean;
  onSelect: (opportunity: Opportunity) => void;
  showLatePayoutWarning?: boolean;
}> = ({ evaluation, isSelected, onSelect, showLatePayoutWarning }) => {
  const {
    opportunity,
    category,
    isEligible,
    conservativeGrossPaise,
    totalIncrementalCostsPaise,
    netEarningsPaise,
    reasons,
    isUnaffordable,
    onboardingPending,
    scheduleConflict,
    transportMismatch,
    skillsMismatch,
    timingUncertain,
    isTooLateForGap,
  } = evaluation;

  const isFeasibleForPreview =
    !scheduleConflict &&
    !transportMismatch &&
    !skillsMismatch &&
    !onboardingPending &&
    !timingUncertain &&
    !isUnaffordable;

  const getBadge = () => {
    switch (category) {
      case 'eligible_immediate':
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
          : isTooLateForGap
          ? '4px solid var(--color-warning)'
          : category === 'ineligible_conflict'
          ? '4px solid var(--color-danger)'
          : '4px solid var(--color-warning)',
        borderColor: isSelected ? 'var(--color-primary)' : undefined,
        backgroundColor: isSelected ? 'var(--color-primary-subtle)' : undefined,
        marginBottom: '1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '0.5rem',
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{opportunity.title}</h3>
          <div style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)' }}>
            Platform: {opportunity.platformName} • Area: {opportunity.approximateArea}
          </div>
        </div>
        <div>{getBadge()}</div>
      </div>

      {showLatePayoutWarning && (
        <div
          className="notice-box"
          style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a', color: '#92400e', marginBottom: '0.75rem' }}
        >
          <strong>Timing Notice:</strong> Payout arrives on{' '}
          {formatDateDisplay(opportunity.expectedPayout.date || '')}, which is after the earliest shortfall date.
          Preview is available, but this gig cannot resolve the earlier gap.
        </div>
      )}

      {/* Work Schedule & Travel */}
      <div
        style={{
          fontSize: '0.85rem',
          marginBottom: '0.75rem',
          background: 'var(--color-surface-subtle)',
          padding: '0.65rem 0.85rem',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <div>
          <strong>Work Date & Hours:</strong> {formatDateDisplay(opportunity.workDate)} (
          {opportunity.startTime} – {opportunity.endTime})
        </div>
        <div>
          <strong>Estimated Travel (Fictional):</strong> {opportunity.estimatedTravel.outboundMinutes}m outbound +{' '}
          {opportunity.estimatedTravel.returnMinutes}m return
          {opportunity.estimatedTravel.costPaise > 0 &&
            ` • Travel Cost: ${formatINR(opportunity.estimatedTravel.costPaise)}`}
        </div>
      </div>

      {/* Financial Breakdown */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}
      >
        <div style={{ background: 'var(--color-bg)', padding: '0.55rem', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Gross Pay
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            {formatINR(conservativeGrossPaise)}
            {opportunity.earnings.type === 'range' && (
              <span style={{ fontSize: '0.75rem', fontWeight: 'normal' }}> (min)</span>
            )}
          </div>
        </div>
        <div style={{ background: 'var(--color-bg)', padding: '0.55rem', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Incremental Costs
          </div>
          <div
            style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              color: totalIncrementalCostsPaise > 0 ? 'var(--color-danger)' : 'inherit',
            }}
          >
            -{formatINR(totalIncrementalCostsPaise)}
          </div>
        </div>
        <div style={{ background: 'var(--color-bg)', padding: '0.55rem', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Net Earnings
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-success)' }}>
            {formatINR(netEarningsPaise)}
          </div>
        </div>
      </div>

      {/* Itemized Incremental Costs */}
      {opportunity.incrementalCosts.length > 0 && (
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
          <strong>Cost details:</strong>{' '}
          {opportunity.incrementalCosts.map((c) => `${c.description} (${formatINR(c.amountPaise)})`).join(', ')}
        </div>
      )}

      {/* Expected Payout Timing */}
      <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
        <strong>Expected Payout:</strong> {opportunity.expectedPayout.description}
      </div>

      {/* Assessment Details & Action */}
      <div
        style={{
          marginTop: '0.75rem',
          paddingTop: '0.5rem',
          borderTop: '1px dashed var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ fontSize: '0.825rem', flex: 1 }}>
          {reasons.length > 0 ? (
            <ul style={{ paddingLeft: '1.2rem', margin: 0, color: isEligible ? 'var(--color-text-muted)' : '#991b1b' }}>
              {reasons.map((r, idx) => (
                <li key={idx}>{r}</li>
              ))}
            </ul>
          ) : (
            <span style={{ color: 'var(--color-success)', fontWeight: 500 }}>
              ✓ All schedule, skills, transport, and onboarding criteria confirmed.
            </span>
          )}
        </div>

        {isFeasibleForPreview ? (
          <button
            type="button"
            onClick={() => onSelect(opportunity)}
            className={`btn btn-sm ${isSelected ? 'btn-secondary' : 'btn-primary'}`}
            aria-label={`Preview impact for ${opportunity.title}`}
          >
            {isSelected ? 'Previewing ✓' : 'Preview impact'}
          </button>
        ) : (
          <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
            Preview Unavailable
          </span>
        )}
      </div>
    </div>
  );
};

export const OpportunityCatalog: React.FC<OpportunityCatalogProps> = ({
  catalogEvaluation,
  rankingResult,
  selectedOpportunityId,
  onSelectOpportunity,
}) => {
  const [isHowOrderedOpen, setIsHowOrderedOpen] = useState(false);
  const { groupedEvaluations } = catalogEvaluation;
  const { payoutTooLate, uncertainTerms, ineligibleConflicts } = groupedEvaluations;
  const { status, hasBaselineGap, baselineShortfall, rankedOpportunities } = rankingResult;

  // Render each opportunity only once: collect IDs rendered in ranked section
  const rankedOpportunityIds = new Set(rankedOpportunities.map((r) => r.opportunity.id));

  // Filter late payout, uncertain, and ineligible to avoid duplicate cards
  const unrankedPayoutTooLate = payoutTooLate.filter((e) => !rankedOpportunityIds.has(e.opportunity.id));
  const unrankedUncertain = uncertainTerms.filter((e) => !rankedOpportunityIds.has(e.opportunity.id));
  const unrankedIneligible = ineligibleConflicts.filter((e) => !rankedOpportunityIds.has(e.opportunity.id));

  return (
    <div id="opportunity-catalog-section" style={{ marginTop: '0.5rem' }}>
      <div className="card-header" style={{ borderBottom: 'none', marginBottom: '0.35rem' }}>
        <div>
          <h2 className="card-title" style={{ fontSize: '1.35rem' }}>
            Fictional Sample Opportunities Catalog
          </h2>
          <div className="form-hint" style={{ fontSize: '0.85rem' }}>
            Sample extra work opportunities to evaluate against worker availability and cash runway. All terms and
            shifts are fictional.
          </div>
        </div>
      </div>

      {/* Neutral Action Note */}
      <div
        className="notice-box"
        style={{
          backgroundColor: 'var(--color-surface-subtle)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text)',
          marginBottom: '1rem',
        }}
      >
        <strong>Neutral Planning Choice:</strong> Considering extra work is optional. Choosing{' '}
        <em>“Continue without extra work”</em> leaves your baseline cash flow forecast unchanged.
      </div>

      {/* Expandable "How options are ordered" accordion */}
      {hasBaselineGap && (
        <div
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-surface)',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            fontSize: '0.85rem',
          }}
        >
          <button
            type="button"
            onClick={() => setIsHowOrderedOpen(!isHowOrderedOpen)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: 0,
              fontFamily: 'inherit',
              fontSize: '0.9rem',
            }}
            aria-expanded={isHowOrderedOpen}
          >
            <span>{isHowOrderedOpen ? '▼' : '►'}</span>
            <span>How options are ordered</span>
          </button>

          {isHowOrderedOpen && (
            <div
              style={{
                marginTop: '0.65rem',
                paddingTop: '0.5rem',
                borderTop: '1px dashed var(--color-border)',
                color: 'var(--color-text-muted)',
                lineHeight: 1.6,
              }}
            >
              <p style={{ marginBottom: '0.5rem' }}>
                Qualifying candidates that can help address your Day {baselineShortfall?.dayIndex} shortfall are
                sorted strictly in this transparent order:
              </p>
              <ol style={{ paddingLeft: '1.25rem', marginBottom: '0.5rem' }}>
                <li>
                  <strong>Greater immediate shortfall reduction:</strong> Options that reduce more of the Day{' '}
                  {baselineShortfall?.dayIndex} deficit rank higher.
                </li>
                <li>
                  <strong>Smaller buffer-inclusive deficit:</strong> Options leaving a smaller gap below your safety
                  buffer rank higher.
                </li>
                <li>
                  <strong>Lower upfront cost:</strong> Options requiring less upfront money before payout rank higher.
                </li>
                <li>
                  <strong>Higher net pay per work hour:</strong> Net earnings divided by shift work duration (excluding
                  travel time).
                </li>
                <li>
                  <strong>Shorter travel time:</strong> Outbound + return travel duration.
                </li>
                <li>
                  <strong>Stable tie-breaker:</strong> Deterministic alphabetical ordering by opportunity ID when all
                  metrics match.
                </li>
              </ol>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', margin: 0 }}>
                Options are ordered by fixed, transparent rules. No AI score is used.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Section 1: Ranked Candidates for Earliest Gap (or General Eligible if no gap) */}
      {hasBaselineGap ? (
        <div style={{ marginTop: '1.25rem' }}>
          <h3
            style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              color: 'var(--color-primary-text)',
              marginBottom: '0.5rem',
            }}
          >
            Options that could reduce your first shortfall
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            {rankedOpportunities.length === 1
              ? `1 qualifying candidate found that can reduce the Day ${baselineShortfall?.dayIndex} essential shortfall.`
              : rankedOpportunities.length > 1
              ? `${rankedOpportunities.length} qualifying candidates ordered by immediate gap reduction and affordability.`
              : `No qualifying opportunities found that can reduce your Day ${baselineShortfall?.dayIndex} essential shortfall.`}
          </p>

          {status === 'no_qualifying_opportunities' ? (
            <div className="card" style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              {(() => {
                const excluded = rankingResult.excludedOpportunities;
                const hasLate = excluded.some((e) => e.category === 'payout_too_late');
                const hasConflict = excluded.some((e) => e.category === 'ineligible_conflict');
                const hasUncertain = excluded.some((e) => e.category === 'uncertain_terms');
                const reasons: string[] = [];
                if (hasConflict) reasons.push('schedule, skill, or upfront cost constraints');
                if (hasUncertain) reasons.push('unconfirmed platform onboarding');
                if (hasLate) reasons.push('payouts arriving after the shortfall date');

                return `No qualifying opportunities can improve the Day ${baselineShortfall?.dayIndex} shortfall. Candidates were excluded due to ${
                  reasons.length > 0 ? reasons.join(' and ') : 'unmet eligibility criteria'
                }.`;
              })()}
            </div>
          ) : (
            rankedOpportunities.map((ranked) => (
              <RankedOpportunityCard
                key={ranked.opportunity.id}
                ranked={ranked}
                isSelected={selectedOpportunityId === ranked.opportunity.id}
                onSelect={onSelectOpportunity}
              />
            ))
          )}
        </div>
      ) : (
        /* Neutral General Browsing (No Baseline Shortfall) */
        <div style={{ marginTop: '1.25rem' }}>
          <h3
            style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              color: 'var(--color-primary-text)',
              marginBottom: '0.5rem',
            }}
          >
            Eligible Opportunities
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            All baseline essential expenses are covered across 14 days. These sample opportunities match your confirmed
            preferences.
          </p>
          {groupedEvaluations.eligibleCandidates.length === 0 ? (
            <div className="card" style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              No matching opportunities found for your current preferences.
            </div>
          ) : (
            groupedEvaluations.eligibleCandidates.map((evaluation) => (
              <OpportunityCard
                key={evaluation.opportunity.id}
                evaluation={evaluation}
                isSelected={selectedOpportunityId === evaluation.opportunity.id}
                onSelect={onSelectOpportunity}
              />
            ))
          )}
        </div>
      )}

      {/* Section 2: Payout Too Late for Immediate Gap */}
      {unrankedPayoutTooLate.length > 0 && (
        <div style={{ marginTop: '1.75rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-warning)', marginBottom: '0.5rem' }}>
            Payout Arrives Too Late for Earliest Shortfall
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            These opportunities match your schedule and skills, but their expected payout arrives after your earliest
            essential shortfall. Preview is available, but they cannot resolve the immediate Day{' '}
            {baselineShortfall?.dayIndex} deficit.
          </p>
          {unrankedPayoutTooLate.map((evaluation) => (
            <OpportunityCard
              key={evaluation.opportunity.id}
              evaluation={evaluation}
              isSelected={selectedOpportunityId === evaluation.opportunity.id}
              onSelect={onSelectOpportunity}
              showLatePayoutWarning={true}
            />
          ))}
        </div>
      )}

      {/* Section 3: Uncertain Terms or Onboarding Pending */}
      {unrankedUncertain.length > 0 && (
        <div style={{ marginTop: '1.75rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#b45309', marginBottom: '0.5rem' }}>
            Uncertain Terms / Onboarding Pending
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            These opportunities require confirmed platform onboarding or have uncertain settlement timing that cannot
            be verified.
          </p>
          {unrankedUncertain.map((evaluation) => (
            <OpportunityCard
              key={evaluation.opportunity.id}
              evaluation={evaluation}
              isSelected={selectedOpportunityId === evaluation.opportunity.id}
              onSelect={onSelectOpportunity}
            />
          ))}
        </div>
      )}

      {/* Section 4: Ineligible or Schedule/Skill Conflicts */}
      {unrankedIneligible.length > 0 && (
        <div style={{ marginTop: '1.75rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-danger)', marginBottom: '0.5rem' }}>
            Ineligible / Schedule & Skill Conflicts
          </h3>
          {unrankedIneligible.map((evaluation) => (
            <OpportunityCard
              key={evaluation.opportunity.id}
              evaluation={evaluation}
              isSelected={selectedOpportunityId === evaluation.opportunity.id}
              onSelect={onSelectOpportunity}
            />
          ))}
        </div>
      )}
    </div>
  );
};
