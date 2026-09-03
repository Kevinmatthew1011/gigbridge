import type { ExplainApiRequest, ExplainApiResponse, ExplanationProviderAdapter } from './types.ts';
import { validateAndRenderExplanation } from '../src/utils/explanationValidator.ts';
import { validateExplainRequest } from './inputValidator.ts';
import { generateServerDeterministicFallback } from './fallbackGenerator.ts';
import { ExplanationServerCache, computeCacheKey } from './cache.ts';
import type { ExplanationPayload } from '../src/types/explanation.ts';

export interface GatewayOptions {
  adapterTimeoutMs?: number;
  cache?: ExplanationServerCache;
}

const defaultServerCache = new ExplanationServerCache();

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

  // Semantic rejections with safe subcodes
  if (msg.startsWith('GEMINI_SEMANTIC_REJECTION')) return msg;
  if (msg.startsWith('GROQ_SEMANTIC_REJECTION')) return msg;
  if (msg.startsWith('SEMANTIC_REJECTION')) return msg;

  if (adapterName === 'gemini') return 'GEMINI_GENERIC_ERROR';
  if (adapterName === 'groq') return 'GROQ_GENERIC_ERROR';
  return 'PROVIDER_ERROR';
}

/**
 * Handles incoming explain requests by coordinating input validation,
 * in-memory caching, in-flight request coalescing, adapter invocation,
 * semantic contract verification, and safe server-side fallback with diagnostics.
 */
export async function processExplainRequest(
  rawBody: unknown,
  adapter: ExplanationProviderAdapter,
  options: GatewayOptions = {}
): Promise<{ statusCode: number; response: ExplainApiResponse }> {
  const timeoutMs = options.adapterTimeoutMs ?? (adapter.name === 'gemini' || adapter.name === 'groq' ? 30000 : 2000);
  const cache = options.cache ?? defaultServerCache;

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

  const isAiProvider = adapter.name === 'gemini' || adapter.name === 'groq';

  // If not an AI provider (e.g. mock), do not use AI cache
  if (!isAiProvider) {
    try {
      const adapterOutput = await adapter.generateExplanation({
        requestId: req.requestId,
        scenario: req.scenario,
        facts: req.facts,
        timeoutMs,
      });

      const semanticResult = validateAndRenderExplanation(adapterOutput, req.facts, {
        fallbackText: serverFallbackText,
        requireDisclosures: req.scenario === 'single_opportunity_preview',
        requireRemainingGapStatement: req.scenario === 'single_opportunity_preview',
        requireBaselineShortfallStatement: req.scenario === 'baseline_summary',
      });

      if (!semanticResult.isValid) {
        return {
          statusCode: 200,
          response: {
            requestId: req.requestId,
            status: 'success',
            source: 'fallback',
            diagnosticCode: 'MOCK_SEMANTIC_REJECTION',
            renderedText: serverFallbackText,
            messages: [],
            referencedFactIds: [],
            cacheHit: false,
          },
        };
      }

      return {
        statusCode: 200,
        response: {
          requestId: req.requestId,
          status: 'success',
          source: 'mock',
          renderedText: semanticResult.renderedText,
          messages: semanticResult.renderedMessages,
          referencedFactIds: semanticResult.referencedFactIds,
          cacheHit: false,
        },
      };
    } catch (err: unknown) {
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
          cacheHit: false,
        },
      };
    }
  }

  // 3. Compute deterministic cache key for AI provider
  const cacheKey = computeCacheKey({
    scenario: req.scenario,
    facts: req.facts,
    provider: adapter.name,
    model: adapter.model,
  });

  // 4. Execute coalesced provider call with in-memory caching and subscriber-aware cancellation
  let adapterOutput: ExplanationPayload;
  let isCacheHit = false;

  try {
    const result = await cache.executeCoalesced({
      key: cacheKey,
      subscriberId: req.requestId,
      bypassCache: req.bypassCache === true,
      runner: async (signal) => {
        const timeoutAbortController = new AbortController();
        if (signal) {
          if (signal.aborted) {
            timeoutAbortController.abort();
          } else {
            signal.addEventListener('abort', () => timeoutAbortController.abort(), { once: true });
          }
        }

        let timeoutHandle: NodeJS.Timeout | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            timeoutAbortController.abort();
            reject(new Error(`Adapter timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        });

        try {
          const payload = await Promise.race([
            adapter.generateExplanation({
              requestId: req.requestId,
              scenario: req.scenario,
              facts: req.facts,
              timeoutMs,
              signal: timeoutAbortController.signal,
            }),
            timeoutPromise,
          ]);

          // Pre-validate semantic correctness before considering the response valid for caching
          const validationCheck = validateAndRenderExplanation(payload, req.facts, {
            fallbackText: serverFallbackText,
            requireDisclosures: req.scenario === 'single_opportunity_preview',
            requireRemainingGapStatement: req.scenario === 'single_opportunity_preview',
            requireBaselineShortfallStatement: req.scenario === 'baseline_summary',
          });

          if (!validationCheck.isValid) {
            const subcode = validationCheck.semanticRejectionReason
              ? `:${validationCheck.semanticRejectionReason}`
              : '';
            const prefix =
              adapter.name === 'gemini'
                ? 'GEMINI_SEMANTIC_REJECTION'
                : adapter.name === 'groq'
                ? 'GROQ_SEMANTIC_REJECTION'
                : 'SEMANTIC_REJECTION';
            throw new Error(`${prefix}${subcode}`);
          }

          // Cache only validated AI response
          cache.set(cacheKey, payload);
          return payload;
        } finally {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
        }
      },
    });

    adapterOutput = result.payload;
    isCacheHit = result.cacheHit;
  } catch (err: unknown) {
    // Failure, timeout, or semantic rejection -> serve deterministic fallback; do NOT cache failure
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
        cacheHit: false,
      },
    };
  }

  // 5. Render verified messages using application templates
  const semanticResult = validateAndRenderExplanation(adapterOutput, req.facts, {
    fallbackText: serverFallbackText,
    requireDisclosures: req.scenario === 'single_opportunity_preview',
    requireRemainingGapStatement: req.scenario === 'single_opportunity_preview',
    requireBaselineShortfallStatement: req.scenario === 'baseline_summary',
  });

  if (!semanticResult.isValid) {
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
        cacheHit: false,
      },
    };
  }

  return {
    statusCode: 200,
    response: {
      requestId: req.requestId,
      status: 'success',
      source: 'ai',
      renderedText: semanticResult.renderedText,
      messages: semanticResult.renderedMessages,
      referencedFactIds: semanticResult.referencedFactIds,
      cacheHit: isCacheHit,
    },
  };
}
