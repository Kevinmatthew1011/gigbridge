import React, { useState } from 'react';
import { FinancialInputs, Bill, Payout } from '../types/finance';
import { parseINRToPaise, paiseToInputString } from '../utils/formatters';
import { isValidDateString, addDays } from '../utils/dates';

interface FinancialInputPanelProps {
  inputs: FinancialInputs;
  onUpdateInputs: (inputs: FinancialInputs) => void;
  onResetToSeed: () => void;
}

interface FormState {
  currentCash: string;
  dailyEssential: string;
  safetyBuffer: string;
  startDate: string;
  bills: Array<{ id: string; title: string; amount: string; dueDate: string }>;
  payouts: Array<{ id: string; title: string; amount: string; expectedDate: string }>;
}

export const FinancialInputPanel: React.FC<FinancialInputPanelProps> = ({
  inputs,
  onUpdateInputs,
  onResetToSeed,
}) => {
  // Local string form state for smooth typing and decimal input
  const [formState, setFormState] = useState<FormState>(() => ({
    currentCash: paiseToInputString(inputs.currentCashPaise),
    dailyEssential: paiseToInputString(inputs.dailyEssentialPaise),
    safetyBuffer: paiseToInputString(inputs.safetyBufferPaise),
    startDate: inputs.startDate,
    bills: inputs.bills.map((b) => ({
      id: b.id,
      title: b.title,
      amount: paiseToInputString(b.amountPaise),
      dueDate: b.dueDate,
    })),
    payouts: inputs.payouts.map((p) => ({
      id: p.id,
      title: p.title,
      amount: paiseToInputString(p.amountPaise),
      expectedDate: p.expectedDate,
    })),
  }));

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Synchronize when parent reset or external inputs update
  React.useEffect(() => {
    setFormState({
      currentCash: paiseToInputString(inputs.currentCashPaise),
      dailyEssential: paiseToInputString(inputs.dailyEssentialPaise),
      safetyBuffer: paiseToInputString(inputs.safetyBufferPaise),
      startDate: inputs.startDate,
      bills: inputs.bills.map((b) => ({
        id: b.id,
        title: b.title,
        amount: paiseToInputString(b.amountPaise),
        dueDate: b.dueDate,
      })),
      payouts: inputs.payouts.map((p) => ({
        id: p.id,
        title: p.title,
        amount: paiseToInputString(p.amountPaise),
        expectedDate: p.expectedDate,
      })),
    });
    setErrors({});
  }, [inputs]);

  const validateAndPropagate = (nextState: FormState) => {
    const newErrors: Record<string, string> = {};

    // 1. Current cash validation
    const cashParsed = parseINRToPaise(nextState.currentCash, { fieldName: 'Current Cash' });
    if (!cashParsed.isValid) {
      newErrors.currentCash = cashParsed.error || 'Invalid amount';
    }

    // 2. Daily essentials validation
    const dailyParsed = parseINRToPaise(nextState.dailyEssential, { fieldName: 'Daily Essentials' });
    if (!dailyParsed.isValid) {
      newErrors.dailyEssential = dailyParsed.error || 'Invalid amount';
    }

    // 3. Safety buffer validation
    const bufferParsed = parseINRToPaise(nextState.safetyBuffer, { fieldName: 'Safety Buffer' });
    if (!bufferParsed.isValid) {
      newErrors.safetyBuffer = bufferParsed.error || 'Invalid amount';
    }

    // 4. Start date validation
    if (!isValidDateString(nextState.startDate)) {
      newErrors.startDate = 'Valid start date (YYYY-MM-DD) is required';
    }

    // 5. Bills validation
    const validatedBills: Bill[] = [];
    nextState.bills.forEach((b, idx) => {
      const billParsed = parseINRToPaise(b.amount, { fieldName: `Bill #${idx + 1} Amount` });
      if (!billParsed.isValid) {
        newErrors[`bill_amount_${b.id}`] = billParsed.error || 'Invalid amount';
      }
      if (!isValidDateString(b.dueDate)) {
        newErrors[`bill_date_${b.id}`] = 'Valid due date is required';
      }
      if (billParsed.isValid && isValidDateString(b.dueDate)) {
        validatedBills.push({
          id: b.id,
          title: b.title.trim() || `Bill #${idx + 1}`,
          amountPaise: billParsed.paise,
          dueDate: b.dueDate,
        });
      }
    });

    // 6. Payouts validation
    const validatedPayouts: Payout[] = [];
    nextState.payouts.forEach((p, idx) => {
      const payoutParsed = parseINRToPaise(p.amount, { fieldName: `Payout #${idx + 1} Amount` });
      if (!payoutParsed.isValid) {
        newErrors[`payout_amount_${p.id}`] = payoutParsed.error || 'Invalid amount';
      }
      if (!isValidDateString(p.expectedDate)) {
        newErrors[`payout_date_${p.id}`] = 'Valid expected date is required';
      }
      if (payoutParsed.isValid && isValidDateString(p.expectedDate)) {
        validatedPayouts.push({
          id: p.id,
          title: p.title.trim() || `Payout #${idx + 1}`,
          amountPaise: payoutParsed.paise,
          expectedDate: p.expectedDate,
        });
      }
    });

    setErrors(newErrors);

    // Only propagate valid state up
    if (Object.keys(newErrors).length === 0) {
      onUpdateInputs({
        currentCashPaise: cashParsed.paise,
        dailyEssentialPaise: dailyParsed.paise,
        safetyBufferPaise: bufferParsed.paise,
        startDate: nextState.startDate,
        bills: validatedBills,
        payouts: validatedPayouts,
        forecastDays: 14,
      });
    }
  };

  const handleChange = (field: keyof FormState, value: string) => {
    const nextState = { ...formState, [field]: value };
    setFormState(nextState);
    validateAndPropagate(nextState);
  };

  const handleAddBill = () => {
    const nextState: FormState = {
      ...formState,
      bills: [
        ...formState.bills,
        {
          id: `bill-${Date.now()}`,
          title: 'New Bill',
          amount: '0',
          dueDate: addDays(formState.startDate, 2),
        },
      ],
    };
    setFormState(nextState);
    validateAndPropagate(nextState);
  };

  const handleRemoveBill = (id: string) => {
    const nextState: FormState = {
      ...formState,
      bills: formState.bills.filter((b) => b.id !== id),
    };
    setFormState(nextState);
    validateAndPropagate(nextState);
  };

  const handleBillChange = (id: string, field: 'title' | 'amount' | 'dueDate', value: string) => {
    const nextState: FormState = {
      ...formState,
      bills: formState.bills.map((b) => (b.id === id ? { ...b, [field]: value } : b)),
    };
    setFormState(nextState);
    validateAndPropagate(nextState);
  };

  const handleAddPayout = () => {
    const nextState: FormState = {
      ...formState,
      payouts: [
        ...formState.payouts,
        {
          id: `payout-${Date.now()}`,
          title: 'Expected Payout',
          amount: '0',
          expectedDate: addDays(formState.startDate, 6),
        },
      ],
    };
    setFormState(nextState);
    validateAndPropagate(nextState);
  };

  const handleRemovePayout = (id: string) => {
    const nextState: FormState = {
      ...formState,
      payouts: formState.payouts.filter((p) => p.id !== id),
    };
    setFormState(nextState);
    validateAndPropagate(nextState);
  };

  const handlePayoutChange = (id: string, field: 'title' | 'amount' | 'expectedDate', value: string) => {
    const nextState: FormState = {
      ...formState,
      payouts: formState.payouts.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    };
    setFormState(nextState);
    validateAndPropagate(nextState);
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Financial Inputs</h2>
        <button
          type="button"
          onClick={onResetToSeed}
          className="btn btn-secondary btn-sm"
          title="Reset all inputs back to seed scenario"
        >
          Reset to Demo
        </button>
      </div>

      <div className="form-group">
        <label htmlFor="input-start-date" className="form-label">
          Forecast Start Date (Day 1)
        </label>
        <input
          id="input-start-date"
          type="date"
          className={`form-input ${errors.startDate ? 'form-input-error' : ''}`}
          value={formState.startDate}
          onChange={(e) => handleChange('startDate', e.target.value)}
        />
        {errors.startDate && <div className="form-error-msg">{errors.startDate}</div>}
      </div>

      <div className="form-group">
        <label htmlFor="input-current-cash" className="form-label">
          Current Cash in Hand (₹)
        </label>
        <input
          id="input-current-cash"
          type="text"
          inputMode="decimal"
          className={`form-input ${errors.currentCash ? 'form-input-error' : ''}`}
          value={formState.currentCash}
          onChange={(e) => handleChange('currentCash', e.target.value)}
        />
        <div className="form-hint">Excludes pending or uncollected payouts.</div>
        {errors.currentCash && <div className="form-error-msg">{errors.currentCash}</div>}
      </div>

      <div className="form-group">
        <label htmlFor="input-daily-essential" className="form-label">
          Daily Essential Expenses (₹)
        </label>
        <input
          id="input-daily-essential"
          type="text"
          inputMode="decimal"
          className={`form-input ${errors.dailyEssential ? 'form-input-error' : ''}`}
          value={formState.dailyEssential}
          onChange={(e) => handleChange('dailyEssential', e.target.value)}
        />
        <div className="form-hint">Fuel, daily food, vehicle maintenance per day.</div>
        {errors.dailyEssential && <div className="form-error-msg">{errors.dailyEssential}</div>}
      </div>

      <div className="form-group">
        <label htmlFor="input-safety-buffer" className="form-label">
          Safety Buffer (₹)
        </label>
        <input
          id="input-safety-buffer"
          type="text"
          inputMode="decimal"
          className={`form-input ${errors.safetyBuffer ? 'form-input-error' : ''}`}
          value={formState.safetyBuffer}
          onChange={(e) => handleChange('safetyBuffer', e.target.value)}
        />
        <div className="form-hint">Target cushion to absorb unexpected delays.</div>
        {errors.safetyBuffer && <div className="form-error-msg">{errors.safetyBuffer}</div>}
      </div>

      {/* Dated Bills Section */}
      <div className="item-section">
        <div className="item-section-header">
          <span className="item-section-title">Dated Bills & Obligations</span>
          <button type="button" onClick={handleAddBill} className="btn btn-secondary btn-sm">
            + Add Bill
          </button>
        </div>
        {formState.bills.length === 0 && (
          <p className="form-hint">No dated bills added.</p>
        )}
        {formState.bills.map((bill) => (
          <div key={bill.id} className="item-row">
            <div className="item-row-wide">
              <input
                type="text"
                placeholder="Bill title (e.g. Rent, EMI)"
                className="form-input"
                style={{ width: '70%' }}
                value={bill.title}
                onChange={(e) => handleBillChange(bill.id, 'title', e.target.value)}
              />
              <button
                type="button"
                onClick={() => handleRemoveBill(bill.id)}
                className="btn btn-danger-outline btn-sm"
                title="Remove bill"
              >
                Delete
              </button>
            </div>
            <div>
              <label className="form-label">Amount (₹)</label>
              <input
                type="text"
                inputMode="decimal"
                className={`form-input ${errors[`bill_amount_${bill.id}`] ? 'form-input-error' : ''}`}
                value={bill.amount}
                onChange={(e) => handleBillChange(bill.id, 'amount', e.target.value)}
              />
              {errors[`bill_amount_${bill.id}`] && (
                <div className="form-error-msg">{errors[`bill_amount_${bill.id}`]}</div>
              )}
            </div>
            <div>
              <label className="form-label">Due Date</label>
              <input
                type="date"
                className={`form-input ${errors[`bill_date_${bill.id}`] ? 'form-input-error' : ''}`}
                value={bill.dueDate}
                onChange={(e) => handleBillChange(bill.id, 'dueDate', e.target.value)}
              />
              {errors[`bill_date_${bill.id}`] && (
                <div className="form-error-msg">{errors[`bill_date_${bill.id}`]}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Earned-but-Unpaid Payouts Section */}
      <div className="item-section">
        <div className="item-section-header">
          <div>
            <span className="item-section-title">Earned-but-Unpaid Payouts</span>
            <div className="form-hint">Expected (not guaranteed) platform settlements.</div>
          </div>
          <button type="button" onClick={handleAddPayout} className="btn btn-secondary btn-sm">
            + Add Payout
          </button>
        </div>
        {formState.payouts.length === 0 && (
          <p className="form-hint">No pending payouts scheduled.</p>
        )}
        {formState.payouts.map((payout) => (
          <div key={payout.id} className="item-row">
            <div className="item-row-wide">
              <input
                type="text"
                placeholder="Payout title (e.g. Swiggy settlement)"
                className="form-input"
                style={{ width: '70%' }}
                value={payout.title}
                onChange={(e) => handlePayoutChange(payout.id, 'title', e.target.value)}
              />
              <button
                type="button"
                onClick={() => handleRemovePayout(payout.id)}
                className="btn btn-danger-outline btn-sm"
                title="Remove payout"
              >
                Delete
              </button>
            </div>
            <div>
              <label className="form-label">Amount (₹)</label>
              <input
                type="text"
                inputMode="decimal"
                className={`form-input ${errors[`payout_amount_${payout.id}`] ? 'form-input-error' : ''}`}
                value={payout.amount}
                onChange={(e) => handlePayoutChange(payout.id, 'amount', e.target.value)}
              />
              {errors[`payout_amount_${payout.id}`] && (
                <div className="form-error-msg">{errors[`payout_amount_${payout.id}`]}</div>
              )}
            </div>
            <div>
              <label className="form-label">Expected Date</label>
              <input
                type="date"
                className={`form-input ${errors[`payout_date_${payout.id}`] ? 'form-input-error' : ''}`}
                value={payout.expectedDate}
                onChange={(e) => handlePayoutChange(payout.id, 'expectedDate', e.target.value)}
              />
              {errors[`payout_date_${payout.id}`] && (
                <div className="form-error-msg">{errors[`payout_date_${payout.id}`]}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
