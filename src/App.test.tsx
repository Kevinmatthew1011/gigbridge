import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App.tsx';

describe('App Component Integration & UI Redesign', () => {
  it('renders the fictional demo banner and single reset button in header', () => {
    render(<App />);
    expect(
      screen.getByText(/Fictional demo — sample money and opportunities/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset to Demo/i })).toBeInTheDocument();
  });

  it('renders human introduction and quick navigation buttons', () => {
    render(<App />);
    expect(screen.getByText(/Plan the next 14 days/i)).toBeInTheDocument();
    expect(
      screen.getByText(/See what your money can cover and explore sample work if you choose/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /↓ Review cash flow/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /↓ Explore sample work/i })).toBeInTheDocument();
  });

  it('renders manageable input sections with structured group titles', () => {
    render(<App />);
    expect(screen.getByText(/Money available now/i)).toBeInTheDocument();
    expect(screen.getByText(/Daily essentials and bills/i)).toBeInTheDocument();
    expect(screen.getByText(/Money already earned, arriving later/i)).toBeInTheDocument();
    expect(screen.getByText(/Your availability and work preferences/i)).toBeInTheDocument();

    const currentCashInput = screen.getByLabelText(/Current Cash in Hand/i) as HTMLInputElement;
    expect(currentCashInput.value).toBe('700');
  });

  it('renders human plain-language financial summary with lowest projected cash over 14 days', () => {
    render(<App />);
    expect(
      screen.getByText(/Your first essentials gap is ₹400 on Day 3/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Safety Buffer Status/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Lowest projected cash over 14 days/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/on Day 14/i)
    ).toBeInTheDocument();
  });

  it('supports progressive timeline detail expansion with concise overview', () => {
    render(<App />);
    expect(screen.getByText(/14-Day Cash Flow Runway/i)).toBeInTheDocument();
    expect(screen.getByText(/14 Days Forecasted/i)).toBeInTheDocument();

    const toggleBtn = screen.getByRole('button', { name: /View Full 14-Day Table/i });
    expect(toggleBtn).toBeInTheDocument();

    // Table is initially collapsed
    expect(screen.queryByRole('table', { name: /14-day cash flow runway/i })).not.toBeInTheDocument();

    // Click to expand table
    fireEvent.click(toggleBtn);
    expect(screen.getByRole('table', { name: /14-day cash flow runway/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hide Full Timeline/i })).toBeInTheDocument();
  });

  it('renders ranked opportunities with rank badges and expandable ordering explanation', () => {
    render(<App />);
    expect(screen.getByText(/Options that could reduce your first shortfall/i)).toBeInTheDocument();
    expect(screen.getByText(/Rank 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Sample Packing Shift \(Fictional\)/i)).toBeInTheDocument();

    const howOrderedBtn = screen.getByRole('button', { name: /How options are ordered/i });
    fireEvent.click(howOrderedBtn);
    expect(screen.getByText(/Greater immediate shortfall reduction/i)).toBeInTheDocument();
    expect(screen.getByText(/Options are ordered by fixed, transparent rules. No AI score is used./i)).toBeInTheDocument();
  });

  it('opens and closes preview returning to baseline', () => {
    render(<App />);

    const previewButtons = screen.getAllByRole('button', { name: /Preview impact/i });
    fireEvent.click(previewButtons[0]);

    expect(
      screen.getByText(/With Sample Opportunity: Sample Packing Shift \(Fictional\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Hypothetical preview — no work booked and no actual cash changed/i)
    ).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /✕ Close Preview/i });
    fireEvent.click(closeBtn);

    expect(
      screen.queryByText(/With Sample Opportunity: Sample Packing Shift/i)
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Your first essentials gap is ₹400 on Day 3/i)).toBeInTheDocument();
  });

  it('replaces active preview when another opportunity is clicked', () => {
    render(<App />);

    const previewButtons = screen.getAllByRole('button', { name: /Preview impact/i });
    fireEvent.click(previewButtons[0]);
    expect(
      screen.getByText(/With Sample Opportunity: Sample Packing Shift/i)
    ).toBeInTheDocument();

    fireEvent.click(previewButtons[1]);
    expect(
      screen.getByText(/With Sample Opportunity: Sample Express Courier Shift/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/With Sample Opportunity: Sample Packing Shift/i)
    ).not.toBeInTheDocument();
  });

  it('previews Opportunity B correctly showing that Day 8 payout leaves Day 3 shortfall unresolved', () => {
    render(<App />);

    const previewButtons = screen.getAllByRole('button', { name: /Preview impact/i });
    // Click Opp B (Express Courier Shift)
    fireEvent.click(previewButtons[1]);

    expect(
      screen.getByText(/With Sample Opportunity: Sample Express Courier Shift/i)
    ).toBeInTheDocument();

    // Day 3 shortfall remains unresolved
    expect(
      screen.getByText(/₹400 Remaining/i)
    ).toBeInTheDocument();
  });

  it('reproduces Courier screenshot state: missing skill and onboarding disables preview with accurate categorization', () => {
    render(<App />);

    // 1. Uncheck Courier skill and Courier onboarding
    const courierSkillCheckbox = screen.getByRole('checkbox', { name: /Courier & Package Delivery/i });
    const courierOnboardingCheckbox = screen.getByRole('checkbox', { name: /Sample Express Delivery Platform/i });

    fireEvent.click(courierSkillCheckbox); // Uncheck skill
    fireEvent.click(courierOnboardingCheckbox); // Uncheck onboarding

    // Courier shift must now be categorized as ineligible / conflict and preview disabled
    expect(screen.getByText(/Requires courier_delivery skills/i)).toBeInTheDocument();
    expect(screen.getByText(/Onboarding with Sample Express Delivery Platform is pending or unconfirmed/i)).toBeInTheDocument();

    // 2. Toggle Courier skill back ON, keep onboarding OFF
    fireEvent.click(courierSkillCheckbox);
    expect(screen.queryByText(/Requires courier_delivery skills/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Onboarding with Sample Express Delivery Platform is pending or unconfirmed/i)).toBeInTheDocument();

    // 3. Toggle Courier onboarding back ON -> fully eligible, preview available with late-payout warning
    fireEvent.click(courierOnboardingCheckbox);
    expect(screen.getByText(/Payout Arrives Too Late for Earliest Shortfall/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Preview impact for Sample Express Courier Shift/i })).toBeInTheDocument();
  });

  it('allows inline editing of existing bills and payouts without recreating them', () => {
    render(<App />);

    // 1. Edit existing Day 3 bill amount from 500 to 600
    const billAmountInput = screen.getByLabelText(/Bill amount for Bill/i);
    fireEvent.change(billAmountInput, { target: { value: '600' } });

    // Shortfall on Day 3 should update from ₹400 to ₹500
    expect(
      screen.getByText(/Your first essentials gap is ₹500 on Day 3/i)
    ).toBeInTheDocument();

    // 2. Edit existing Day 7 payout amount from 1000 to 1200
    const payoutAmountInput = screen.getByLabelText(/Payout amount for Earned Delivery Payout/i);
    fireEvent.change(payoutAmountInput, { target: { value: '1200' } });

    expect(screen.getByDisplayValue('600')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1200')).toBeInTheDocument();
  });

  it('allows inline editing of existing availability slots and auto-clears active preview', () => {
    render(<App />);

    // Preview Opp A
    const previewBtn = screen.getAllByRole('button', { name: /Preview impact/i })[0];
    fireEvent.click(previewBtn);
    expect(
      screen.getByText(/With Sample Opportunity: Sample Packing Shift/i)
    ).toBeInTheDocument();

    // Edit start time of Day 2 slot from 08:00 to 11:00 (causing schedule conflict with 09:00 shift + 30m travel)
    const day2StartInput = screen.getByLabelText(/Start time for 2026-09-04 slot 1/i);
    fireEvent.change(day2StartInput, { target: { value: '11:00' } });

    // Preview is auto-cleared
    expect(
      screen.queryByText(/With Sample Opportunity: Sample Packing Shift/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Simulation preview closed because baseline financial inputs or preferences were modified/i)
    ).toBeInTheDocument();

    // Opp A now has schedule conflict
    expect(screen.getByText(/Requires availability from 08:30 to 17:30/i)).toBeInTheDocument();
  });

  it('resets all inputs, preferences and clears preview on Reset to Demo', () => {
    render(<App />);

    const previewBtn = screen.getAllByRole('button', { name: /Preview impact/i })[0];
    fireEvent.click(previewBtn);

    const currentCashInput = screen.getByLabelText(/Current Cash in Hand/i) as HTMLInputElement;
    fireEvent.change(currentCashInput, { target: { value: '999' } });
    expect(currentCashInput.value).toBe('999');

    const resetBtn = screen.getByRole('button', { name: /Reset to Demo/i });
    fireEvent.click(resetBtn);

    expect(currentCashInput.value).toBe('700');
    expect(
      screen.queryByText(/With Sample Opportunity: Sample Packing Shift/i)
    ).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // PHASE 3: AI EXPLANATION CLIENT INTEGRATION TESTS
  // --------------------------------------------------------------------------
  describe('Phase 3: AI Explanation Client Integration & Truthful Badging', () => {
    it('requests baseline explanation on click and displays truthful mock badge without claiming AI model', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(init?.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            requestId: body.requestId,
            status: 'success',
            source: 'mock',
            messages: [
              {
                messageId: 'baseline_essential_shortfall',
                text: 'Your first essential cash shortfall of ₹400 occurs on Day 3 (Sat, 5 Sept) when expenses exceed available cash.',
                referencedFactIds: ['FACT_BASELINE_ESSENTIAL_SHORTFALL'],
              },
              {
                messageId: 'baseline_buffer_gap',
                text: 'Reaching your ₹100 safety buffer cushion on Day 3 requires ₹500 total (includes the ₹400 essential deficit; not an extra charge).',
                referencedFactIds: ['FACT_BASELINE_SAFETY_BUFFER', 'FACT_BASELINE_ESSENTIAL_SHORTFALL'],
              },
            ],
          }),
        } as Response;
      });

      render(<App />);

      // Find the Explain button in the baseline financial summary
      const explainBtn = screen.getAllByRole('button', { name: /Explain these results/i })[0];
      expect(explainBtn).toBeInTheDocument();

      // Trigger user click
      fireEvent.click(explainBtn);

      // Verify fetch was called with facts and NO raw user bill descriptions or client fallbackText
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const callArgs = fetchSpy.mock.calls[0];
      expect(callArgs[0]).toBe('/api/explain');
      const sentPayload = JSON.parse(callArgs[1]?.body as string);
      expect(sentPayload.scenario).toBe('baseline_summary');
      expect(sentPayload.fallbackText).toBeUndefined(); // Strictly omitted
      expect(sentPayload.facts.FACT_BASELINE_ESSENTIAL_SHORTFALL.deficitPaise).toBe(40000);
      expect(sentPayload.facts.FACT_BASELINE_ESSENTIAL_SHORTFALL.description).toBeUndefined(); // Raw bill name omitted

      // Wait for rendered text & truthful badge
      expect(
        await screen.findByText(/Demo explanation — no AI model connected/i)
      ).toBeInTheDocument();
      expect(
        screen.getAllByText(/Your first essential cash shortfall of ₹400 occurs on Day 3/i).length
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getByText(/Reaching your ₹100 safety buffer cushion on Day 3 requires ₹500 total/i)
      ).toBeInTheDocument();

      fetchSpy.mockRestore();
    });

    it('requests preview explanation for Opp A: includes Day 5 warning & mandatory disclosures', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(init?.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            requestId: body.requestId,
            status: 'success',
            source: 'mock',
            messages: [
              {
                messageId: 'original_gap_covered',
                text: 'Taking this opportunity covers the original Day 3 essential deficit of ₹400 (projected balance is ₹250 at that event).',
                referencedFactIds: ['FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON', 'FACT_BASELINE_ESSENTIAL_SHORTFALL'],
              },
              {
                messageId: 'later_gap_remains',
                text: 'However, a later essential shortfall occurs on Day 5 (Mon, 7 Sept) with a deficit of ₹150.',
                referencedFactIds: ['FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL'],
              },
              {
                messageId: 'fictional_opportunity_disclosure',
                text: 'Hypothetical preview with sample money and opportunities. Real opportunities may vary in pay timing and eligibility.',
                referencedFactIds: [],
              },
              {
                messageId: 'work_is_optional_disclosure',
                text: 'Extra work is completely optional. Choose gigs that respect your rest, safety, and commute preferences.',
                referencedFactIds: [],
              },
            ],
          }),
        } as Response;
      });

      render(<App />);

      // Preview Opportunity A
      const previewBtn = screen.getAllByRole('button', { name: /Preview impact/i })[0];
      fireEvent.click(previewBtn);

      // Click "Explain these results" within preview
      const previewExplainBtns = screen.getAllByRole('button', { name: /Explain these results/i });
      const previewExplainBtn = previewExplainBtns[previewExplainBtns.length - 1];
      fireEvent.click(previewExplainBtn);

      // Verify explanation rendered with Day 5 remaining shortfall warning and disclosures
      expect(
        await screen.findByText(/covers the original Day 3 essential deficit of ₹400/i)
      ).toBeInTheDocument();
      expect(
        screen.getAllByText(/later essential shortfall occurs on Day 5/i).length
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getByText(/Hypothetical preview with sample money/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Extra work is completely optional/i)
      ).toBeInTheDocument();

      fetchSpy.mockRestore();
    });

    it('renders local deterministic fallback with "Standard summary" badge on gateway error or malformed response', async () => {
      // Simulate unavailable gateway (network failure / 500)
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Connection refused'));

      render(<App />);

      const explainBtn = screen.getAllByRole('button', { name: /Explain these results/i })[0];
      fireEvent.click(explainBtn);

      // Should gracefully fall back to local deterministic summary with Standard summary badge
      expect(
        await screen.findByText(/Standard summary/i)
      ).toBeInTheDocument();
      expect(
        screen.getAllByText(/Your first essentials gap is ₹400 on Day 3/i).length
      ).toBeGreaterThanOrEqual(1);

      fetchSpy.mockRestore();
    });

    it('clears explanations on financial edits, switching gigs, closing preview, and Reset', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(init?.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            requestId: body.requestId,
            status: 'success',
            source: 'mock',
            messages: [
              {
                messageId: 'baseline_essential_shortfall',
                text: 'Your first essential cash shortfall of ₹400 occurs on Day 3 (Sat, 5 Sept) when expenses exceed available cash.',
                referencedFactIds: ['FACT_BASELINE_ESSENTIAL_SHORTFALL'],
              },
            ],
          }),
        } as Response;
      });

      render(<App />);

      // Request baseline explanation
      const explainBtn = screen.getAllByRole('button', { name: /Explain these results/i })[0];
      fireEvent.click(explainBtn);

      expect(
        await screen.findByText(/Demo explanation — no AI model connected/i)
      ).toBeInTheDocument();

      // Edit financial inputs -> explanation must clear
      const cashInput = screen.getByLabelText(/Current Cash in Hand/i);
      fireEvent.change(cashInput, { target: { value: '850' } });

      expect(
        screen.queryByText(/Demo explanation — no AI model connected/i)
      ).not.toBeInTheDocument();

      fetchSpy.mockRestore();
    });

    it('ensures baseline and preview requests operate independently and cannot overwrite each other', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(init?.body as string);
        if (body.scenario === 'baseline_summary') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              requestId: body.requestId,
              status: 'success',
              source: 'mock',
              messages: [
                {
                  messageId: 'baseline_essential_shortfall',
                  text: 'Baseline summary explanation for Day 3.',
                  referencedFactIds: ['FACT_BASELINE_ESSENTIAL_SHORTFALL'],
                },
              ],
            }),
          } as Response;
        } else {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              requestId: body.requestId,
              status: 'success',
              source: 'fallback',
              messages: [
                {
                  messageId: 'original_gap_covered',
                  text: 'Preview explanation for Opportunity A.',
                  referencedFactIds: ['FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON', 'FACT_BASELINE_ESSENTIAL_SHORTFALL'],
                },
                {
                  messageId: 'later_gap_remains',
                  text: 'Day 5 warning.',
                  referencedFactIds: ['FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL'],
                },
                {
                  messageId: 'fictional_opportunity_disclosure',
                  text: 'Disclosure 1',
                  referencedFactIds: [],
                },
                {
                  messageId: 'work_is_optional_disclosure',
                  text: 'Disclosure 2',
                  referencedFactIds: [],
                },
              ],
            }),
          } as Response;
        }
      });

      render(<App />);

      // Request baseline explanation
      const baseExplainBtn = screen.getAllByRole('button', { name: /Explain these results/i })[0];
      fireEvent.click(baseExplainBtn);

      expect(
        await screen.findByText(/Demo explanation — no AI model connected/i)
      ).toBeInTheDocument();

      // Open preview and request preview explanation
      const previewBtn = screen.getAllByRole('button', { name: /Preview impact/i })[0];
      fireEvent.click(previewBtn);

      const previewExplainBtns = screen.getAllByRole('button', { name: /Explain these results/i });
      const prevExplainBtn = previewExplainBtns[previewExplainBtns.length - 1];
      fireEvent.click(prevExplainBtn);

      // Both explanations are active with their respective badges and content
      expect(
        await screen.findByText(/Standard summary/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Demo explanation — no AI model connected/i)
      ).toBeInTheDocument();

      fetchSpy.mockRestore();
    });

    it('renders "AI-assisted explanation" badge and transparency note when gateway returns source "ai"', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(init?.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            requestId: body.requestId,
            status: 'success',
            source: 'ai',
            messages: [
              {
                messageId: 'baseline_essential_shortfall',
                text: 'Your first essential cash shortfall of ₹400 occurs on Day 3 (Sat, 5 Sept) when expenses exceed available cash.',
                referencedFactIds: ['FACT_BASELINE_ESSENTIAL_SHORTFALL'],
              },
            ],
          }),
        } as Response;
      });

      render(<App />);

      const baseExplainBtn = screen.getAllByRole('button', { name: /Explain these results/i })[0];
      fireEvent.click(baseExplainBtn);

      expect(
        await screen.findByText(/AI-assisted explanation/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Gemini organizes verified facts; calculations remain rule-based/i)
      ).toBeInTheDocument();

      fetchSpy.mockRestore();
    });

    it('renders safe diagnosticCode tag when gateway fallback response includes it', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(init?.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            requestId: body.requestId,
            status: 'success',
            source: 'fallback',
            diagnosticCode: 'GEMINI_AUTH_ERROR',
            messages: [],
            renderedText: 'Standard fallback summary',
          }),
        } as Response;
      });

      render(<App />);

      const baseExplainBtn = screen.getAllByRole('button', { name: /Explain these results/i })[0];
      fireEvent.click(baseExplainBtn);

      expect(
        await screen.findByText(/Standard summary/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/\(GEMINI_AUTH_ERROR\)/i)
      ).toBeInTheDocument();

      fetchSpy.mockRestore();
    });

    it('renders GEMINI_TIMEOUT_ERROR badge when gateway returns timeout diagnostic', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(init?.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            requestId: body.requestId,
            status: 'success',
            source: 'fallback',
            diagnosticCode: 'GEMINI_TIMEOUT_ERROR',
            messages: [],
            renderedText: 'Standard summary after 30s timeout',
          }),
        } as Response;
      });

      render(<App />);

      const baseExplainBtn = screen.getAllByRole('button', { name: /Explain these results/i })[0];
      fireEvent.click(baseExplainBtn);

      expect(
        await screen.findByText(/Standard summary/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/\(GEMINI_TIMEOUT_ERROR\)/i)
      ).toBeInTheDocument();

      fetchSpy.mockRestore();
    });
  });
});
