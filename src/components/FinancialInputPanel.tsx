import React, { useState } from 'react';
import { FinancialInputs, Bill, Payout } from '../types/finance';
import { parseINRToPaise, paiseToInputString } from '../utils/formatters';

interface FinancialInputPanelProps {
  inputs: FinancialInputs;
  onUpdateInputs: (inputs: FinancialInputs) => void;
}

export const FinancialInputPanel: React.FC<FinancialInputPanelProps> = ({
  inputs,
  onUpdateInputs,
}) => {
  // Local string inputs for fluid user typing
  const [currentCashStr, setCurrentCashStr] = useState<string>(() =>
    paiseToInputString(inputs.currentCashPaise)
  );
  const [dailyExpensesStr, setDailyExpensesStr] = useState<string>(() =>
    paiseToInputString(inputs.dailyEssentialPaise)
  );
  const [safetyBufferStr, setSafetyBufferStr] = useState<string>(() =>
    paiseToInputString(inputs.safetyBufferPaise)
  );
  const [startDateStr, setStartDateStr] = useState<string>(inputs.startDate);

  // Synchronize local string inputs when parent resets or modifies inputs
  React.useEffect(() => {
    setCurrentCashStr(paiseToInputString(inputs.currentCashPaise));
    setDailyExpensesStr(paiseToInputString(inputs.dailyEssentialPaise));
    setSafetyBufferStr(paiseToInputString(inputs.safetyBufferPaise));
    setStartDateStr(inputs.startDate);
  }, [inputs.currentCashPaise, inputs.dailyEssentialPaise, inputs.safetyBufferPaise, inputs.startDate]);

  // Validation errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // New item draft states
  const [newBillTitle, setNewBillTitle] = useState('');
  const [newBillAmount, setNewBillAmount] = useState('');
  const [newBillDate, setNewBillDate] = useState(inputs.startDate);

  const [newPayoutTitle, setNewPayoutTitle] = useState('');
  const [newPayoutAmount, setNewPayoutAmount] = useState('');
  const [newPayoutDate, setNewPayoutDate] = useState(inputs.startDate);

  const validateAndPropagate = (
    cCash: string,
    dExp: string,
    sBuf: string,
    sDate: string,
    bills: Bill[],
    payouts: Payout[]
  ) => {
    const newErrors: { [key: string]: string } = {};

    const cashParsed = parseINRToPaise(cCash, { fieldName: 'Current Cash' });
    if (!cashParsed.isValid || cashParsed.paise < 0) {
      newErrors.currentCash = cashParsed.error || 'Enter a valid non-negative amount';
    }

    const expParsed = parseINRToPaise(dExp, { fieldName: 'Daily Essentials' });
    if (!expParsed.isValid || expParsed.paise < 0) {
      newErrors.dailyExpenses = expParsed.error || 'Enter a valid daily essential expense';
    }

    const bufParsed = parseINRToPaise(sBuf, { fieldName: 'Safety Buffer' });
    if (!bufParsed.isValid || bufParsed.paise < 0) {
      newErrors.safetyBuffer = bufParsed.error || 'Enter a valid safety buffer';
    }

    if (!sDate) {
      newErrors.startDate = 'Start date is required';
    }

    setErrors(newErrors);

    if (
      Object.keys(newErrors).length === 0 &&
      cashParsed.isValid &&
      expParsed.isValid &&
      bufParsed.isValid
    ) {
      onUpdateInputs({
        currentCashPaise: cashParsed.paise,
        dailyEssentialPaise: expParsed.paise,
        safetyBufferPaise: bufParsed.paise,
        startDate: sDate,
        bills,
        payouts,
      });
    }
  };

  const handleCashChange = (val: string) => {
    setCurrentCashStr(val);
    validateAndPropagate(val, dailyExpensesStr, safetyBufferStr, startDateStr, inputs.bills, inputs.payouts);
  };

  const handleExpensesChange = (val: string) => {
    setDailyExpensesStr(val);
    validateAndPropagate(currentCashStr, val, safetyBufferStr, startDateStr, inputs.bills, inputs.payouts);
  };

  const handleBufferChange = (val: string) => {
    setSafetyBufferStr(val);
    validateAndPropagate(currentCashStr, dailyExpensesStr, val, startDateStr, inputs.bills, inputs.payouts);
  };

  const handleStartDateChange = (val: string) => {
    setStartDateStr(val);
    validateAndPropagate(currentCashStr, dailyExpensesStr, safetyBufferStr, val, inputs.bills, inputs.payouts);
  };

  // Add & Edit Bills
  const handleAddBill = (e: React.FormEvent) => {
    e.preventDefault();
    const billParsed = parseINRToPaise(newBillAmount, { fieldName: 'Bill Amount' });
    if (!billParsed.isValid || billParsed.paise <= 0 || !newBillTitle.trim() || !newBillDate) {
      return;
    }
    const updatedBills: Bill[] = [
      ...inputs.bills,
      {
        id: `bill-${Date.now()}`,
        title: newBillTitle.trim(),
        amountPaise: billParsed.paise,
        dueDate: newBillDate,
      },
    ];
    setNewBillTitle('');
    setNewBillAmount('');
    validateAndPropagate(currentCashStr, dailyExpensesStr, safetyBufferStr, startDateStr, updatedBills, inputs.payouts);
  };

  const handleEditBill = (id: string, field: 'title' | 'amount' | 'date', value: string) => {
    const updatedBills = inputs.bills.map((bill) => {
      if (bill.id !== id) return bill;
      if (field === 'title') {
        return { ...bill, title: value };
      }
      if (field === 'date') {
        return { ...bill, dueDate: value };
      }
      if (field === 'amount') {
        const parsed = parseINRToPaise(value, { fieldName: 'Bill Amount' });
        return { ...bill, amountPaise: parsed.isValid ? parsed.paise : bill.amountPaise };
      }
      return bill;
    });
    validateAndPropagate(currentCashStr, dailyExpensesStr, safetyBufferStr, startDateStr, updatedBills, inputs.payouts);
  };

  const handleRemoveBill = (id: string) => {
    const updatedBills = inputs.bills.filter((b) => b.id !== id);
    validateAndPropagate(currentCashStr, dailyExpensesStr, safetyBufferStr, startDateStr, updatedBills, inputs.payouts);
  };

  // Add & Edit Payouts
  const handleAddPayout = (e: React.FormEvent) => {
    e.preventDefault();
    const payoutParsed = parseINRToPaise(newPayoutAmount, { fieldName: 'Payout Amount' });
    if (!payoutParsed.isValid || payoutParsed.paise <= 0 || !newPayoutTitle.trim() || !newPayoutDate) {
      return;
    }
    const updatedPayouts: Payout[] = [
      ...inputs.payouts,
      {
        id: `payout-${Date.now()}`,
        title: newPayoutTitle.trim(),
        amountPaise: payoutParsed.paise,
        expectedDate: newPayoutDate,
      },
    ];
    setNewPayoutTitle('');
    setNewPayoutAmount('');
    validateAndPropagate(currentCashStr, dailyExpensesStr, safetyBufferStr, startDateStr, inputs.bills, updatedPayouts);
  };

  const handleEditPayout = (id: string, field: 'title' | 'amount' | 'date', value: string) => {
    const updatedPayouts = inputs.payouts.map((payout) => {
      if (payout.id !== id) return payout;
      if (field === 'title') {
        return { ...payout, title: value };
      }
      if (field === 'date') {
        return { ...payout, expectedDate: value };
      }
      if (field === 'amount') {
        const parsed = parseINRToPaise(value, { fieldName: 'Payout Amount' });
        return { ...payout, amountPaise: parsed.isValid ? parsed.paise : payout.amountPaise };
      }
      return payout;
    });
    validateAndPropagate(currentCashStr, dailyExpensesStr, safetyBufferStr, startDateStr, inputs.bills, updatedPayouts);
  };

  const handleRemovePayout = (id: string) => {
    const updatedPayouts = inputs.payouts.filter((p) => p.id !== id);
    validateAndPropagate(currentCashStr, dailyExpensesStr, safetyBufferStr, startDateStr, inputs.bills, updatedPayouts);
  };

  return (
    <div>
      {/* Group 1: Money available now */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '0.85rem' }}>
          Money available now
        </h3>

        <div className="form-group">
          <label htmlFor="input-current-cash" className="form-label">
            Current Cash in Hand (₹)
          </label>
          <input
            id="input-current-cash"
            type="text"
            className={`form-input ${errors.currentCash ? 'form-input-error' : ''}`}
            value={currentCashStr}
            onChange={(e) => handleCashChange(e.target.value)}
            placeholder="e.g. 700"
          />
          <div className="form-hint">Physical cash & immediately available account funds. Exclude pending payouts.</div>
          {errors.currentCash && <div className="form-error-msg">{errors.currentCash}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="input-start-date" className="form-label">
            Forecast Start Date (Day 1)
          </label>
          <input
            id="input-start-date"
            type="date"
            className={`form-input ${errors.startDate ? 'form-input-error' : ''}`}
            value={startDateStr}
            onChange={(e) => handleStartDateChange(e.target.value)}
          />
          <div className="form-hint">Day 1 of the 14-day cash runway.</div>
          {errors.startDate && <div className="form-error-msg">{errors.startDate}</div>}
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="input-safety-buffer" className="form-label">
            Safety Buffer Target (₹)
          </label>
          <input
            id="input-safety-buffer"
            type="text"
            className={`form-input ${errors.safetyBuffer ? 'form-input-error' : ''}`}
            value={safetyBufferStr}
            onChange={(e) => handleBufferChange(e.target.value)}
            placeholder="e.g. 100"
          />
          <div className="form-hint">Target cushion for emergency needs (evaluated separately from essential shortfalls).</div>
          {errors.safetyBuffer && <div className="form-error-msg">{errors.safetyBuffer}</div>}
        </div>
      </div>

      {/* Group 2: Daily essentials and bills */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '0.85rem' }}>
          Daily essentials and bills
        </h3>

        <div className="form-group">
          <label htmlFor="input-daily-expenses" className="form-label">
            Daily Essential Expenses (₹/day)
          </label>
          <input
            id="input-daily-expenses"
            type="text"
            className={`form-input ${errors.dailyExpenses ? 'form-input-error' : ''}`}
            value={dailyExpensesStr}
            onChange={(e) => handleExpensesChange(e.target.value)}
            placeholder="e.g. 200"
          />
          <div className="form-hint">Everyday survival basics (food, essential fuel, daily living).</div>
          {errors.dailyExpenses && <div className="form-error-msg">{errors.dailyExpenses}</div>}
        </div>

        <div>
          <label className="form-label" style={{ marginBottom: '0.5rem' }}>
            Dated Bills & Obligations
          </label>
          {inputs.bills.length === 0 ? (
            <div className="form-hint" style={{ marginBottom: '0.75rem' }}>
              No dated bills added yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {inputs.bills.map((bill) => (
                <div
                  key={bill.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    background: 'var(--color-surface-subtle)',
                    padding: '0.5rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.825rem', flex: 2 }}
                      value={bill.title}
                      onChange={(e) => handleEditBill(bill.id, 'title', e.target.value)}
                      aria-label={`Bill title for ${bill.title}`}
                      placeholder="Bill title"
                    />
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.825rem', flex: 1 }}
                      value={paiseToInputString(bill.amountPaise)}
                      onChange={(e) => handleEditBill(bill.id, 'amount', e.target.value)}
                      aria-label={`Bill amount for ${bill.title}`}
                      placeholder="₹"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveBill(bill.id)}
                      className="btn btn-sm btn-danger-outline"
                      aria-label={`Remove bill ${bill.title}`}
                      title="Remove bill"
                      style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                    >
                      ✕
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>Due:</span>
                    <input
                      type="date"
                      className="form-input"
                      style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
                      value={bill.dueDate}
                      onChange={(e) => handleEditBill(bill.id, 'date', e.target.value)}
                      aria-label={`Bill due date for ${bill.title}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Bill Form */}
          <form onSubmit={handleAddBill} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--color-bg)', padding: '0.65rem', borderRadius: 'var(--radius-sm)' }}>
            <input
              type="text"
              className="form-input"
              style={{ fontSize: '0.85rem' }}
              placeholder="Bill name (e.g. Room rent)"
              value={newBillTitle}
              onChange={(e) => setNewBillTitle(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="form-input"
                style={{ fontSize: '0.85rem', flex: 1 }}
                placeholder="Amount (₹)"
                value={newBillAmount}
                onChange={(e) => setNewBillAmount(e.target.value)}
              />
              <input
                type="date"
                className="form-input"
                style={{ fontSize: '0.85rem', flex: 1.2 }}
                value={newBillDate}
                onChange={(e) => setNewBillDate(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
              + Add Bill
            </button>
          </form>
        </div>
      </div>

      {/* Group 3: Money already earned, arriving later */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '0.85rem' }}>
          Money already earned, arriving later
        </h3>

        {inputs.payouts.length === 0 ? (
          <div className="form-hint" style={{ marginBottom: '0.75rem' }}>
            No pending payouts added.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {inputs.payouts.map((payout) => (
              <div
                key={payout.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  background: 'var(--color-surface-subtle)',
                  padding: '0.5rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: '0.825rem', flex: 2 }}
                    value={payout.title}
                    onChange={(e) => handleEditPayout(payout.id, 'title', e.target.value)}
                    aria-label={`Payout title for ${payout.title}`}
                    placeholder="Payout source"
                  />
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: '0.825rem', flex: 1 }}
                    value={paiseToInputString(payout.amountPaise)}
                    onChange={(e) => handleEditPayout(payout.id, 'amount', e.target.value)}
                    aria-label={`Payout amount for ${payout.title}`}
                    placeholder="₹"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePayout(payout.id)}
                    className="btn btn-sm btn-danger-outline"
                    aria-label={`Remove payout ${payout.title}`}
                    title="Remove payout"
                    style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>Expected:</span>
                  <input
                    type="date"
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
                    value={payout.expectedDate}
                    onChange={(e) => handleEditPayout(payout.id, 'date', e.target.value)}
                    aria-label={`Payout expected date for ${payout.title}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Payout Form */}
        <form onSubmit={handleAddPayout} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--color-bg)', padding: '0.65rem', borderRadius: 'var(--radius-sm)' }}>
          <input
            type="text"
            className="form-input"
            style={{ fontSize: '0.85rem' }}
            placeholder="Payout source (e.g. Delivery platform pay)"
            value={newPayoutTitle}
            onChange={(e) => setNewPayoutTitle(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="form-input"
              style={{ fontSize: '0.85rem', flex: 1 }}
              placeholder="Amount (₹)"
              value={newPayoutAmount}
              onChange={(e) => setNewPayoutAmount(e.target.value)}
            />
            <input
              type="date"
              className="form-input"
              style={{ fontSize: '0.85rem', flex: 1.2 }}
              value={newPayoutDate}
              onChange={(e) => setNewPayoutDate(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
            + Add Payout
          </button>
        </form>
      </div>
    </div>
  );
};
