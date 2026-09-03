import type { ExplanationPayload } from '../src/types/explanation.ts';
import type { ExplanationProviderAdapter, ProviderGenerateOptions } from './types.ts';

export interface GroqAdapterOptions {
  apiKey: string | null;
  model?: string;
  fetchFn?: typeof fetch;
}

function buildScenarioSystemInstruction(scenario: string): string {
  if (scenario === 'baseline_summary') {
    return `You are the structured explanation engine for GigBridge baseline 14-day cash flow analysis.
Your sole function is to select and order approved message IDs that accurately explain the baseline financial facts to the user.
You MUST output strictly structured JSON matching this schema: {"messages": [{"messageId": string, "referencedFactIds": string[]}]}.

APPROVED MESSAGE IDs FOR BASELINE:
1. "baseline_essential_shortfall": Select when FACT_BASELINE_ESSENTIAL_SHORTFALL is present. References ["FACT_BASELINE_ESSENTIAL_SHORTFALL"].
2. "baseline_buffer_gap": Select when FACT_BASELINE_SAFETY_BUFFER is configured (> 0) and essential shortfall exists. References ["FACT_BASELINE_SAFETY_BUFFER", "FACT_BASELINE_ESSENTIAL_SHORTFALL"].
3. "baseline_buffer_only_breach": Select ONLY when no essential shortfall exists but FACT_BASELINE_BUFFER_BREACH is present. References ["FACT_BASELINE_BUFFER_BREACH", "FACT_BASELINE_SAFETY_BUFFER"].
4. "baseline_no_shortfall": Select ONLY when no essential shortfall exists across all 14 days. References [].
5. "baseline_buffer_protected": Select ONLY when cash stays above safety buffer across all 14 days. References [].

CRITICAL CONSTRAINTS:
- If FACT_BASELINE_ESSENTIAL_SHORTFALL is present: You MUST select "baseline_essential_shortfall" and (if safety buffer > 0) "baseline_buffer_gap". You MUST NEVER select "baseline_no_shortfall" or "baseline_buffer_only_breach".
- Output JSON ONLY with the "messages" array. Do NOT generate conversational greetings, explanations, advice, or calculations.`;
  }

  return `You are the structured explanation engine for GigBridge single gig simulation preview.
Your sole function is to select and order approved message IDs that accurately explain the gig impact facts to the user.
You MUST output strictly structured JSON matching this schema: {"messages": [{"messageId": string, "referencedFactIds": string[]}]}.

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
- Output JSON ONLY with the "messages" array. Do NOT generate conversational greetings, explanations, advice, or calculations.`;
}

/**
 * Server-only Groq Provider Adapter.
 * Invokes Groq OpenAI-compatible Chat Completions API with JSON mode.
 * Never logs raw payloads, model text, or secrets.
 */
export class GroqExplanationAdapter implements ExplanationProviderAdapter {
  public readonly name = 'groq';
  private readonly apiKey: string | null;
  private readonly model: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: GroqAdapterOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model || 'openai/gpt-oss-20b';
    this.fetchFn = options.fetchFn || globalThis.fetch;
  }

  public async generateExplanation(options: ProviderGenerateOptions): Promise<ExplanationPayload> {
    if (!this.apiKey) {
      throw new Error('GROQ_CONFIG_ERROR: Missing GROQ_API_KEY on server');
    }

    const endpointUrl = 'https://api.groq.com/openai/v1/chat/completions';
    const systemInstruction = buildScenarioSystemInstruction(options.scenario);

    const promptText = JSON.stringify({
      scenario: options.scenario,
      facts: options.facts,
      instructions:
        'Select and order the most accurate approved message IDs substantiating this scenario from the provided facts. Respond with strictly valid JSON matching {"messages": [{"messageId": string, "referencedFactIds": string[]}]}.',
    });

    const requestBody = {
      model: this.model,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: promptText },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 1024,
    };

    const res = await this.fetchFn(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: options.signal,
    });

    if (!res.ok) {
      const status = res.status;
      if (status === 401 || status === 403) {
        throw new Error(`GROQ_AUTH_ERROR: Authentication failure (HTTP ${status})`);
      } else if (status === 429) {
        throw new Error(`GROQ_QUOTA_ERROR: Rate limit or quota exceeded (HTTP 429)`);
      } else if (status === 404) {
        throw new Error(`GROQ_MODEL_ERROR: Model not found or unavailable: ${this.model}`);
      } else {
        throw new Error(`GROQ_API_ERROR: Upstream API returned HTTP ${status}`);
      }
    }

    const data = await res.json();

    // 1. Validate choices array presence
    if (!data || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error('GROQ_NO_CHOICES: No choices returned from Groq');
    }

    const choice = data.choices[0];
    if (!choice || typeof choice !== 'object') {
      throw new Error('GROQ_NO_CHOICES: Choice entry is invalid');
    }

    if (choice.finish_reason === 'length') {
      throw new Error('GROQ_TRUNCATED_OUTPUT: Model output truncated by max_tokens');
    }

    const rawContent = choice.message?.content;
    if (typeof rawContent !== 'string' || !rawContent.trim()) {
      throw new Error('GROQ_EMPTY_CONTENT: Missing or empty content text in choice message');
    }

    // 2. Parse JSON safely
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent.trim());
    } catch (_err) {
      throw new Error('GROQ_JSON_PARSE_FAILED: Failed to parse structured JSON from Groq output');
    }

    // 3. Validate shape against ExplanationPayload contract
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('GROQ_SCHEMA_SHAPE_MISMATCH: Groq output root is not an object');
    }

    const parsedObj = parsed as Record<string, unknown>;
    if (!Array.isArray(parsedObj.messages)) {
      throw new Error('GROQ_SCHEMA_SHAPE_MISMATCH: Groq output missing messages array');
    }

    for (const msg of parsedObj.messages) {
      if (
        !msg ||
        typeof msg !== 'object' ||
        typeof msg.messageId !== 'string' ||
        !Array.isArray(msg.referencedFactIds) ||
        !msg.referencedFactIds.every((id: unknown) => typeof id === 'string')
      ) {
        throw new Error('GROQ_SCHEMA_SHAPE_MISMATCH: Message item invalid or missing messageId / referencedFactIds');
      }
    }

    return {
      messages: parsedObj.messages,
    };
  }
}
