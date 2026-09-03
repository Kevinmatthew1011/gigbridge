import React from 'react';

export interface ExplanationBoxProps {
  scenarioLabel: string;
  status: 'idle' | 'loading' | 'success' | 'fallback';
  source: 'ai' | 'mock' | 'fallback' | null;
  diagnosticCode?: string;
  renderedText: string | null;
  onRequestExplanation: () => void;
  isDisabled?: boolean;
  disabledReason?: string;
}

export const ExplanationBox: React.FC<ExplanationBoxProps> = ({
  scenarioLabel,
  status,
  source,
  diagnosticCode,
  renderedText,
  onRequestExplanation,
  isDisabled = false,
  disabledReason,
}) => {
  return (
    <div
      className="explanation-container"
      style={{
        marginTop: '0.85rem',
        padding: '0.85rem',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-border)',
        backgroundColor: '#f8fafc',
      }}
    >
      {status === 'idle' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Want a structured breakdown of this {scenarioLabel}?
          </div>
          <button
            type="button"
            onClick={onRequestExplanation}
            disabled={isDisabled}
            className="btn btn-secondary btn-sm"
            title={disabledReason || 'Generate structured explanation'}
            style={{ fontWeight: 600 }}
          >
            Explain these results
          </button>
        </div>
      )}

      {status === 'loading' && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.875rem',
            color: 'var(--color-text-muted)',
          }}
        >
          <span className="spinner" aria-hidden="true" style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid #cbd5e1', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span>Generating explanation from verified facts (waiting for model response)...</span>
        </div>
      )}

      {(status === 'success' || status === 'fallback') && renderedText && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.5rem',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {source === 'ai' ? (
                <>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: '#ecfdf5',
                      color: '#065f46',
                      border: '1px solid #a7f3d0',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                    }}
                  >
                    AI-assisted explanation
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Gemini organizes verified facts; calculations remain rule-based.
                  </span>
                </>
              ) : source === 'mock' ? (
                <span
                  className="badge"
                  style={{
                    backgroundColor: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                  }}
                >
                  Demo explanation — no AI model connected
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                    }}
                  >
                    Standard summary
                  </span>
                  {diagnosticCode && import.meta.env.DEV && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        color: 'var(--color-text-muted)',
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '3px',
                      }}
                      title={`Safe diagnostic code: ${diagnosticCode}`}
                    >
                      ({diagnosticCode})
                    </span>
                  )}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onRequestExplanation}
              disabled={isDisabled}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              title="Refresh explanation"
            >
              ↻ Refresh
            </button>
          </div>
          <div
            style={{
              fontSize: '0.9rem',
              lineHeight: 1.5,
              color: 'var(--color-text)',
            }}
          >
            {renderedText}
          </div>
        </div>
      )}
    </div>
  );
};
