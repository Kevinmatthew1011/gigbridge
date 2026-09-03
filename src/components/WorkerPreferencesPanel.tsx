import React from 'react';
import { WorkerPreferences, TransportType } from '../types/opportunity';

interface WorkerPreferencesPanelProps {
  preferences: WorkerPreferences;
  onUpdatePreferences: (preferences: WorkerPreferences) => void;
}

const ALL_TRANSPORTS: { id: TransportType; label: string }[] = [
  { id: 'two_wheeler', label: 'Two-Wheeler (Bike/Scooter)' },
  { id: 'bicycle', label: 'Bicycle' },
  { id: 'walking', label: 'Walking' },
  { id: 'four_wheeler', label: 'Four-Wheeler' },
];

const ALL_SKILLS: string[] = ['packing', 'delivery', 'warehouse', 'heavy_lifting'];

const ALL_PLATFORMS: string[] = [
  'Sample Packing Platform',
  'Sample Courier Platform',
  'Sample QuickWarehouse Platform',
];

export const WorkerPreferencesPanel: React.FC<WorkerPreferencesPanelProps> = ({
  preferences,
  onUpdatePreferences,
}) => {
  const handleTransportToggle = (transport: TransportType) => {
    const nextTransport = preferences.availableTransport.includes(transport)
      ? preferences.availableTransport.filter((t) => t !== transport)
      : [...preferences.availableTransport, transport];
    onUpdatePreferences({ ...preferences, availableTransport: nextTransport });
  };

  const handleSkillToggle = (skill: string) => {
    const nextSkills = preferences.skills.includes(skill)
      ? preferences.skills.filter((s) => s !== skill)
      : [...preferences.skills, skill];
    onUpdatePreferences({ ...preferences, skills: nextSkills });
  };

  const handlePlatformToggle = (platform: string) => {
    const nextPlatforms = preferences.confirmedOnboarding.includes(platform)
      ? preferences.confirmedOnboarding.filter((p) => p !== platform)
      : [...preferences.confirmedOnboarding, platform];
    onUpdatePreferences({ ...preferences, confirmedOnboarding: nextPlatforms });
  };

  const handleAreaChange = (area: string) => {
    onUpdatePreferences({ ...preferences, approximateArea: area });
  };

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <div className="card-header">
        <div>
          <h2 className="card-title">Worker Preferences & Constraints</h2>
          <div className="form-hint">
            Configures availability, transport, skills, and confirmed platform onboarding.
          </div>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="pref-area" className="form-label">
          Approximate Area / Hub
        </label>
        <input
          id="pref-area"
          type="text"
          className="form-input"
          value={preferences.approximateArea}
          onChange={(e) => handleAreaChange(e.target.value)}
          placeholder="e.g. Koramangala, Indiranagar"
        />
      </div>

      <div className="form-group">
        <label className="form-label">Available Transport</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {ALL_TRANSPORTS.map((t) => (
            <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={preferences.availableTransport.includes(t.id)}
                onChange={() => handleTransportToggle(t.id)}
              />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Skills</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {ALL_SKILLS.map((skill) => {
            const isSelected = preferences.skills.includes(skill);
            return (
              <button
                key={skill}
                type="button"
                className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleSkillToggle(skill)}
                style={{ textTransform: 'capitalize' }}
              >
                {isSelected ? `✓ ${skill}` : `+ ${skill}`}
              </button>
            );
          })}
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Confirmed Platform Onboarding</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {ALL_PLATFORMS.map((plat) => (
            <label key={plat} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={preferences.confirmedOnboarding.includes(plat)}
                onChange={() => handlePlatformToggle(plat)}
              />
              {plat}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};
