import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

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
});
