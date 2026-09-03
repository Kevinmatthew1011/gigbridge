import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { FinancialInputs } from './types/finance.ts';
import type { WorkerPreferences, Opportunity } from './types/opportunity.ts';
import { getSeedInputs, calculate14DayCashFlow } from './utils/cashFlowEngine.ts';
import {
  getSeedWorkerPreferences,
  getSeedOpportunities,
  evaluateOpportunityCatalog,
} from './utils/opportunityEngine.ts';
import { simulateOpportunity } from './utils/simulationEngine.ts';
import { rankOpportunitiesForImmediateGap } from './utils/rankingEngine.ts';
import { getTodayDateString, isValidDateString } from './utils/dates.ts';
import { extractBaselineFacts, extractAllFacts } from './utils/factExtractor.ts';
import { fetchExplanation } from './utils/explanationClient.ts';
import { Banner } from './components/Banner.tsx';
import { FinancialInputPanel } from './components/FinancialInputPanel.tsx';
import { WorkerPreferencesPanel } from './components/WorkerPreferencesPanel.tsx';
import { SummaryAlerts } from './components/SummaryAlerts.tsx';
import { TimelineView } from './components/TimelineView.tsx';
import { OpportunityCatalog } from './components/OpportunityCatalog.tsx';
import { OpportunitySimulationPreview } from './components/OpportunitySimulationPreview.tsx';

interface ExplanationUIState {
  status: 'idle' | 'loading' | 'success' | 'fallback';
  source: 'ai' | 'mock' | 'fallback' | null;
  diagnosticCode?: string;
  renderedText: string | null;
}

const INITIAL_EXPLANATION_STATE: ExplanationUIState = {
  status: 'idle',
  source: null,
  renderedText: null,
};

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

  // Separate Explanation UI states for baseline and preview
  const [baselineExplanation, setBaselineExplanation] = useState<ExplanationUIState>(INITIAL_EXPLANATION_STATE);
  const [previewExplanation, setPreviewExplanation] = useState<ExplanationUIState>(INITIAL_EXPLANATION_STATE);

  // Separate AbortControllers and Request ID tracking to prevent race conditions & stale responses
  const baselineAbortRef = useRef<AbortController | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const currentBaselineReqIdRef = useRef<string | null>(null);
  const currentPreviewReqIdRef = useRef<string | null>(null);

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

  // Find currently selected opportunity and evaluation
  const selectedOpportunity = useMemo(
    () => opportunities.find((o) => o.id === selectedOpportunityId) || null,
    [opportunities, selectedOpportunityId]
  );

  const selectedEvaluation = useMemo(() => {
    if (!selectedOpportunity) return null;
    return catalogEvaluation.evaluations.find((e) => e.opportunity.id === selectedOpportunity.id) || null;
  }, [catalogEvaluation, selectedOpportunity]);

  // Simulation Result for selected opportunity
  const simulationResult = useMemo(() => {
    if (!selectedOpportunity) return null;
    return simulateOpportunity(inputs, selectedOpportunity, preferences);
  }, [selectedOpportunity, inputs, preferences]);

  // Extract canonical typed facts deterministically
  const baselineFacts = useMemo(() => extractBaselineFacts(inputs, summary), [inputs, summary]);

  const simulationFacts = useMemo(() => {
    if (!selectedOpportunity) return null;
    return extractAllFacts({
      inputs,
      summary,
      opportunity: selectedOpportunity,
      evaluation: selectedEvaluation,
      simulationResult,
      rankingResult,
    });
  }, [inputs, summary, selectedOpportunity, selectedEvaluation, simulationResult, rankingResult]);

  // Form input validation status
  const isInputValid = useMemo(() => {
    return (
      inputs.currentCashPaise >= 0 &&
      inputs.dailyEssentialPaise >= 0 &&
      inputs.safetyBufferPaise >= 0 &&
      isValidDateString(inputs.startDate)
    );
  }, [inputs]);

  // Clear baseline and preview explanations when inputs or preferences change
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Cancel in-flight baseline request
    if (baselineAbortRef.current) {
      baselineAbortRef.current.abort();
      baselineAbortRef.current = null;
    }
    currentBaselineReqIdRef.current = null;
    setBaselineExplanation(INITIAL_EXPLANATION_STATE);

    // Cancel in-flight preview request
    if (previewAbortRef.current) {
      previewAbortRef.current.abort();
      previewAbortRef.current = null;
    }
    currentPreviewReqIdRef.current = null;
    setPreviewExplanation(INITIAL_EXPLANATION_STATE);

    if (selectedOpportunityId) {
      setSelectedOpportunityId(null);
      setPreviewClearedNotice(
        'Simulation preview closed because baseline financial inputs or preferences were modified.'
      );
    }
  }, [inputs, preferences]);

  // Clear preview explanation when selected opportunity changes
  useEffect(() => {
    if (previewAbortRef.current) {
      previewAbortRef.current.abort();
      previewAbortRef.current = null;
    }
    currentPreviewReqIdRef.current = null;
    setPreviewExplanation(INITIAL_EXPLANATION_STATE);
  }, [selectedOpportunityId]);

  // On-demand explanation handler for baseline cash flow
  const handleRequestBaselineExplanation = useCallback(async () => {
    if (!isInputValid) return;

    if (baselineAbortRef.current) {
      baselineAbortRef.current.abort();
    }

    const controller = new AbortController();
    baselineAbortRef.current = controller;

    const requestId = `req_base_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    currentBaselineReqIdRef.current = requestId;

    setBaselineExplanation({
      status: 'loading',
      source: null,
      renderedText: null,
    });

    try {
      const result = await fetchExplanation({
        scenario: 'baseline_summary',
        facts: baselineFacts,
        fallbackText: summary.explanation,
        requestId,
        signal: controller.signal,
      });

      // Discard stale responses if requestId has changed
      if (currentBaselineReqIdRef.current !== requestId) return;

      setBaselineExplanation({
        status: result.status,
        source: result.source,
        diagnosticCode: result.diagnosticCode,
        renderedText: result.renderedText,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (currentBaselineReqIdRef.current !== requestId) return;

      setBaselineExplanation({
        status: 'fallback',
        source: 'fallback',
        diagnosticCode: 'GATEWAY_ERROR',
        renderedText: summary.explanation,
      });
    } finally {
      if (baselineAbortRef.current === controller) {
        baselineAbortRef.current = null;
      }
    }
  }, [isInputValid, baselineFacts, summary.explanation]);

  // On-demand explanation handler for single-opportunity simulation
  const handleRequestPreviewExplanation = useCallback(async () => {
    if (!simulationResult || !simulationFacts || !isInputValid) return;

    if (previewAbortRef.current) {
      previewAbortRef.current.abort();
    }

    const controller = new AbortController();
    previewAbortRef.current = controller;

    const requestId = `req_prev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    currentPreviewReqIdRef.current = requestId;

    setPreviewExplanation({
      status: 'loading',
      source: null,
      renderedText: null,
    });

    try {
      const result = await fetchExplanation({
        scenario: 'single_opportunity_preview',
        facts: simulationFacts,
        fallbackText: simulationResult.explanation,
        requestId,
        signal: controller.signal,
      });

      if (currentPreviewReqIdRef.current !== requestId) return;

      setPreviewExplanation({
        status: result.status,
        source: result.source,
        diagnosticCode: result.diagnosticCode,
        renderedText: result.renderedText,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (currentPreviewReqIdRef.current !== requestId) return;

      setPreviewExplanation({
        status: 'fallback',
        source: 'fallback',
        diagnosticCode: 'GATEWAY_ERROR',
        renderedText: simulationResult.explanation,
      });
    } finally {
      if (previewAbortRef.current === controller) {
        previewAbortRef.current = null;
      }
    }
  }, [simulationResult, simulationFacts, isInputValid]);

  // Reset restores both financial inputs and worker preferences and clears preview & explanations
  const handleResetToSeed = () => {
    if (baselineAbortRef.current) baselineAbortRef.current.abort();
    if (previewAbortRef.current) previewAbortRef.current.abort();
    baselineAbortRef.current = null;
    previewAbortRef.current = null;
    currentBaselineReqIdRef.current = null;
    currentPreviewReqIdRef.current = null;

    const currentStartDate = inputs.startDate || defaultStartDate;
    setInputs(getSeedInputs(currentStartDate));
    setPreferences(getSeedWorkerPreferences(currentStartDate));
    setSelectedOpportunityId(null);
    setPreviewClearedNotice(null);
    setBaselineExplanation(INITIAL_EXPLANATION_STATE);
    setPreviewExplanation(INITIAL_EXPLANATION_STATE);
  };

  const handleSelectOpportunity = (opp: Opportunity) => {
    lastTriggerElementRef.current = document.activeElement as HTMLElement | null;
    setSelectedOpportunityId(opp.id);
    setPreviewClearedNotice(null);
  };

  const handleClosePreview = () => {
    if (previewAbortRef.current) previewAbortRef.current.abort();
    previewAbortRef.current = null;
    currentPreviewReqIdRef.current = null;
    setSelectedOpportunityId(null);
    setPreviewExplanation(INITIAL_EXPLANATION_STATE);

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
              explanationStatus={baselineExplanation.status}
              explanationSource={baselineExplanation.source}
              explanationDiagnosticCode={baselineExplanation.diagnosticCode}
              explanationText={baselineExplanation.renderedText}
              onRequestExplanation={handleRequestBaselineExplanation}
              isExplanationDisabled={!isInputValid}
              explanationDisabledReason={!isInputValid ? 'Complete valid financial inputs to request explanation.' : undefined}
            />

            {/* Single Opportunity Impact Preview (when active) */}
            {simulationResult && simulationResult.isFeasible && (
              <OpportunitySimulationPreview
                simulationResult={simulationResult}
                safetyBufferPaise={inputs.safetyBufferPaise}
                onClosePreview={handleClosePreview}
                explanationStatus={previewExplanation.status}
                explanationSource={previewExplanation.source}
                explanationDiagnosticCode={previewExplanation.diagnosticCode}
                explanationText={previewExplanation.renderedText}
                onRequestExplanation={handleRequestPreviewExplanation}
                isExplanationDisabled={!isInputValid}
                explanationDisabledReason={!isInputValid ? 'Complete valid financial inputs to request explanation.' : undefined}
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
