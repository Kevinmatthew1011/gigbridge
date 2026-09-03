import type { ExplainApiRequest, ExplainApiResponse, ExplanationProviderAdapter } from './types.ts';
import { validateAndRenderExplanation } from '../src/utils/explanationValidator.ts';
import { validateExplainRequest } from './inputValidator.ts';
import { generateServerDeterministicFallback } from './fallbackGenerator.ts';

export interface GatewayOptions {
  adapterTimeoutMs?: number;
}

/**
 * Extracts a safe, privacy-preserving diagnostic code from provider errors.
 * Never includes API keys, payloads, or financial numbers.
 */
function extractSafeDiagnosticCode(err: unknown, adapterName: string): string {
  if (!(err instanceof Error)) {
    if (adapterName === 'gemini') return 'GEMINI_GATEWAY_ERROR';
    if (adapterName === 'groq') return 'GROQ_GATEWAY_ERROR';
    return 'GATEWAY_ERROR';
  }

  const msg = err.message;
  // Gemini errors
  if (msg.includes('GEMINI_CONFIG_ERROR')) return 'GEMINI_CONFIG_ERROR';
  if (msg.includes('GEMINI_AUTH_ERROR')) return 'GEMINI_AUTH_ERROR';
  if (msg.includes('GEMINI_QUOTA_ERROR')) return 'GEMINI_QUOTA_ERROR';
  if (msg.includes('GEMINI_MODEL_ERROR')) return 'GEMINI_MODEL_ERROR';
  if (msg.includes('GEMINI_BLOCKED_ERROR')) return 'GEMINI_BLOCKED_ERROR';
  if (msg.includes('GEMINI_UNSUPPORTED_RESPONSE_SCHEMA')) return 'GEMINI_UNSUPPORTED_RESPONSE_SCHEMA';
  if (msg.includes('GEMINI_NO_CANDIDATES')) return 'GEMINI_NO_CANDIDATES';
  if (msg.includes('GEMINI_EMPTY_CONTENT')) return 'GEMINI_EMPTY_CONTENT';
  if (msg.includes('GEMINI_MISSING_TEXT_PART')) return 'GEMINI_MISSING_TEXT_PART';
  if (msg.includes('GEMINI_TRUNCATED_OUTPUT')) return 'GEMINI_TRUNCATED_OUTPUT';
  if (msg.includes('GEMINI_JSON_PARSE_FAILED')) return 'GEMINI_JSON_PARSE_FAILED';
  if (msg.includes('GEMINI_SCHEMA_SHAPE_MISMATCH')) return 'GEMINI_SCHEMA_SHAPE_MISMATCH';

  // Groq errors
  if (msg.includes('GROQ_CONFIG_ERROR')) return 'GROQ_CONFIG_ERROR';
  if (msg.includes('GROQ_AUTH_ERROR')) return 'GROQ_AUTH_ERROR';
  if (msg.includes('GROQ_QUOTA_ERROR')) return 'GROQ_QUOTA_ERROR';
  if (msg.includes('GROQ_MODEL_ERROR')) return 'GROQ_MODEL_ERROR';
  if (msg.includes('GROQ_NO_CHOICES')) return 'GROQ_NO_CHOICES';
  if (msg.includes('GROQ_EMPTY_CONTENT')) return 'GROQ_EMPTY_CONTENT';
  if (msg.includes('GROQ_TRUNCATED_OUTPUT')) return 'GROQ_TRUNCATED_OUTPUT';
  if (msg.includes('GROQ_JSON_PARSE_FAILED')) return 'GROQ_JSON_PARSE_FAILED';
  if (msg.includes('GROQ_SCHEMA_SHAPE_MISMATCH')) return 'GROQ_SCHEMA_SHAPE_MISMATCH';

  // Timeouts
  if (msg.includes('timed out') || msg.includes('TIMEOUT_ERROR')) {
    if (adapterName === 'gemini') return 'GEMINI_TIMEOUT_ERROR';
    if (adapterName === 'groq') return 'GROQ_TIMEOUT_ERROR';
    return 'GATEWAY_TIMEOUT_ERROR';
  }

  if (adapterName === 'gemini') return 'GEMINI_GENERIC_ERROR';
  if (adapterName === 'groq') return 'GROQ_GENERIC_ERROR';
  return 'PROVIDER_ERROR';
}

/**
 * Handles incoming explain requests by coordinating input validation,
 * adapter invocation, semantic contract verification, and safe server-side fallback with diagnostics.
 */
export async function processExplainRequest(
  rawBody: unknown,
  adapter: ExplanationProviderAdapter,
  options: GatewayOptions = {}
): Promise<{ statusCode: number; response: ExplainApiResponse }> {
  const timeoutMs = options.adapterTimeoutMs ?? (adapter.name === 'gemini' || adapter.name === 'groq' ? 30000 : 2000);

  // 1. Untrusted input structure, fact type, completeness, and relational validation
  const validation = validateExplainRequest(rawBody);
  if (!validation.isValid || !validation.data) {
    return {
      statusCode: 400,
      response: {
        status: 'error',
        error: 'Invalid request payload',
        details: validation.errors,
      },
    };
  }

  const req: ExplainApiRequest = validation.data;

  // 2. Generate deterministic fallback text purely from validated facts and server templates
  const serverFallbackText = generateServerDeterministicFallback(req.scenario, req.facts);

  // 3. Invoke provider adapter with bounded timeout and cancellation signal
  let adapterOutput: unknown;
  const abortController = new AbortController();

  try {
    let timeoutHandle: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        abortController.abort();
        reject(new Error(`Adapter timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    adapterOutput = await Promise.race([
      adapter.generateExplanation({
        requestId: req.requestId,
        scenario: req.scenario,
        facts: req.facts,
        timeoutMs,
        signal: abortController.signal,
      }),
      timeoutPromise,
    ]);

    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  } catch (err: unknown) {
    // Adapter failed, rejected, or timed out -> serve server-constructed deterministic fallback with safe diagnostic code
    const diagnosticCode = extractSafeDiagnosticCode(err, adapter.name);
    return {
      statusCode: 200,
      response: {
        requestId: req.requestId,
        status: 'success',
        source: 'fallback',
        diagnosticCode,
        renderedText: serverFallbackText,
        messages: [],
        referencedFactIds: [],
      },
    };
  }

  // 4. Apply Phase 1 semantic verification to adapter output
  const semanticResult = validateAndRenderExplanation(adapterOutput, req.facts, {
    fallbackText: serverFallbackText,
    requireDisclosures: req.scenario === 'single_opportunity_preview',
    requireRemainingGapStatement: req.scenario === 'single_opportunity_preview',
    requireBaselineShortfallStatement: req.scenario === 'baseline_summary',
  });

  if (!semanticResult.isValid) {
    // Semantic validation rejected adapter output -> return server-constructed deterministic fallback
    const subcode = semanticResult.semanticRejectionReason ? `:${semanticResult.semanticRejectionReason}` : '';
    const prefix =
      adapter.name === 'gemini'
        ? 'GEMINI_SEMANTIC_REJECTION'
        : adapter.name === 'groq'
        ? 'GROQ_SEMANTIC_REJECTION'
        : 'SEMANTIC_REJECTION';
    const diagnosticCode = `${prefix}${subcode}`;
    return {
      statusCode: 200,
      response: {
        requestId: req.requestId,
        status: 'success',
        source: 'fallback',
        diagnosticCode,
        renderedText: serverFallbackText,
        messages: [],
        referencedFactIds: [],
      },
    };
  }

  // 5. Return successful rendered explanation with truthful source label
  const sourceLabel: 'ai' | 'mock' | 'fallback' =
    adapter.name === 'gemini' || adapter.name === 'groq' ? 'ai' : adapter.name === 'mock' ? 'mock' : 'fallback';

  return {
    statusCode: 200,
    response: {
      requestId: req.requestId,
      status: 'success',
      source: sourceLabel,
      renderedText: semanticResult.renderedText,
      messages: semanticResult.renderedMessages,
      referencedFactIds: semanticResult.referencedFactIds,
    },
  };
}
