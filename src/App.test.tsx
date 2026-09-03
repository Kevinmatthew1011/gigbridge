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

  it('resets inputs and preferences back to seed when Reset to Demo is clicked', () => {
    render(<App />);

    const currentCashInput = screen.getByLabelText(/Current Cash in Hand/i) as HTMLInputElement;
    fireEvent.change(currentCashInput, { target: { value: '999' } });
    expect(currentCashInput.value).toBe('999');

    const areaInput = screen.getByLabelText(/Approximate Area/i) as HTMLInputElement;
    fireEvent.change(areaInput, { target: { value: 'Whitefield' } });
    expect(areaInput.value).toBe('Whitefield');

    const resetButtons = screen.getAllByRole('button', { name: /Reset to Demo/i });
    fireEvent.click(resetButtons[0]);

    expect(currentCashInput.value).toBe('700');
    expect(areaInput.value).toBe('Koramangala');
  });

  it('displays input validation errors on invalid amount entry', () => {
    render(<App />);

    const currentCashInput = screen.getByLabelText(/Current Cash in Hand/i) as HTMLInputElement;
    fireEvent.change(currentCashInput, { target: { value: '-200' } });

    expect(screen.getByText(/Current Cash cannot be negative/i)).toBeInTheDocument();
  });
});
