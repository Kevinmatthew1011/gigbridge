import type { ExplanationPayload } from '../src/types/explanation.ts';
import type { ExplanationProviderAdapter, ProviderGenerateOptions } from './types.ts';

export interface GeminiAdapterOptions {
  apiKey: string | null;
  model?: string;
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
  fetchFn?: typeof fetch;
}

function buildScenarioSystemInstruction(scenario: string): string {
  if (scenario === 'baseline_summary') {
    return `You are the structured explanation engine for GigBridge baseline 14-day cash flow analysis.
Your sole function is to select and order approved message IDs that accurately explain the baseline financial facts to the user.
You MUST output strictly structured JSON matching the provided schema.

APPROVED MESSAGE IDs FOR BASELINE:
1. "baseline_essential_shortfall": Select when FACT_BASELINE_ESSENTIAL_SHORTFALL is present. References ["FACT_BASELINE_ESSENTIAL_SHORTFALL"].
2. "baseline_buffer_gap": Select when FACT_BASELINE_SAFETY_BUFFER is configured (> 0) and essential shortfall exists. References ["FACT_BASELINE_SAFETY_BUFFER", "FACT_BASELINE_ESSENTIAL_SHORTFALL"].
3. "baseline_buffer_only_breach": Select ONLY when no essential shortfall exists but FACT_BASELINE_BUFFER_BREACH is present. References ["FACT_BASELINE_BUFFER_BREACH", "FACT_BASELINE_SAFETY_BUFFER"].
4. "baseline_no_shortfall": Select ONLY when no essential shortfall exists across all 14 days. References [].
5. "baseline_buffer_protected": Select ONLY when cash stays above safety buffer across all 14 days. References [].

CRITICAL CONSTRAINTS:
- If FACT_BASELINE_ESSENTIAL_SHORTFALL is present: You MUST select "baseline_essential_shortfall" and (if safety buffer > 0) "baseline_buffer_gap". You MUST NEVER select "baseline_no_shortfall" or "baseline_buffer_only_breach".
- Do NOT generate arbitrary text, advice, or conversational prose. Output only messageId and referencedFactIds.`;
  }

  return `You are the structured explanation engine for GigBridge single gig simulation preview.
Your sole function is to select and order approved message IDs that accurately explain the gig impact facts to the user.
You MUST output strictly structured JSON matching the provided schema.

APPROVED MESSAGE IDs FOR OPPORTUNITY PREVIEW:
1. "original_gap_covered": Select when gig net payout fully covers the initial essential deficit. References ["FACT_OPP_NET_EARNINGS", "FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON"].
2. "original_gap_partially_reduced": Select when gig payout reduces but does not fully cover the initial deficit. References ["FACT_OPP_NET_EARNINGS", "FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON"].
3. "payout_too_late": Select when gig payout is too late to prevent the initial shortfall. References ["FACT_OPP_PAYOUT_DATE", "FACT_SIM_ORIGINAL_SHORTFALL_COMPARISON"].
4. "later_gap_remains": MANDATORY if a subsequent shortfall remains (FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL is present). References ["FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL"].
5. "fictional_opportunity_disclosure": MANDATORY disclosure stating this opportunity is fictional. References [].
6. "work_is_optional_disclosure": MANDATORY disclosure stating gig work is entirely optional. References [].

CRITICAL CONSTRAINTS:
- Always include the mandatory disclosures: "fictional_opportunity_disclosure" and "work_is_optional_disclosure".
- If FACT_SIM_EARLIEST_ESSENTIAL_SHORTFALL is present: You MUST include "later_gap_remains".
- Do NOT generate arbitrary text, advice, or conversational prose. Output only messageId and referencedFactIds.`;
}

function buildScenarioSchema(scenario: string) {
  const allowedMessageIds =
    scenario === 'baseline_summary'
      ? [
          'baseline_essential_shortfall',
          'baseline_buffer_gap',
          'baseline_buffer_only_breach',
          'baseline_no_shortfall',
          'baseline_buffer_protected',
        ]
      : [
          'original_gap_covered',
          'original_gap_partially_reduced',
          'payout_too_late',
          'later_gap_remains',
          'fictional_opportunity_disclosure',
          'work_is_optional_disclosure',
        ];

  return {
    type: 'OBJECT',
    properties: {
      messages: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            messageId: {
              type: 'STRING',
              enum: allowedMessageIds,
              description: 'Approved message template identifier for this scenario',
            },
            referencedFactIds: {
              type: 'ARRAY',
              items: {
                type: 'STRING',
                description: 'Fact ID that substantiates this message',
              },
              description: 'List of Fact IDs referenced by this message',
            },
          },
          required: ['messageId', 'referencedFactIds'],
        },
        description: 'Ordered list of verified explanation messages',
      },
    },
    required: ['messages'],
  };
}

/**
 * Server-only Gemini Provider Adapter.
 * Invokes Google Gemini API with scenario-tailored structured JSON output schema.
 * Never logs raw payloads, model text, or secrets.
 */
export class GeminiExplanationAdapter implements ExplanationProviderAdapter {
  public readonly name = 'gemini';
  private readonly apiKey: string | null;
  private readonly model: string;
  private readonly thinkingLevel: 'minimal' | 'low' | 'medium' | 'high';
  private readonly fetchFn: typeof fetch;

  constructor(options: GeminiAdapterOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model || 'gemini-3.6-flash';
    this.thinkingLevel = options.thinkingLevel || 'minimal';
    this.fetchFn = options.fetchFn || globalThis.fetch;
  }

  public async generateExplanation(options: ProviderGenerateOptions): Promise<ExplanationPayload> {
    if (!this.apiKey) {
      throw new Error('GEMINI_CONFIG_ERROR: Missing GEMINI_API_KEY on server');
    }

    const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model
    )}:generateContent`;

    const systemInstruction = buildScenarioSystemInstruction(options.scenario);
    const responseSchema = buildScenarioSchema(options.scenario);

    const promptText = JSON.stringify({
      scenario: options.scenario,
      facts: options.facts,
      instructions:
        'Select and order the most accurate approved message IDs substantiating this scenario from the provided facts.',
    });

    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: promptText }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.1,
        maxOutputTokens: 1024,
        thinkingConfig: {
          thinkingLevel: this.thinkingLevel.toUpperCase(),
        },
      },
    };

    const res = await this.fetchFn(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: options.signal,
    });

    if (!res.ok) {
      const status = res.status;
      if (status === 400) {
        throw new Error(`GEMINI_UNSUPPORTED_RESPONSE_SCHEMA: Upstream rejected request schema or parameters (HTTP 400)`);
      } else if (status === 401 || status === 403) {
        throw new Error(`GEMINI_AUTH_ERROR: Authentication failure (HTTP ${status})`);
      } else if (status === 429) {
        throw new Error(`GEMINI_QUOTA_ERROR: Rate limit or quota exceeded (HTTP 429)`);
      } else if (status === 404) {
        throw new Error(`GEMINI_MODEL_ERROR: Model not found or unavailable: ${this.model}`);
      } else {
        throw new Error(`GEMINI_API_ERROR: Upstream API returned HTTP ${status}`);
      }
    }

    const data = await res.json();

    // 1. Validate candidates array presence
    if (!data || !Array.isArray(data.candidates) || data.candidates.length === 0) {
      throw new Error('GEMINI_NO_CANDIDATES: No candidate returned from Gemini');
    }

    const candidate = data.candidates[0];
    if (!candidate || typeof candidate !== 'object') {
      throw new Error('GEMINI_NO_CANDIDATES: Candidate entry is invalid');
    }

    // 2. Check finishReason safely
    if (candidate.finishReason === 'MAX_TOKENS' || candidate.finishReason === 'LENGTH') {
      throw new Error('GEMINI_TRUNCATED_OUTPUT: Model output truncated by maxOutputTokens');
    }

    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      throw new Error(`GEMINI_BLOCKED_ERROR: Response candidate finished with reason ${candidate.finishReason}`);
    }

    // 3. Validate content object
    if (!candidate.content || typeof candidate.content !== 'object') {
      throw new Error('GEMINI_EMPTY_CONTENT: Candidate missing content object');
    }

    // 4. Extract text parts safely, ignoring thought or metadata parts
    if (!Array.isArray(candidate.content.parts) || candidate.content.parts.length === 0) {
      throw new Error('GEMINI_MISSING_TEXT_PART: Candidate parts array missing or empty');
    }

    const textParts = candidate.content.parts
      .filter((p: { text?: unknown; thought?: unknown }) => typeof p?.text === 'string' && !p.thought)
      .map((p: { text: string }) => p.text);

    const rawText = textParts.join('').trim();
    if (!rawText) {
      throw new Error('GEMINI_MISSING_TEXT_PART: Missing or empty content text in candidate parts');
    }

    // 5. Parse JSON safely
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch (_err) {
      throw new Error('GEMINI_JSON_PARSE_FAILED: Failed to parse structured JSON from model output');
    }

    // 6. Validate shape against ExplanationPayload contract
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('GEMINI_SCHEMA_SHAPE_MISMATCH: Model output root is not an object');
    }

    const parsedObj = parsed as Record<string, unknown>;
    if (!Array.isArray(parsedObj.messages)) {
      throw new Error('GEMINI_SCHEMA_SHAPE_MISMATCH: Model output missing messages array');
    }

    for (const msg of parsedObj.messages) {
      if (
        !msg ||
        typeof msg !== 'object' ||
        typeof msg.messageId !== 'string' ||
        !Array.isArray(msg.referencedFactIds) ||
        !msg.referencedFactIds.every((id: unknown) => typeof id === 'string')
      ) {
        throw new Error('GEMINI_SCHEMA_SHAPE_MISMATCH: Message item invalid or missing messageId / referencedFactIds');
      }
    }

    return {
      messages: parsedObj.messages,
    };
  }
}
