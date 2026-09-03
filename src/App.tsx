import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FinancialInputs } from './types/finance';
import { WorkerPreferences, Opportunity } from './types/opportunity';
import { getSeedInputs, calculate14DayCashFlow } from './utils/cashFlowEngine';
import {
  getSeedWorkerPreferences,
  getSeedOpportunities,
  evaluateOpportunityCatalog,
} from './utils/opportunityEngine';
import { simulateOpportunity } from './utils/simulationEngine';
import { rankOpportunitiesForImmediateGap } from './utils/rankingEngine';
import { getTodayDateString } from './utils/dates';
import { Banner } from './components/Banner';
import { FinancialInputPanel } from './components/FinancialInputPanel';
import { WorkerPreferencesPanel } from './components/WorkerPreferencesPanel';
import { SummaryAlerts } from './components/SummaryAlerts';
import { TimelineView } from './components/TimelineView';
import { OpportunityCatalog } from './components/OpportunityCatalog';
import { OpportunitySimulationPreview } from './components/OpportunitySimulationPreview';

export const App: React.FC = () => {
  const defaultStartDate = useMemo(() => getTodayDateString(), []);

  // Baseline Financial State
  const [inputs, setInputs] = useState<FinancialInputs>(() => getSeedInputs(defaultStartDate));

  // Worker Preferences State
  const [preferences, setPreferences] = useState<WorkerPreferences>(() =>
    getSeedWorkerPreferences(defaultStartDate)
  );

  // Selected Opportunity for single-opportunity simulation preview
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);

  // Notice banner when input edits auto-close active preview
  const [previewClearedNotice, setPreviewClearedNotice] = useState<string | null>(null);

  // Focus management ref for restoring focus upon closing preview
  const lastTriggerElementRef = useRef<HTMLElement | null>(null);

  // Pure deterministic 14-day baseline cash flow calculation
  const summary = useMemo(() => calculate14DayCashFlow(inputs), [inputs]);

  // Fictional Opportunities Catalog (relative to start date)
  const opportunities = useMemo(
    () => getSeedOpportunities(inputs.startDate || defaultStartDate),
    [inputs.startDate, defaultStartDate]
  );

  // Fictional Opportunities Evaluation against worker preferences & baseline cash
  const catalogEvaluation = useMemo(
    () => evaluateOpportunityCatalog(opportunities, preferences, inputs, summary),
    [opportunities, preferences, inputs, summary]
  );

  // Transparent Ranking of Opportunities for the Baseline's Earliest Essential Gap
  const rankingResult = useMemo(
    () => rankOpportunitiesForImmediateGap(inputs, opportunities, preferences),
    [inputs, opportunities, preferences]
  );

  // Find currently selected opportunity
  const selectedOpportunity = useMemo(
    () => opportunities.find((o) => o.id === selectedOpportunityId) || null,
    [opportunities, selectedOpportunityId]
  );

  // Simulation Result for selected opportunity
  const simulationResult = useMemo(() => {
    if (!selectedOpportunity) return null;
    return simulateOpportunity(inputs, selectedOpportunity, preferences);
  }, [selectedOpportunity, inputs, preferences]);

  // Track edits to clear preview automatically
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (selectedOpportunityId) {
      setSelectedOpportunityId(null);
      setPreviewClearedNotice(
        'Simulation preview closed because baseline financial inputs or preferences were modified.'
      );
    }
  }, [inputs, preferences]);

  // Reset restores both financial inputs and worker preferences and clears preview
  const handleResetToSeed = () => {
    const currentStartDate = inputs.startDate || defaultStartDate;
    setInputs(getSeedInputs(currentStartDate));
    setPreferences(getSeedWorkerPreferences(currentStartDate));
    setSelectedOpportunityId(null);
    setPreviewClearedNotice(null);
  };

  const handleSelectOpportunity = (opp: Opportunity) => {
    // Record triggering element for focus restore
    lastTriggerElementRef.current = document.activeElement as HTMLElement | null;
    setSelectedOpportunityId(opp.id);
    setPreviewClearedNotice(null);
  };

  const handleClosePreview = () => {
    setSelectedOpportunityId(null);
    // Restore focus if trigger element is available in DOM
    setTimeout(() => {
      if (lastTriggerElementRef.current && document.body.contains(lastTriggerElementRef.current)) {
        lastTriggerElementRef.current.focus();
      }
    }, 50);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      <Banner />
      <div className="app-container">
        {/* Compact Header */}
        <header className="app-header">
          <div className="brand-wrapper">
            <h1 className="brand-title">GigBridge</h1>
          </div>
          <div className="header-actions">
            <button
              type="button"
              onClick={handleResetToSeed}
              className="btn btn-secondary btn-sm"
              title="Reset all financial inputs and preferences to default seed scenario"
            >
              Reset to Demo
            </button>
          </div>
        </header>

        {/* Human Introduction */}
        <div className="hero-intro">
          <h2 className="hero-heading">Plan the next 14 days</h2>
          <p className="hero-subtext">
            See what your money can cover and explore sample work if you choose.
          </p>
          <div className="quick-nav-bar">
            <button
              type="button"
              onClick={() => scrollToSection('financial-summary')}
              className="quick-nav-btn"
            >
              ↓ Review cash flow
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('opportunity-catalog-section')}
              className="quick-nav-btn"
            >
              ↓ Explore sample work
            </button>
          </div>
        </div>

        {previewClearedNotice && (
          <div
            className="notice-box"
            style={{
              backgroundColor: '#eff6ff',
              borderColor: '#bfdbfe',
              color: '#1e40af',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{previewClearedNotice}</span>
            <button
              type="button"
              onClick={() => setPreviewClearedNotice(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
              aria-label="Dismiss notice"
            >
              ✕
            </button>
          </div>
        )}

        <main className="main-grid">
          {/* Left Column: Manageable Input Sections */}
          <aside>
            <FinancialInputPanel
              inputs={inputs}
              onUpdateInputs={setInputs}
            />
            <WorkerPreferencesPanel
              preferences={preferences}
              onUpdatePreferences={setPreferences}
            />
          </aside>

          {/* Right Column: Financial Summary, Simulation Preview, Timeline, & Opportunities */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <SummaryAlerts
              summary={summary}
              safetyBufferPaise={inputs.safetyBufferPaise}
            />

            {/* Single Opportunity Impact Preview (when active) */}
            {simulationResult && simulationResult.isFeasible && (
              <OpportunitySimulationPreview
                simulationResult={simulationResult}
                safetyBufferPaise={inputs.safetyBufferPaise}
                onClosePreview={handleClosePreview}
              />
            )}

            <TimelineView
              summary={summary}
              safetyBufferPaise={inputs.safetyBufferPaise}
            />

            <OpportunityCatalog
              catalogEvaluation={catalogEvaluation}
              rankingResult={rankingResult}
              selectedOpportunityId={selectedOpportunityId}
              onSelectOpportunity={handleSelectOpportunity}
            />
          </section>
        </main>
      </div>
    </>
  );
};

export default App;
