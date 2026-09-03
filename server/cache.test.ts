import { describe, it, expect, vi } from 'vitest';
import { computeCacheKey, ExplanationServerCache } from './cache.ts';
import { getSeedInputs, calculate14DayCashFlow } from '../src/utils/cashFlowEngine.ts';
import { extractBaselineFacts } from '../src/utils/factExtractor.ts';
import type { ExplanationPayload } from '../src/types/explanation.ts';
import { processExplainRequest } from './gateway.ts';
import type { ExplanationProviderAdapter } from './types.ts';

describe('server/cache.ts - Deterministic Cache Key & In-Memory Cache', () => {
  const startDate = '2026-09-03';
  const inputs = getSeedInputs(startDate);
  const summary = calculate14DayCashFlow(inputs);
  const baselineFacts = extractBaselineFacts(inputs, summary);

  it('produces identical cryptographic keys for identical canonical facts with different property order', () => {
    const key1 = computeCacheKey({
      scenario: 'baseline_summary',
      facts: baselineFacts,
      provider: 'gemini',
      model: 'gemini-3.6-flash',
    });

    // Reversed fact insertion order
    const reversedFacts: typeof baselineFacts = {};
    const keys = Object.keys(baselineFacts).reverse() as (keyof typeof baselineFacts)[];
    for (const k of keys) {
      reversedFacts[k] = baselineFacts[k] as any;
    }

    const key2 = computeCacheKey({
      scenario: 'baseline_summary',
      facts: reversedFacts,
      provider: 'gemini',
      model: 'gemini-3.6-flash',
    });

    expect(key1).toBe(key2);
    expect(key1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  });

  it('produces distinct keys when provider, model, schema version, scenario, or facts change', () => {
    const baseKey = computeCacheKey({
      scenario: 'baseline_summary',
      facts: baselineFacts,
      provider: 'gemini',
      model: 'gemini-3.6-flash',
    });

    const differentProviderKey = computeCacheKey({
      scenario: 'baseline_summary',
      facts: baselineFacts,
      provider: 'groq',
      model: 'gemini-3.6-flash',
    });

    const differentModelKey = computeCacheKey({
      scenario: 'baseline_summary',
      facts: baselineFacts,
      provider: 'gemini',
      model: 'gemini-1.5-flash',
    });

    const differentVersionKey = computeCacheKey({
      scenario: 'baseline_summary',
      facts: baselineFacts,
      provider: 'gemini',
      model: 'gemini-3.6-flash',
      contractVersion: 'v2',
    });

    const modifiedInputs = { ...inputs, currentCashPaise: 80000 };
    const modifiedSummary = calculate14DayCashFlow(modifiedInputs);
    const differentFactsKey = computeCacheKey({
      scenario: 'baseline_summary',
      facts: extractBaselineFacts(modifiedInputs, modifiedSummary),
      provider: 'gemini',
      model: 'gemini-3.6-flash',
    });

    expect(differentProviderKey).not.toBe(baseKey);
    expect(differentModelKey).not.toBe(baseKey);
    expect(differentVersionKey).not.toBe(baseKey);
    expect(differentFactsKey).not.toBe(baseKey);
  });

  it('does not include secrets, API keys, or user free-text in cache keys', () => {
    // Inject hypothetical secret in user descriptions or unknownReason
    const factsWithDescription = {
      ...baselineFacts,
      FACT_OPP_TITLE: {
        type: 'amount',
        presence: 'present',
        paise: 50000,
        description: 'Super Secret Personal Free-Text Description with Key AIzaSyFakeSecretKey123',
      } as any,
    };

    const key = computeCacheKey({
      scenario: 'baseline_summary',
      facts: factsWithDescription,
      provider: 'gemini',
      model: 'gemini-3.6-flash',
    });

    // Hash is 64 hex characters
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain('AIzaSy');
    expect(key).not.toContain('Secret');
  });

  it('stores and retrieves cached entries, updating LRU access order', () => {
    const cache = new ExplanationServerCache({ maxEntries: 2, ttlMs: 10000 });
    const payloadA: ExplanationPayload = {
      messages: [{ messageId: 'baseline_essential_shortfall', referencedFactIds: ['FACT_BASELINE_ESSENTIAL_SHORTFALL'] }],
    };
    const payloadB: ExplanationPayload = {
      messages: [{ messageId: 'baseline_no_shortfall', referencedFactIds: [] }],
    };
    const payloadC: ExplanationPayload = {
      messages: [{ messageId: 'baseline_buffer_protected', referencedFactIds: ['FACT_BASELINE_SAFETY_BUFFER'] }],
    };

    cache.set('keyA', payloadA);
    cache.set('keyB', payloadB);

    // Access keyA to make it more recently used than keyB
    expect(cache.get('keyA')).toEqual(payloadA);

    // Insert keyC -> should evict keyB (oldest), keeping keyA and keyC
    cache.set('keyC', payloadC);

    expect(cache.get('keyB')).toBeNull(); // evicted
    expect(cache.get('keyA')).toEqual(payloadA);
    expect(cache.get('keyC')).toEqual(payloadC);
  });

  it('expires entries after TTL duration', async () => {
    const cache = new ExplanationServerCache({ ttlMs: 50 }); // 50ms test TTL
    const payload: ExplanationPayload = {
      messages: [{ messageId: 'baseline_no_shortfall', referencedFactIds: [] }],
    };

    cache.set('key_ttl', payload);
    expect(cache.get('key_ttl')).toEqual(payload);

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(cache.get('key_ttl')).toBeNull();
  });
});

describe('Gateway Caching & Coalescing Integration', () => {
  const startDate = '2026-09-03';
  const inputs = getSeedInputs(startDate);
  const summary = calculate14DayCashFlow(inputs);
  const baselineFacts = extractBaselineFacts(inputs, summary);

  const validGeminiOutput: ExplanationPayload = {
    messages: [
      {
        messageId: 'baseline_essential_shortfall',
        referencedFactIds: ['FACT_BASELINE_ESSENTIAL_SHORTFALL'],
      },
      {
        messageId: 'baseline_buffer_gap',
        referencedFactIds: ['FACT_BASELINE_SAFETY_BUFFER', 'FACT_BASELINE_ESSENTIAL_SHORTFALL'],
      },
    ],
  };

  it('repeated identical request triggers exactly ONE provider call and marks subsequent as cacheHit', async () => {
    const mockProvider = vi.fn().mockResolvedValue(validGeminiOutput);
    const adapter: ExplanationProviderAdapter = {
      name: 'gemini',
      model: 'gemini-3.6-flash',
      generateExplanation: mockProvider,
    };
    const cache = new ExplanationServerCache({ ttlMs: 60000 });

    const req1 = {
      requestId: 'req_call_1',
      scenario: 'baseline_summary',
      facts: baselineFacts,
    };
    const res1 = await processExplainRequest(req1, adapter, { cache });

    expect(res1.statusCode).toBe(200);
    expect(res1.response.status).toBe('success');
    expect((res1.response as any).cacheHit).toBe(false);
    expect((res1.response as any).source).toBe('ai');
    expect(mockProvider).toHaveBeenCalledTimes(1);

    // Second request with same facts but different caller requestId
    const req2 = {
      requestId: 'req_call_2',
      scenario: 'baseline_summary',
      facts: baselineFacts,
    };
    const res2 = await processExplainRequest(req2, adapter, { cache });

    expect(res2.statusCode).toBe(200);
    expect(res2.response.status).toBe('success');
    expect((res2.response as any).cacheHit).toBe(true);
    expect((res2.response as any).source).toBe('ai');
    expect((res2.response as any).requestId).toBe('req_call_2'); // Preserves caller requestId
    expect(mockProvider).toHaveBeenCalledTimes(1); // Provider NOT called again
  });

  it('concurrent identical requests coalesce into ONE provider call and return unique requestIds', async () => {
    let resolveProviderCall!: (val: ExplanationPayload) => void;
    const providerPromise = new Promise<ExplanationPayload>((resolve) => {
      resolveProviderCall = resolve;
    });

    const mockProvider = vi.fn().mockImplementation(() => providerPromise);
    const adapter: ExplanationProviderAdapter = {
      name: 'gemini',
      model: 'gemini-3.6-flash',
      generateExplanation: mockProvider,
    };
    const cache = new ExplanationServerCache();

    // Fire 3 simultaneous requests
    const p1 = processExplainRequest({ requestId: 'call_concurrent_1', scenario: 'baseline_summary', facts: baselineFacts }, adapter, { cache });
    const p2 = processExplainRequest({ requestId: 'call_concurrent_2', scenario: 'baseline_summary', facts: baselineFacts }, adapter, { cache });
    const p3 = processExplainRequest({ requestId: 'call_concurrent_3', scenario: 'baseline_summary', facts: baselineFacts }, adapter, { cache });

    expect(mockProvider).toHaveBeenCalledTimes(1);

    // Resolve provider response
    resolveProviderCall(validGeminiOutput);

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(r1.response.status).toBe('success');
    expect(r2.response.status).toBe('success');
    expect(r3.response.status).toBe('success');

    expect((r1.response as any).requestId).toBe('call_concurrent_1');
    expect((r2.response as any).requestId).toBe('call_concurrent_2');
    expect((r3.response as any).requestId).toBe('call_concurrent_3');

    expect(mockProvider).toHaveBeenCalledTimes(1);
  });

  it('subscriber cancellation does not abort shared provider call if other subscribers exist', async () => {
    let abortSignalObserved: AbortSignal | null = null;
    let resolveProvider!: (val: ExplanationPayload) => void;
    const providerPromise = new Promise<ExplanationPayload>((resolve) => {
      resolveProvider = resolve;
    });

    const mockProvider = vi.fn().mockImplementation((opts: { signal?: AbortSignal }) => {
      abortSignalObserved = opts.signal || null;
      return providerPromise;
    });

    const adapter: ExplanationProviderAdapter = {
      name: 'gemini',
      model: 'gemini-3.6-flash',
      generateExplanation: mockProvider,
    };
    const cache = new ExplanationServerCache();

    const controller1 = new AbortController();
    const cacheKey = computeCacheKey({ scenario: 'baseline_summary', facts: baselineFacts, provider: 'gemini', model: 'gemini-3.6-flash' });

    // Subscriber 1 with abortController
    const p1 = cache.executeCoalesced({
      key: cacheKey,
      subscriberId: 'sub_1',
      signal: controller1.signal,
      runner: (sig) => adapter.generateExplanation({ requestId: 'sub_1', scenario: 'baseline_summary', facts: baselineFacts, signal: sig }),
    });

    // Subscriber 2 with no abort
    const p2 = cache.executeCoalesced({
      key: cacheKey,
      subscriberId: 'sub_2',
      runner: (sig) => adapter.generateExplanation({ requestId: 'sub_2', scenario: 'baseline_summary', facts: baselineFacts, signal: sig }),
    });

    // Abort subscriber 1
    controller1.abort();

    await expect(p1).rejects.toThrow();
    expect((abortSignalObserved as AbortSignal | null)?.aborted).toBe(false); // Upstream NOT aborted because sub_2 is still active

    // Resolve provider
    resolveProvider(validGeminiOutput);

    const r2 = await p2;
    expect(r2.payload).toEqual(validGeminiOutput);
  });

  it('aborting ALL subscribers cancels upstream provider call', async () => {
    let abortSignalObserved: AbortSignal | null = null;
    const providerPromise = new Promise<ExplanationPayload>(() => {}); // Never resolves

    const mockProvider = vi.fn().mockImplementation((opts: { signal?: AbortSignal }) => {
      abortSignalObserved = opts.signal || null;
      return providerPromise;
    });

    const adapter: ExplanationProviderAdapter = {
      name: 'gemini',
      model: 'gemini-3.6-flash',
      generateExplanation: mockProvider,
    };
    const cache = new ExplanationServerCache();

    const controller1 = new AbortController();
    const controller2 = new AbortController();
    const cacheKey = computeCacheKey({ scenario: 'baseline_summary', facts: baselineFacts, provider: 'gemini', model: 'gemini-3.6-flash' });

    const p1 = cache.executeCoalesced({
      key: cacheKey,
      subscriberId: 'sub_1',
      signal: controller1.signal,
      runner: (sig) => adapter.generateExplanation({ requestId: 'sub_1', scenario: 'baseline_summary', facts: baselineFacts, signal: sig }),
    });

    const p2 = cache.executeCoalesced({
      key: cacheKey,
      subscriberId: 'sub_2',
      signal: controller2.signal,
      runner: (sig) => adapter.generateExplanation({ requestId: 'sub_2', scenario: 'baseline_summary', facts: baselineFacts, signal: sig }),
    });

    controller1.abort();
    controller2.abort();

    await expect(p1).rejects.toThrow();
    await expect(p2).rejects.toThrow();

    // Now all subscribers aborted -> upstream provider signal must be aborted
    expect((abortSignalObserved as AbortSignal | null)?.aborted).toBe(true);
  });

  it('bypassCache skips reading cache, makes a new provider call, and replaces the cache entry on success', async () => {
    let callCount = 0;
    const mockProvider = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        messages: [
          { messageId: 'baseline_essential_shortfall', referencedFactIds: ['FACT_BASELINE_ESSENTIAL_SHORTFALL'] },
          { messageId: 'baseline_buffer_gap', referencedFactIds: ['FACT_BASELINE_SAFETY_BUFFER', 'FACT_BASELINE_ESSENTIAL_SHORTFALL'] },
        ],
      };
    });

    const adapter: ExplanationProviderAdapter = {
      name: 'gemini',
      model: 'gemini-3.6-flash',
      generateExplanation: mockProvider,
    };
    const cache = new ExplanationServerCache();

    // Request 1: Initial call
    const res1 = await processExplainRequest({ requestId: 'req_1', scenario: 'baseline_summary', facts: baselineFacts }, adapter, { cache });
    expect((res1.response as any).cacheHit).toBe(false);
    expect(callCount).toBe(1);

    // Request 2: Normal call -> cache hit
    const res2 = await processExplainRequest({ requestId: 'req_2', scenario: 'baseline_summary', facts: baselineFacts }, adapter, { cache });
    expect((res2.response as any).cacheHit).toBe(true);
    expect(callCount).toBe(1);

    // Request 3: Regenerate with bypassCache: true -> skips cache, makes new call
    const res3 = await processExplainRequest({ requestId: 'req_3', scenario: 'baseline_summary', facts: baselineFacts, bypassCache: true }, adapter, { cache });
    expect((res3.response as any).cacheHit).toBe(false);
    expect(callCount).toBe(2);

    // Request 4: Normal call after regeneration -> cache hit with updated entry
    const res4 = await processExplainRequest({ requestId: 'req_4', scenario: 'baseline_summary', facts: baselineFacts }, adapter, { cache });
    expect((res4.response as any).cacheHit).toBe(true);
    expect(callCount).toBe(2);
  });

  it('failed regeneration does NOT erase previously valid cached value', async () => {
    let shouldFail = false;
    const mockProvider = vi.fn().mockImplementation(async () => {
      if (shouldFail) {
        throw new Error('GEMINI_QUOTA_ERROR: Rate limited');
      }
      return validGeminiOutput;
    });

    const adapter: ExplanationProviderAdapter = {
      name: 'gemini',
      model: 'gemini-3.6-flash',
      generateExplanation: mockProvider,
    };
    const cache = new ExplanationServerCache();

    // 1. Initial success -> populated in cache
    const res1 = await processExplainRequest({ requestId: 'req_1', scenario: 'baseline_summary', facts: baselineFacts }, adapter, { cache });
    expect(res1.response.status).toBe('success');
    expect((res1.response as any).source).toBe('ai');

    // 2. Regeneration fails
    shouldFail = true;
    const res2 = await processExplainRequest({ requestId: 'req_2', scenario: 'baseline_summary', facts: baselineFacts, bypassCache: true }, adapter, { cache });
    expect(res2.response.status).toBe('success');
    expect((res2.response as any).source).toBe('fallback'); // Serves fallback on failure
    expect((res2.response as any).diagnosticCode).toBe('GEMINI_QUOTA_ERROR');

    // 3. Normal request after failed regeneration -> still serves original valid cache
    shouldFail = false;
    const res3 = await processExplainRequest({ requestId: 'req_3', scenario: 'baseline_summary', facts: baselineFacts }, adapter, { cache });
    expect(res3.response.status).toBe('success');
    expect((res3.response as any).source).toBe('ai');
    expect((res3.response as any).cacheHit).toBe(true);
  });

  it('mock provider responses are never cached', async () => {
    const mockAdapter: ExplanationProviderAdapter = {
      name: 'mock',
      model: 'deterministic-mock',
      generateExplanation: vi.fn().mockResolvedValue(validGeminiOutput),
    };
    const cache = new ExplanationServerCache();

    const res1 = await processExplainRequest({ requestId: 'mock_1', scenario: 'baseline_summary', facts: baselineFacts }, mockAdapter, { cache });
    expect((res1.response as any).source).toBe('mock');
    expect((res1.response as any).provider).toBe('mock');
    expect((res1.response as any).cacheHit).toBe(false);
    expect(cache.size()).toBe(0); // Zero entries stored
  });

  it('correctly labels provider as groq for Groq adapter and gemini for Gemini adapter', async () => {
    const cache = new ExplanationServerCache();
    const groqAdapter: ExplanationProviderAdapter = {
      name: 'groq',
      model: 'openai/gpt-oss-20b',
      generateExplanation: vi.fn().mockResolvedValue(validGeminiOutput),
    };

    const geminiAdapter: ExplanationProviderAdapter = {
      name: 'gemini',
      model: 'gemini-3.6-flash',
      generateExplanation: vi.fn().mockResolvedValue(validGeminiOutput),
    };

    const groqRes = await processExplainRequest({ requestId: 'groq_req', scenario: 'baseline_summary', facts: baselineFacts }, groqAdapter, { cache });
    expect((groqRes.response as any).source).toBe('ai');
    expect((groqRes.response as any).provider).toBe('groq');

    const geminiRes = await processExplainRequest({ requestId: 'gemini_req', scenario: 'baseline_summary', facts: baselineFacts }, geminiAdapter, { cache });
    expect((geminiRes.response as any).source).toBe('ai');
    expect((geminiRes.response as any).provider).toBe('gemini');
  });

  it('switching provider from Gemini to Groq produces distinct cache keys and does NOT reuse Gemini cache', async () => {
    const cache = new ExplanationServerCache();

    const mockGroq = vi.fn().mockResolvedValue(validGeminiOutput);
    const mockGemini = vi.fn().mockResolvedValue(validGeminiOutput);

    const groqAdapter: ExplanationProviderAdapter = {
      name: 'groq',
      model: 'openai/gpt-oss-20b',
      generateExplanation: mockGroq,
    };

    const geminiAdapter: ExplanationProviderAdapter = {
      name: 'gemini',
      model: 'gemini-3.6-flash',
      generateExplanation: mockGemini,
    };

    // 1. Initial call with Gemini -> caches under Gemini key
    const geminiRes = await processExplainRequest({ requestId: 'gem_1', scenario: 'baseline_summary', facts: baselineFacts }, geminiAdapter, { cache });
    expect((geminiRes.response as any).provider).toBe('gemini');
    expect((geminiRes.response as any).cacheHit).toBe(false);
    expect(mockGemini).toHaveBeenCalledTimes(1);

    // 2. Call with Groq for same scenario and facts -> MUST NOT reuse Gemini cache! Must trigger Groq call.
    const groqRes = await processExplainRequest({ requestId: 'groq_1', scenario: 'baseline_summary', facts: baselineFacts }, groqAdapter, { cache });
    expect((groqRes.response as any).provider).toBe('groq');
    expect((groqRes.response as any).cacheHit).toBe(false); // Cache miss because provider is groq
    expect(mockGroq).toHaveBeenCalledTimes(1);

    // 3. Repeated call with Groq -> hits Groq cache
    const groqRes2 = await processExplainRequest({ requestId: 'groq_2', scenario: 'baseline_summary', facts: baselineFacts }, groqAdapter, { cache });
    expect((groqRes2.response as any).provider).toBe('groq');
    expect((groqRes2.response as any).cacheHit).toBe(true);
    expect(mockGroq).toHaveBeenCalledTimes(1); // Not called again
  });
});
