import React, { useState, useMemo } from 'react';
import { FinancialInputs } from './types/finance';
import { WorkerPreferences } from './types/opportunity';
import { getSeedInputs, calculate14DayCashFlow } from './utils/cashFlowEngine';
import {
  getSeedWorkerPreferences,
  getSeedOpportunities,
  evaluateOpportunityCatalog,
} from './utils/opportunityEngine';
import { getTodayDateString } from './utils/dates';
import { Banner } from './components/Banner';
import { FinancialInputPanel } from './components/FinancialInputPanel';
import { WorkerPreferencesPanel } from './components/WorkerPreferencesPanel';
import { SummaryAlerts } from './components/SummaryAlerts';
import { TimelineView } from './components/TimelineView';
import { OpportunityCatalog } from './components/OpportunityCatalog';

export const App: React.FC = () => {
  // Use today's calendar date as default start date
  const defaultStartDate = useMemo(() => getTodayDateString(), []);

  // Baseline Financial State
  const [inputs, setInputs] = useState<FinancialInputs>(() => getSeedInputs(defaultStartDate));

  // Worker Preferences State (Feature 2)
  const [preferences, setPreferences] = useState<WorkerPreferences>(() =>
    getSeedWorkerPreferences(defaultStartDate)
  );

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

  // Reset restores both financial inputs and worker preferences
  const handleResetToSeed = () => {
    const currentStartDate = inputs.startDate || defaultStartDate;
    setInputs(getSeedInputs(currentStartDate));
    setPreferences(getSeedWorkerPreferences(currentStartDate));
  };

  return (
    <>
      <Banner />
      <div className="app-container">
        <header className="app-header">
          <div>
            <h1 className="app-title">GigBridge</h1>
            <p className="app-subtitle">
              14-day cash-flow forecast and sample opportunity evaluation for delivery workers.
            </p>
          </div>
          <div className="header-actions">
            <button
              type="button"
              onClick={handleResetToSeed}
              className="btn btn-secondary"
              title="Reset all financial inputs and preferences to default seed scenario"
            >
              Reset to Demo
            </button>
          </div>
        </header>

        <main className="main-grid">
          {/* Left Column: Editable Financial Inputs & Preferences */}
          <aside>
            <FinancialInputPanel
              inputs={inputs}
              onUpdateInputs={setInputs}
              onResetToSeed={handleResetToSeed}
            />
            <WorkerPreferencesPanel
              preferences={preferences}
              onUpdatePreferences={setPreferences}
            />
          </aside>

          {/* Right Column: Key Alerts, 14-Day Timeline, & Opportunities Catalog */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <SummaryAlerts
              summary={summary}
              safetyBufferPaise={inputs.safetyBufferPaise}
            />
            <TimelineView
              summary={summary}
              safetyBufferPaise={inputs.safetyBufferPaise}
            />
            <OpportunityCatalog catalogEvaluation={catalogEvaluation} />
          </section>
        </main>
      </div>
    </>
  );
};

export default App;
