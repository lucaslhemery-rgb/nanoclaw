import http from 'http';
import fs from 'fs';
import path from 'path';

import {
  WEBHOOK_BODY_LIMIT_BYTES,
  WEBHOOK_HOST,
  WEBHOOK_PORT,
} from './config.js';
import { logger } from './logger.js';
import type { WebhookDeps, WebhookHandler } from './types.js';
import {
  getRegisteredWebhookSources,
  getWebhookHandler,
} from './webhooks/registry.js';

const WEBHOOK_DLQ_DIR = path.join(process.cwd(), 'data', 'webhook-dlq');
const WEBHOOK_RETRY_DELAYS_MS = [0, 5000, 15000];

async function handleWithRetry(
  source: string,
  handler: WebhookHandler,
  payload: unknown,
  headers: Record<string, string | undefined>,
  deps: WebhookDeps,
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < WEBHOOK_RETRY_DELAYS_MS.length; attempt++) {
    if (WEBHOOK_RETRY_DELAYS_MS[attempt] > 0) {
      await new Promise((r) => setTimeout(r, WEBHOOK_RETRY_DELAYS_MS[attempt]));
    }
    try {
      await handler.handle(payload, deps);
      if (attempt > 0) {
        logger.info(
          { source, attempt },
          'Webhook handler succeeded after retry',
        );
      }
      return;
    } catch (err) {
      lastErr = err;
      logger.warn(
        { source, attempt, err },
        'Webhook handler attempt failed, will retry',
      );
    }
  }
  // Final failure : dump to DLQ for manual replay.
  try {
    fs.mkdirSync(WEBHOOK_DLQ_DIR, { recursive: true });
    const filename = `${source}-${Date.now()}.json`;
    fs.writeFileSync(
      path.join(WEBHOOK_DLQ_DIR, filename),
      JSON.stringify(
        {
          source,
          timestamp: new Date().toISOString(),
          headers,
          payload,
          error: lastErr instanceof Error ? lastErr.message : String(lastErr),
        },
        null,
        2,
      ),
    );
    logger.error(
      { source, filename, err: lastErr },
      'Webhook handler failed after retries, written to DLQ',
    );
  } catch (dlqErr) {
    logger.error(
      { source, err: dlqErr, originalErr: lastErr },
      'Failed to write webhook to DLQ — message lost',
    );
  }
}

// Route pattern: POST /webhooks/:source
const ROUTE_PATTERN = /^\/webhooks\/([a-z0-9_-]+)\/?$/i;

function readBody(req: http.IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;

    req.on('data', (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > limit) {
        req.destroy();
        reject(new Error(`Body exceeds limit of ${limit} bytes`));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function getHeaders(
  req: http.IncomingMessage,
): Record<string, string | undefined> {
  const headers: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    headers[key] = Array.isArray(value) ? value[0] : value;
  }
  return headers;
}

export function startWebhookServer(deps: WebhookDeps): http.Server {
  const server = http.createServer(async (req, res) => {
    // Health check
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          sources: getRegisteredWebhookSources(),
        }),
      );
      return;
    }

    // Only accept POST
    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end('Method Not Allowed');
      return;
    }

    // Match route
    const match = req.url && ROUTE_PATTERN.exec(req.url);
    if (!match) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const source = match[1].toLowerCase();
    const handler = getWebhookHandler(source);
    if (!handler) {
      logger.warn({ source }, 'No webhook handler registered for source');
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    let rawBody: Buffer;
    try {
      rawBody = await readBody(req, WEBHOOK_BODY_LIMIT_BYTES);
    } catch (err) {
      logger.warn({ source, err }, 'Failed to read webhook body');
      res.writeHead(413);
      res.end('Payload Too Large');
      return;
    }

    // Verify signature
    const headers = getHeaders(req);
    if (!handler.verify(headers, rawBody)) {
      logger.warn({ source }, 'Webhook signature verification failed');
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    // Respond 200 immediately
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');

    // Fire-and-forget: parse and handle in background with retry + DLQ.
    try {
      const payload: unknown = JSON.parse(rawBody.toString('utf-8'));
      handleWithRetry(source, handler, payload, headers, deps).catch((err) => {
        logger.error({ source, err }, 'Webhook retry wrapper crashed');
      });
    } catch (err) {
      logger.error({ source, err }, 'Failed to parse webhook body as JSON');
    }
  });

  server.listen(WEBHOOK_PORT, WEBHOOK_HOST, () => {
    logger.info(
      { port: WEBHOOK_PORT, host: WEBHOOK_HOST },
      'Webhook server listening',
    );
  });

  return server;
}
