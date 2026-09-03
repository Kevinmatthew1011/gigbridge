import type { FactMap } from '../types/explanation.ts';
import { validateAndRenderExplanation } from './explanationValidator.ts';
import type { ExplanationScenario } from '../../server/types.ts';

export interface ClientExplanationResult {
  status: 'success' | 'fallback';
  source: 'ai' | 'mock' | 'fallback';
  diagnosticCode?: string;
  renderedText: string;
  requestId: string;
  error?: string;
}

/**
 * Client-side API caller that invokes the local explanation gateway,
 * performs client-side semantic re-verification, and renders application-owned templates.
 */
export async function fetchExplanation(options: {
  scenario: ExplanationScenario;
  facts: FactMap;
  fallbackText: string;
  requestId: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<ClientExplanationResult> {
  const { scenario, facts, fallbackText, requestId, signal, timeoutMs = 35000 } = options;

  // Create combined timeout controller to prevent hanging client requests
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

  const combinedSignal = signal
    ? AbortSignal.any
      ? AbortSignal.any([signal, timeoutController.signal])
      : signal
    : timeoutController.signal;

  try {
    const res = await fetch('/api/explain', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requestId,
        scenario,
        facts,
      }),
      signal: combinedSignal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      return {
        status: 'fallback',
        source: 'fallback',
        diagnosticCode: `HTTP_${res.status}`,
        renderedText: fallbackText,
        requestId,
        error: `Gateway returned status ${res.status}`,
      };
    }

    const data = await res.json();

    // Check request ID match to prevent out-of-order state application
    if (data.requestId !== requestId) {
      return {
        status: 'fallback',
        source: 'fallback',
        diagnosticCode: 'STALE_REQUEST_DISCARDED',
        renderedText: fallbackText,
        requestId,
        error: 'Stale response discarded',
      };
    }

    // Handle explicit server fallback response
    if (data.source === 'fallback') {
      return {
        status: 'fallback',
        source: 'fallback',
        diagnosticCode: data.diagnosticCode,
        renderedText: fallbackText,
        requestId,
        error: data.diagnosticCode,
      };
    }

    // Client-side semantic re-verification using application-owned templates
    const semanticResult = validateAndRenderExplanation(
      { messages: data.messages },
      facts,
      {
        fallbackText,
        requireDisclosures: scenario === 'single_opportunity_preview',
        requireRemainingGapStatement: scenario === 'single_opportunity_preview',
        requireBaselineShortfallStatement: scenario === 'baseline_summary',
      }
    );

    if (!semanticResult.isValid) {
      return {
        status: 'fallback',
        source: 'fallback',
        diagnosticCode: 'CLIENT_SEMANTIC_REJECTION',
        renderedText: fallbackText,
        requestId,
        error: semanticResult.errors.join(' '),
      };
    }

    // Truthful source attribution: 'ai' only if gateway verified an actual Gemini response
    const sourceLabel: 'ai' | 'mock' | 'fallback' =
      data.source === 'ai' ? 'ai' : data.source === 'mock' ? 'mock' : 'fallback';

    return {
      status: 'success',
      source: sourceLabel,
      renderedText: semanticResult.renderedText,
      requestId,
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      if (signal?.aborted) {
        throw err;
      }
    }
    return {
      status: 'fallback',
      source: 'fallback',
      diagnosticCode: 'GATEWAY_NETWORK_ERROR',
      renderedText: fallbackText,
      requestId,
      error: err instanceof Error ? err.message : 'Network error connecting to local explanation gateway',
    };
  }
}
