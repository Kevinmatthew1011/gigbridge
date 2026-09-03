import { startServer } from './server.ts';
import { MockExplanationAdapter } from './mockAdapter.ts';
import { GeminiExplanationAdapter } from './geminiAdapter.ts';
import { GroqExplanationAdapter } from './groqAdapter.ts';
import { loadServerConfig } from './config.ts';

const config = loadServerConfig();

let adapter = new MockExplanationAdapter();
if (config.provider === 'gemini') {
  adapter = new GeminiExplanationAdapter({
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
    thinkingLevel: config.geminiThinkingLevel,
  }) as any;
} else if (config.provider === 'groq') {
  adapter = new GroqExplanationAdapter({
    apiKey: config.groqApiKey,
    model: config.groqModel,
  }) as any;
}

const modelInfo =
  config.provider === 'gemini'
    ? ` (model: ${config.geminiModel}, thinking: ${config.geminiThinkingLevel})`
    : config.provider === 'groq'
    ? ` (model: ${config.groqModel})`
    : '';

console.log(`[GigBridge Gateway] Initializing provider: ${adapter.name}${modelInfo}`);

startServer(adapter, {
  port: config.port,
  host: config.host,
  adapterTimeoutMs: config.geminiTimeoutMs,
}).catch((err) => {
  console.error('[GigBridge Gateway] Failed to start:', err);
  process.exit(1);
});
