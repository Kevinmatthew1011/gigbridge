import React, { useState } from 'react';
import { WorkerPreferences, TransportType, DayAvailability } from '../types/opportunity';
import { formatDateDisplay } from '../utils/dates';

interface WorkerPreferencesPanelProps {
  preferences: WorkerPreferences;
  onUpdatePreferences: (preferences: WorkerPreferences) => void;
}

export const WorkerPreferencesPanel: React.FC<WorkerPreferencesPanelProps> = ({
  preferences,
  onUpdatePreferences,
}) => {
  const [newAvailDate, setNewAvailDate] = useState('');
  const [newAvailStart, setNewAvailStart] = useState('08:00');
  const [newAvailEnd, setNewAvailEnd] = useState('18:00');

  const handleAreaChange = (val: string) => {
    onUpdatePreferences({
      ...preferences,
      approximateArea: val,
    });
  };

  const toggleTransport = (mode: TransportType) => {
    const current = preferences.availableTransport;
    const next = current.includes(mode)
      ? current.filter((m) => m !== mode)
      : [...current, mode];
    onUpdatePreferences({
      ...preferences,
      availableTransport: next,
    });
  };

  const toggleSkill = (skill: string) => {
    const current = preferences.skills;
    const next = current.includes(skill)
      ? current.filter((s) => s !== skill)
      : [...current, skill];
    onUpdatePreferences({
      ...preferences,
      skills: next,
    });
  };

  const toggleOnboarding = (platform: string) => {
    const current = preferences.confirmedOnboarding;
    const next = current.includes(platform)
      ? current.filter((p) => p !== platform)
      : [...current, platform];
    onUpdatePreferences({
      ...preferences,
      confirmedOnboarding: next,
    });
  };

  const handleAddAvailabilitySlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAvailDate || !newAvailStart || !newAvailEnd) return;

    // Check if date already exists
    const existingIndex = preferences.availability.findIndex((a) => a.date === newAvailDate);
    let updatedAvailability: DayAvailability[];

    if (existingIndex >= 0) {
      updatedAvailability = preferences.availability.map((dayAvail, idx) => {
        if (idx !== existingIndex) return dayAvail;
        return {
          ...dayAvail,
          slots: [...dayAvail.slots, { startTime: newAvailStart, endTime: newAvailEnd }],
        };
      });
    } else {
      updatedAvailability = [
        ...preferences.availability,
        {
          date: newAvailDate,
          slots: [{ startTime: newAvailStart, endTime: newAvailEnd }],
        },
      ];
    }

    onUpdatePreferences({
      ...preferences,
      availability: updatedAvailability,
    });
  };

  const handleEditSlot = (
    date: string,
    slotIndex: number,
    field: 'startTime' | 'endTime',
    value: string
  ) => {
    const updatedAvailability = preferences.availability.map((dayAvail) => {
      if (dayAvail.date !== date) return dayAvail;
      const updatedSlots = dayAvail.slots.map((slot, idx) => {
        if (idx !== slotIndex) return slot;
        return {
          ...slot,
          [field]: value,
        };
      });
      return { ...dayAvail, slots: updatedSlots };
    });

    onUpdatePreferences({
      ...preferences,
      availability: updatedAvailability,
    });
  };

  const handleRemoveSlot = (date: string, slotIndex: number) => {
    const updatedAvailability = preferences.availability
      .map((dayAvail) => {
        if (dayAvail.date !== date) return dayAvail;
        const newSlots = dayAvail.slots.filter((_, idx) => idx !== slotIndex);
        return { ...dayAvail, slots: newSlots };
      })
      .filter((dayAvail) => dayAvail.slots.length > 0);

    onUpdatePreferences({
      ...preferences,
      availability: updatedAvailability,
    });
  };

  return (
    <div className="card">
      <h3 className="card-title" style={{ marginBottom: '0.85rem' }}>
        Your availability and work preferences
      </h3>

      {/* 1. Schedule Availability Editor */}
      <div className="form-group">
        <label className="form-label">Available Work Dates & Hours</label>
        <div className="form-hint" style={{ marginBottom: '0.5rem' }}>
          Dates and hours you are available to take shifts (including travel time). Edit directly below.
        </div>

        {preferences.availability.length === 0 ? (
          <div className="form-hint" style={{ marginBottom: '0.75rem', color: '#b45309' }}>
            No available work dates configured. You will not match sample opportunities.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '0.75rem', maxHeight: '280px', overflowY: 'auto' }}>
            {preferences.availability.map((dayAvail) => (
              <div key={dayAvail.date} style={{ background: 'var(--color-surface-subtle)', padding: '0.5rem 0.65rem', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                  {formatDateDisplay(dayAvail.date)}
                </div>
                {dayAvail.slots.map((slot, sIdx) => (
                  <div
                    key={sIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      marginBottom: sIdx < dayAvail.slots.length - 1 ? '0.3rem' : 0,
                    }}
                  >
                    <input
                      type="time"
                      className="form-input"
                      style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem', flex: 1 }}
                      value={slot.startTime}
                      onChange={(e) => handleEditSlot(dayAvail.date, sIdx, 'startTime', e.target.value)}
                      aria-label={`Start time for ${dayAvail.date} slot ${sIdx + 1}`}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>to</span>
                    <input
                      type="time"
                      className="form-input"
                      style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem', flex: 1 }}
                      value={slot.endTime}
                      onChange={(e) => handleEditSlot(dayAvail.date, sIdx, 'endTime', e.target.value)}
                      aria-label={`End time for ${dayAvail.date} slot ${sIdx + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(dayAvail.date, sIdx)}
                      className="btn btn-sm btn-danger-outline"
                      style={{ padding: '0.15rem 0.45rem', fontSize: '0.75rem' }}
                      title="Remove availability slot"
                      aria-label={`Remove availability slot ${dayAvail.date} ${sIdx + 1}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Add Availability Form */}
        <form
          onSubmit={handleAddAvailabilitySlot}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
            background: 'var(--color-bg)',
            padding: '0.65rem',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>+ Add Availability Slot</div>
          <input
            type="date"
            className="form-input"
            style={{ fontSize: '0.825rem' }}
            value={newAvailDate}
            onChange={(e) => setNewAvailDate(e.target.value)}
            aria-label="Availability date"
          />
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input
              type="time"
              className="form-input"
              style={{ fontSize: '0.825rem', flex: 1 }}
              value={newAvailStart}
              onChange={(e) => setNewAvailStart(e.target.value)}
              aria-label="Start time"
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>to</span>
            <input
              type="time"
              className="form-input"
              style={{ fontSize: '0.825rem', flex: 1 }}
              value={newAvailEnd}
              onChange={(e) => setNewAvailEnd(e.target.value)}
              aria-label="End time"
            />
          </div>
          <button
            type="submit"
            className="btn btn-secondary btn-sm"
            style={{ alignSelf: 'flex-start', marginTop: '0.2rem' }}
          >
            + Add Available Slot
          </button>
        </form>
      </div>

      {/* 2. Approximate Area */}
      <div className="form-group">
        <label htmlFor="input-area" className="form-label">
          Approximate Area / Hub
        </label>
        <input
          id="input-area"
          type="text"
          className="form-input"
          value={preferences.approximateArea}
          onChange={(e) => handleAreaChange(e.target.value)}
          placeholder="e.g. Koramangala"
        />
        <div className="form-hint">Used to evaluate estimated travel to sample opportunities.</div>
      </div>

      {/* 3. Available Transport */}
      <div className="form-group">
        <label className="form-label">Available Transport</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={preferences.availableTransport.includes('two_wheeler')}
              onChange={() => toggleTransport('two_wheeler')}
            />
            <span>Two-Wheeler (Motorbike / Scooter)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={preferences.availableTransport.includes('bicycle')}
              onChange={() => toggleTransport('bicycle')}
            />
            <span>Bicycle</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={preferences.availableTransport.includes('walking')}
              onChange={() => toggleTransport('walking')}
            />
            <span>Walking / Foot</span>
          </label>
        </div>
      </div>

      {/* 4. Skills & Capabilities */}
      <div className="form-group">
        <label className="form-label">Skills & Capabilities</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={preferences.skills.includes('packing')}
              onChange={() => toggleSkill('packing')}
            />
            <span>Packing & Sorting</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={preferences.skills.includes('courier_delivery')}
              onChange={() => toggleSkill('courier_delivery')}
            />
            <span>Courier & Package Delivery</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={preferences.skills.includes('warehouse_loading')}
              onChange={() => toggleSkill('warehouse_loading')}
            />
            <span>Warehouse Loading & Staging</span>
          </label>
        </div>
      </div>

      {/* 5. Confirmed Platform Onboarding */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Confirmed Platform Onboarding</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={preferences.confirmedOnboarding.includes('Sample Packing Platform')}
              onChange={() => toggleOnboarding('Sample Packing Platform')}
            />
            <span>Sample Packing Platform</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={preferences.confirmedOnboarding.includes('Sample Express Delivery Platform')}
              onChange={() => toggleOnboarding('Sample Express Delivery Platform')}
            />
            <span>Sample Express Delivery Platform</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={preferences.confirmedOnboarding.includes('Sample QuickWarehouse Platform')}
              onChange={() => toggleOnboarding('Sample QuickWarehouse Platform')}
            />
            <span>Sample QuickWarehouse Platform</span>
          </label>
        </div>
      </div>
    </div>
  );
};
