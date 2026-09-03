import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from './App';

describe('App Component Integration', () => {
  it('renders the fictional demo banner prominently', () => {
    render(<App />);
    expect(
      screen.getByText(/Fictional demo — sample money and opportunities/i)
    ).toBeInTheDocument();
  });

  it('renders the initial seed baseline scenario correctly with updated readability labels', () => {
    render(<App />);

    // Seed inputs check
    const currentCashInput = screen.getByLabelText(/Current Cash in Hand/i) as HTMLInputElement;
    expect(currentCashInput.value).toBe('700');

    const dailyEssentialInput = screen.getByLabelText(/Daily Essential Expenses/i) as HTMLInputElement;
    expect(dailyEssentialInput.value).toBe('200');

    const safetyBufferInput = screen.getByLabelText(/Safety Buffer/i) as HTMLInputElement;
    expect(safetyBufferInput.value).toBe('100');

    // Earliest shortfall alert check (₹400 deficit on Day 3)
    expect(screen.getByText(/₹400 Deficit/i)).toBeInTheDocument();

    // Buffer inclusive gap card (₹500)
    const bufferGapLabel = screen.getByText(/Buffer-Inclusive Gap \(At Shortfall\)/i);
    const bufferCard = bufferGapLabel.closest('.metric-card') as HTMLElement;
    expect(within(bufferCard).getByText('₹500')).toBeInTheDocument();

    // "First Below Safety Buffer" card
    expect(screen.getByText(/First Below Safety Buffer/i)).toBeInTheDocument();

    // "Lowest Cash That Day" table header
    expect(screen.getByRole('columnheader', { name: /Lowest Cash That Day/i })).toBeInTheDocument();

    // Shortened dynamic summary string
    expect(
      screen.getByText(/First essential shortfall: ₹400 on Day 3/i)
    ).toBeInTheDocument();
  });

  it('renders worker preferences and the fictional opportunity catalog with seed groups', () => {
    render(<App />);

    // Preferences panel
    expect(screen.getByText(/Worker Preferences & Constraints/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Approximate Area/i)).toHaveValue('Koramangala');

    // Opportunities catalog
    expect(screen.getByText(/Fictional Sample Opportunities Catalog/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Eligible Candidates \(Pre-Day 3 Shortfall\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Sample Packing Shift \(Fictional\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Sample Express Courier Shift \(Fictional\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Sample Quick Warehouse Shift \(Fictional\)/i)).toBeInTheDocument();
  });

  it('opens single-opportunity simulation preview for Seed Opportunity A and displays accurate comparison', () => {
    render(<App />);

    // Click "Preview impact" on Sample Packing Shift
    const previewButtons = screen.getAllByRole('button', { name: /Preview impact/i });
    expect(previewButtons.length).toBeGreaterThan(0);
    fireEvent.click(previewButtons[0]);

    // Preview header & disclaimer
    expect(
      screen.getByText(/With Sample Opportunity: Sample Packing Shift \(Fictional\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Hypothetical preview — no work booked and no actual cash changed/i)
    ).toBeInTheDocument();

    // Original shortfall resolved: Day 3 covered
    expect(screen.getByText(/Covered \(₹0 Deficit\)/i)).toBeInTheDocument();

    // First below buffer in simulation is Day 4
    expect(screen.getByText(/First Below Buffer \(Simulated\)/i)).toBeInTheDocument();

    // Remaining shortfall on Day 5 (₹150 Deficit)
    expect(screen.getByText(/Remaining Shortfall \(Simulated\)/i)).toBeInTheDocument();
    expect(screen.getByText(/₹150 Deficit/i)).toBeInTheDocument();

    // 14-Day comparison table is rendered
    expect(
      screen.getByText(/14-Day Baseline vs. Simulation Comparison/i)
    ).toBeInTheDocument();
  });

  it('closes preview and returns to baseline when Close Preview is clicked', () => {
    render(<App />);

    const previewButton = screen.getAllByRole('button', { name: /Preview impact/i })[0];
    fireEvent.click(previewButton);

    expect(
      screen.getByText(/With Sample Opportunity: Sample Packing Shift/i)
    ).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: /✕ Close Preview/i });
    fireEvent.click(closeButton);

    // Preview section is removed
    expect(
      screen.queryByText(/With Sample Opportunity: Sample Packing Shift/i)
    ).not.toBeInTheDocument();

    // Baseline alert is still present
    expect(screen.getByText(/₹400 Deficit/i)).toBeInTheDocument();
  });

  it('replaces the active preview when another opportunity is selected without accumulating gigs', () => {
    render(<App />);

    const previewButtons = screen.getAllByRole('button', { name: /Preview impact/i });
    // Click Opp A (Packing Shift)
    fireEvent.click(previewButtons[0]);
    expect(
      screen.getByText(/With Sample Opportunity: Sample Packing Shift/i)
    ).toBeInTheDocument();

    // Click Opp B (Express Courier Shift)
    fireEvent.click(previewButtons[1]);
    expect(
      screen.getByText(/With Sample Opportunity: Sample Express Courier Shift/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/With Sample Opportunity: Sample Packing Shift/i)
    ).not.toBeInTheDocument();
  });

  it('automatically clears active preview when baseline financial inputs are edited', () => {
    render(<App />);

    const previewButton = screen.getAllByRole('button', { name: /Preview impact/i })[0];
    fireEvent.click(previewButton);
    expect(
      screen.getByText(/With Sample Opportunity: Sample Packing Shift/i)
    ).toBeInTheDocument();

    // Edit current cash
    const currentCashInput = screen.getByLabelText(/Current Cash in Hand/i);
    fireEvent.change(currentCashInput, { target: { value: '800' } });

    // Preview is auto-closed and notice displayed
    expect(
      screen.queryByText(/With Sample Opportunity: Sample Packing Shift/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Simulation preview closed because baseline financial inputs or preferences were modified/i)
    ).toBeInTheDocument();
  });

  it('disables preview button for uncertain/ineligible opportunities and shows reasons', () => {
    render(<App />);

    // Opp C (Quick Warehouse Shift) has pending onboarding
    expect(screen.getByText(/Preview Unavailable/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Onboarding with Sample QuickWarehouse Platform is pending or unconfirmed/i)
    ).toBeInTheDocument();
  });

  it('automatically clears active preview when worker preferences are edited', () => {
    render(<App />);

    const previewButton = screen.getAllByRole('button', { name: /Preview impact/i })[0];
    fireEvent.click(previewButton);
    expect(
      screen.getByText(/With Sample Opportunity: Sample Packing Shift/i)
    ).toBeInTheDocument();

    // Edit worker area in preferences
    const areaInput = screen.getByLabelText(/Approximate Area/i);
    fireEvent.change(areaInput, { target: { value: 'Indiranagar' } });

    // Preview is auto-closed and notice displayed
    expect(
      screen.queryByText(/With Sample Opportunity: Sample Packing Shift/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Simulation preview closed because baseline financial inputs or preferences were modified/i)
    ).toBeInTheDocument();
  });

  it('previews Opportunity B correctly showing that the Day 8 payout leaves Day 3 shortfall unresolved', () => {
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

  it('resets inputs and preferences back to seed and clears preview when Reset to Demo is clicked', () => {
    render(<App />);

    const previewButton = screen.getAllByRole('button', { name: /Preview impact/i })[0];
    fireEvent.click(previewButton);

    const currentCashInput = screen.getByLabelText(/Current Cash in Hand/i) as HTMLInputElement;
    fireEvent.change(currentCashInput, { target: { value: '999' } });
    expect(currentCashInput.value).toBe('999');

    const resetButton = screen.getAllByRole('button', { name: /Reset to Demo/i })[0];
    fireEvent.click(resetButton);

    expect(currentCashInput.value).toBe('700');
    expect(
      screen.queryByText(/With Sample Opportunity: Sample Packing Shift/i)
    ).not.toBeInTheDocument();
  });
});
