import fs from 'node:fs';
import path from 'node:path';

export type GeminiThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

export const ALLOWED_THINKING_LEVELS: ReadonlySet<GeminiThinkingLevel> = new Set([
  'minimal',
  'low',
  'medium',
  'high',
]);

export interface ServerConfig {
  provider: 'mock' | 'gemini' | 'groq';
  geminiApiKey: string | null;
  geminiModel: string;
  geminiThinkingLevel: GeminiThinkingLevel;
  groqApiKey: string | null;
  groqModel: string;
  port: number;
  host: string;
  geminiTimeoutMs: number;
  configSources: {
    provider: 'process.env' | '.env.server' | 'default';
    geminiApiKey: 'process.env' | '.env.server' | 'none';
    geminiModel: 'process.env' | '.env.server' | 'default';
    geminiThinkingLevel: 'process.env' | '.env.server' | 'default';
    groqApiKey: 'process.env' | '.env.server' | 'none';
    groqModel: 'process.env' | '.env.server' | 'default';
  };
}

/**
 * Parses simple KEY=VALUE format from a .env file.
 * Correctly handles quotes, inline comments, CRLF, and surrounding whitespace.
 */
export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalsIdx = trimmed.indexOf('=');
    if (equalsIdx === -1) continue;

    const key = trimmed.slice(0, equalsIdx).trim();
    let val = trimmed.slice(equalsIdx + 1).trim();

    // Strip surrounding single or double quotes
    if (
      (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
      (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
    ) {
      val = val.slice(1, -1);
    } else {
      // If unquoted, strip trailing inline comments
      const commentIdx = val.indexOf('#');
      if (commentIdx !== -1) {
        val = val.slice(0, commentIdx);
      }
    }

    if (key) {
      result[key] = val.trim();
    }
  }

  return result;
}

/**
 * Loads server configuration from .env.server (if present) and environment variables.
 * Never exposes secrets to frontend code or log strings.
 */
export function loadServerConfig(rootDir?: string): ServerConfig {
  const baseDir = rootDir || process.cwd();
  const envServerPath = path.join(baseDir, '.env.server');

  let fileEnv: Record<string, string> = {};
  if (fs.existsSync(envServerPath)) {
    try {
      const content = fs.readFileSync(envServerPath, 'utf8');
      fileEnv = parseEnvFile(content);
    } catch (_err) {
      // Ignore read errors and rely on process.env
    }
  }

  const resolveEnvValue = (
    key: string
  ): { value: string | undefined; source: 'process.env' | '.env.server' | 'default' } => {
    const procVal = process.env[key];
    if (procVal !== undefined && procVal.trim().length > 0) {
      return { value: procVal.trim(), source: 'process.env' };
    }
    const fileVal = fileEnv[key];
    if (fileVal !== undefined && fileVal.trim().length > 0) {
      return { value: fileVal.trim(), source: '.env.server' };
    }
    return { value: undefined, source: 'default' };
  };

  const providerResolution = resolveEnvValue('EXPLAIN_PROVIDER');
  const rawProvider = providerResolution.value?.toLowerCase();
  const provider: 'mock' | 'gemini' | 'groq' =
    rawProvider === 'gemini' ? 'gemini' : rawProvider === 'groq' ? 'groq' : 'mock';

  // Gemini config
  const geminiKeyResolution = resolveEnvValue('GEMINI_API_KEY');
  const geminiApiKey = geminiKeyResolution.value || null;

  const geminiModelResolution = resolveEnvValue('GEMINI_MODEL');
  const geminiModel = geminiModelResolution.value || 'gemini-3.6-flash';

  const thinkingResolution = resolveEnvValue('GEMINI_THINKING_LEVEL');
  const rawThinking = thinkingResolution.value?.toLowerCase() as GeminiThinkingLevel | undefined;
  const geminiThinkingLevel: GeminiThinkingLevel =
    rawThinking && ALLOWED_THINKING_LEVELS.has(rawThinking) ? rawThinking : 'minimal';

  // Groq config
  const groqKeyResolution = resolveEnvValue('GROQ_API_KEY');
  const groqApiKey = groqKeyResolution.value || null;

  const groqModelResolution = resolveEnvValue('GROQ_MODEL');
  const groqModel = groqModelResolution.value || 'openai/gpt-oss-20b';

  const rawPort = resolveEnvValue('PORT').value;
  const port = rawPort ? parseInt(rawPort, 10) || 3001 : 3001;

  const host = resolveEnvValue('HOST').value || '127.0.0.1';

  const rawTimeout = resolveEnvValue('GEMINI_TIMEOUT_MS').value;
  const geminiTimeoutMs = rawTimeout ? parseInt(rawTimeout, 10) || 30000 : 30000;

  return {
    provider,
    geminiApiKey,
    geminiModel,
    geminiThinkingLevel,
    groqApiKey,
    groqModel,
    port,
    host,
    geminiTimeoutMs,
    configSources: {
      provider: providerResolution.source,
      geminiApiKey: geminiKeyResolution.source === 'default' ? 'none' : geminiKeyResolution.source,
      geminiModel: geminiModelResolution.source,
      geminiThinkingLevel: thinkingResolution.source,
      groqApiKey: groqKeyResolution.source === 'default' ? 'none' : groqKeyResolution.source,
      groqModel: groqModelResolution.source,
    },
  };
}
