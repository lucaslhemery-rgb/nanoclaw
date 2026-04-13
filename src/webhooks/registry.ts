import type { WebhookHandler } from '../types.js';

const handlers = new Map<string, WebhookHandler>();

export function registerWebhook(source: string, handler: WebhookHandler): void {
  handlers.set(source, handler);
}

export function getWebhookHandler(source: string): WebhookHandler | undefined {
  return handlers.get(source);
}

export function getRegisteredWebhookSources(): string[] {
  return [...handlers.keys()];
}
