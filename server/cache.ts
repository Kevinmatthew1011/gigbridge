import crypto from 'node:crypto';
import type { FactMap, FactId, ExplanationPayload } from '../src/types/explanation.ts';
import type { ExplanationScenario } from './types.ts';

export const EXPLANATION_CONTRACT_VERSION = 'v1';

export interface CacheOptions {
  ttlMs?: number;
  maxEntries?: number;
}

interface CacheEntry {
  payload: ExplanationPayload;
  timestamp: number;
}

interface Subscriber {
  id: string;
  signal?: AbortSignal;
  resolve: (payload: ExplanationPayload) => void;
  reject: (err: unknown) => void;
}

interface InFlightOperation {
  abortController: AbortController;
  subscribers: Map<string, Subscriber>;
  promise: Promise<ExplanationPayload>;
}

/**
 * Computes a deterministic, cryptographic state signature from canonical scenario data.
 * Strictly excludes API keys, secrets, raw prompts, free-text descriptions, area, and user names.
 */
export function computeCacheKey(params: {
  scenario: ExplanationScenario;
  facts: FactMap;
  provider: string;
  model?: string;
  contractVersion?: string;
}): string {
  const { scenario, facts, provider, model = 'default', contractVersion = EXPLANATION_CONTRACT_VERSION } = params;

  // Extract canonical typed facts with sorted keys
  const sortedFactKeys = Object.keys(facts).sort() as FactId[];
  const canonicalFacts: Record<string, unknown> = {};

  for (const factId of sortedFactKeys) {
    const fact = facts[factId];
    if (!fact) continue;

    const base: Record<string, unknown> = {
      type: fact.type,
      presence: fact.presence,
    };

    if (fact.presence === 'present') {
      if (fact.type === 'amount') {
        base.paise = fact.paise;
      } else if (fact.type === 'date') {
        base.date = fact.date;
        base.dayIndex = fact.dayIndex;
      } else if (fact.type === 'event') {
        base.dayIndex = fact.dayIndex;
        base.date = fact.date;
        base.deficitPaise = fact.deficitPaise;
        base.bufferInclusiveGapPaise = fact.bufferInclusiveGapPaise;
        base.minBalancePaise = fact.minBalancePaise;
        base.bufferDeficitPaise = fact.bufferDeficitPaise;
      } else if (fact.type === 'eligibility') {
        base.category = fact.category;
        base.isEligible = fact.isEligible;
      } else if (fact.type === 'outcome') {
        base.isOriginalDeficitResolved = fact.isOriginalDeficitResolved;
        base.isOriginalBufferGapResolved = fact.isOriginalBufferGapResolved;
        base.hasRemainingOrLaterShortfall = fact.hasRemainingOrLaterShortfall;
        base.remainingDeficitAtEventPaise = fact.remainingDeficitAtEventPaise;
        base.deficitReductionPaise = fact.deficitReductionPaise;
      }
    }

    canonicalFacts[factId] = base;
  }

  const canonicalObj = {
    v: contractVersion,
    scenario,
    provider,
    model,
    facts: canonicalFacts,
  };

  const canonicalJson = JSON.stringify(canonicalObj);
  return crypto.createHash('sha256').update(canonicalJson).digest('hex');
}

/**
 * In-memory LRU cache and in-flight request coalescer for validated explanation payloads.
 * Memory-only, bounded size, configurable TTL, with subscriber-aware cancellation.
 */
export class ExplanationServerCache {
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, InFlightOperation>();

  constructor(options: CacheOptions = {}) {
    const requestedTtl = options.ttlMs ?? 300000; // 5 minutes default
    this.ttlMs = Math.max(1, Math.min(requestedTtl, 3600000)); // Bounded: 1ms to 1 hour

    const requestedMax = options.maxEntries ?? 50;
    this.maxEntries = Math.max(1, Math.min(requestedMax, 500)); // Bounded: 1 to 500 entries
  }

  /**
   * Retrieves a cached payload if present and unexpired. Updates LRU access order.
   */
  public get(key: string): ExplanationPayload | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Refresh LRU order (delete & re-insert)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.payload;
  }

  /**
   * Stores a successfully validated payload. Enforces deterministic LRU eviction.
   */
  public set(key: string, payload: ExplanationPayload): void {
    // If key already exists, delete it first to update order
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict the oldest entry (first item in Map iterator)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      payload,
      timestamp: Date.now(),
    });
  }

  /**
   * Coalesces concurrent in-flight requests and serves from cache when available.
   * Subscriber-aware: canceling one subscriber does not abort the shared call unless ALL subscribers abort.
   */
  public async executeCoalesced(params: {
    key: string;
    subscriberId: string;
    signal?: AbortSignal;
    bypassCache?: boolean;
    runner: (signal: AbortSignal) => Promise<ExplanationPayload>;
  }): Promise<{ payload: ExplanationPayload; cacheHit: boolean }> {
    const { key, subscriberId, signal, bypassCache = false, runner } = params;

    // 1. Check cache if not bypassing
    if (!bypassCache) {
      const cached = this.get(key);
      if (cached) {
        return { payload: cached, cacheHit: true };
      }
    }

    // 2. Attach to existing in-flight operation or create a new one
    let operation = this.inFlight.get(key);

    if (!operation) {
      const abortController = new AbortController();
      const subscribers = new Map<string, Subscriber>();

      const opPromise = (async () => {
        try {
          const result = await runner(abortController.signal);
          return result;
        } finally {
          this.inFlight.delete(key);
        }
      })();

      operation = {
        abortController,
        subscribers,
        promise: opPromise,
      };

      this.inFlight.set(key, operation);
    }

    // 3. Register subscriber
    const op = operation;

    return new Promise<{ payload: ExplanationPayload; cacheHit: boolean }>((resolve, reject) => {
      const subscriber: Subscriber = {
        id: subscriberId,
        signal,
        resolve: (payload) => resolve({ payload, cacheHit: false }),
        reject,
      };

      op.subscribers.set(subscriberId, subscriber);

      // Handle subscriber-specific cancellation
      const onAbort = () => {
        op.subscribers.delete(subscriberId);
        if (op.subscribers.size === 0) {
          // All subscribers have aborted -> cancel upstream provider operation
          op.abortController.abort();
        }
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      };

      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }

      // Await shared provider call
      op.promise
        .then((payload) => {
          if (signal) {
            signal.removeEventListener('abort', onAbort);
          }
          if (op.subscribers.has(subscriberId)) {
            op.subscribers.delete(subscriberId);
            resolve({ payload, cacheHit: false });
          }
        })
        .catch((err) => {
          if (signal) {
            signal.removeEventListener('abort', onAbort);
          }
          if (op.subscribers.has(subscriberId)) {
            op.subscribers.delete(subscriberId);
            reject(err);
          }
        });
    });
  }

  public clear(): void {
    this.cache.clear();
    for (const op of this.inFlight.values()) {
      op.abortController.abort();
    }
    this.inFlight.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}
