import http from 'node:http';
import type { ExplanationProviderAdapter, ServerOptions } from './types.ts';
import { MockExplanationAdapter } from './mockAdapter.ts';
import { processExplainRequest } from './gateway.ts';

export const DEFAULT_PORT = 3001;
export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_MAX_BODY_SIZE_BYTES = 65536; // 64 KB

/**
 * Creates the local Node HTTP server for the explanation gateway.
 * Allows dependency injection of adapters for testing.
 */
export function createExplanationServer(
  adapter: ExplanationProviderAdapter = new MockExplanationAdapter(),
  options: ServerOptions = {}
): http.Server {
  const maxBodySize = options.maxBodySizeBytes ?? DEFAULT_MAX_BODY_SIZE_BYTES;
  const adapterTimeoutMs = options.adapterTimeoutMs ?? 2000;

  const server = http.createServer(async (req, res) => {
    // Set security and content headers
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

    // Health check endpoint
    if (url.pathname === '/api/health' && req.method === 'GET') {
      res.statusCode = 200;
      res.end(JSON.stringify({ status: 'ok', service: 'gigbridge-explanation-gateway' }));
      return;
    }

    // Main explanation endpoint
    if (url.pathname === '/api/explain') {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end(JSON.stringify({ status: 'error', error: 'Method Not Allowed. Use POST.' }));
        return;
      }

      // Stream body with bounded size check
      let rawBody = '';
      let bodySize = 0;
      let isBodyTooLarge = false;

      req.on('data', (chunk: Buffer) => {
        if (isBodyTooLarge) return;
        bodySize += chunk.length;
        if (bodySize > maxBodySize) {
          isBodyTooLarge = true;
          return;
        }
        rawBody += chunk.toString('utf-8');
      });

      req.on('end', async () => {
        if (isBodyTooLarge) {
          res.statusCode = 413;
          res.end(JSON.stringify({ status: 'error', error: `Payload too large. Maximum size is ${maxBodySize} bytes.` }));
          return;
        }

        let parsedBody: unknown;
        try {
          parsedBody = JSON.parse(rawBody);
        } catch (_parseErr) {
          res.statusCode = 400;
          res.end(JSON.stringify({ status: 'error', error: 'Invalid JSON body.' }));
          return;
        }

        try {
          const { statusCode, response } = await processExplainRequest(parsedBody, adapter, {
            adapterTimeoutMs,
          });
          res.statusCode = statusCode;
          res.end(JSON.stringify(response));
        } catch (_handlerErr) {
          res.statusCode = 500;
          res.end(JSON.stringify({ status: 'error', error: 'Internal server error.' }));
        }
      });

      req.on('error', (_err) => {
        if (!res.headersSent) {
          res.statusCode = 400;
          res.end(JSON.stringify({ status: 'error', error: 'Request stream error.' }));
        }
      });

      return;
    }

    // Route not found
    res.statusCode = 404;
    res.end(JSON.stringify({ status: 'error', error: 'Not Found' }));
  });

  return server;
}

/**
 * Starts the server on the configured port and host.
 */
export function startServer(
  adapter: ExplanationProviderAdapter = new MockExplanationAdapter(),
  options: ServerOptions = {}
): Promise<http.Server> {
  const port = options.port ?? DEFAULT_PORT;
  const host = options.host ?? DEFAULT_HOST;
  const server = createExplanationServer(adapter, options);

  return new Promise((resolve, reject) => {
    server.listen(port, host, () => {
      // Intentionally do not log sensitive data
      console.log(`[GigBridge Gateway] Listening on http://${host}:${port}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}
