import type { FactMap, FactId, RenderedMessage, ExplanationPayload } from '../src/types/explanation.ts';

export type ExplanationScenario = 'baseline_summary' | 'single_opportunity_preview';

export interface ExplainApiRequest {
  requestId: string;
  scenario: ExplanationScenario;
  facts: FactMap;
}

export interface ExplainApiResponseSuccess {
  requestId: string;
  status: 'success';
  source: 'ai' | 'mock' | 'fallback';
  diagnosticCode?: string;
  renderedText: string;
  messages: RenderedMessage[];
  referencedFactIds: FactId[];
}

export interface ExplainApiResponseError {
  requestId?: string;
  status: 'error';
  error: string;
  details?: string[];
}

export type ExplainApiResponse = ExplainApiResponseSuccess | ExplainApiResponseError;

export interface ProviderGenerateOptions {
  requestId: string;
  scenario: ExplanationScenario;
  facts: FactMap;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ExplanationProviderAdapter {
  name: string;
  generateExplanation(options: ProviderGenerateOptions): Promise<ExplanationPayload>;
}

export interface ServerOptions {
  port?: number;
  host?: string;
  adapterTimeoutMs?: number;
  maxBodySizeBytes?: number;
}
